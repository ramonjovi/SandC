import { randomUUID } from "node:crypto";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM, type Program } from "@tpc/engine";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, schema, type DbHandle } from "../src/db";

const PW = "correct-horse-1";
let handle: DbHandle;
let app: ReturnType<typeof createApp>;

const client = () => request.agent(app).set("x-requested-with", "tpc");
let pt: ReturnType<typeof client>;

async function addUser(email: string, role: string, athleteId: string | null = null, name = email) {
  const userId = randomUUID();
  await handle.db.insert(schema.users).values({ id: userId, email, name, role, passwordHash: await hashPassword(PW), athleteId });
  return userId;
}
async function login(email: string, password = PW) {
  const a = client();
  await a.post("/api/auth/login").send({ email, password });
  return a;
}

beforeAll(async () => {
  handle = await openDb({ memory: true });
  app = createApp(handle.db);
  await addUser("pt@x.test", "clinician", null, "Dr. PT");
  await addUser("admin@x.test", "admin", null, "Admin");
  pt = await login("pt@x.test");
}, 60000);
afterAll(async () => { await handle.close(); });

async function newAthlete(f: typeof SYNTHETIC_ALEX) {
  const r = await pt.post("/api/athletes").send({ profile: f.profile, goals: f.goals }).expect(201);
  await pt.put(`/api/assessments/${r.body.assessmentId}`).send({ data: f }).expect(200);
  return r.body as { id: string; assessmentId: string };
}
/** Clinician invites; athlete accepts and is signed in. */
async function athleteSession(athleteId: string, email: string) {
  const inv = await pt.post(`/api/athletes/${athleteId}/invite`).expect(201);
  const a = client();
  await a.post(`/api/invites/${inv.body.token}/accept`).send({ email, password: PW }).expect(201);
  return { agent: a, token: inv.body.token as string };
}

describe("authentication", () => {
  it("rejects unauthenticated requests", async () => {
    await client().get("/api/athletes").expect(401);
    await client().get("/api/me").expect(401);
    expect((await client().get("/api/auth/me").expect(200)).body).toBeNull();
  });
  it("rejects bad credentials with a generic message", async () => {
    const wrong = await client().post("/api/auth/login").send({ email: "pt@x.test", password: "nope-nope-nope" }).expect(401);
    const none = await client().post("/api/auth/login").send({ email: "ghost@x.test", password: "nope-nope-nope" }).expect(401);
    expect(wrong.body.error).toBe(none.body.error);
  });
  it("logs in, sets an HttpOnly cookie and never exposes the password hash", async () => {
    const r = await client().post("/api/auth/login").send({ email: "pt@x.test", password: PW }).expect(200);
    expect(r.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(r.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    expect(JSON.stringify(r.body)).not.toMatch(/scrypt|passwordHash/);
    expect((await pt.get("/api/auth/me")).body.role).toBe("clinician");
  });
  it("blocks mutating requests without the CSRF header", async () => {
    await request.agent(app).post("/api/auth/logout").expect(403);
  });
  it("logout invalidates the session", async () => {
    const a = await login("pt@x.test");
    await a.get("/api/athletes").expect(200);
    await a.post("/api/auth/logout").expect(200);
    await a.get("/api/athletes").expect(401);
  });
  it("disabled users cannot sign in and lose their sessions", async () => {
    const uid = await addUser("temp@x.test", "clinician");
    const a = await login("temp@x.test");
    await a.get("/api/athletes").expect(200);
    await handle.db.update(schema.users).set({ disabled: true }).where(eq(schema.users.id, uid));
    await a.get("/api/athletes").expect(401);
    await client().post("/api/auth/login").send({ email: "temp@x.test", password: PW }).expect(401);
  });
  it("expired sessions are rejected", async () => {
    const a = await login("pt@x.test");
    await handle.db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    await a.get("/api/athletes").expect(401);
    pt = await login("pt@x.test"); // restore for later suites
  });
  it("rate-limits repeated failed logins", async () => {
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await client().post("/api/auth/login").send({ email: "victim@x.test", password: "wrong-wrong-1" })).status;
    expect(last).toBe(429);
  });
  it("only admins can manage users", async () => {
    await pt.get("/api/admin/users").expect(403);
    const admin = await login("admin@x.test");
    await admin.post("/api/admin/users").send({ name: "New PT", email: "new@x.test", role: "clinician", password: "a-long-password" }).expect(201);
    await admin.post("/api/admin/users").send({ name: "Weak", email: "weak@x.test", password: "short" }).expect(400);
    expect((await login("new@x.test", "a-long-password").then((a) => a.get("/api/auth/me"))).body.role).toBe("clinician");
  });
  it("changing password signs out other sessions and requires the current password", async () => {
    await addUser("cp@x.test", "clinician");
    const a = await login("cp@x.test");
    const b = await login("cp@x.test");
    await a.post("/api/auth/change-password").send({ current: "wrong", next: "brand-new-password" }).expect(401);
    await a.post("/api/auth/change-password").send({ current: PW, next: "brand-new-password" }).expect(200);
    await b.get("/api/athletes").expect(401);
    await a.get("/api/athletes").expect(200);
  });
});

describe("athlete invites and isolation", () => {
  it("invite links are single-use and expire", async () => {
    const a = await newAthlete(SYNTHETIC_ALEX);
    const { token } = await athleteSession(a.id, "inv1@x.test");
    await client().get(`/api/invites/${token}`).expect(410);
    const inv2 = await pt.post(`/api/athletes/${a.id}/invite`).expect(201);
    await handle.db.update(schema.invites).set({ expiresAt: new Date(Date.now() - 1000) });
    await client().get(`/api/invites/${inv2.body.token}`).expect(410);
  });
  it("athletes cannot reach clinician data or other athletes", async () => {
    const a = await newAthlete(SYNTHETIC_ALEX);
    const b = await newAthlete(SYNTHETIC_SAM);
    const { agent } = await athleteSession(a.id, "iso-a@x.test");
    await agent.get("/api/athletes").expect(403);
    await agent.get(`/api/athletes/${b.id}`).expect(403);
    await agent.get(`/api/athletes/${a.id}/audit`).expect(403);
    const me = await agent.get("/api/me").expect(200);
    expect(me.body.name).toBe(SYNTHETIC_ALEX.profile.name);
  });
  it("clinicians cannot use the athlete endpoints", async () => {
    await pt.get("/api/me").expect(403);
  });
});

describe("full vertical slice (Alex)", () => {
  let a: Awaited<ReturnType<typeof newAthlete>>;
  let me: ReturnType<typeof client>;
  let programId = "";
  let program: Program;

  it("creates profile and records assessment", async () => {
    a = await newAthlete(SYNTHETIC_ALEX);
    const d = await pt.get(`/api/athletes/${a.id}`).expect(200);
    expect(d.body.assessments[0].data.physical.squatLoadKg).toBe(100);
    me = (await athleteSession(a.id, "alex@x.test")).agent;
  });

  it("rejects invalid assessment data", async () => {
    await pt.put(`/api/assessments/${a.assessmentId}`).send({ data: { profile: { name: "x" } } }).expect(400);
  });

  it("generates an independent engine interpretation", async () => {
    const r = await pt.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201);
    expect(r.body.strategy.key).toBe("high_load");
    expect(r.body.priorities.length).toBeGreaterThan(0);
  });

  it("records the PT interpretation (attributed to the signed-in user) and compares", async () => {
    const r = await pt.put(`/api/assessments/${a.assessmentId}/pt-interpretation`).send({
      priorityKeys: ["hip_stability", "power_rfd"], strategy: "combined", reasoning: "r",
    }).expect(201);
    expect(r.body.comparison.strategyAgrees).toBe(false);
    expect(r.body.comparison.disagreements.length).toBeGreaterThan(0);
    const [row] = await handle.db.select().from(schema.ptInterpretations).where(eq(schema.ptInterpretations.id, r.body.id));
    expect(row.clinician).toBe("Dr. PT");
  });

  it("generates an editable draft program that the athlete cannot see yet", async () => {
    const r = await pt.post(`/api/assessments/${a.assessmentId}/program`).expect(201);
    programId = r.body.id;
    program = (await pt.get(`/api/athletes/${a.id}`)).body.programs[0].data;
    expect(program.weeks).toHaveLength(8);
    expect((await me.get("/api/me").expect(200)).body.program).toBeNull();
  });

  it("allows edits and audits them under the real user", async () => {
    program.weeks[0].sessions[0].exercises[0].sets = 2;
    await pt.put(`/api/programs/${programId}`).send({ data: program }).expect(200);
    const audit = await pt.get(`/api/athletes/${a.id}/audit`);
    expect(audit.body.some((e: any) => e.action === "edit" && e.entity === "program" && e.actor === "Dr. PT")).toBe(true);
  });

  it("requires screening acknowledgement to approve", async () => {
    await pt.post(`/api/programs/${programId}/approve`).send({}).expect(400);
    await pt.post(`/api/programs/${programId}/approve`).send({ screeningReviewed: true }).expect(200);
    const row = (await pt.get(`/api/athletes/${a.id}`)).body.programs[0];
    expect(row.approvedBy).toBe("Dr. PT");
  });

  it("shows the approved program to the athlete without clinician-only data", async () => {
    const r = await me.get("/api/me").expect(200);
    expect(r.body.program.weeks).toHaveLength(8);
    expect(JSON.stringify(r.body)).not.toMatch(/safetyFlags|reasoning|clearanceNote/);
  });

  it("logs a session and returns proposed next targets; clinician applies them", async () => {
    const squat = program.weeks[0].sessions[0].exercises.find((e) => e.exerciseId === "back_squat")!;
    const r = await me.post("/api/me/session-logs").send({
      week: 1, day: 1,
      exercises: [{ prescribedId: squat.id, exerciseId: "back_squat", sets: Array.from({ length: squat.sets }, () => ({ reps: squat.reps, loadKg: squat.loadKg })), rirFinal: 2, pain: null }],
    }).expect(201);
    const t = r.body.proposals.find((p: any) => p.exerciseId === "back_squat");
    expect(t.action).toBe("increase");
    expect(t.nextLoadKg).toBeGreaterThan(squat.loadKg!);
    const logs = (await pt.get(`/api/athletes/${a.id}`)).body.sessionLogs;
    const applied = await pt.post(`/api/session-logs/${logs[0].id}/apply`).send({}).expect(200);
    expect(applied.body.changes.length).toBeGreaterThan(0);
  });

  it("flags weekly volume jumps over 10%", async () => {
    await me.post("/api/me/weekly-logs").send({ weekStart: "2026-09-28", runKm: 50 }).expect(201);
    const r = await me.post("/api/me/weekly-logs").send({ weekStart: "2026-10-05", runKm: 60 }).expect(201);
    expect(r.body.volumeFlag.ok).toBe(false);
  });

  it("builds the roadmap with baseline, objectives, milestones and progress", async () => {
    const rm = (await me.get("/api/me").expect(200)).body.roadmap;
    expect(rm.objectives.length).toBeGreaterThan(0);
    expect(rm.milestones.length).toBeGreaterThanOrEqual(3);
    expect(rm.adherence.completed).toBe(1);
    expect(rm.baselineMetrics.squat1RM).toBeCloseTo(116.7, 1);
  });
});

describe("safety gate (Sam)", () => {
  it("requires a recorded medical review note when screening flags exist", async () => {
    const a = await newAthlete(SYNTHETIC_SAM);
    const rep = await pt.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201);
    expect(rep.body.safetyFlags.some((f: any) => f.highStakes)).toBe(true);
    const p = await pt.post(`/api/assessments/${a.assessmentId}/program`).expect(201);
    await pt.post(`/api/programs/${p.body.id}/approve`).send({ screeningReviewed: true }).expect(422);
    await pt.post(`/api/programs/${p.body.id}/approve`).send({ screeningReviewed: true, clearanceNote: "Reviewed with sports physician; cleared for strength work." }).expect(200);
  });
});

describe("global rule defaults (editable, audited)", () => {
  it("requires a clinician and a reason, and enforces bounds", async () => {
    await client().put("/api/rules/running.dsi/defaults").send({ values: { strengthDeficitBelow: 0.7 }, reason: "testing" }).expect(401);
    await pt.put("/api/rules/running.dsi/defaults").send({ values: { strengthDeficitBelow: 0.7 } }).expect(400);
    await pt.put("/api/rules/running.dsi/defaults").send({ values: { strengthDeficitBelow: 5 }, reason: "too high" }).expect(400);
    await pt.put("/api/rules/running.dsi/defaults").send({ values: { nonsense: 1 }, reason: "bad key" }).expect(400);
    await pt.put("/api/rules/running.vdot.formula/defaults").send({ values: { x: 1 }, reason: "no params" }).expect(404);
    await pt.put("/api/rules/running.dsi/defaults").send({ values: { strengthDeficitBelow: 0.6 }, reason: "same as default" }).expect(400);
  });

  it("athletes cannot read or change rule defaults", async () => {
    const a = await newAthlete(SYNTHETIC_ALEX);
    const { agent } = await athleteSession(a.id, "rules-ath@x.test");
    await agent.get("/api/rules/overrides").expect(403);
    await agent.put("/api/rules/running.dsi/defaults").send({ values: { strengthDeficitBelow: 0.7 }, reason: "sneaky" }).expect(403);
  });

  it("changes apply to new interpretations only, are recorded on them, and are audited", async () => {
    const a = await newAthlete(SYNTHETIC_ALEX); // DSI 0.65
    const before = (await pt.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201)).body;
    expect(before.priorities.some((p: any) => p.key === "max_strength")).toBe(false);

    const put = await pt.put("/api/rules/running.dsi/defaults").send({ values: { strengthDeficitBelow: 0.7 }, reason: "Clinic prefers a stricter DSI cut-off" }).expect(200);
    expect(put.body.changes[0]).toMatchObject({ key: "strengthDeficitBelow", from: 0.6, to: 0.7 });

    const after = (await pt.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201)).body;
    expect(after.priorities[0].key).toBe("max_strength");
    expect(after.paramOverrides).toEqual({ "running.dsi": { strengthDeficitBelow: 0.7 } });
    // the earlier report is untouched
    const detail = (await pt.get(`/api/athletes/${a.id}`)).body.assessments[0];
    expect(detail.report.paramOverrides).toEqual({ "running.dsi": { strengthDeficitBelow: 0.7 } }); // latest
    expect(before.paramOverrides).toEqual({});

    const audit = (await pt.get("/api/rules/audit").expect(200)).body;
    const e = audit.find((x: any) => x.entityId === "running.dsi" && x.action === "edit-default");
    expect(e.actor).toBe("Dr. PT");
    expect(e.detail.reason).toMatch(/stricter/);
    expect(e.detail.ruleStatus).toBe("needs_verification");
    expect(e.detail.changes[0]).toMatchObject({ from: 0.6, to: 0.7 });

    const list = (await pt.get("/api/rules/overrides")).body;
    expect(list).toEqual([expect.objectContaining({ ruleId: "running.dsi", key: "strengthDeficitBelow", value: 0.7, updatedBy: "Dr. PT" })]);
  });

  it("reset restores the built-in default and is audited", async () => {
    await pt.put("/api/rules/running.dsi/defaults").send({ reset: true, reason: "Back to defaults" }).expect(200);
    expect((await pt.get("/api/rules/overrides")).body).toEqual([]);
    const audit = (await pt.get("/api/rules/audit")).body;
    expect(audit.some((x: any) => x.action === "reset-default")).toBe(true);
    await pt.put("/api/rules/running.dsi/defaults").send({ reset: true, reason: "nothing to reset" }).expect(400);
  });

  it("progression and weekly-cap overrides affect athlete logging", async () => {
    await pt.put("/api/rules/core.load.weekly-cap/defaults").send({ values: { capPct: 20 }, reason: "Allow bigger build weeks" }).expect(200);
    await pt.put("/api/rules/core.progression.load/defaults").send({ values: { incEasyPct: 7.5 }, reason: "Faster progression for trained group" }).expect(200);
    const a = await newAthlete(SYNTHETIC_ALEX);
    await pt.post(`/api/assessments/${a.assessmentId}/interpret`);
    const p = await pt.post(`/api/assessments/${a.assessmentId}/program`).expect(201);
    await pt.post(`/api/programs/${p.body.id}/approve`).send({ screeningReviewed: true }).expect(200);
    const me = (await athleteSession(a.id, "ovr@x.test")).agent;
    await me.post("/api/me/weekly-logs").send({ weekStart: "2026-09-28", runKm: 50 }).expect(201);
    expect((await me.post("/api/me/weekly-logs").send({ weekStart: "2026-10-05", runKm: 58 })).body.volumeFlag.ok).toBe(true); // +16% under the 20% cap
    const prog = (await pt.get(`/api/athletes/${a.id}`)).body.programs[0].data;
    const squat = prog.weeks[0].sessions[0].exercises.find((e: any) => e.exerciseId === "back_squat");
    const r = await me.post("/api/me/session-logs").send({
      week: 1, day: 1,
      exercises: [{ prescribedId: squat.id, exerciseId: "back_squat", sets: Array.from({ length: squat.sets }, () => ({ reps: squat.reps, loadKg: squat.loadKg })), rirFinal: 2, pain: null }],
    }).expect(201);
    const t = r.body.proposals.find((x: any) => x.exerciseId === "back_squat");
    expect(t.nextLoadKg).toBe(Math.round((squat.loadKg * 1.075) / 2.5) * 2.5);
  });
});
