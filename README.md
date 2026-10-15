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

## Progress, logging and PDF reports

- **Clinician logging:** on the Progress tab, a session grid shows every planned session. If an athlete forgot to log, click "Log Session A/B", pick the date it was done and enter the sets. Weekly running volume can be entered the same way. Clinician-entered logs are marked "entered by <name>"; a wrong log can be deleted (kept in the audit history).
- **Trend charts:** per-goal charts (baseline, each retest, target), heaviest set per session, and weekly running volume. Every chart has a table view and a hover tooltip.
- **PDF reports:** Progress tab → "Create PDF report for athlete" → choose Baseline or Progress update, tick the sections, add notes, then Print and choose "Save as PDF" (turn off headers and footers). Screening answers and engine reasoning are never included.

## Deploy (Railway)

Add a PostgreSQL service, then set `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` (10+ characters; creates the first admin when no users exist; rotate it after first sign-in). Build: `npm install && npm run build`. Start: `npm start`. The server runs migrations on boot and serves the built client.

## Editable rule defaults

Clinicians can change the numeric defaults of rules (DSI bands, plyometric contact caps, progression percentages, pace fractions and so on) on the **Rules** page. Each value has a validated range (for source-backed rules, the range the source supports), every change requires a written reason, and every change and reset is recorded in the audit log and the **Change history** tab. Changes apply to new interpretations, newly generated programs and future athlete logging; programs already generated keep their values, and each report and program records which overrides were in effect. Engine tests check that every editable value is actually read by the engine.

## Safety and honesty

- Every rule is classified **source-verified / proposed default / needs verification**; see the in-app **Rules** page and `docs/rule-classification.md`.
- The engine **never** classifies REDs risk or grants medical clearance. It surfaces screening flags; approval requires a clinician acknowledgement, and a written review note when high-stakes flags exist.
- Authentication is implemented (see above), but this is not yet a reviewed, compliant system: before storing real patient data, review hosting, backups, encryption, consent and applicable health-privacy law.

## Not yet built

MFA / email password reset, per-clinician caseloads, taper planning, running-plan (non-gym) generation, additional sport modules.
