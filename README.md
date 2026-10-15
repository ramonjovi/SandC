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

With no `DATABASE_URL`, the server uses embedded Postgres (PGlite, stored in `packages/server/.pglite`) and seeds two **synthetic** athletes. Athlete demo links: `/a/alex-demo-0001` (approved program, one logged session) and `/a/sam-demo-0002` (draft, screening flags, tibial restriction). Delete `.pglite` to reset.

## Deploy (Railway)

Add a PostgreSQL service, then set `DATABASE_URL` (and `CLINICIAN_TOKEN`). Build: `npm install && npm run build`. Start: `npm start`. The server runs migrations on boot and serves the built client.

## Safety and honesty

- Every rule is classified **source-verified / proposed default / needs verification**; see the in-app **Rules** page and `docs/rule-classification.md`.
- The engine **never** classifies REDs risk or grants medical clearance. It surfaces screening flags; approval requires a clinician acknowledgement, and a written review note when high-stakes flags exist.
- Athlete links and the shared `CLINICIAN_TOKEN` are placeholders. **Add real authentication before storing real patient data.**

## Not yet built

Authentication/roles, GitHub Actions CI, taper planning, running-plan (non-gym) generation, rule-default editing UI (defaults are editable per prescription today, not globally), additional sport modules.
