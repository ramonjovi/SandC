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
- **Video frames:** in the Assess tab, the "Video frames for the report" card has a slot for each phase (foot strike, overstride, shin angle, peak knee flexion, hip extension, vertical bounce, pelvic drop, knee window, foot width, heel tilt, heel whip, pogo hops, jump, Nordic). Screenshot the frame from your phone video, add it, optionally mark it up and measure it (level the picture on a true vertical such as a door frame; set a scale from something of known length so lengths, horizontal gaps and vertical gaps read in centimetres; angle from true vertical; angle between lines; vertical and horizontal reference lines; line, arrow, circle, freehand pen, text label; six colours; undo). The vertical oscillation slot has a small calculator: bounce = pelvis height at the highest point of flight minus the lowest point of stance, and edit the "what this might mean" text (a hedged draft is pre-filled from what you entered in the form). Pictures are shrunk in the browser, stored in the database, visible only to signed-in clinicians, included in backups, and deleted with the athlete. The default consent form has an optional tick-box for pictures; the card warns if a signed form does not show it.
- **PDF reports:** Progress tab → "Create PDF report for athlete". The default **Results and proposed plan** report (first visit) opens with the goal, an "At a glance" summary and "What is going well" / "What we will work on" boxes (you write these), then **1 Your results** (plain-language test table and video observations), **2 What it means** (your overall reading plus the saved video frames, two cards across) and **3 Your plan** (an 8-week overview, the week 1 exercises, key dates and the goal targets). **Progress update** adds baseline-versus-latest columns, trend charts and the training log. Tick the sections you want, add notes and next steps, then Print and choose "Save as PDF" (turn off headers and footers). Screening answers and engine reasoning are never included.

## Using it on your own computer (Windows)

1. **Start:** double-click `start.bat`. It backs up your data, builds the app, opens http://localhost:3001 and runs it. Keep that window open while you work; closing it stops the app.
2. **First time only, your own account** (close the app first): `npm run make-admin` asks for your email, name and password (typed hidden). Then `npm run remove-demo` removes the `*@tpc.demo` logins and the two synthetic demo athletes. It keeps every real athlete and refuses to run until you have your own account. Demo data is only ever created on a completely empty database, so it will not come back.
3. **Backups:** `start.bat` makes one before each start and keeps the newest 14 in the `backups` folder (not uploaded to GitHub). Copy that folder to a USB drive or cloud drive now and then: a backup on the same computer does not protect you if the computer is lost. `npm run restore` lists them; `npm run restore -- <name>` puts one back (your current data is kept aside first). The tools refuse to run while the app is open.

## Deploy (Railway)

Add a PostgreSQL service, then set `DATABASE_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` (10+ characters; creates the first admin when no users exist; rotate it after first sign-in). Build: `npm install && npm run build`. Start: `npm start`. The server runs migrations on boot and serves the built client.

## Editable rule defaults

Clinicians can change the numeric defaults of rules (DSI bands, plyometric contact caps, progression percentages, pace fractions and so on) on the **Rules** page. Each value has a validated range (for source-backed rules, the range the source supports), every change requires a written reason, and every change and reset is recorded in the audit log and the **Change history** tab. Changes apply to new interpretations, newly generated programs and future athlete logging; programs already generated keep their values, and each report and program records which overrides were in effect. Engine tests check that every editable value is actually read by the engine.

## Choosing sessions, archiving athletes, and the clinician guide

- **Sessions per week:** when generating a program choose 1, 2 (default) or 3 gym sessions. One keeps both heavy lifts in a whole-body session; three adds a light third session (calves, hips, low-level reactive work, no heavy lifts). Race week is always one light session.
- **Archive / delete:** *Archive this athlete* on the case page hides them and blocks their sign-in (reversible, "Show archived" on the athlete list). *Delete permanently* is only offered for archived athletes, needs the exact name typed, erases all their records, and wipes the content of their audit rows (it keeps that a deletion happened, who did it and when).
- **Guide:** each case has a "what to do next" checklist (intake, test day, interpretation, program, approval, invite, first session, retest), every test has a "How to run" panel, every exercise has a "Coach this exercise" panel for the clinician and a "How to do it" panel for the athlete, and the Program tab has a short guide to running a gym session. `docs/test-protocols.md` is the printable test-day guide.

## Consent

- **Consent form (top bar):** the privacy notice and tick-boxes athletes agree to. Each version is drafted by one clinician and must be **reviewed and approved by a different clinician** (not the author or last editor, with a short note of what was checked, and no [[blanks]] left). Approved versions are never edited; a change is a new version, and the previous one is retired.
- **Where the data is kept** is filled in automatically from where the app runs (the clinic computer, or Railway when `RAILWAY_ENVIRONMENT` is set), so a signed form never states a place that is not true.
- **Signing:** on the case page's Consent card (athlete reads and types their name on the clinic device), in the athlete's own account, or as a recorded signed paper form. Under 18 requires a named parent or guardian. Each signature stores the exact wording, version and approval details.
- **What it controls:** a program cannot be approved, and an athlete cannot see their own data or log sessions, without active consent. Withdrawing consent blocks both again. Permanent deletion also removes consent records.
- The wording is a plain-language template, not legal advice: have it checked against the privacy and health-records law where TPC operates.

## Safety and honesty

- Every rule is classified **source-verified / proposed default / needs verification**; see the in-app **Rules** page and `docs/rule-classification.md`.
- The engine **never** classifies REDs risk or grants medical clearance. It surfaces screening flags; approval requires a clinician acknowledgement, and a written review note when high-stakes flags exist.
- Authentication is implemented (see above), but this is not yet a reviewed, compliant system: before storing real patient data, review hosting, backups, encryption, consent and applicable health-privacy law.

## Not yet built

MFA / email password reset, per-clinician caseloads, taper planning, running-plan (non-gym) generation, additional sport modules.
