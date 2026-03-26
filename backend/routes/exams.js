// routes/exams.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all exams
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*, c.course_name
      FROM EXAM e
      LEFT JOIN COURSE c ON e.course_ID = c.course_ID
      ORDER BY e.exam_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET exam by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*, c.course_name
      FROM EXAM e LEFT JOIN COURSE c ON e.course_ID = c.course_ID
      WHERE e.exam_ID = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Exam not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET questions for an exam
router.get('/:id/questions', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM QUESTION WHERE exam_ID = ? ORDER BY question_ID',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create exam
router.post('/', async (req, res) => {
  const { title, exam_date, duration, total_marks, course_ID } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO EXAM (title, exam_date, duration, total_marks, course_ID) VALUES (?, ?, ?, ?, ?)',
      [title, exam_date, duration, total_marks, course_ID || null]
    );
    res.status(201).json({ message: 'Exam created', exam_ID: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update exam
router.put('/:id', async (req, res) => {
  const { title, exam_date, duration, total_marks, course_ID } = req.body;
  try {
    await db.query(
      'UPDATE EXAM SET title=?, exam_date=?, duration=?, total_marks=?, course_ID=? WHERE exam_ID=?',
      [title, exam_date, duration, total_marks, course_ID, req.params.id]
    );
    res.json({ message: 'Exam updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE exam
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM EXAM WHERE exam_ID = ?', [req.params.id]);
    res.json({ message: 'Exam deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
