// routes/attempts.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ── Grade Calculation Logic ─────────────────────────────────
function calculateGrade(marks) {
  if (marks >= 90) return { grade: 'A', status: 'Pass' };
  if (marks >= 75) return { grade: 'B', status: 'Pass' };
  if (marks >= 50) return { grade: 'C', status: 'Pass' };
  return { grade: 'Fail', status: 'Fail' };
}

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
      SELECT r.result_ID, r.attempt_ID, r.marks_obtained, r.grade, r.status,
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

// POST create result (auto-calculates grade)
router.post('/results', async (req, res) => {
  const { attempt_ID, marks_obtained } = req.body;
  if (!attempt_ID || marks_obtained === undefined)
    return res.status(400).json({ error: 'attempt_ID and marks_obtained are required' });

  const { grade, status } = calculateGrade(parseFloat(marks_obtained));

  try {
    const [result] = await db.query(
      'INSERT INTO RESULT (attempt_ID, marks_obtained, grade, status) VALUES (?, ?, ?, ?)',
      [attempt_ID, marks_obtained, grade, status]
    );
    // Also update score in ATTEMPT
    await db.query('UPDATE ATTEMPT SET score = ? WHERE attempt_ID = ?', [marks_obtained, attempt_ID]);
    res.status(201).json({
      message: 'Result created',
      result_ID: result.insertId,
      grade,
      status
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update result (recalculates grade)
router.put('/results/:id', async (req, res) => {
  const { marks_obtained } = req.body;
  const { grade, status } = calculateGrade(parseFloat(marks_obtained));
  try {
    await db.query(
      'UPDATE RESULT SET marks_obtained=?, grade=?, status=? WHERE result_ID=?',
      [marks_obtained, grade, status, req.params.id]
    );
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
