import rateLimit from "express-rate-limit";

// Applied only to the two endpoints an attacker would actually target
// (password guessing, reset-email spam) — never mounted globally, so normal
// authenticated traffic for residents/admins/purok-leaders is unaffected.
//
// Limits are deliberately generous, not maximally strict: this is a small
// barangay system, not a target worth tuning against sophisticated
// distributed brute force, and an overly tight limit risks locking out a
// real person (or a live capstone-defense demo) over a couple of mistyped
// passwords. Both windows reset automatically; a legitimate user who waits
// is never permanently blocked.

// 10 *failed* attempts per 15 minutes per IP. Only failures count
// (skipSuccessfulRequests) — a legitimate user (or a demo repeatedly
// switching between admin/purok-leader/resident accounts) logging in
// correctly never spends down this budget; only wrong-password guesses do.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many login attempts. Please try again later." });
  },
});

// 5 requests per hour per IP. Forgot-password sends an email — the limit is
// tighter than login because the cost of abuse (spamming a resident's inbox,
// or hammering the SMTP provider) is higher than a few wrong guesses.
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many password reset requests. Please try again later." });
  },
});
