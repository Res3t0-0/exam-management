// routes/enrollments.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all enrollments (with student and course details)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.reg_no, u.name AS student_name, s.department AS student_dept, s.semester,
             e.course_ID, c.course_name, c.credits, c.department AS course_dept
      FROM ENROLL e
      JOIN STUDENT s  ON e.reg_no    = s.reg_no
      JOIN USER u     ON s.user_ID   = u.user_ID
      JOIN COURSE c   ON e.course_ID = c.course_ID
      ORDER BY e.reg_no, e.course_ID
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST enroll a student in a course
router.post('/', async (req, res) => {
  const { reg_no, course_ID } = req.body;
  if (!reg_no || !course_ID)
    return res.status(400).json({ error: 'reg_no and course_ID are required' });

  try {
    // Verify student exists
    const [students] = await db.query('SELECT reg_no FROM STUDENT WHERE reg_no = ?', [reg_no]);
    if (!students.length) return res.status(404).json({ error: `Student '${reg_no}' not found` });

    // Verify course exists
    const [courses] = await db.query('SELECT course_ID FROM COURSE WHERE course_ID = ?', [course_ID]);
    if (!courses.length) return res.status(404).json({ error: `Course '${course_ID}' not found` });

    await db.query('INSERT INTO ENROLL (reg_no, course_ID) VALUES (?, ?)', [reg_no, course_ID]);
    res.status(201).json({ message: `Student ${reg_no} enrolled in ${course_ID}` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: `Student ${reg_no} is already enrolled in ${course_ID}` });
    res.status(500).json({ error: err.message });
  }
});

// DELETE unenroll a student from a course
router.delete('/', async (req, res) => {
  const { reg_no, course_ID } = req.body;
  if (!reg_no || !course_ID)
    return res.status(400).json({ error: 'reg_no and course_ID are required' });

  try {
    const [result] = await db.query(
      'DELETE FROM ENROLL WHERE reg_no = ? AND course_ID = ?',
      [reg_no, course_ID]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ message: `Student ${reg_no} unenrolled from ${course_ID}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
