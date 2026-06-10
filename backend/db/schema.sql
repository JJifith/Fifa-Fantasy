-- World Cup Fantasy Football Database Schema
-- Run this once to set up your database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  budget DECIMAL(10,2) DEFAULT 100.00,
  total_points INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  position VARCHAR(3) NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  team VARCHAR(100) NOT NULL,
  price DECIMAL(5,2) NOT NULL,
  photo_url TEXT,
  jersey_number INTEGER,
  club VARCHAR(100),
  age INTEGER,
  status VARCHAR(20) DEFAULT 'fit' CHECK (status IN ('fit', 'injured', 'suspended', 'eliminated')),
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rounds table
CREATE TABLE IF NOT EXISTS rounds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  stage VARCHAR(50) NOT NULL, -- 'group', 'r32', 'r16', 'qf', 'sf', 'final'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  transfer_limit INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR(20) UNIQUE NOT NULL, -- from Zafronix e.g. "2026-001"
  round_id INTEGER REFERENCES rounds(id),
  home_team VARCHAR(100),
  away_team VARCHAR(100),
  home_score INTEGER,
  away_score INTEGER,
  kickoff_utc TIMESTAMP,
  stage VARCHAR(50),
  stadium VARCHAR(100),
  city VARCHAR(100),
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, finished
  created_at TIMESTAMP DEFAULT NOW()
);

-- Player match stats (filled after each match)
CREATE TABLE IF NOT EXISTS player_match_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  match_id INTEGER REFERENCES matches(id),
  round_id INTEGER REFERENCES rounds(id),
  minutes_played INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT FALSE,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  penalties_saved INTEGER DEFAULT 0,
  penalties_conceded INTEGER DEFAULT 0,
  own_goals INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- User teams (15 players per user, updated each round)
CREATE TABLE IF NOT EXISTS user_teams (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  player_id INTEGER REFERENCES players(id),
  round_id INTEGER REFERENCES rounds(id),
  is_playing BOOLEAN DEFAULT TRUE, -- TRUE = starting 11, FALSE = bench
  is_captain BOOLEAN DEFAULT FALSE,
  is_vice_captain BOOLEAN DEFAULT FALSE,
  bench_order INTEGER, -- 1-4 for bench players
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, player_id, round_id)
);

-- Transfers
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  round_id INTEGER REFERENCES rounds(id),
  player_out_id INTEGER REFERENCES players(id),
  player_in_id INTEGER REFERENCES players(id),
  transfer_type VARCHAR(20) DEFAULT 'normal', -- normal, wildcard
  created_at TIMESTAMP DEFAULT NOW()
);

-- User boosters
CREATE TABLE IF NOT EXISTS user_boosters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  booster_type VARCHAR(30) NOT NULL, -- wildcard, twelfth_man, max_captain, qualification_booster
  round_id INTEGER REFERENCES rounds(id), -- which round it was used
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, booster_type)
);

-- Round points (points per user per round)
CREATE TABLE IF NOT EXISTS round_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  round_id INTEGER REFERENCES rounds(id),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, round_id)
);

-- Transfer bank (tracks stacked transfers)
CREATE TABLE IF NOT EXISTS transfer_bank (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  available_transfers INTEGER DEFAULT 3,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_teams_user_round ON user_teams(user_id, round_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_round ON player_match_stats(round_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_round ON transfers(user_id, round_id);
