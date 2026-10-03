// JSON-file user store for this learning/demo app.
const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, 'users.json');
function loadUsers() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '[]');
}
function saveUsers(users) { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }
function findUserByUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  return loadUsers().find(u => String(u.username || '').toLowerCase() === key);
}
function createUser(user) { const users = loadUsers(); users.push(user); saveUsers(users); return user; }
function updateUserById(id, changes) {
  const users = loadUsers(); const i = users.findIndex(u => String(u.id) === String(id));
  if (i < 0) return null; users[i] = { ...users[i], ...changes }; saveUsers(users); return users[i];
}
function updateUserByUsername(username, changes) {
  const user = findUserByUsername(username); return user ? updateUserById(user.id, changes) : null;
}
module.exports = { loadUsers, saveUsers, findUserByUsername, createUser, updateUserById, updateUserByUsername };
