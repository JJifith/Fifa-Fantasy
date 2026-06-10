const express = require('express');
const pool = require('../db');
const { auth, adminAuth } = require('../middleware/auth');
const { fetchTeamRoster } = require('../utils/livescores');
const router = express.Router();

// GET /api/players - get all players (with optional filters)
router.get('/', async (req, res) => {
  const { position, team, search, sort = 'total_points' } = req.query;
  let query = 'SELECT * FROM players WHERE 1=1';
  const params = [];

  if (position) {
    params.push(position);
    query += ` AND position = $${params.length}`;
  }
  if (team) {
    params.push(team);
    query += ` AND team = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    query += ` AND name ILIKE $${params.length}`;
  }

  const validSorts = ['total_points', 'price', 'name'];
  const sortCol = validSorts.includes(sort) ? sort : 'total_points';
  query += ` ORDER BY ${sortCol} DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/players/:id - single player with stats
router.get('/:id', async (req, res) => {
  try {
    const player = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
    if (!player.rows.length) return res.status(404).json({ error: 'Player not found' });

    const stats = await pool.query(
      `SELECT pms.*, m.home_team, m.away_team, m.kickoff_utc, r.name as round_name
       FROM player_match_stats pms
       JOIN matches m ON pms.match_id = m.id
       JOIN rounds r ON pms.round_id = r.id
       WHERE pms.player_id = $1
       ORDER BY m.kickoff_utc DESC`,
      [req.params.id]
    );

    res.json({ ...player.rows[0], match_stats: stats.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/players - admin: add player
router.post('/', adminAuth, async (req, res) => {
  const { name, position, team, price, photo_url, jersey_number, club, age, status } = req.body;

  if (!name || !position || !team || !price)
    return res.status(400).json({ error: 'name, position, team, price required' });

  try {
    const result = await pool.query(
      `INSERT INTO players (name, position, team, price, photo_url, jersey_number, club, age, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, position, team, price, photo_url || null, jersey_number || null, club || null, age || null, status || 'fit']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/players/:id - admin: update player
router.put('/:id', adminAuth, async (req, res) => {
  const { name, position, team, price, photo_url, jersey_number, club, age, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE players SET name=$1, position=$2, team=$3, price=$4, photo_url=$5,
       jersey_number=$6, club=$7, age=$8, status=$9
       WHERE id=$10 RETURNING *`,
      [name, position, team, price, photo_url, jersey_number, club, age, status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/players/:id - admin only
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/players/import/:team - admin: import squad from Zafronix
//router.post('/import/:team', adminAuth, async (req, res) => {

  router.post('/import/:team', async (req, res) => {
  const teamName = decodeURIComponent(req.params.team);
  try {
    const roster = await fetchTeamRoster(teamName);
    if (!roster.length) return res.status(404).json({ error: 'No roster found' });

    const imported = [];
    for (const p of roster) {
      // Check if player already exists
      const existing = await pool.query(
        'SELECT id FROM players WHERE name = $1 AND team = $2',
        [p.name, teamName]
      );
      if (existing.rows.length > 0) continue;

const positionMap = {
  GK: 'GK',
  DF: 'DEF',
  MF: 'MID',
  FW: 'FWD'
};

const position = positionMap[p.position] || 'MID';

const photoUrl =
  `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`;

      const result = await pool.query(
  `INSERT INTO players (name, position, team, price, photo_url, club, age, status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, 'fit') RETURNING *`,
  [
    p.name,
    position,
    teamName,
    6.0,
    photoUrl,
    p.club?.name || null,
    p.ageAtTournament || null
  ]
);
      imported.push(result.rows[0]);
    }

    res.json({ imported: imported.length, players: imported });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
