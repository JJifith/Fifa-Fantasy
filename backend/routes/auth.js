const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, budget) VALUES ($1, $2, $3, 100) RETURNING id, name, email, budget, total_points, is_admin',
      [name, email, hash]
    );

    const user = result.rows[0];

    // Initialize transfer bank
    await pool.query(
      'INSERT INTO transfer_bank (user_id, available_transfers) VALUES ($1, 3) ON CONFLICT (user_id) DO NOTHING',
      [user.id]
    );

    // Initialize boosters
    const boosters = ['wildcard', 'twelfth_man', 'max_captain', 'qualification_booster'];
    for (const booster of boosters) {
      await pool.query(
        'INSERT INTO user_boosters (user_id, booster_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, booster]
      );
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash, budget, total_points, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, budget, total_points, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
