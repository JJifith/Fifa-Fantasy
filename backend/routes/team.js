const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/team - get current user's team for active round
router.get('/', auth, async (req, res) => {
  try {
    const activeRound = await pool.query('SELECT * FROM rounds WHERE is_active = TRUE LIMIT 1');
    if (!activeRound.rows.length) return res.json({ team: [], round: null });

    const round = activeRound.rows[0];
    const result = await pool.query(
      `SELECT ut.*, p.name, p.position, p.team, p.price, p.photo_url, p.status, p.total_points
       FROM user_teams ut
       JOIN players p ON ut.player_id = p.id
       WHERE ut.user_id = $1 AND ut.round_id = $2
       ORDER BY ut.is_playing DESC, ut.bench_order ASC`,
      [req.user.id, round.id]
    );

    res.json({ team: result.rows, round });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/team/select - save initial team selection
router.post('/select', auth, async (req, res) => {
  const { players } = req.body;
  // players: [{ player_id, is_playing, is_captain, is_vice_captain, bench_order }]

  if (!players || players.length !== 15)
    return res.status(400).json({ error: 'Must select exactly 15 players' });

  try {
    const activeRound = await pool.query('SELECT * FROM rounds WHERE is_active = TRUE LIMIT 1');
    if (!activeRound.rows.length)
      return res.status(400).json({ error: 'No active round' });

    const round = activeRound.rows[0];
    if (round.is_locked)
      return res.status(400).json({ error: 'Round is locked' });

    // Check if user already has a team this round
    const existing = await pool.query(
      'SELECT id FROM user_teams WHERE user_id = $1 AND round_id = $2 LIMIT 1',
      [req.user.id, round.id]
    );
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Team already selected for this round. Use transfers.' });

    // Validate selection
    const playerIds = players.map(p => p.player_id);
    const playerData = await pool.query(
  'SELECT id, position, price, team FROM players WHERE id = ANY($1)',
  [playerIds]
);

    const playerMap = {};
    playerData.rows.forEach(p => playerMap[p.id] = p);

    // Budget check
    const user = await pool.query('SELECT budget FROM users WHERE id = $1', [req.user.id]);
    const totalCost = playerData.rows.reduce((sum, p) => sum + parseFloat(p.price), 0);
    if (totalCost > parseFloat(user.rows[0].budget))
      return res.status(400).json({ error: `Over budget. Cost: ${totalCost.toFixed(1)}M, Budget: ${user.rows[0].budget}M` });

    // Position validation for starting 11
    const starting = players.filter(p => p.is_playing);
    const bench = players.filter(p => !p.is_playing);

    if (starting.length !== 11) return res.status(400).json({ error: 'Must have exactly 11 starting players' });
    if (bench.length !== 4) return res.status(400).json({ error: 'Must have exactly 4 bench players' });

    const posCount = (arr, pos) => arr.filter(p => playerMap[p.player_id]?.position === pos).length;

    // GK: exactly 1 starting, 1 bench
    if (posCount(starting, 'GK') !== 1) return res.status(400).json({ error: 'Must have exactly 1 starting GK' });
    if (posCount(bench, 'GK') !== 1) return res.status(400).json({ error: 'Must have exactly 1 bench GK' });

    // DEF: at least 3
    if (posCount(starting, 'DEF') < 3) return res.status(400).json({ error: 'Must have at least 3 DEF' });

    // MID: at least 2
    if (posCount(starting, 'MID') < 2) return res.status(400).json({ error: 'Must have at least 2 MID' });

    // FWD: at least 1
    if (posCount(starting, 'FWD') < 1) return res.status(400).json({ error: 'Must have at least 1 FWD' });

    // Captain checks
    const captains = players.filter(p => p.is_captain);
    const viceCaptains = players.filter(p => p.is_vice_captain);
    if (captains.length !== 1) return res.status(400).json({ error: 'Must have exactly 1 captain' });
    if (viceCaptains.length !== 1) return res.status(400).json({ error: 'Must have exactly 1 vice captain' });

    // Max 3 players from same country team
    const teamCount = {};
    playerData.rows.forEach(p => {
      teamCount[p.team] = (teamCount[p.team] || 0) + 1;
    });
    for (const [team, count] of Object.entries(teamCount)) {
      if (count > 5) return res.status(400).json({ error: `Max 3 players from same team. ${team} has ${count}` });
    }

    // Insert team
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const p of players) {
        await client.query(
          `INSERT INTO user_teams (user_id, player_id, round_id, is_playing, is_captain, is_vice_captain, bench_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [req.user.id, p.player_id, round.id, p.is_playing, p.is_captain || false, p.is_vice_captain || false, p.bench_order || null]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Team saved!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/team/captain - update captain/vice captain
router.put('/captain', auth, async (req, res) => {
  const { captain_id, vice_captain_id } = req.body;
  try {
    const activeRound = await pool.query('SELECT * FROM rounds WHERE is_active = TRUE LIMIT 1');
    if (!activeRound.rows.length) return res.status(400).json({ error: 'No active round' });
    const round = activeRound.rows[0];
    if (round.is_locked) return res.status(400).json({ error: 'Round is locked' });

    await pool.query(
      'UPDATE user_teams SET is_captain = FALSE, is_vice_captain = FALSE WHERE user_id = $1 AND round_id = $2',
      [req.user.id, round.id]
    );
    await pool.query(
      'UPDATE user_teams SET is_captain = TRUE WHERE user_id = $1 AND round_id = $2 AND player_id = $3',
      [req.user.id, round.id, captain_id]
    );
    await pool.query(
      'UPDATE user_teams SET is_vice_captain = TRUE WHERE user_id = $1 AND round_id = $2 AND player_id = $3',
      [req.user.id, round.id, vice_captain_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/team/points - get user's points breakdown for a round
router.get('/points/:roundId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ut.is_captain, ut.is_vice_captain, ut.is_playing,
              p.name, p.position, p.team, p.photo_url,
              COALESCE(SUM(pms.points_earned), 0) as raw_points
       FROM user_teams ut
       JOIN players p ON ut.player_id = p.id
       LEFT JOIN player_match_stats pms ON pms.player_id = p.id AND pms.round_id = $2
       WHERE ut.user_id = $1 AND ut.round_id = $2
       GROUP BY ut.is_captain, ut.is_vice_captain, ut.is_playing, p.name, p.position, p.team, p.photo_url`,
      [req.user.id, req.params.roundId]
    );

    const players = result.rows.map(p => {
      let points = parseInt(p.raw_points);
      if (p.is_captain) points = Math.round(points * 2);
      else if (p.is_vice_captain) points = Math.round(points * 1.5);
      return { ...p, final_points: points };
    });

    const totalPoints = players
      .filter(p => p.is_playing)
      .reduce((sum, p) => sum + p.final_points, 0);

    res.json({ players, totalPoints });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
