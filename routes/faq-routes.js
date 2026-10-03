// routes/faq-routes.js — FAQs for ByteSoft (Express)
//
// Add to server.js, AFTER the session middleware:
//     app.use('/api/faq', require('./routes/faq-routes'));
//
// Endpoints (all need a logged-in user):
//     GET    /api/faq               -> { faqs, mine, pending, isManager }
//     POST   /api/faq/ask  { question }     -> user submits a question (status: pending)
//     POST   /api/faq/:id/answer { answer } -> MANAGER answers it (status: answered)
//     DELETE /api/faq/:id                   -> MANAGER removes a question
//
// Who is the manager?
//   Set MANAGER_USERNAMES in your .env, e.g.  MANAGER_USERNAMES=bkartikagar,priya
//   If it is not set, the first account that was ever registered is the manager.
//
// Data is stored in faq-data.json (next to server.js) so it survives restarts.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadUsers } = require('../db');

const router = express.Router();
const FILE = path.join(__dirname, '..', 'faq-data.json');
const MAX_QUESTION = 200;
const MIN_QUESTION = 5;
const MAX_ANSWER = 1000;
const MAX_PENDING_PER_USER = 5;

// ---- Starter FAQs (written to faq-data.json the first time the server runs) ----
const STARTER_FAQS = [
  ['How do I add a project?',
   'Click the + button in the Projects card, enter a title and a status, then press Save. You can edit or delete the project at any time.'],
  ['How do I add or change a meeting?',
   'Click the + button beside Meeting Schedule. Every meeting also has an Edit button and a Delete button.'],
  ['How do I apply for leave?',
   'Click Apply Leave on the calendar (or just tell Byte "apply for leave"). Choose the date, pick a full or half day, and add a reason. If you still have paid leave this month, it is approved right away; otherwise it goes to your manager.'],
  ['How do I edit my profile?',
   'Click your name or the profile card at the top right to open your profile page, change the fields you want, and press Save Profile.'],
  ['How do I clock in and out?',
   'Use the Clock in button in the Shifts & Attendance card. Press it again when your shift ends to clock out.'],
  ['What can Byte do?',
   'Byte can show your projects, meetings, profile and leave balance, add, rename or remove projects and meetings, and open FAQs, Support and the leave form. You can write to Byte in English or Hinglish.'],
  ['Where is my data stored?',
   'Your projects, meetings and profile are saved in this browser. FAQs and the public chat are stored on the ByteSoft server.'],
  ['My question is not listed. What should I do?',
   'Click the + icon at the top of this page and type your question. It will appear here as soon as the manager answers it.'],
  ['How do I check my leave balance?',
   'Ask Byte “show my leave balance” or check the leave balance shown in the dashboard.'],
  ['How do I open the FAQ or Support section?',
   'Use the FAQ or Support navigation item, or ask Byte to open FAQs or Support.'],
  ['Can I use Byte in Hinglish?',
   'Yes. Try simple commands such as “projects dikhao”, “meeting add karo”, or “chhutti apply karo”.'],
  ['Can I apply for more than one day of leave?',
   'For now, submit one date per leave request. You can choose a full day or a half day.'],
  ['How do I delete a project or meeting?',
   'Use the item’s menu or ask Byte to delete a project or meeting by its name or number.']
];

function seed() {
  const now = Date.now();
  return STARTER_FAQS.map(([question, answer], i) => ({
    id: now + i,
    question,
    answer,
    status: 'answered',
    askedBy: null,
    answeredBy: 'ByteSoft',
    ts: now + i,
    answeredTs: now + i
  }));
}

// ---- Storage ----
let items = [];
try {
  items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(items)) items = [];
} catch { items = []; }

if (!items.length) {
  items = seed();
  save();
}

let nextId = Math.max(Date.now(), ...items.map(i => i.id + 1));

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
  } catch (err) {
    console.error('faq: could not save', err.message);
  }
}

// ---- Who is who ----
function managerNames() {
  const fromEnv = String(process.env.MANAGER_USERNAMES || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  try {
    const first = loadUsers()[0];
    return first ? [String(first.username).toLowerCase()] : [];
  } catch { return []; }
}

function isManager(req) {
  const name = String((req.session && req.session.username) || '').toLowerCase();
  return !!name && managerNames().includes(name);
}

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Please log in first.' });
}

router.use(requireLogin);

const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

// Make sure a question starts with a capital letter and ends with a question mark.
function tidyQuestion(q) {
  let t = clean(q, MAX_QUESTION);
  if (!t) return t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[?.!]$/.test(t)) t += '?';
  return t;
}

function tidyAnswer(a) {
  let t = String(a || '').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_ANSWER);
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---- Routes ----
router.get('/', (req, res) => {
  const manager = isManager(req);
  const me = req.session.username;
  const faqs = items
    .filter(i => i.status === 'answered')
    .sort((a, b) => a.answeredTs - b.answeredTs)
    .map(({ id, question, answer }) => ({ id, question, answer }));
  const mine = items
    .filter(i => i.status === 'pending' && i.askedBy === me)
    .map(({ id, question, ts }) => ({ id, question, ts }));
  const pending = manager
    ? items.filter(i => i.status === 'pending').map(({ id, question, askedBy, ts }) => ({ id, question, askedBy, ts }))
    : [];

  res.set('Cache-Control', 'no-store');
  res.json({ faqs, mine, pending, isManager: manager });
});

router.post('/ask', express.json({ limit: '5kb' }), (req, res) => {
  const me = req.session.username;
  const question = tidyQuestion((req.body || {}).question);

  if (question.length < MIN_QUESTION) {
    return res.status(400).json({ error: 'Please type a full question.' });
  }
  const duplicate = items.find(i => i.question.toLowerCase() === question.toLowerCase());
  if (duplicate) {
    return res.status(409).json({
      error: duplicate.status === 'answered'
        ? 'This question is already answered in the list above.'
        : 'This question has already been sent to the manager.'
    });
  }
  if (items.filter(i => i.status === 'pending' && i.askedBy === me).length >= MAX_PENDING_PER_USER) {
    return res.status(429).json({ error: `You already have ${MAX_PENDING_PER_USER} questions waiting for an answer.` });
  }

  const item = {
    id: nextId++, question, answer: '', status: 'pending',
    askedBy: me, answeredBy: null, ts: Date.now(), answeredTs: 0
  };
  items.push(item);
  save();
  res.status(201).json({ message: 'Your question was sent. It will appear in the FAQs once the manager answers it.', id: item.id });
});

router.post('/:id/answer', express.json({ limit: '10kb' }), (req, res) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Only a manager can answer questions.' });
  const item = items.find(i => String(i.id) === req.params.id);
  if (!item) return res.status(404).json({ error: 'Question not found.' });

  const answer = tidyAnswer((req.body || {}).answer);
  if (!answer) return res.status(400).json({ error: 'Please type an answer.' });

  item.answer = answer;
  item.status = 'answered';
  item.answeredBy = req.session.username;
  item.answeredTs = Date.now();
  save();
  res.json({ message: 'Answer published.' });
});

router.delete('/:id', (req, res) => {
  if (!isManager(req)) return res.status(403).json({ error: 'Only a manager can remove questions.' });
  const before = items.length;
  items = items.filter(i => String(i.id) !== req.params.id);
  if (items.length === before) return res.status(404).json({ error: 'Question not found.' });
  save();
  res.json({ message: 'Removed.' });
});

module.exports = router;
