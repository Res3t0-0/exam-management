// routes/questions.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all questions
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT q.*, e.title AS exam_title
      FROM QUESTION q
      LEFT JOIN EXAM e ON q.exam_ID = e.exam_ID
      ORDER BY q.exam_ID, q.question_ID
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET question by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM QUESTION WHERE question_ID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create question
router.post('/', async (req, res) => {
  const { question_text, question_type, marks, exam_ID } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO QUESTION (question_text, question_type, marks, exam_ID) VALUES (?, ?, ?, ?)',
      [question_text, question_type, marks, exam_ID || null]
    );
    res.status(201).json({ message: 'Question created', question_ID: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update question
router.put('/:id', async (req, res) => {
  const { question_text, question_type, marks, exam_ID } = req.body;
  try {
    await db.query(
      'UPDATE QUESTION SET question_text=?, question_type=?, marks=?, exam_ID=? WHERE question_ID=?',
      [question_text, question_type, marks, exam_ID, req.params.id]
    );
    res.json({ message: 'Question updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE question
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM QUESTION WHERE question_ID = ?', [req.params.id]);
    res.json({ message: 'Question deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
