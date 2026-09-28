// chat-routes.js — public chat for ByteSoft (Express)
//
// Add to your server file, AFTER your session/auth middleware:
//     app.use(require('./chat-routes'));
//
// Endpoints:
//     GET  /api/chat/messages?after=<id>   -> { messages: [...] }  (new messages since <id>)
//     POST /api/chat/messages  { text }    -> { message }
//
// Messages are kept in memory and saved to chat-messages.json so they
// survive a server restart. Only the newest 500 are kept.

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const FILE = path.join(__dirname, 'chat-messages.json');
const MAX_STORED = 500;
const MAX_TEXT = 500;
const FIRST_LOAD_LIMIT = 100;

// ---- Who is sending? ------------------------------------------------------
// Edit this to match how your server tracks the logged-in user.
// It tries the usual session shapes first and only falls back to what the
// browser sent if your app has no session.
function getUser(req) {
  const s = req.session || {};
  const u = s.user || req.user || {};
  const body = req.body || {};
  const username = String(s.username || u.username || body.username || '').trim().slice(0, 40);
  const name = String(s.name || u.name || u.fullName || body.name || username).trim().slice(0, 60);
  return { username, name };
}

// ---- Storage --------------------------------------------------------------
let messages = [];
try {
  messages = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(messages)) messages = [];
} catch { messages = []; }
let nextId = messages.length ? messages[messages.length - 1].id + 1 : 1;

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(FILE, JSON.stringify(messages), err => {
      if (err) console.error('chat: could not save messages', err.message);
    });
  }, 500);
}

// ---- Routes ---------------------------------------------------------------
router.use('/api/chat', express.json({ limit: '10kb' }));

router.get('/api/chat/messages', (req, res) => {
  const after = parseInt(req.query.after, 10) || 0;
  const result = after > 0
    ? messages.filter(m => m.id > after)
    : messages.slice(-FIRST_LOAD_LIMIT);
  res.set('Cache-Control', 'no-store');
  res.json({ messages: result });
});

const lastSent = new Map(); // username -> timestamp, simple flood guard

router.post('/api/chat/messages', (req, res) => {
  const { username, name } = getUser(req);
  if (!username) return res.status(401).json({ error: 'Please log in to chat.' });

  const text = String((req.body || {}).text || '').trim().slice(0, MAX_TEXT);
  if (!text) return res.status(400).json({ error: 'Message is empty.' });

  const now = Date.now();
  if (now - (lastSent.get(username) || 0) < 400) {
    return res.status(429).json({ error: 'You are sending messages too fast.' });
  }
  lastSent.set(username, now);

  const message = { id: nextId++, username, name, text, ts: now };
  messages.push(message);
  if (messages.length > MAX_STORED) messages = messages.slice(-MAX_STORED);
  scheduleSave();
  res.json({ message });
});

module.exports = router;
