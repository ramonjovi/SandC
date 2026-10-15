import { randomUUID } from "node:crypto";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX } from "@tpc/engine";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, schema, type DbHandle } from "../src/db";

const PW = "correct-horse-1";
let handle: DbHandle;
let app: ReturnType<typeof createApp>;
let pt: ReturnType<typeof request.agent>;
const client = () => request.agent(app).set("x-requested-with", "tpc");

beforeAll(async () => {
  handle = await openDb({ memory: true });
  app = createApp(handle.db);
  await handle.db.insert(schema.users).values({ id: randomUUID(), email: "pt@x.test", name: "Dr. PT", role: "clinician", passwordHash: await hashPassword(PW) });
  pt = client();
  await pt.post("/api/auth/login").send({ email: "pt@x.test", password: PW }).expect(200);
}, 60000);
afterAll(async () => { await handle.close(); });

async function athleteWithProgram(sessionsPerWeek?: number) {
  const f = SYNTHETIC_ALEX;
  const a = (await pt.post("/api/athletes").send({ profile: f.profile, goals: f.goals }).expect(201)).body as { id: string; assessmentId: string };
  await pt.put(`/api/assessments/${a.assessmentId}`).send({ data: f }).expect(200);
  await pt.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201);
  const p = await pt.post(`/api/assessments/${a.assessmentId}/program`).send({ sessionsPerWeek }).expect(201);
  await pt.post(`/api/programs/${p.body.id}/approve`).send({ screeningReviewed: true }).expect(200);
  return { ...a, programId: p.body.id as string };
}
async function athleteLogin(athleteId: string, email: string) {
  const inv = await pt.post(`/api/athletes/${athleteId}/invite`).expect(201);
  const me = client();
  await me.post(`/api/invites/${inv.body.token}/accept`).send({ email, password: PW }).expect(201);
  return me;
}

describe("choosing sessions per week", () => {
  for (const n of [1, 2, 3]) {
    it(`generates ${n} session(s) per week and the athlete sees them`, async () => {
      const a = await athleteWithProgram(n);
      const detail = (await pt.get(`/api/athletes/${a.id}`)).body;
      const prog = detail.programs[0].data;
      expect(prog.sessionsPerWeek).toBe(n);
      expect(prog.weeks[0].sessions).toHaveLength(n);
      const me = await athleteLogin(a.id, `n${n}@x.test`);
      const mine = (await me.get("/api/me").expect(200)).body;
      expect(mine.program.weeks[0].sessions).toHaveLength(n);
      expect(mine.roadmap.adherence.planned).toBe(prog.weeks.reduce((t: number, w: any) => t + w.sessions.length, 0));
      expect(Object.keys(mine.exerciseGuides).length).toBeGreaterThan(10);
    });
  }
  it("invalid values fall back to two sessions", async () => {
    const a = await athleteWithProgram(9);
    expect((await pt.get(`/api/athletes/${a.id}`)).body.programs[0].data.sessionsPerWeek).toBe(2);
  });
  it("clinician meta includes the exercise coaching guides", async () => {
    const meta = (await pt.get("/api/meta").expect(200)).body;
    expect(meta.modules[0].exerciseGuides.back_squat.steps.length).toBeGreaterThan(0);
  });
});

describe("archive, restore and permanent delete", () => {
  it("archiving hides the athlete, blocks their sign-in and kills their session; restore reverses it", async () => {
    const a = await athleteWithProgram();
    const me = await athleteLogin(a.id, "arch@x.test");
    await me.get("/api/me").expect(200);

    await pt.post(`/api/athletes/${a.id}/archive`).send({ reason: "Left the clinic" }).expect(200);
    expect((await pt.get("/api/athletes")).body.some((x: any) => x.id === a.id)).toBe(false);
    expect((await pt.get("/api/athletes?archived=1")).body.some((x: any) => x.id === a.id)).toBe(true);
    await me.get("/api/me").expect(401);
    await client().post("/api/auth/login").send({ email: "arch@x.test", password: PW }).expect(401);
    await pt.post(`/api/athletes/${a.id}/archive`).send({}).expect(409);

    await pt.post(`/api/athletes/${a.id}/restore`).expect(200);
    expect((await pt.get("/api/athletes")).body.some((x: any) => x.id === a.id)).toBe(true);
    await client().post("/api/auth/login").send({ email: "arch@x.test", password: PW }).expect(200);
  });

  it("permanent delete needs the athlete archived first and the exact name", async () => {
    const a = await athleteWithProgram();
    await pt.delete(`/api/athletes/${a.id}`).send({ confirmName: SYNTHETIC_ALEX.profile.name }).expect(409); // not archived
    await pt.post(`/api/athletes/${a.id}/archive`).send({}).expect(200);
    await pt.delete(`/api/athletes/${a.id}`).send({ confirmName: "wrong name" }).expect(400);
    await pt.delete(`/api/athletes/${a.id}`).send({}).expect(400);
    await pt.get(`/api/athletes/${a.id}`).expect(200); // still there
  });

  it("permanent delete removes every record and scrubs audit content, but keeps a deletion record", async () => {
    const a = await athleteWithProgram();
    const me = await athleteLogin(a.id, "gone@x.test");
    const prog = (await pt.get(`/api/athletes/${a.id}`)).body.programs[0].data;
    const s = prog.weeks[0].sessions[0];
    await me.post("/api/me/session-logs").send({ week: 1, day: 1, exercises: [{ prescribedId: s.exercises[0].id, exerciseId: s.exercises[0].exerciseId, sets: [{ reps: 5, loadKg: 50 }], rirFinal: 2, pain: null }] }).expect(201);
    await me.post("/api/me/weekly-logs").send({ weekStart: "2026-10-05", runKm: 40 }).expect(201);

    const ownAuditIds = (await handle.db.select().from(schema.auditLog).where(eq(schema.auditLog.athleteId, a.id))).map((r) => r.id);
    expect(ownAuditIds.length).toBeGreaterThan(3);
    await pt.post(`/api/athletes/${a.id}/archive`).send({}).expect(200);
    await pt.delete(`/api/athletes/${a.id}`).send({ confirmName: SYNTHETIC_ALEX.profile.name }).expect(200);

    await pt.get(`/api/athletes/${a.id}`).expect(404);
    const db = handle.db;
    for (const t of [schema.assessments, schema.engineReports, schema.programs, schema.sessionLogs, schema.weeklyLogs, schema.invites, schema.ptInterpretations]) {
      expect((await db.select().from(t).where(eq((t as any).athleteId, a.id))).length).toBe(0);
    }
    expect((await db.select().from(schema.users).where(eq(schema.users.athleteId, a.id))).length).toBe(0);
    expect((await db.select().from(schema.users).where(eq(schema.users.email, "gone@x.test"))).length).toBe(0);
    await me.get("/api/me").expect(401);

    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, a.id));
    expect(audit.some((e) => e.action === "delete-athlete" && e.actor === "Dr. PT")).toBe(true);
    // no remaining audit row for this athlete carries content (the assessment snapshots were the sensitive part)
    for (const e of audit.filter((x) => x.action !== "delete-athlete")) expect(e.detail).toBeNull();
    const all = await db.select().from(schema.auditLog);
    for (const r of all.filter((x) => ownAuditIds.includes(x.id))) {
      expect(r.detail).toBeNull();
      expect(r.athleteId).toBeNull();
    }
  });

  it("athletes cannot archive or delete", async () => {
    const a = await athleteWithProgram();
    const me = await athleteLogin(a.id, "nope@x.test");
    await me.post(`/api/athletes/${a.id}/archive`).send({}).expect(403);
    await me.delete(`/api/athletes/${a.id}`).send({ confirmName: "x" }).expect(403);
  });
});
