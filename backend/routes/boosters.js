const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/boosters - get user's booster status
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ub.*, r.name as used_in_round
       FROM user_boosters ub
       LEFT JOIN rounds r ON ub.round_id = r.id
       WHERE ub.user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/boosters/activate - activate a booster
router.post('/activate', auth, async (req, res) => {
  const { booster_type } = req.body;
  const validBoosters = ['wildcard', 'twelfth_man', 'max_captain', 'qualification_booster'];

  if (!validBoosters.includes(booster_type))
    return res.status(400).json({ error: 'Invalid booster type' });

  try {
    const activeRound = await pool.query('SELECT * FROM rounds WHERE is_active = TRUE LIMIT 1');
    if (!activeRound.rows.length) return res.status(400).json({ error: 'No active round' });
    const round = activeRound.rows[0];

    // Wildcard and qualification_booster only in group stage
    if (['wildcard', 'qualification_booster'].includes(booster_type) && round.stage !== 'group') {
      return res.status(400).json({ error: `${booster_type} only available in group stage` });
    }

    // Check if already used
    const booster = await pool.query(
      'SELECT * FROM user_boosters WHERE user_id = $1 AND booster_type = $2',
      [req.user.id, booster_type]
    );

    if (!booster.rows.length) return res.status(404).json({ error: 'Booster not found' });
    if (booster.rows[0].used) return res.status(400).json({ error: 'Booster already used' });

    // Check if another booster is active this round (can't stack)
    const activeBooster = await pool.query(
      'SELECT * FROM user_boosters WHERE user_id = $1 AND round_id = $2 AND used = TRUE',
      [req.user.id, round.id]
    );
    if (activeBooster.rows.length > 0)
      return res.status(400).json({ error: 'Can only use one booster per round' });

    // Activate
    await pool.query(
      'UPDATE user_boosters SET used = TRUE, round_id = $1 WHERE user_id = $2 AND booster_type = $3',
      [round.id, req.user.id, booster_type]
    );

    // Wildcard: reset transfer bank to max
    if (booster_type === 'wildcard') {
      await pool.query(
        'UPDATE transfer_bank SET available_transfers = 15 WHERE user_id = $1',
        [req.user.id]
      );
    }

    res.json({ success: true, message: `${booster_type} activated for ${round.name}!` });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
