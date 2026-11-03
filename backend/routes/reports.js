// routes/reports.js — read-only reports built on database views, a window
// function, a stored procedure and the trigger-filled audit table.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET per-exam statistics            (view vw_exam_statistics)
router.get('/exam-stats', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_exam_statistics ORDER BY exam_ID');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET per-course summary             (view vw_course_summary)
router.get('/course-summary', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_course_summary ORDER BY course_ID');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET top 10 students by average marks (RANK() window function over a view).
// Only students with at least 3 graded exams are ranked, so one lucky paper can't win.
router.get('/top-students', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT RANK() OVER (ORDER BY AVG(marks_obtained) DESC) AS rnk,
             reg_no, student_name AS name, department,
             ROUND(AVG(marks_obtained), 2) AS avg_marks,
             COUNT(*) AS exams
      FROM vw_student_results
      GROUP BY reg_no, student_name, department
      HAVING COUNT(*) >= 3
      ORDER BY rnk, reg_no
      LIMIT 10
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET audit log of result changes    (filled by triggers, newest first)
router.get('/audit', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT audit_ID, result_ID, action, old_marks, new_marks,
             old_grade, new_grade, changed_by, changed_at
      FROM RESULT_AUDIT
      ORDER BY audit_ID DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET report card for one student    (stored procedure sp_student_report)
router.get('/student/:reg_no', async (req, res) => {
  try {
    const [sets] = await db.query('CALL sp_student_report(?)', [req.params.reg_no]);
    res.json(Array.isArray(sets[0]) ? sets[0] : []);
  } catch (err) {
    if (err.sqlState === '45000') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
