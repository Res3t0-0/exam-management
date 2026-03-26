// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// GET all users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM USER ORDER BY user_ID');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET user by ID
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM USER WHERE user_ID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create user
router.post('/', async (req, res) => {
  const { name, email, phone, dob } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  try {
    const [result] = await db.query(
      'INSERT INTO USER (name, email, phone, dob) VALUES (?, ?, ?, ?)',
      [name, email, phone || null, dob || null]
    );
    res.status(201).json({ message: 'User created', user_ID: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update user
router.put('/:id', async (req, res) => {
  const { name, email, phone, dob } = req.body;
  try {
    await db.query(
      'UPDATE USER SET name=?, email=?, phone=?, dob=? WHERE user_ID=?',
      [name, email, phone, dob, req.params.id]
    );
    res.json({ message: 'User updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE user
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM USER WHERE user_ID = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
