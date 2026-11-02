// routes/attempts.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ── Grade Calculation Logic (relative grading) ──────────────
// avg = class average, sd = class standard deviation.
// Marks below PASS_MARK are always Fail. Otherwise the grade comes from the
// band the marks fall in (lower bound of each band is inclusive):
//   S : marks >= avg + 1.5*sd
//   A : avg + 0.5*sd <= marks < avg + 1.5*sd
//   B : avg - 0.5*sd <= marks < avg + 0.5*sd
//   C : avg - 1.5*sd <= marks < avg - 0.5*sd
//   D : avg - 2.0*sd <= marks < avg - 1.5*sd
//   E : marks < avg - 2.0*sd
const PASS_MARK = 50;

function calculateGrade(marks, avg, sd) {
  if (marks < PASS_MARK) return { grade: 'Fail', status: 'Fail' };
  // round to 6 dp so floating point noise can't push a boundary mark into the wrong band
  const cut = k => Math.round((avg + k * sd) * 1e6) / 1e6;
  let grade;
  if      (marks >= cut(1.5))  grade = 'S';
  else if (marks >= cut(0.5))  grade = 'A';
  else if (marks >= cut(-0.5)) grade = 'B';
  else if (marks >= cut(-1.5)) grade = 'C';
  else if (marks >= cut(-2))   grade = 'D';
  else                         grade = 'E';
  return { grade, status: 'Pass' };
}

// Returns an error message, or null if marks / class average / SD are usable.
function checkGradeInputs(marks, avg, sd) {
  if ([marks, avg, sd].some(n => typeof n !== 'number' || !Number.isFinite(n)))
    return 'marks_obtained, class_average and std_dev must all be numbers';
  if (marks < 0)  return 'marks_obtained cannot be negative';
  if (avg < 0)    return 'class_average cannot be negative';
  if (sd <= 0)    return 'std_dev must be greater than 0';
  return null;
}

// Request values may arrive as strings from forms; missing values stay NaN.
const toNum = v => (v === undefined || v === null || v === '') ? NaN : Number(v);

// GET all attempts (with student and exam info)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.attempt_ID, a.reg_no, u.name AS student_name,
             a.exam_ID, e.title AS exam_title,
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
      SELECT a.*, u.name AS student_name, e.title AS exam_title
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
  try {
    const [result] = await db.query(
      'INSERT INTO ATTEMPT (reg_no, exam_ID, start_time, submit_time, score) VALUES (?, ?, ?, ?, ?)',
      [reg_no, exam_ID, start_time || null, submit_time || null, score || 0]
    );
    res.status(201).json({ message: 'Attempt created', attempt_ID: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update attempt
router.put('/:id', async (req, res) => {
  const { start_time, submit_time, score } = req.body;
  try {
    await db.query(
      'UPDATE ATTEMPT SET start_time=?, submit_time=?, score=? WHERE attempt_ID=?',
      [start_time, submit_time, score, req.params.id]
    );
    res.json({ message: 'Attempt updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE attempt
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM ATTEMPT WHERE attempt_ID = ?', [req.params.id]);
    res.json({ message: 'Attempt deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
// RESULTS ROUTES (nested under attempts for simplicity)
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
      SELECT r.*, u.name AS student_name, e.title AS exam_title
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

// POST create result (auto-calculates grade from marks, class average and SD)
router.post('/results', async (req, res) => {
  const { attempt_ID } = req.body;
  if (!attempt_ID)
    return res.status(400).json({ error: 'attempt_ID, marks_obtained, class_average and std_dev are required' });

  const marks = toNum(req.body.marks_obtained);
  const avg   = toNum(req.body.class_average);
  const sd    = toNum(req.body.std_dev);
  const bad = checkGradeInputs(marks, avg, sd);
  if (bad) return res.status(400).json({ error: bad });

  const { grade, status } = calculateGrade(marks, avg, sd);

  try {
    const [result] = await db.query(
      'INSERT INTO RESULT (attempt_ID, marks_obtained, class_average, std_dev, grade, status) VALUES (?, ?, ?, ?, ?, ?)',
      [attempt_ID, marks, avg, sd, grade, status]
    );
    // Also update score in ATTEMPT
    await db.query('UPDATE ATTEMPT SET score = ? WHERE attempt_ID = ?', [marks, attempt_ID]);
    res.status(201).json({
      message: 'Result created',
      result_ID: result.insertId,
      grade,
      status
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: `Attempt ${attempt_ID} already has a result` });
    if (err.code === 'ER_NO_REFERENCED_ROW_2')
      return res.status(404).json({ error: `Attempt ${attempt_ID} not found` });
    res.status(500).json({ error: err.message });
  }
});

// PUT update result (recalculates grade). Any field left out keeps its stored value.
router.put('/results/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM RESULT WHERE result_ID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Result not found' });

    const pick = (key) => toNum(req.body[key] !== undefined && req.body[key] !== '' ? req.body[key] : rows[0][key]);
    const marks = pick('marks_obtained');
    const avg   = pick('class_average');
    const sd    = pick('std_dev');
    const bad = checkGradeInputs(marks, avg, sd);
    if (bad) return res.status(400).json({ error: bad });

    const { grade, status } = calculateGrade(marks, avg, sd);
    await db.query(
      'UPDATE RESULT SET marks_obtained=?, class_average=?, std_dev=?, grade=?, status=? WHERE result_ID=?',
      [marks, avg, sd, grade, status, req.params.id]
    );
    await db.query('UPDATE ATTEMPT SET score = ? WHERE attempt_ID = ?', [marks, rows[0].attempt_ID]);
    res.json({ message: 'Result updated', grade, status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE result
router.delete('/results/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM RESULT WHERE result_ID = ?', [req.params.id]);
    res.json({ message: 'Result deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
