const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByUsername, createUser, updateUserById, updateUserByUsername } = require('../db');
const router = express.Router();
const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What city were you born in?',
  'What was the name of your first pet?',
  'What is the first name of your oldest cousin?',
  'What was your childhood nickname?'
];

router.post('/register', async (req, res) => {
  try {
    const { username, password, email, name, securityQuestion, securityAnswer } = req.body;
    if (!username || !password || !securityQuestion || !securityAnswer) return res.status(400).json({ error: 'Username, password, security question, and answer are required.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!SECURITY_QUESTIONS.includes(securityQuestion)) return res.status(400).json({ error: 'Choose a valid security question.' });
    if (String(securityAnswer).trim().length < 2) return res.status(400).json({ error: 'Your security answer must be at least 2 characters.' });
    if (findUserByUsername(username)) return res.status(409).json({ error: 'That username is already taken.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const securityAnswerHash = await bcrypt.hash(String(securityAnswer).trim().toLowerCase(), 12);
    createUser({ id: Date.now().toString(), username: String(username).trim(), name: name || '', email: email || null, passwordHash, securityQuestion, securityAnswerHash });
    res.status(201).json({ message: 'Account created. You can now log in.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = findUserByUsername(username);
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid username or password.' });
    req.session.userId = user.id; req.session.username = user.username;
    res.json({ message: 'Login successful.', username: user.username, name: user.name || '', email: user.email || '' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); }
});

// Return the registered question for the supplied username. The answer itself is never returned.
router.post('/forgot-password/question', (req, res) => {
  const user = findUserByUsername(req.body.username);
  if (!user || !user.securityQuestion || !user.securityAnswerHash) return res.status(404).json({ error: 'We could not find recovery details for that username. Older accounts may need to be registered again to enable recovery.' });
  res.json({ securityQuestion: user.securityQuestion });
});

router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;
    if (!username || !securityAnswer || !newPassword) return res.status(400).json({ error: 'Fill in every field.' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    const user = findUserByUsername(username);
    if (!user || !user.securityAnswerHash || !(await bcrypt.compare(String(securityAnswer).trim().toLowerCase(), user.securityAnswerHash))) return res.status(400).json({ error: 'The username or security answer is incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    updateUserById(user.id, { passwordHash });
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); }
});

router.post('/change-password', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
    const { currentPassword, newPassword } = req.body;
    const user = require('../db').loadUsers().find(u => String(u.id) === String(req.session.userId));
    if (!user || !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect.' });
    if (String(newPassword || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    updateUserById(user.id, { passwordHash: await bcrypt.hash(newPassword, 12) });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); }
});

router.post('/logout', (req, res) => { req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ message: 'Logged out.' }); }); });
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) return res.json({ loggedIn: true, username: req.session.username });
  res.json({ loggedIn: false });
});
module.exports = router;
