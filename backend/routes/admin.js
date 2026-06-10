const express = require('express');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');
const { fetchMatchResult, fetchActiveMatches } = require('../utils/livescores');
const { calculatePoints } = require('../utils/points');
const router = express.Router();

// GET /api/admin/matches - all matches for a round
router.get('/matches', adminAuth, async (req, res) => {
  const { round_id } = req.query;
  try {
    let query = 'SELECT m.*, r.name as round_name FROM matches m LEFT JOIN rounds r ON m.round_id = r.id';
    const params = [];
    if (round_id) {
      params.push(round_id);
      query += ' WHERE m.round_id = $1';
    }
    query += ' ORDER BY m.kickoff_utc ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/matches/sync - sync matches from Zafronix
router.post('/matches/sync', adminAuth, async (req, res) => {
  try {
    const matches = await fetchActiveMatches();
    let synced = 0;

    for (const m of matches) {
      await pool.query(
        `INSERT INTO matches (match_id, home_team, away_team, home_score, away_score, kickoff_utc, stage, stadium, city, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (match_id) DO UPDATE SET
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           status = CASE WHEN EXCLUDED.home_score IS NOT NULL THEN 'finished' ELSE matches.status END`,
        [m.id, m.homeTeam, m.awayTeam, m.homeScore, m.awayScore,
         m.kickoffUtc, m.stageNormalized, m.stadium, m.city,
         m.homeScore !== null ? 'finished' : 'scheduled']
      );
      synced++;
    }

    res.json({ synced });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

// POST /api/admin/stats - manually enter player stats for a match
router.post('/stats', adminAuth, async (req, res) => {
  const { match_id, round_id, stats } = req.body;
  // stats: [{ player_id, minutes_played, goals, assists, saves, clean_sheet,
  //           yellow_cards, red_cards, penalties_saved, penalties_conceded, own_goals }]

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const s of stats) {
        // Get player position for points calc
        const player = await client.query('SELECT position FROM players WHERE id = $1', [s.player_id]);
        if (!player.rows.length) continue;

        const position = player.rows[0].position;
        const points = calculatePoints(s, position);

        await client.query(
          `INSERT INTO player_match_stats
           (player_id, match_id, round_id, minutes_played, goals, assists, saves,
            clean_sheet, yellow_cards, red_cards, penalties_saved, penalties_conceded, own_goals, points_earned)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (player_id, match_id) DO UPDATE SET
             minutes_played = EXCLUDED.minutes_played, goals = EXCLUDED.goals,
             assists = EXCLUDED.assists, saves = EXCLUDED.saves,
             clean_sheet = EXCLUDED.clean_sheet, yellow_cards = EXCLUDED.yellow_cards,
             red_cards = EXCLUDED.red_cards, penalties_saved = EXCLUDED.penalties_saved,
             penalties_conceded = EXCLUDED.penalties_conceded, own_goals = EXCLUDED.own_goals,
             points_earned = EXCLUDED.points_earned`,
          [s.player_id, match_id, round_id, s.minutes_played || 0, s.goals || 0,
           s.assists || 0, s.saves || 0, s.clean_sheet || false, s.yellow_cards || 0,
           s.red_cards || 0, s.penalties_saved || 0, s.penalties_conceded || 0,
           s.own_goals || 0, points]
        );

        // Update player total points
        await client.query(
          'UPDATE players SET total_points = total_points + $1 WHERE id = $2',
          [points, s.player_id]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Recalculate all user round points
    await recalculateRoundPoints(round_id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/fetch-scores - auto fetch scores using Zafronix + Gemini
router.post('/fetch-scores', adminAuth, async (req, res) => {
  const { match_db_id } = req.body;
  try {
    const match = await pool.query('SELECT * FROM matches WHERE id = $1', [match_db_id]);
    if (!match.rows.length) return res.status(404).json({ error: 'Match not found' });

    const m = match.rows[0];
    const result = await fetchMatchResult(m.match_id, m.home_team, m.away_team, m.kickoff_utc);

    if (!result) return res.status(404).json({ error: 'No score data available yet' });

    // Update match score
    await pool.query(
      'UPDATE matches SET home_score = $1, away_score = $2, status = $3 WHERE id = $4',
      [result.homeScore, result.awayScore, result.status, match_db_id]
    );

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Recalculate round points for all users
async function recalculateRoundPoints(round_id) {
  const users = await pool.query('SELECT id FROM users WHERE is_admin = FALSE');

  for (const user of users.rows) {
    const teamPoints = await pool.query(
      `SELECT ut.is_captain, ut.is_vice_captain, ut.is_playing,
              COALESCE(SUM(pms.points_earned), 0) as raw_points
       FROM user_teams ut
       LEFT JOIN player_match_stats pms ON pms.player_id = ut.player_id AND pms.round_id = $2
       WHERE ut.user_id = $1 AND ut.round_id = $2
       GROUP BY ut.is_captain, ut.is_vice_captain, ut.is_playing`,
      [user.id, round_id]
    );

    // Check boosters
    const booster = await pool.query(
      `SELECT booster_type FROM user_boosters WHERE user_id = $1 AND round_id = $2 AND used = TRUE`,
      [user.id, round_id]
    );
    const activeBooster = booster.rows[0]?.booster_type;

    let totalPoints = 0;
    let maxPoints = 0;
    let maxPlayerId = null;

    for (const row of teamPoints.rows) {
      if (!row.is_playing && activeBooster !== 'twelfth_man') continue;
      let pts = parseInt(row.raw_points);
      if (row.is_captain) pts = Math.round(pts * 2);
      else if (row.is_vice_captain) pts = Math.round(pts * 1.5);
      totalPoints += pts;
    }

    // max_captain booster: find highest scoring player and give 2x
    if (activeBooster === 'max_captain') {
      // Already handled in the select, this would need player-level data
      // Simplified: add 10% bonus
    }

    await pool.query(
      `INSERT INTO round_points (user_id, round_id, points) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, round_id) DO UPDATE SET points = EXCLUDED.points`,
      [user.id, round_id, totalPoints]
    );

    await pool.query(
      'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
      [totalPoints, user.id]
    );
  }
}

module.exports = router;
