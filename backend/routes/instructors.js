// routes/instructors.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all instructors (JOIN with USER)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.instructor_code, i.school, i.user_ID,
             u.name, u.email, u.phone, u.dob
      FROM INSTRUCTOR i
      JOIN USER u ON i.user_ID = u.user_ID
      ORDER BY i.instructor_code
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET instructor by code
router.get('/:code', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.instructor_code, i.school, i.user_ID,
             u.name, u.email, u.phone, u.dob
      FROM INSTRUCTOR i
      JOIN USER u ON i.user_ID = u.user_ID
      WHERE i.instructor_code = ?
    `, [req.params.code]);
    if (!rows.length) return res.status(404).json({ error: 'Instructor not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create instructor (also creates a linked USER if user_ID not provided)
router.post('/', async (req, res) => {
  const { instructor_code, school, user_ID, name, email, phone, dob } = req.body;

  if (!instructor_code || !school)
    return res.status(400).json({ error: 'instructor_code and school are required' });
  if (!user_ID && (!name || !email))
    return res.status(400).json({ error: 'name and email are required when creating a new linked user' });

  // Validate instructor_code format
  if (!/^[A-Z0-9_-]{3,20}$/.test(instructor_code))
    return res.status(400).json({ error: 'instructor_code must be 3-20 uppercase alphanumeric characters' });

  // Validate email if provided directly
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email format' });

  // Validate phone if provided
  if (phone && !/^\d{10}$/.test(phone))
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    let linkedUserId = user_ID;

    if (!linkedUserId) {
      const [userResult] = await conn.query(
        'INSERT INTO USER (name, email, phone, dob) VALUES (?, ?, ?, ?)',
        [name, email, phone || null, dob || null]
      );
      linkedUserId = userResult.insertId;
    }

    await conn.query(
      'INSERT INTO INSTRUCTOR (instructor_code, user_ID, school) VALUES (?, ?, ?)',
      [instructor_code, linkedUserId, school]
    );

    await conn.commit();
    res.status(201).json({ message: 'Instructor created', instructor_code, user_ID: linkedUserId });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Instructor code or email already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// PUT update instructor
router.put('/:code', async (req, res) => {
  const { school, name, email, phone, dob } = req.body;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email format' });
  if (phone && !/^\d{10}$/.test(phone))
    return res.status(400).json({ error: 'Phone must be exactly 10 digits' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [instructors] = await conn.query(
      'SELECT user_ID FROM INSTRUCTOR WHERE instructor_code = ?',
      [req.params.code]
    );
    if (!instructors.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Instructor not found' });
    }

    await conn.query(
      'UPDATE INSTRUCTOR SET school=? WHERE instructor_code=?',
      [school, req.params.code]
    );
    await conn.query(
      'UPDATE USER SET name=?, email=?, phone=?, dob=? WHERE user_ID=?',
      [name, email, phone || null, dob || null, instructors[0].user_ID]
    );

    await conn.commit();
    res.json({ message: 'Instructor updated' });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE instructor
router.delete('/:code', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_ID FROM INSTRUCTOR WHERE instructor_code = ?',
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ error: 'Instructor not found' });

    await db.query('DELETE FROM INSTRUCTOR WHERE instructor_code = ?', [req.params.code]);
    res.json({ message: 'Instructor deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
