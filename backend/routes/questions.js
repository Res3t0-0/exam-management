// routes/questions.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

const VALID_TYPES = ['MCQ', 'Short Answer', 'True/False', 'Long Answer'];

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

  if (!exam_ID || isNaN(Number(exam_ID)) || Number(exam_ID) <= 0) {
    return res.status(400).json({ error: 'A valid exam_ID is required' });
  }
  if (!question_text || !String(question_text).trim()) {
    return res.status(400).json({ error: 'question_text is required' });
  }
  if (!question_type || !VALID_TYPES.includes(question_type)) {
    return res.status(400).json({ error: `question_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const numMarks = Number(marks);
  if (isNaN(numMarks) || numMarks <= 0) {
    return res.status(400).json({ error: 'marks must be a positive number' });
  }

  try {
    // Verify exam exists
    const [exams] = await db.query('SELECT exam_ID FROM EXAM WHERE exam_ID = ?', [exam_ID]);
    if (!exams.length) return res.status(404).json({ error: `Exam with ID ${exam_ID} not found` });

    const [result] = await db.query(
      'INSERT INTO QUESTION (question_text, question_type, marks, exam_ID) VALUES (?, ?, ?, ?)',
      [question_text.trim(), question_type, numMarks, exam_ID]
    );
    res.status(201).json({ message: 'Question created', question_ID: result.insertId });
  } catch (err) {
    if (err.errno === 3819 || err.errno === 4025) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update question
router.put('/:id', async (req, res) => {
  const { question_text, question_type, marks, exam_ID } = req.body;

  if (!exam_ID || isNaN(Number(exam_ID)) || Number(exam_ID) <= 0) {
    return res.status(400).json({ error: 'A valid exam_ID is required' });
  }
  if (!question_text || !String(question_text).trim()) {
    return res.status(400).json({ error: 'question_text is required' });
  }
  if (!question_type || !VALID_TYPES.includes(question_type)) {
    return res.status(400).json({ error: `question_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const numMarks = Number(marks);
  if (isNaN(numMarks) || numMarks <= 0) {
    return res.status(400).json({ error: 'marks must be a positive number' });
  }

  try {
    const [r] = await db.query(
      'UPDATE QUESTION SET question_text=?, question_type=?, marks=?, exam_ID=? WHERE question_ID=?',
      [question_text.trim(), question_type, numMarks, exam_ID, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question updated' });
  } catch (err) {
    if (err.errno === 3819 || err.errno === 4025) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE question
router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM QUESTION WHERE question_ID = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
