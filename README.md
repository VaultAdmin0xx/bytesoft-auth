# ByteSoft — Login Backend Setup

## What this is
A small Node.js/Express server that adds real login to your front end:
- Passwords are hashed with bcrypt (never stored in plain text)
- Sessions via cookies, so the server knows who's logged in
- A protected `/dashboard.html` page that only loads if you're authenticated
- Users stored in `users.json` (swap for a real database later — see note at the bottom)

## File overview
```
bytesoft-auth/
├── server.js           # starts the app, sets up sessions, serves front end
├── db.js                # simple JSON-file "database" for users
├── routes/auth.js       # /register, /login, /logout, /me endpoints
├── routes/byte-routes.js# Byte assistant (English + Hinglish)
├── routes/faq-routes.js # FAQs + questions from users (pending until the manager answers)
├── faq.json             # created automatically the first time the server runs
├── public/index.html    # your login/signup page (front end)
├── public/dashboard.html# page shown after a successful login
├── package.json
└── .env.example
```

## Step 1 — Install Node.js
If you don't have it: download from https://nodejs.org (LTS version). Check it worked:
```bash
node -v
npm -v
```

## Step 2 — Install dependencies
Open a terminal in the `bytesoft-auth` folder and run:
```bash
npm install
```
This downloads Express, bcrypt, sessions, etc. based on `package.json`.

## Step 3 — Set your session secret
Copy the example env file and edit it:
```bash
cp .env.example .env
```
Open `.env` and replace `SESSION_SECRET` with a long random string (this is what signs your session cookies — keep it private and never commit it to git).

## Step 4 — Run the server
```bash
npm start
```
You should see:
```
ByteSoft server running at http://localhost:3000
```

## Step 5 — Try it out
Open `http://localhost:3000` in your browser.
- Click "Sign up", create an account (username + password, min 8 characters)
- It'll flip back to the login form — log in with those same credentials
- On success you're redirected to `/dashboard.html`, which only renders because the server checked your session

## FAQs and the manager
Users can submit their own question with the **+** button on the FAQs page. It stays **pending** (only the person who asked and the manager can see it) until the manager writes an answer, then it is published for everyone.

Who is the manager? Add this to your `.env` (comma-separated for more than one person):
```
MANAGER_USERNAMES=bkartikagar
```
If you don't set it, the first account in `users.json` is the manager.

## How the pieces talk to each other
1. `public/index.html` has a form. Its JavaScript sends a `fetch()` POST to `/api/auth/login` or `/api/auth/register` with JSON `{ username, password }`.
2. `routes/auth.js` receives that request:
   - **Register**: checks the username isn't taken, hashes the password with bcrypt, saves the new user to `users.json`.
   - **Login**: looks up the user, compares the submitted password against the stored hash with `bcrypt.compare`, and if it matches, stores `userId` in `req.session`.
3. Express automatically sets a cookie in the browser tied to that session.
4. On later requests (like loading `/dashboard.html`), the browser sends that cookie back automatically, so `server.js`'s `requireAuth` middleware can check `req.session.userId` and decide whether to let the request through.
5. Logging out destroys the session server-side and clears the cookie.

## Security notes worth knowing
- Passwords are **hashed**, not encrypted — there's no way to "recover" a password, only reset it.
- Sessions currently use Express's default in-memory store, which is fine for local development but **resets whenever you restart the server** and doesn't scale across multiple server processes. For production, use a persistent store like `connect-redis` or `connect-pg-simple`.
- `users.json` is a flat file for learning purposes. For anything real, swap `db.js` for a proper database (see below) — the rest of the app doesn't need to change since `routes/auth.js` only calls `findUserByUsername` and `createUser`.
- Always run this behind HTTPS in production, and set `cookie.secure = true` in `server.js` once you do, so cookies only travel over HTTPS.

## Swapping in a real database later
Replace the contents of `db.js` with calls to your database of choice (Postgres, MySQL, MongoDB, etc.), keeping the same three exported function names (`findUserByUsername`, `createUser`, and whatever else you add). Nothing in `routes/auth.js` or `server.js` needs to change.
