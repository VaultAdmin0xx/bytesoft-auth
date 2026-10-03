# ByteSoft password recovery update

## What's added
- Sign-up now asks the user to choose a recovery question and enter an answer.
- The answer is normalized (trimmed and lowercased) and stored as a bcrypt hash; it is never stored as readable text.
- The login page has a **Forgot password?** flow: enter username, load the selected question, answer it, and set a new password.
- Password reset is handled server-side and new passwords are bcrypt-hashed. Passwords must be at least 8 characters.
- Logged-in password change endpoint is also available at `POST /api/auth/change-password` (requires current password).

## Run
1. Install Node.js.
2. Run `npm install` in this folder.
3. Set a strong `SESSION_SECRET` environment variable for deployment.
4. Run `npm start` and open `http://localhost:3000`.

## Important notes
- This demo uses a JSON file as its user database. For production, use a database, rate-limit recovery attempts, and consider email-based recovery or MFA. Security questions are weaker than modern recovery methods because answers may be guessable.
- For this requested demo reset, the included `users.json` is intentionally empty. Existing accounts/passwords in the previous user store are removed; everyone must register again and choose a recovery question. Back up your old user data first if you might need it later.

## Calendar updates
- Added a **Total Leave Taken** summary (approved leave only; half-days count as 0.5 day).
- Added a pending-request count and an expandable **Holiday History** panel showing dates, full/half-day type, reason, and status.
- Existing account data has been reset for this updated demo: `users.json` starts as an empty array. Users need to register again and set a security question/answer.
- Leave history remains browser-local (`localStorage`) in this demo and is not synced across devices or accounts.
