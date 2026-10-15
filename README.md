# TPC Performance OS

A deterministic "second clinician" for endurance athletes. The PT and the engine interpret the same assessment independently, the app compares them, and the clinician keeps final authority. No paid AI APIs.

**Stack:** React + TypeScript + Vite, Tailwind + shadcn/ui-style components, Node + Express, PostgreSQL + Drizzle.
**Layout (npm workspaces):**

| Package | Purpose |
| --- | --- |
| `packages/engine` | Pure TypeScript engine. `core/` is sport-agnostic (types, progression, PT-vs-engine comparison, roadmap, module registry). `modules/running/` is the first sport module. New sports implement `SportModule` and call `registerModule`. |
| `packages/server` | Express API, Drizzle schema + migrations, audit log, seed. |
| `packages/client` | Clinician interface (`/`) and athlete interface (`/a/<access-code>`). |

## Run locally

```bash
npm install
npm run dev        # API on :3001, web on :5173 (proxied)
npm test           # engine + API tests
```

With no `DATABASE_URL`, the server uses embedded Postgres (PGlite, stored in `packages/server/.pglite`) and seeds **synthetic** data. Demo logins (password `demo-password-1`, dev only): `admin@tpc.demo`, `clinician@tpc.demo`, `alex@tpc.demo` (approved program, one logged session), `sam@tpc.demo` (draft, screening flags, tibial restriction). Delete `.pglite` to reset.

## Authentication

- Email + password (scrypt hashes), server-side sessions in the database, `HttpOnly` / `SameSite=Lax` / `Secure` (on HTTPS) cookie, 7-day expiry.
- Roles: `admin` (manages team accounts), `clinician` (all athletes), `athlete` (only their own record, via `/api/me`).
- Athletes join through a one-time, 7-day invite link a clinician generates on the case page. Links are stored hashed and cannot be reused.
- CSRF: every non-GET request must carry `x-requested-with: tpc`. Login attempts are rate-limited (in-memory, per instance). Changing a password signs out other devices.
- All audit entries are attributed to the signed-in user, not a client-supplied name.
- Clinicians currently see every athlete (single-clinic model). Per-clinician caseloads, MFA and password reset by email are not built.

## Deploy (Railway)

Add a PostgreSQL service, then set `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` (10+ characters; creates the first admin when no users exist; rotate it after first sign-in). Build: `npm install && npm run build`. Start: `npm start`. The server runs migrations on boot and serves the built client.

## Safety and honesty

- Every rule is classified **source-verified / proposed default / needs verification**; see the in-app **Rules** page and `docs/rule-classification.md`.
- The engine **never** classifies REDs risk or grants medical clearance. It surfaces screening flags; approval requires a clinician acknowledgement, and a written review note when high-stakes flags exist.
- Authentication is implemented (see above), but this is not yet a reviewed, compliant system: before storing real patient data, review hosting, backups, encryption, consent and applicable health-privacy law.

## Not yet built

MFA / email password reset, per-clinician caseloads, taper planning, running-plan (non-gym) generation, rule-default editing UI (defaults are editable per prescription today, not globally), additional sport modules.
