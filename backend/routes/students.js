// routes/students.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

async function validateUserUniqueness(conn, { email, phone, excludeUserId = null }) {
  if (email) {
    const params = [email];
    let query = 'SELECT user_ID FROM USER WHERE email = ?';
    if (excludeUserId) {
      query += ' AND user_ID <> ?';
      params.push(excludeUserId);
    }
    const [emailRows] = await conn.query(query, params);
    if (emailRows.length) {
      return 'Email is already in use';
    }
  }

  if (phone) {
    const params = [phone];
    let query = 'SELECT user_ID FROM USER WHERE phone = ?';
    if (excludeUserId) {
      query += ' AND user_ID <> ?';
      params.push(excludeUserId);
    }
    const [phoneRows] = await conn.query(query, params);
    if (phoneRows.length) {
      return 'Phone number is already in use';
    }
  }

  return null;
}

// GET all students (JOIN with USER)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.reg_no, u.name, u.email, u.phone, u.dob,
             s.semester, s.department, s.user_ID
      FROM STUDENT s JOIN USER u ON s.user_ID = u.user_ID
      ORDER BY s.reg_no
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET student by reg_no
router.get('/:reg_no', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.reg_no, u.name, u.email, u.phone, u.dob,
             s.semester, s.department, s.user_ID
      FROM STUDENT s JOIN USER u ON s.user_ID = u.user_ID
      WHERE s.reg_no = ?
    `, [req.params.reg_no]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create student
router.post('/', async (req, res) => {
  const { reg_no, user_ID, name, email, phone, dob, semester, department } = req.body;
  if (!reg_no || !semester || !department)
    return res.status(400).json({ error: 'reg_no, semester, and department are required' });

  if (!user_ID && (!name || !email)) {
    return res.status(400).json({ error: 'name and email are required when creating a new linked user' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    let linkedUserId = user_ID;

    if (!linkedUserId) {
      const duplicateMessage = await validateUserUniqueness(conn, { email, phone });
      if (duplicateMessage) {
        await conn.rollback();
        return res.status(409).json({ error: duplicateMessage });
      }

      const [userResult] = await conn.query(
        'INSERT INTO USER (name, email, phone, dob) VALUES (?, ?, ?, ?)',
        [name, email, phone || null, dob || null]
      );
      linkedUserId = userResult.insertId;
    }

    await conn.query(
      'INSERT INTO STUDENT (reg_no, user_ID, semester, department) VALUES (?, ?, ?, ?)',
      [reg_no, linkedUserId, semester, department]
    );

    await conn.commit();
    res.status(201).json({ message: 'Student created', reg_no, user_ID: linkedUserId });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// PUT update student
router.put('/:reg_no', async (req, res) => {
  const { semester, department, name, email, phone, dob } = req.body;
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [students] = await conn.query(
      'SELECT user_ID FROM STUDENT WHERE reg_no = ?',
      [req.params.reg_no]
    );

    if (!students.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Student not found' });
    }

    const duplicateMessage = await validateUserUniqueness(conn, {
      email,
      phone,
      excludeUserId: students[0].user_ID
    });
    if (duplicateMessage) {
      await conn.rollback();
      return res.status(409).json({ error: duplicateMessage });
    }

    await conn.query(
      'UPDATE STUDENT SET semester=?, department=? WHERE reg_no=?',
      [semester, department, req.params.reg_no]
    );

    await conn.query(
      'UPDATE USER SET name=?, email=?, phone=?, dob=? WHERE user_ID=?',
      [name, email, phone || null, dob || null, students[0].user_ID]
    );

    await conn.commit();
    res.json({ message: 'Student updated' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE student
router.delete('/:reg_no', async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [students] = await conn.query(
      'SELECT user_ID FROM STUDENT WHERE reg_no = ?',
      [req.params.reg_no]
    );

    if (!students.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Student not found' });
    }

    const userId = students[0].user_ID;

    await conn.query('DELETE FROM STUDENT WHERE reg_no = ?', [req.params.reg_no]);

    const [studentRefs] = await conn.query(
      'SELECT reg_no FROM STUDENT WHERE user_ID = ? LIMIT 1',
      [userId]
    );
    const [instructorRefs] = await conn.query(
      'SELECT instructor_code FROM INSTRUCTOR WHERE user_ID = ? LIMIT 1',
      [userId]
    );

    if (!studentRefs.length && !instructorRefs.length) {
      await conn.query('DELETE FROM USER WHERE user_ID = ?', [userId]);
    }

    await conn.commit();
    res.json({ message: 'Student deleted' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// GET enrollments for student
router.get('/:reg_no/enrollments', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.course_ID, c.course_name, c.credits, c.department
      FROM ENROLL e JOIN COURSE c ON e.course_ID = c.course_ID
      WHERE e.reg_no = ?
    `, [req.params.reg_no]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
