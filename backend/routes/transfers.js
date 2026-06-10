const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/transfers/bank - how many transfers user has available
router.get('/bank', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT available_transfers FROM transfer_bank WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ available: result.rows[0]?.available_transfers || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/transfers - make a transfer
router.post('/', auth, async (req, res) => {
  const { player_out_id, player_in_id } = req.body;

  try {
    const activeRound = await pool.query('SELECT * FROM rounds WHERE is_active = TRUE LIMIT 1');
    if (!activeRound.rows.length) return res.status(400).json({ error: 'No active round' });
    const round = activeRound.rows[0];
    if (round.is_locked) return res.status(400).json({ error: 'Round is locked. Transfers open after round ends.' });

    // Check transfer bank
    const bank = await pool.query('SELECT available_transfers FROM transfer_bank WHERE user_id = $1', [req.user.id]);
    const available = bank.rows[0]?.available_transfers || 0;

    // Check if wildcard is active
    const wildcard = await pool.query(
      `SELECT * FROM user_boosters WHERE user_id = $1 AND booster_type = 'wildcard' AND round_id = $2`,
      [req.user.id, round.id]
    );
    const isWildcard = wildcard.rows.length > 0 && wildcard.rows[0].used;

    if (!isWildcard && available <= 0)
      return res.status(400).json({ error: 'No transfers available' });

    // Get player out details
    const playerOut = await pool.query('SELECT * FROM players WHERE id = $1', [player_out_id]);
    const playerIn = await pool.query('SELECT * FROM players WHERE id = $1', [player_in_id]);

    if (!playerOut.rows.length || !playerIn.rows.length)
      return res.status(404).json({ error: 'Player not found' });

    // Check same position
    if (playerOut.rows[0].position !== playerIn.rows[0].position)
      return res.status(400).json({ error: 'Must transfer for same position' });

    // Budget check
    const user = await pool.query('SELECT budget FROM users WHERE id = $1', [req.user.id]);
    const priceDiff = parseFloat(playerIn.rows[0].price) - parseFloat(playerOut.rows[0].price);
    const newBudget = parseFloat(user.rows[0].budget) - priceDiff;
    if (newBudget < 0)
      return res.status(400).json({ error: `Insufficient budget. Need ${priceDiff.toFixed(1)}M more.` });

    // Check player not already in team
    const alreadyIn = await pool.query(
      'SELECT id FROM user_teams WHERE user_id = $1 AND player_id = $2 AND round_id = $3',
      [req.user.id, player_in_id, round.id]
    );
    if (alreadyIn.rows.length > 0)
      return res.status(400).json({ error: 'Player already in your team' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the slot of player being transferred out
      const slot = await client.query(
        'SELECT is_playing, bench_order FROM user_teams WHERE user_id = $1 AND player_id = $2 AND round_id = $3',
        [req.user.id, player_out_id, round.id]
      );

      // Remove old player
      await client.query(
        'DELETE FROM user_teams WHERE user_id = $1 AND player_id = $2 AND round_id = $3',
        [req.user.id, player_out_id, round.id]
      );

      // Add new player in same slot
      await client.query(
        `INSERT INTO user_teams (user_id, player_id, round_id, is_playing, bench_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, player_in_id, round.id, slot.rows[0].is_playing, slot.rows[0].bench_order]
      );

      // Log transfer
      await client.query(
        `INSERT INTO transfers (user_id, round_id, player_out_id, player_in_id, transfer_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, round.id, player_out_id, player_in_id, isWildcard ? 'wildcard' : 'normal']
      );

      // Update budget
      await client.query('UPDATE users SET budget = $1 WHERE id = $2', [newBudget, req.user.id]);

      // Deduct from transfer bank (unless wildcard)
      if (!isWildcard) {
        await client.query(
          'UPDATE transfer_bank SET available_transfers = available_transfers - 1 WHERE user_id = $1',
          [req.user.id]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true, newBudget, transfersLeft: isWildcard ? '∞' : available - 1 });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/transfers/history - transfer history
router.get('/history', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, r.name as round_name,
              po.name as player_out_name, po.position as player_out_pos,
              pi.name as player_in_name, pi.position as player_in_pos
       FROM transfers t
       JOIN rounds r ON t.round_id = r.id
       JOIN players po ON t.player_out_id = po.id
       JOIN players pi ON t.player_in_id = pi.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
