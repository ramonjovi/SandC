import { eq } from "drizzle-orm";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM, type Program } from "@tpc/engine";
import { createApp } from "./app";
import { openDb, schema, type Db } from "./db";

export const DEMO_CODES = { alex: "alex-demo-0001", sam: "sam-demo-0002" };

/** Seeds SYNTHETIC athletes by exercising the real HTTP API end to end. */
export async function seedIfEmpty(db: Db) {
  const existing = await db.select().from(schema.athletes).limit(1);
  if (existing.length) return;
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const call = async (method: string, url: string, body?: unknown) => {
    const r = await fetch(base + url, { method, headers: { "content-type": "application/json", "x-actor": "Dr. Demo (PT)" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(j)}`);
    return j as any;
  };
  try {
    for (const [fixture, code] of [[SYNTHETIC_ALEX, DEMO_CODES.alex], [SYNTHETIC_SAM, DEMO_CODES.sam]] as const) {
      const a = await call("POST", "/athletes", { profile: fixture.profile, goals: fixture.goals, clinician: "Dr. Demo (PT)", isSynthetic: true });
      await db.update(schema.athletes).set({ accessCode: code }).where(eq(schema.athletes.id, a.id));
      await call("PUT", `/assessments/${a.assessmentId}`, { data: fixture });
      await call("POST", `/assessments/${a.assessmentId}/interpret`);
      if (fixture === SYNTHETIC_ALEX) {
        // PT interpretation that deliberately differs from the engine in one respect.
        await call("PUT", `/assessments/${a.assessmentId}/pt-interpretation`, {
          clinician: "Dr. Demo (PT)", priorityKeys: ["hip_stability", "calf_soleus", "power_rfd"], strategy: "combined",
          reasoning: "Pelvic drop and calf asymmetry are the main findings. I would like some reactive work earlier given the 10k pace.",
        });
        const prog = await call("POST", `/assessments/${a.assessmentId}/program`);
        await call("POST", `/programs/${prog.id}/approve`, { clinician: "Dr. Demo (PT)", screeningReviewed: true });
        const program = ((await call("GET", `/athletes/${a.id}`)).programs[0].data) as Program;
        const s = program.weeks[0].sessions[0];
        await call("POST", `/athlete/${code}/session-logs`, {
          week: 1, day: 1, cmjHeightCm: 36,
          exercises: s.exercises.map((e) => ({
            prescribedId: e.id, exerciseId: e.exerciseId,
            sets: Array.from({ length: e.sets }, () => ({ reps: e.reps, loadKg: e.loadKg })),
            rirFinal: e.rir, pain: null,
          })),
        });
        await call("POST", `/athlete/${code}/weekly-logs`, { weekStart: "2026-09-28", runKm: 52 });
        await call("POST", `/athlete/${code}/weekly-logs`, { weekStart: "2026-10-05", runKm: 58, notes: "Felt good." });
      } else {
        // Sam stays as a draft: shows screening flags and the approval gate.
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
  console.log("Seeded synthetic athletes. Athlete links: /a/" + DEMO_CODES.alex + " and /a/" + DEMO_CODES.sam);
  await close();
}
