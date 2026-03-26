// routes/courses.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all courses (JOIN with INSTRUCTOR and USER)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.course_ID, c.course_name, c.credits, c.department,
             c.instructor_code, u.name AS instructor_name
      FROM COURSE c
      LEFT JOIN INSTRUCTOR i ON c.instructor_code = i.instructor_code
      LEFT JOIN USER u ON i.user_ID = u.user_ID
      ORDER BY c.course_ID
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET course by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*, u.name AS instructor_name
      FROM COURSE c
      LEFT JOIN INSTRUCTOR i ON c.instructor_code = i.instructor_code
      LEFT JOIN USER u ON i.user_ID = u.user_ID
      WHERE c.course_ID = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Course not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create course
router.post('/', async (req, res) => {
  const { course_ID, course_name, credits, department, instructor_code } = req.body;
  try {
    await db.query(
      'INSERT INTO COURSE (course_ID, course_name, credits, department, instructor_code) VALUES (?, ?, ?, ?, ?)',
      [course_ID, course_name, credits, department, instructor_code || null]
    );
    res.status(201).json({ message: 'Course created', course_ID });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update course
router.put('/:id', async (req, res) => {
  const { course_name, credits, department, instructor_code } = req.body;
  try {
    await db.query(
      'UPDATE COURSE SET course_name=?, credits=?, department=?, instructor_code=? WHERE course_ID=?',
      [course_name, credits, department, instructor_code, req.params.id]
    );
    res.json({ message: 'Course updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE course
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM COURSE WHERE course_ID = ?', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
