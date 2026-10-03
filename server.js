require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Hosting platforms (Render, Railway, etc.) sit behind a proxy that
// terminates HTTPS for you. This tells Express to trust that proxy
// so secure cookies work correctly.
if (isProduction) {
  app.set('trust proxy', 1);
}

// Parse JSON and form bodies sent from the front end
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions: this is what "remembers" a user is logged in between requests
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction, // only send the cookie over HTTPS in production
    maxAge: 1000 * 60 * 60 * 2 // session lasts 2 hours
  }
}));

// Serve the front-end files (public/index.html, public/dashboard.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// All auth endpoints live under /api/auth
app.use('/api/auth', authRoutes);
app.use('/api/byte', require('./routes/byte-routes'));
app.use('/api/faq', require('./routes/faq-routes'));

// Middleware to protect routes that require login
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// Example protected API route — the dashboard page calls this
app.get('/api/dashboard-data', requireAuth, (req, res) => {
  res.json({ message: `Welcome back, ${req.session.username}!` });
});

app.use(require('./chat-routes'));

app.listen(PORT, () => {
  console.log(`ByteSoft server running at http://localhost:${PORT}`);
});
