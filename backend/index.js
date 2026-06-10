const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/team', require('./routes/team'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/boosters', require('./routes/boosters'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/rounds', require('./routes/leaderboard')); // rounds are in leaderboard file
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 WC Fantasy Backend running on port ${PORT}`);
});

module.exports = app;
