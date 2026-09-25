// A minimal "database" that stores users in a JSON file on disk.
// Good for learning/demo purposes. For production, swap this out
// for a real database (Postgres, MySQL, MongoDB, etc.) — the
// routes/auth.js file is written so that swap only touches this file.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw || '[]');
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function findUserByUsername(username) {
  const users = loadUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function createUser(user) {
  const users = loadUsers();
  users.push(user);
  saveUsers(users);
  return user;
}

module.exports = { loadUsers, saveUsers, findUserByUsername, createUser };
