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

  if (!course_ID || !/^[A-Z0-9_-]{3,20}$/.test(String(course_ID).trim())) {
    return res.status(400).json({ error: 'course_ID must be 3-20 uppercase alphanumeric characters' });
  }
  if (!course_name || !String(course_name).trim()) {
    return res.status(400).json({ error: 'course_name is required' });
  }
  const numCredits = Number(credits);
  if (isNaN(numCredits) || numCredits < 1 || numCredits > 10) {
    return res.status(400).json({ error: 'credits must be an integer between 1 and 10' });
  }
  if (!department || !String(department).trim()) {
    return res.status(400).json({ error: 'department is required' });
  }

  try {
    if (instructor_code) {
      const [ins] = await db.query('SELECT instructor_code FROM INSTRUCTOR WHERE instructor_code = ?', [instructor_code]);
      if (!ins.length) return res.status(404).json({ error: `Instructor '${instructor_code}' does not exist` });
    }

    await db.query(
      'INSERT INTO COURSE (course_ID, course_name, credits, department, instructor_code) VALUES (?, ?, ?, ?, ?)',
      [course_ID.trim(), course_name.trim(), numCredits, department.trim(), instructor_code || null]
    );
    res.status(201).json({ message: 'Course created', course_ID: course_ID.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'course_ID already exists' });
    if (err.errno === 3819 || err.errno === 4025) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT update course
router.put('/:id', async (req, res) => {
  const { course_name, credits, department, instructor_code } = req.body;

  if (!course_name || !String(course_name).trim()) {
    return res.status(400).json({ error: 'course_name is required' });
  }
  const numCredits = Number(credits);
  if (isNaN(numCredits) || numCredits < 1 || numCredits > 10) {
    return res.status(400).json({ error: 'credits must be an integer between 1 and 10' });
  }
  if (!department || !String(department).trim()) {
    return res.status(400).json({ error: 'department is required' });
  }

  try {
    if (instructor_code) {
      const [ins] = await db.query('SELECT instructor_code FROM INSTRUCTOR WHERE instructor_code = ?', [instructor_code]);
      if (!ins.length) return res.status(404).json({ error: `Instructor '${instructor_code}' does not exist` });
    }

    const [r] = await db.query(
      'UPDATE COURSE SET course_name=?, credits=?, department=?, instructor_code=? WHERE course_ID=?',
      [course_name.trim(), numCredits, department.trim(), instructor_code || null, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Course not found' });
    res.json({ message: 'Course updated' });
  } catch (err) {
    if (err.errno === 3819 || err.errno === 4025) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE course
router.delete('/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM COURSE WHERE course_ID = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Course not found' });
    res.json({ message: 'Course deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
