const axios = require('axios');

const ZAFRONIX_BASE = 'https://api.zafronix.com/fifa/worldcup/v1';
const ZAFRONIX_KEY = process.env.ZAFRONIX_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Fetch match result from Zafronix
async function fetchMatchFromZafronix(matchId) {
  try {
    const res = await axios.get(`${ZAFRONIX_BASE}/matches/${matchId}`, {
      headers: { 'X-API-Key': ZAFRONIX_KEY }
    });
    const match = res.data;

    // Check if we have meaningful data
    if (match.homeScore !== null && match.awayScore !== null) {
      return {
        source: 'zafronix',
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        goals: match.goals || [],
        cards: match.cards || [],
        status: match.status || 'finished'
      };
    }
    return null;
  } catch (err) {
    console.log(`Zafronix miss for ${matchId}:`, err.message);
    return null;
  }
}

// Fallback: fetch from Gemini with Google Search grounding
async function fetchMatchFromGemini(homeTeam, awayTeam, matchDate) {
  try {
    const prompt = `Search for the FIFA World Cup 2026 match result: ${homeTeam} vs ${awayTeam} on ${matchDate}.
    
Return ONLY a JSON object with this exact structure, no other text:
{
  "homeScore": <number or null>,
  "awayScore": <number or null>,
  "status": "finished" or "live" or "scheduled",
  "goals": [
    { "player": "<name>", "team": "<team>", "minute": <number>, "type": "goal" or "penalty" or "own_goal", "assist": "<name or null>" }
  ],
  "cards": [
    { "player": "<name>", "team": "<team>", "minute": <number>, "type": "yellow" or "red" }
  ]
}`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }]
      }
    );

    const text = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { source: 'gemini', ...parsed };
  } catch (err) {
    console.log('Gemini fallback failed:', err.message);
    return null;
  }
}

// Main function - try Zafronix first, fall back to Gemini
async function fetchMatchResult(matchId, homeTeam, awayTeam, matchDate) {
  console.log(`Fetching: ${homeTeam} vs ${awayTeam}`);

  // Try Zafronix first
  const zafronixData = await fetchMatchFromZafronix(matchId);
  if (zafronixData) {
    console.log(`✅ Zafronix data for ${matchId}`);
    return zafronixData;
  }

  // Fallback to Gemini
  console.log(`⚠️ Falling back to Gemini for ${homeTeam} vs ${awayTeam}`);
  const geminiData = await fetchMatchFromGemini(homeTeam, awayTeam, matchDate);
  if (geminiData) {
    console.log(`✅ Gemini data for ${homeTeam} vs ${awayTeam}`);
    return geminiData;
  }

  console.log(`❌ No data available for ${homeTeam} vs ${awayTeam}`);
  return null;
}

// Fetch all active matches from Zafronix
async function fetchActiveMatches() {
  try {
    const res = await axios.get(`${ZAFRONIX_BASE}/matches?year=2026`, {
      headers: { 'X-API-Key': ZAFRONIX_KEY }
    });
    return res.data.data || [];
  } catch (err) {
    console.error('Failed to fetch active matches:', err.message);
    return [];
  }
}

// Import all 2026 squads from Zafronix
async function fetchTeamRoster(teamName) {
  try {
    const res = await axios.get(`${ZAFRONIX_BASE}/teams/${encodeURIComponent(teamName)}/roster?year=2026`, {
      headers: { 'X-API-Key': ZAFRONIX_KEY }
    });
    return res.data || [];
  } catch (err) {
    console.error(`Failed to fetch roster for ${teamName}:`, err.message);
    return [];
  }
}

module.exports = {
  fetchMatchResult,
  fetchActiveMatches,
  fetchTeamRoster
};
