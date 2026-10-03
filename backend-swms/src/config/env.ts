import "dotenv/config";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Most PaaS platforms (Render, Railway, Heroku, etc.) set this automatically
// in production. Local `npm run dev` never sets it, so isProduction is false
// there unless explicitly overridden — verify NODE_ENV=production is actually
// set in whatever environment you deploy to.
const isProduction = process.env.NODE_ENV === "production";

// In development, a missing FRONTEND_URL safely falls back to the Next dev
// server's default origin. In production there is no safe default — an
// unset value would silently let CORS reject the real frontend, so it's
// required instead, matching the existing required()/JWT_SECRET pattern.
const frontendOrigin = isProduction
  ? required("FRONTEND_URL", process.env.FRONTEND_URL)
  : process.env.FRONTEND_URL || "http://localhost:3000";

// Defaults to Secure in production (cookies must not be sent over plain
// HTTP) and non-Secure in development (so plain http://localhost still
// works). COOKIE_SECURE, if explicitly set, always wins — e.g. to test
// production-like behavior locally over HTTPS, or to force it off behind a
// proxy that already terminates TLS in a way that needs verifying.
const cookieSecureOverride = process.env.COOKIE_SECURE;
const cookieSecure = cookieSecureOverride !== undefined ? cookieSecureOverride === "true" : isProduction;

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 8000),
  frontendOrigin,
  databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL),
  jwtSecret: required("JWT_SECRET", process.env.JWT_SECRET),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  cookieSecure,
  cookieName: "swms_token",
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
  },
};
