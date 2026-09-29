# Basura Watch — Full Setup

The app is two services:

- **`backend-swms/`** — Express + Prisma + PostgreSQL API (auth + data)
- **`swms-frontend/`** — Next.js UI (proxies `/api/*` to the backend)

Every screen reads from the database, and login is real (username + password,
hashed with bcrypt, JWT in an httpOnly cookie) with role-based access control
for `admin`, `purok-leader`, and `resident`.

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
click-to-fill buttons).

Login authenticates with **username + password** only.

| Role         | Username                     | Password                |
| ------------ | ----------------------------- | ------------------------ |
| Admin        | `ADMIN_DEMO_USERNAME`         | see local seed/demo config |
| Purok Leader | `PUROK_LEADER_DEMO_USERNAME`  | see local seed/demo config |
| Resident     | `RESIDENT_DEMO_USERNAME`      | see local seed/demo config |

The actual demo usernames and password are set by `backend-swms/prisma/seed.ts`
(printed to the console when you run `npm run db:seed`) — pull them from there
or from your local `.env`/demo environment rather than from this document.

## How auth & RBAC fit together

1. `POST /api/auth/login` verifies the password and sets an httpOnly `swms_token`
   cookie containing a signed JWT (role + scope).
2. Next.js `proxy.ts` reads that cookie and keeps users inside the route group
   for their role (`/admin`, `/purok-leader`, `/resident`), redirecting others.
3. The Express API independently verifies the same cookie on every request and
   scopes each query — a resident only ever receives their own household's data,
   a leader only their purok. **This is the real security boundary.**

## Feature overview

**Households & residents** — Purok Leaders register households (with family
members and a resident login account) under their own purok; Admin sees and
manages all of them.

**QR trash collection** — Purok Leaders scan a household's QR code to log a
collection as compliant, a violation, or missed, and record who physically
disposed of the trash (the household's own representative, or a family
member/other person). Only one trash log is allowed per household per
calendar date — enforced by both a pre-check and a database unique
constraint, so a retried or concurrent duplicate scan is rejected cleanly
rather than silently double-counted.

**Violations & repeat-offense tracking** — A violation-status trash log
automatically creates a violation record in the same transaction. A household
is flagged as a repeat offender the moment it already has *any* prior
violation on record (regardless of whether that earlier violation was later
completed — completed violations still count toward this).

**Violation lifecycle (Active → Completed)** — Admin and Purok Leaders can
mark a violation as completed once the household has corrected the behavior
and staff has closed the record. Completed violations are never deleted —
they remain permanently visible as history (to Admin, the relevant Purok
Leader, and the affected resident) alongside their completion date and which
staff member closed them. Residents can view both active and completed
violations but cannot change a violation's status themselves.

**Notifications** — Household-specific and purok-wide (leader-only or
resident-visible) notifications are created automatically for real events:
a new violation notifies both the affected resident and the purok leader; a
completed violation notifies the resident. Read state is tracked per user,
so one person reading a shared notification doesn't mark it read for anyone
else.

**Payments** — Purok Leaders and Admin record payments against a household
for a billing period (e.g. "September 2026"). "Paid/unpaid for the current
period" is always derived by matching real payment records against the
server's own current-period definition — never from a client clock or a
static stored flag. OR numbers, where recorded, are validated for
uniqueness both on submission and at the database level, so two payments can
never end up sharing the same receipt number even under a race.

**Purok archive/restore** — Admin can archive a purok (its leader's
operational access is suspended, but residents and historical data are
completely unaffected) and restore it within a 30-day window. Permanent
deletion is only ever allowed after that window has passed and the purok has
zero remaining households, accounts, or notifications referencing it —
nothing is ever cascade-deleted.

**Admin Settings** — a single, admin-only system-wide record (barangay name,
municipality, contact number, monthly collection fee, collection days,
collection time). The monthly fee feeds the admin payment-collection
statistics; the other fields are informational.

**Exports** — Admin can export households, trash logs, payments, and
violations to CSV. Purok Leaders export their own trash logs, violations,
and payments as genuine `.xlsx` Excel workbooks (not renamed CSV), with a
frozen header row, sensible column widths, and — for violations —
completion status and date included alongside the original fields.

## Environment variables

Both services ship a documented `.env.example` (`backend-swms/.env.example`,
`swms-frontend/.env.example`) — copy each to `.env` / `.env.local` and fill in
real values. The comments in those files explain what each variable does and
its security implications (CORS origin, cookie `Secure` flag, the JWT secret
shared between both services, the SMTP settings used for password-reset
email, and the explicit opt-in guards required before the destructive
`db:wipe` or `db:seed:demo` scripts will run). **Never commit a real `.env`
or `.env.local` file** — both are already gitignored.

## Database migrations

Schema changes live in `backend-swms/prisma/migrations/`, applied in order
via `npm run db:migrate` (development) or `prisma migrate deploy` (any other
environment). Every migration in this project has been generated, manually
inspected for safety, and applied one at a time — none are destructive to
existing data; some add columns with safe defaults, none drop or rewrite
existing rows.

## Security notes

- Passwords are hashed with bcrypt; JWTs are signed and stored in an
  `httpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- Every API route re-derives its own authorization/scope from the verified
  session on every request — the frontend's route guarding is a UX
  convenience only, never the actual security boundary.
- Login and forgot-password are rate-limited per IP; other endpoints require
  authentication first.
- Logging out clears the session cookie but does not revoke the underlying
  token server-side before its normal expiry — a known tradeoff of this
  project's stateless-JWT design, not an oversight.

## Known limitations

- No automated test suite exists yet; verification has been manual and
  live, batch by batch, throughout development.
- `swms-frontend/README.md` is still the default `create-next-app`
  boilerplate — this file is the project's real setup documentation.
