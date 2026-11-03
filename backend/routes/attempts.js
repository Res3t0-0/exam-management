// routes/attempts.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ── Grading ──────────────────────────────────────────────────
// Grades are derived by the database triggers trg_result_bi / trg_result_bu calling fn_grade().
// When RESULT is inserted/updated, ATTEMPT.score is synchronized.
// When ATTEMPT.score is updated, any existing RESULT.marks_obtained is synchronized inside a transaction.

// Maps database errors (triggers, constraints) to proper HTTP responses
function sendDbError(res, err) {
  // business rule raised by a trigger / stored procedure via SIGNAL SQLSTATE '45000'
  if (err.sqlState === '45000') return res.status(400).json({ error: err.message });
  // CHECK constraint (MySQL 8 = 3819, MariaDB = 4025)
  if (err.errno === 3819 || err.errno === 4025) return res.status(400).json({ error: err.message });
  if (err.code === 'ER_DUP_ENTRY') {
    const msg = /uq_attempt_student_exam/.test(err.message)
      ? 'Duplicate entry: this student already has an attempt for this exam'
      : err.message;
    return res.status(409).json({ error: msg });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2')
    return res.status(404).json({ error: 'Referenced student, exam or attempt does not exist' });
  res.status(500).json({ error: err.message });
}

// Runs fn(conn) inside one transaction: commit if it resolves, roll back if it throws
async function withTransaction(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Returns an error message, or null if marks / class average / SD are usable.
function checkGradeInputs(marks, avg, sd) {
  if ([marks, avg, sd].some(n => typeof n !== 'number' || !Number.isFinite(n)))
    return 'marks_obtained, class_average and std_dev must all be numbers';
  if (marks < 0)  return 'marks_obtained cannot be negative';
  if (avg < 0)    return 'class_average cannot be negative';
  if (sd < 0)     return 'std_dev cannot be negative';
  return null;
}

// Request values may arrive as strings from forms; missing values stay NaN.
const toNum = v => (v === undefined || v === null || v === '') ? NaN : Number(v);

// GET all attempts (with student and exam info)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.attempt_ID, a.reg_no, u.name AS student_name,
             a.exam_ID, e.title AS exam_title, e.total_marks,
             a.start_time, a.submit_time, a.score
      FROM ATTEMPT a
      JOIN STUDENT s  ON a.reg_no  = s.reg_no
      JOIN USER u     ON s.user_ID = u.user_ID
      JOIN EXAM e     ON a.exam_ID = e.exam_ID
      ORDER BY a.attempt_ID
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET attempt by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, u.name AS student_name, e.title AS exam_title, e.total_marks
      FROM ATTEMPT a
      JOIN STUDENT s ON a.reg_no = s.reg_no
      JOIN USER u ON s.user_ID = u.user_ID
      JOIN EXAM e ON a.exam_ID = e.exam_ID
      WHERE a.attempt_ID = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Attempt not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create attempt
router.post('/', async (req, res) => {
  const { reg_no, exam_ID, start_time, submit_time, score } = req.body;

  if (!reg_no || !String(reg_no).trim()) {
    return res.status(400).json({ error: 'reg_no is required' });
  }
  if (!exam_ID || isNaN(Number(exam_ID))) {
    return res.status(400).json({ error: 'valid exam_ID is required' });
  }
  const numScore = score !== undefined && score !== null && score !== '' ? Number(score) : 0;
  if (isNaN(numScore) || numScore < 0) {
    return res.status(400).json({ error: 'score cannot be negative' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO ATTEMPT (reg_no, exam_ID, start_time, submit_time, score) VALUES (?, ?, ?, ?, ?)',
      [reg_no.trim(), exam_ID, start_time || null, submit_time || null, numScore]
    );
    res.status(201).json({ message: 'Attempt created', attempt_ID: result.insertId });
  } catch (err) { sendDbError(res, err); }
});

// PUT update attempt: score changes also update RESULT.marks_obtained if a RESULT exists
router.put('/:id', async (req, res) => {
  const { start_time, submit_time, score } = req.body;

  try {
    await withTransaction(async conn => {
      const [attempts] = await conn.query('SELECT * FROM ATTEMPT WHERE attempt_ID = ?', [req.params.id]);
      if (!attempts.length) {
        const err = new Error('Attempt not found');
        err.statusCode = 404;
        throw err;
      }

      const existingAttempt = attempts[0];
      const newScore = score !== undefined && score !== null && score !== ''
        ? Number(score)
        : existingAttempt.score;

      if (isNaN(newScore) || newScore < 0) {
        const err = new Error('Score must be a non-negative number');
        err.sqlState = '45000';
        throw err;
      }

      // 1. Update the ATTEMPT record
      await conn.query(
        'UPDATE ATTEMPT SET start_time=?, submit_time=?, score=? WHERE attempt_ID=?',
        [
          start_time !== undefined ? (start_time || null) : existingAttempt.start_time,
          submit_time !== undefined ? (submit_time || null) : existingAttempt.submit_time,
          newScore,
          req.params.id
        ]
      );

      // 2. Synchronize RESULT.marks_obtained if a result already exists for this attempt
      const [results] = await conn.query('SELECT result_ID, class_average, std_dev FROM RESULT WHERE attempt_ID = ?', [req.params.id]);
      if (results.length > 0) {
        await conn.query(
          'UPDATE RESULT SET marks_obtained=? WHERE attempt_ID=?',
          [newScore, req.params.id]
        );
      }
    });

    res.json({ message: 'Attempt updated (and synchronized with result if present)' });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    sendDbError(res, err);
  }
});

// DELETE attempt
router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM ATTEMPT WHERE attempt_ID = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Attempt not found' });
    res.json({ message: 'Attempt deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
// RESULTS ROUTES
// ─────────────────────────────────────────────────────────────

// GET all results (with student and exam details)
router.get('/results/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.result_ID, r.attempt_ID, r.marks_obtained,
             r.class_average, r.std_dev, r.grade, r.status,
             a.reg_no, u.name AS student_name,
             e.title AS exam_title, e.total_marks
      FROM RESULT r
      JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
      JOIN STUDENT s ON a.reg_no = s.reg_no
      JOIN USER u    ON s.user_ID = u.user_ID
      JOIN EXAM e    ON a.exam_ID = e.exam_ID
      ORDER BY r.result_ID
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET result by result_ID
router.get('/results/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.*, u.name AS student_name, e.title AS exam_title, e.total_marks
      FROM RESULT r
      JOIN ATTEMPT a ON r.attempt_ID = a.attempt_ID
      JOIN STUDENT s ON a.reg_no = s.reg_no
      JOIN USER u    ON s.user_ID = u.user_ID
      JOIN EXAM e    ON a.exam_ID = e.exam_ID
      WHERE r.result_ID = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Result not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create result. Send attempt_ID, marks_obtained, class_average, std_dev.
// Grade and status are computed by triggers via fn_grade().
// Synchronizes ATTEMPT.score atomically.
router.post('/results', async (req, res) => {
  const { attempt_ID } = req.body;
  if (!attempt_ID)
    return res.status(400).json({ error: 'attempt_ID, marks_obtained, class_average and std_dev are required' });

  const marks = toNum(req.body.marks_obtained);
  const avg   = toNum(req.body.class_average);
  const sd    = toNum(req.body.std_dev);
  const bad   = checkGradeInputs(marks, avg, sd);
  if (bad) return res.status(400).json({ error: bad });

  try {
    const out = await withTransaction(async conn => {
      const [ins] = await conn.query(
        'INSERT INTO RESULT (attempt_ID, marks_obtained, class_average, std_dev, grade, status) VALUES (?, ?, ?, ?, ?, ?)',
        [attempt_ID, marks, avg, sd, 'Fail', 'Fail'] // triggers will set real grade and status
      );
      // Synchronize score in ATTEMPT
      await conn.query('UPDATE ATTEMPT SET score = ? WHERE attempt_ID = ?', [marks, attempt_ID]);
      const [[row]] = await conn.query('SELECT grade, status FROM RESULT WHERE result_ID = ?', [ins.insertId]);
      return { result_ID: ins.insertId, grade: row.grade, status: row.status };
    });
    res.status(201).json({ message: 'Result created', ...out });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: `Attempt ${attempt_ID} already has a result` });
    if (err.code === 'ER_NO_REFERENCED_ROW_2')
      return res.status(404).json({ error: `Attempt ${attempt_ID} not found` });
    sendDbError(res, err);
  }
});

// PUT update result (triggers recalculate grade; updates ATTEMPT.score)
router.put('/results/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM RESULT WHERE result_ID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Result not found' });

    const pick = (key) => toNum(req.body[key] !== undefined && req.body[key] !== '' ? req.body[key] : rows[0][key]);
    const marks = pick('marks_obtained');
    const avg   = pick('class_average');
    const sd    = pick('std_dev');
    const bad   = checkGradeInputs(marks, avg, sd);
    if (bad) return res.status(400).json({ error: bad });

    const out = await withTransaction(async conn => {
      await conn.query(
        'UPDATE RESULT SET marks_obtained=?, class_average=?, std_dev=? WHERE result_ID=?',
        [marks, avg, sd, req.params.id]
      );
      // Synchronize score in ATTEMPT
      await conn.query('UPDATE ATTEMPT SET score = ? WHERE attempt_ID = ?', [marks, rows[0].attempt_ID]);
      const [[row]] = await conn.query('SELECT grade, status FROM RESULT WHERE result_ID = ?', [req.params.id]);
      return row;
    });
    res.json({ message: 'Result updated', grade: out.grade, status: out.status });
  } catch (err) { sendDbError(res, err); }
});

// DELETE result (logged in RESULT_AUDIT by trigger trg_result_ad)
router.delete('/results/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM RESULT WHERE result_ID = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Result not found' });
    res.json({ message: 'Result deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
