# Basura Watch — Full Setup

The app is now two services:

- **`backend-swms/`** — Express + Prisma + PostgreSQL API (auth + data)
- **`swms-frontend/`** — Next.js UI (proxies `/api/*` to the backend)

The mock data is gone; every screen reads from the database, and login is real
(username + password, hashed with bcrypt, JWT in an httpOnly cookie) with
role-based access control for `admin`, `purok-leader`, and `resident`.

## 1. Database — already configured (Neon)

The backend points at a **Neon** cloud PostgreSQL database via `DATABASE_URL` in
`backend-swms/.env`, so there's nothing to install. TLS is handled automatically
(`sslmode=require`). Prisma manages the schema via migrations in
`backend-swms/prisma/migrations`.

## 2. Backend

```bash
cd backend-swms
npm install
npm run db:generate # generates the Prisma client
npm run db:migrate  # applies migrations to the database
npm run db:seed     # loads sample data + demo accounts
npm run dev          # API on http://localhost:8000
```

## 3. Frontend

In a second terminal:

```bash
cd swms-frontend
npm install
npm run dev         # UI on http://localhost:3000
```

`swms-frontend/.env.local` already points `BACKEND_URL` at `http://localhost:8000`
and shares the same `AUTH_JWT_SECRET` as the backend's `JWT_SECRET`. **If you
change the JWT secret, change it in both files.**

## 4. Log in

Open http://localhost:3000 and use a demo account (the login screen has
click-to-fill buttons):

Login now requires username, email, **and** password to all match.

| Role         | Username   | Email                          | Password      |
| ------------ | ---------- | ------------------------------- | ------------- |
| Admin        | `admin`    | `admin@basurawatch.test`        | `admin123`    |
| Purok Leader | `leader`   | `leader@basurawatch.test`       | `leader123`   |
| Resident     | `resident` | `resident@basurawatch.test`     | `resident123` |

## How auth & RBAC fit together

1. `POST /api/auth/login` verifies the password and sets an httpOnly `swms_token`
   cookie containing a signed JWT (role + scope).
2. Next.js `proxy.ts` reads that cookie and keeps users inside the route group
   for their role (`/admin`, `/purok-leader`, `/resident`), redirecting others.
3. The Express API independently verifies the same cookie on every request and
   scopes each query — a resident only ever receives their own household's data,
   a leader only their purok. **This is the real security boundary.**

## Also fixed in this pass

- **QR "Print sticker"** now prints the QR sticker itself (it was hidden by a
  `no-print` class before, so only the instructions printed).
- **Hydration mismatch** from reading the session during render is gone — the
  session is resolved after mount via `/api/auth/me`.
- **Mobile nav** no longer highlights "Dashboard" on every sub-page.
