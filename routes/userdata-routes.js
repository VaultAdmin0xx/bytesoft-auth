// routes/userdata-routes.js — per-user dashboard data stored on the SERVER
// (projects, meetings, profile, leave, attendance) so it follows the user to any device.
//
// In server.js, add AFTER the session middleware:
//     app.use('/api/userdata', require('./routes/userdata-routes'));
//
// Endpoints (logged-in users only; each user can only touch their OWN data):
//     GET /api/userdata          -> { data: { projects, meetings, ... } }
//     PUT /api/userdata/:key     -> body { value }  saves one key
//
// Data file: user-data.json (next to server.js).  Add it to .gitignore.

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const FILE = path.join(__dirname, '..', 'user-data.json');

// Only these keys can be saved (the names match the ones used in dashboard.html).
const ALLOWED = new Set([
  'bytesoft_projects',
  'bytesoft_meetings',
  'bytesoft_profile',
  'bytesoft_leave_balances',
  'bytesoft_leave_requests',
  'bytesoft_attendance'
]);
const MAX_VALUE_BYTES = 200 * 1024; // 200 KB per key is plenty

let store = {};
try {
  store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!store || typeof store !== 'object' || Array.isArray(store)) store = {};
} catch { store = {}; }

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(FILE, JSON.stringify(store, null, 2), err => {
      if (err) console.error('userdata: could not save', err.message);
    });
  }, 300);
}

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Please log in first.' });
}
router.use(requireLogin);

router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ data: store[String(req.session.userId)] || {} });
});

router.put('/:key', express.json({ limit: '300kb' }), (req, res) => {
  const key = req.params.key;
  if (!ALLOWED.has(key)) return res.status(400).json({ error: 'Unknown data key.' });
  const body = req.body || {};
  if (!('value' in body)) return res.status(400).json({ error: 'Missing value.' });
  if (JSON.stringify(body.value).length > MAX_VALUE_BYTES) {
    return res.status(413).json({ error: 'Data is too large.' });
  }
  const id = String(req.session.userId);
  if (!store[id]) store[id] = {};
  store[id][key] = body.value;
  scheduleSave();
  res.json({ ok: true });
});

module.exports = router;
