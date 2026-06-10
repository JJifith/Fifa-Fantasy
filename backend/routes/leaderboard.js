const express = require('express');
const pool = require('../db');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/leaderboard - global leaderboard
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.total_points,
              RANK() OVER (ORDER BY u.total_points DESC) as rank
       FROM users u
       WHERE u.is_admin = FALSE
       ORDER BY u.total_points DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/round/:roundId - round leaderboard
router.get('/round/:roundId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, rp.points,
              RANK() OVER (ORDER BY rp.points DESC) as rank
       FROM round_points rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.round_id = $1 AND u.is_admin = FALSE
       ORDER BY rp.points DESC`,
      [req.params.roundId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rounds - all rounds
router.get('/rounds', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rounds ORDER BY start_date ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rounds/active
router.get('/rounds/active', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rounds WHERE is_active = TRUE LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rounds - admin: create round
router.post('/rounds', adminAuth, async (req, res) => {
  const { name, stage, start_date, end_date, transfer_limit } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO rounds (name, stage, start_date, end_date, transfer_limit)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, stage, start_date, end_date, transfer_limit || 3]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/rounds/:id/activate - admin: set active round
router.put('/rounds/:id/activate', adminAuth, async (req, res) => {
  try {
    await pool.query('UPDATE rounds SET is_active = FALSE');
    await pool.query('UPDATE rounds SET is_active = TRUE WHERE id = $1', [req.params.id]);

    // Add transfers to all user banks for new round
    const round = await pool.query('SELECT * FROM rounds WHERE id = $1', [req.params.id]);
    const transferLimit = round.rows[0].transfer_limit;

    // Add transfers to bank (capped at 6)
    await pool.query(`
      UPDATE transfer_bank
      SET available_transfers = LEAST(available_transfers + $1, 6)
    `, [transferLimit]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/rounds/:id/lock - admin: lock/unlock round
router.put('/rounds/:id/lock', adminAuth, async (req, res) => {
  const { locked } = req.body;
  try {
    await pool.query('UPDATE rounds SET is_locked = $1 WHERE id = $2', [locked, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
