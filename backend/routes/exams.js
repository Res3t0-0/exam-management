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

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!exam_date || isNaN(Date.parse(exam_date))) {
    return res.status(400).json({ error: 'valid exam_date (YYYY-MM-DD) is required' });
  }
  const dur = Number(duration);
  if (isNaN(dur) || dur <= 0) {
    return res.status(400).json({ error: 'duration must be a positive integer in minutes' });
  }
  const tm = Number(total_marks);
  if (isNaN(tm) || tm <= 0) {
    return res.status(400).json({ error: 'total_marks must be a positive number' });
  }

  try {
    if (course_ID) {
      const [courses] = await db.query('SELECT course_ID FROM COURSE WHERE course_ID = ?', [course_ID]);
      if (!courses.length) return res.status(404).json({ error: `Course '${course_ID}' not found` });
    }

    const [result] = await db.query(
      'INSERT INTO EXAM (title, exam_date, duration, total_marks, course_ID) VALUES (?, ?, ?, ?, ?)',
      [title.trim(), exam_date, dur, tm, course_ID || null]
    );
    res.status(201).json({ message: 'Exam created', exam_ID: result.insertId });
  } catch (err) {
    if (err.errno === 3819 || err.errno === 4025) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT update exam
router.put('/:id', async (req, res) => {
  const { title, exam_date, duration, total_marks, course_ID } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!exam_date || isNaN(Date.parse(exam_date))) {
    return res.status(400).json({ error: 'valid exam_date (YYYY-MM-DD) is required' });
  }
  const dur = Number(duration);
  if (isNaN(dur) || dur <= 0) {
    return res.status(400).json({ error: 'duration must be a positive integer in minutes' });
  }
  const tm = Number(total_marks);
  if (isNaN(tm) || tm <= 0) {
    return res.status(400).json({ error: 'total_marks must be a positive number' });
  }

  try {
    if (course_ID) {
      const [courses] = await db.query('SELECT course_ID FROM COURSE WHERE course_ID = ?', [course_ID]);
      if (!courses.length) return res.status(404).json({ error: `Course '${course_ID}' not found` });
    }

    const [r] = await db.query(
      'UPDATE EXAM SET title=?, exam_date=?, duration=?, total_marks=?, course_ID=? WHERE exam_ID=?',
      [title.trim(), exam_date, dur, tm, course_ID || null, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Exam not found' });
    res.json({ message: 'Exam updated' });
  } catch (err) {
    if (err.errno === 3819 || err.errno === 4025) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE exam
router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM EXAM WHERE exam_ID = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Exam not found' });
    res.json({ message: 'Exam deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST auto-grade an exam: runs the stored procedure sp_grade_exam
router.post('/:id/grade', async (req, res) => {
  try {
    const [sets] = await db.query('CALL sp_grade_exam(?)', [req.params.id]);
    const distribution = Array.isArray(sets[0]) ? sets[0] : [];
    const graded = distribution.reduce((n, r) => n + Number(r.students), 0);
    res.json({ message: `Graded ${graded} result(s)`, graded, distribution });
  } catch (err) {
    if (err.sqlState === '45000') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
