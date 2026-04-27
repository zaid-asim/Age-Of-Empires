const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend communication during dev, 
// and when backend/frontend might be separated.
app.use(cors());
app.use(express.json());

// Serve the static frontend files
app.use(express.static(path.join(__dirname, '.')));

const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

// Ensure leaderboard file exists
if (!fs.existsSync(LEADERBOARD_FILE)) {
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify([]));
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// GET /ping (Cron-job heartbeat to keep Render instance alive)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// GET /leaderboard
app.get('/leaderboard', (req, res) => {
  try {
    const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Leaderboard read error:', err);
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

// POST /submit-score
app.post('/submit-score', (req, res) => {
  const { name, score } = req.body;
  if (!name || typeof score !== 'number') {
    return res.status(400).json({ error: 'Valid name and score required' });
  }

  try {
    const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
    const leaderboard = JSON.parse(data);
    
    // Add new score
    leaderboard.push({ name, score, date: new Date().toISOString() });
    
    // Sort descending and keep top 100
    leaderboard.sort((a, b) => b.score - a.score);
    const topLeaderboard = leaderboard.slice(0, 100);

    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(topLeaderboard, null, 2));

    res.status(200).json({ success: true, rank: topLeaderboard.findIndex(e => e.name === name && e.score === score) + 1 });
  } catch (err) {
    console.error('Leaderboard write error:', err);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Fallback to index.html for SPA routing (if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
