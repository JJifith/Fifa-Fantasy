// Points calculation engine
// Position-weighted scoring system

const POINTS = {
  // Goals - higher reward for defensive positions
  goal: { GK: 8, DEF: 6, MID: 4, FWD: 3 },

  // Assists - same for all
  assist: { GK: 3, DEF: 3, MID: 3, FWD: 3 },

  // Clean sheet (full match)
  clean_sheet: { GK: 5, DEF: 4, MID: 2, FWD: 0 },

  // Saves (per 3 saves)
  saves_per_3: { GK: 1, DEF: 0, MID: 0, FWD: 0 },

  // Penalty saved
  penalty_saved: { GK: 5, DEF: 0, MID: 0, FWD: 0 },

  // Penalty conceded
  penalty_conceded: { GK: -2, DEF: -2, MID: -1, FWD: 0 },

  // Cards
  yellow_card: -1,
  red_card: -3,

  // Own goal
  own_goal: -2,

  // Appearance points (if played > 0 mins)
  appearance: 1,

  // Full match (played 60+ mins)
  full_match: 1,
};

function calculatePoints(stats, position) {
  let points = 0;

  if (!stats || !position) return 0;

  // Appearance
  if (stats.minutes_played > 0) points += POINTS.appearance;
  if (stats.minutes_played >= 60) points += POINTS.full_match;

  // Goals
  points += (stats.goals || 0) * POINTS.goal[position];

  // Assists
  points += (stats.assists || 0) * POINTS.assist[position];

  // Clean sheet
  if (stats.clean_sheet && stats.minutes_played >= 60) {
    points += POINTS.clean_sheet[position];
  }

  // Saves (per 3)
  if (position === 'GK') {
    points += Math.floor((stats.saves || 0) / 3) * POINTS.saves_per_3.GK;
  }

  // Penalty saved
  points += (stats.penalties_saved || 0) * POINTS.penalty_saved[position];

  // Penalty conceded
  points += (stats.penalties_conceded || 0) * POINTS.penalty_conceded[position];

  // Cards
  points += (stats.yellow_cards || 0) * POINTS.yellow_card;
  points += (stats.red_cards || 0) * POINTS.red_card;

  // Own goals
  points += (stats.own_goals || 0) * POINTS.own_goal;

  return points;
}

function applyCaptainMultiplier(points, isCaptain, isViceCaptain) {
  if (isCaptain) return Math.round(points * 2);
  if (isViceCaptain) return Math.round(points * 1.5);
  return points;
}

function applyQualificationBooster(points, teamQualified) {
  if (teamQualified) return Math.round(points * 2);
  return points;
}

module.exports = {
  calculatePoints,
  applyCaptainMultiplier,
  applyQualificationBooster,
  POINTS
};
