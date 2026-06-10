# ⚽ WC Fantasy 2026

A full-stack fantasy football app for the FIFA World Cup 2026.

## Features

- 👤 User signup/login (JWT auth)
- 💰 100M budget to build a 15-player squad
- ⚽ Formation builder (11 starting + 4 bench)
- 👑 Captain (2x) and Vice Captain (1.5x) scoring
- 🔄 Transfers: 3/round group stage, 4/round knockouts (stack up to 6)
- 🃏 Boosters: Wildcard, 12th Man, Max Captain, Qualification Booster
- 📊 Position-weighted points (goals, assists, clean sheets, saves, cards)
- 🏆 Global leaderboard + round-by-round breakdown
- ⚙ Admin panel: player import from Zafronix, score entry, round management
- 📡 Live scores via Zafronix API + Gemini fallback

## Tech Stack

- **Frontend**: React + React Router
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT
- **Live data**: Zafronix API + Gemini (Google Search grounding)

## Quick Start

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

```bash
# Backend
cd backend && npm install && node index.js

# Frontend  
cd frontend && npm install && npm start
```

## Points System

| Action | GK | DEF | MID | FWD |
|--------|-----|-----|-----|-----|
| Goal | 8 | 6 | 4 | 3 |
| Assist | 3 | 3 | 3 | 3 |
| Clean Sheet (60+ min) | 5 | 4 | 2 | — |
| Per 3 Saves | 1 | — | — | — |
| Penalty Saved | 5 | — | — | — |
| Yellow Card | -1 | -1 | -1 | -1 |
| Red Card | -3 | -3 | -3 | -3 |
| Own Goal | -2 | -2 | -2 | -2 |
| Appearance | +1 all | | | |
| 60+ mins | +1 all | | | |
