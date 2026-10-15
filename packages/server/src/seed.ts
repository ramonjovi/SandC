import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM, type Program } from "@tpc/engine";
import { createApp } from "./app";
import { hashPassword, passwordProblem } from "./auth";
import { openDb, schema, type Db } from "./db";

/** Demo credentials for SYNTHETIC data in local development only (never seeded when DATABASE_URL is set). */
export const DEMO_PASSWORD = "demo-password-1";
export const DEMO_USERS = {
  admin: "admin@tpc.demo",
  clinician: "clinician@tpc.demo",
  alex: "alex@tpc.demo",
  sam: "sam@tpc.demo",
};

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the users table is empty. */
export async function bootstrapAdmin(db: Db) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if ((await db.select().from(schema.users).limit(1)).length) return;
  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_PASSWORD rejected: ${problem}`);
  await db.insert(schema.users).values({ id: randomUUID(), email, name: process.env.ADMIN_NAME ?? "Administrator", role: "admin", passwordHash: await hashPassword(password) });
  console.log(`Created initial admin ${email}`);
}

/** Seeds SYNTHETIC users and athletes by exercising the real HTTP API end to end. */
export async function seedIfEmpty(db: Db) {
  if ((await db.select().from(schema.athletes).limit(1)).length) return;
  const hash = await hashPassword(DEMO_PASSWORD);
  const addUser = (email: string, name: string, role: string, athleteId: string | null = null) =>
    db.insert(schema.users).values({ id: randomUUID(), email, name, role, passwordHash: hash, athleteId });
  if (!(await db.select().from(schema.users).where(eq(schema.users.email, DEMO_USERS.admin))).length) await addUser(DEMO_USERS.admin, "Demo Admin", "admin");
  await addUser(DEMO_USERS.clinician, "Dr. Demo (PT)", "clinician");

  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const sessionFor = async (email: string) => {
    const r = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-requested-with": "tpc" }, body: JSON.stringify({ email, password: DEMO_PASSWORD }) });
    if (!r.ok) throw new Error(`login failed for ${email}`);
    return r.headers.get("set-cookie")!.split(";")[0];
  };
  const caller = (cookie: string) => async (method: string, url: string, body?: unknown) => {
    const r = await fetch(base + url, { method, headers: { "content-type": "application/json", "x-requested-with": "tpc", cookie }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(j)}`);
    return j as any;
  };
  try {
    const call = caller(await sessionFor(DEMO_USERS.clinician));
    for (const [fixture, email] of [[SYNTHETIC_ALEX, DEMO_USERS.alex], [SYNTHETIC_SAM, DEMO_USERS.sam]] as const) {
      const a = await call("POST", "/athletes", { profile: fixture.profile, goals: fixture.goals, isSynthetic: true });
      await addUser(email, fixture.profile.name, "athlete", a.id);
      await call("PUT", `/assessments/${a.assessmentId}`, { data: fixture });
      await call("POST", `/assessments/${a.assessmentId}/interpret`);
      if (fixture === SYNTHETIC_ALEX) {
        // PT interpretation that deliberately differs from the engine in one respect.
        await call("PUT", `/assessments/${a.assessmentId}/pt-interpretation`, {
          priorityKeys: ["hip_stability", "calf_soleus", "power_rfd"], strategy: "combined",
          reasoning: "Pelvic drop and calf asymmetry are the main findings. I would like some reactive work earlier given the 10k pace.",
        });
        const prog = await call("POST", `/assessments/${a.assessmentId}/program`);
        await call("POST", `/programs/${prog.id}/approve`, { screeningReviewed: true });
        const program = ((await call("GET", `/athletes/${a.id}`)).programs[0].data) as Program;
        const s = program.weeks[0].sessions[0];
        const me = caller(await sessionFor(DEMO_USERS.alex));
        await me("POST", "/me/session-logs", {
          week: 1, day: 1, cmjHeightCm: 36,
          exercises: s.exercises.map((e) => ({
            prescribedId: e.id, exerciseId: e.exerciseId,
            sets: Array.from({ length: e.sets }, () => ({ reps: e.reps, loadKg: e.loadKg })),
            rirFinal: e.rir, pain: null,
          })),
        });
        await me("POST", "/me/weekly-logs", { weekStart: "2026-09-28", runKm: 52 });
        await me("POST", "/me/weekly-logs", { weekStart: "2026-10-05", runKm: 58, notes: "Felt good." });
      } else {
        // Sam stays a draft: shows screening flags and the approval gate.
        await call("POST", `/assessments/${a.assessmentId}/program`);
      }
    }
  } finally {
    server.close();
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  const { db, close } = await openDb();
  await seedIfEmpty(db);
  console.log(`Seeded synthetic data. Demo logins (password "${DEMO_PASSWORD}"): ${Object.values(DEMO_USERS).join(", ")}`);
  await close();
}
