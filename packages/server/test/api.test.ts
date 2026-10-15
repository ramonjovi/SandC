import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM, type Program } from "@tpc/engine";
import { createApp } from "../src/app";
import { openDb, type DbHandle } from "../src/db";

let handle: DbHandle;
let api: ReturnType<typeof request>;

beforeAll(async () => {
  handle = await openDb({ memory: true });
  api = request(createApp(handle.db));
}, 60000);
afterAll(async () => { await handle.close(); });

async function newAthlete(f: typeof SYNTHETIC_ALEX) {
  const r = await api.post("/api/athletes").send({ profile: f.profile, goals: f.goals, clinician: "PT" }).expect(201);
  await api.put(`/api/assessments/${r.body.assessmentId}`).send({ data: f }).expect(200);
  return r.body as { id: string; accessCode: string; assessmentId: string };
}

describe("full vertical slice (Alex)", () => {
  let a: Awaited<ReturnType<typeof newAthlete>>;
  let programId = "";
  let program: Program;

  it("creates profile and records assessment", async () => {
    a = await newAthlete(SYNTHETIC_ALEX);
    const d = await api.get(`/api/athletes/${a.id}`).expect(200);
    expect(d.body.assessments[0].data.physical.squatLoadKg).toBe(100);
  });

  it("rejects invalid assessment data", async () => {
    await api.put(`/api/assessments/${a.assessmentId}`).send({ data: { profile: { name: "x" } } }).expect(400);
  });

  it("generates an independent engine interpretation", async () => {
    const r = await api.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201);
    expect(r.body.strategy.key).toBe("high_load");
    expect(r.body.priorities.length).toBeGreaterThan(0);
  });

  it("records the PT interpretation and compares", async () => {
    const r = await api.put(`/api/assessments/${a.assessmentId}/pt-interpretation`).send({
      clinician: "PT", priorityKeys: ["hip_stability", "power_rfd"], strategy: "combined", reasoning: "r",
    }).expect(201);
    expect(r.body.comparison.strategyAgrees).toBe(false);
    expect(r.body.comparison.disagreements.length).toBeGreaterThan(0);
  });

  it("generates an editable draft program that the athlete cannot see yet", async () => {
    const r = await api.post(`/api/assessments/${a.assessmentId}/program`).expect(201);
    programId = r.body.id;
    const d = await api.get(`/api/athletes/${a.id}`);
    program = d.body.programs[0].data;
    expect(program.weeks).toHaveLength(8);
    const me = await api.get(`/api/athlete/${a.accessCode}/me`).expect(200);
    expect(me.body.program).toBeNull();
  });

  it("allows edits and audits them", async () => {
    program.weeks[0].sessions[0].exercises[0].sets = 2;
    await api.put(`/api/programs/${programId}`).set("x-actor", "PT").send({ data: program }).expect(200);
    const audit = await api.get(`/api/athletes/${a.id}/audit`);
    expect(audit.body.some((e: any) => e.action === "edit" && e.entity === "program")).toBe(true);
  });

  it("requires screening acknowledgement to approve", async () => {
    await api.post(`/api/programs/${programId}/approve`).send({ clinician: "PT" }).expect(400);
    await api.post(`/api/programs/${programId}/approve`).send({ clinician: "PT", screeningReviewed: true }).expect(200);
  });

  it("shows the approved program in the athlete interface without clinician-only data", async () => {
    const me = await api.get(`/api/athlete/${a.accessCode}/me`).expect(200);
    expect(me.body.program.weeks).toHaveLength(8);
    expect(JSON.stringify(me.body)).not.toMatch(/safetyFlags|reasoning|clearanceNote/);
  });

  it("logs a session and returns proposed next targets", async () => {
    const s = program.weeks[0].sessions[0];
    const squat = s.exercises.find((e) => e.exerciseId === "back_squat")!;
    const r = await api.post(`/api/athlete/${a.accessCode}/session-logs`).send({
      week: 1, day: 1,
      exercises: [{ prescribedId: squat.id, exerciseId: "back_squat", sets: Array.from({ length: squat.sets }, () => ({ reps: squat.reps, loadKg: squat.loadKg })), rirFinal: 2, pain: null }],
    }).expect(201);
    const t = r.body.proposals.find((p: any) => p.exerciseId === "back_squat");
    expect(t.action).toBe("increase");
    expect(t.nextLoadKg).toBeGreaterThan(squat.loadKg!);
    // clinician applies it to next week's same-day squat
    const logs = (await api.get(`/api/athletes/${a.id}`)).body.sessionLogs;
    const applied = await api.post(`/api/session-logs/${logs[0].id}/apply`).send({}).expect(200);
    expect(applied.body.changes.length).toBeGreaterThan(0);
  });

  it("flags weekly volume jumps over 10%", async () => {
    await api.post(`/api/athlete/${a.accessCode}/weekly-logs`).send({ weekStart: "2026-09-28", runKm: 50 }).expect(201);
    const r = await api.post(`/api/athlete/${a.accessCode}/weekly-logs`).send({ weekStart: "2026-10-05", runKm: 60 }).expect(201);
    expect(r.body.volumeFlag.ok).toBe(false);
  });

  it("builds the roadmap with baseline, objectives, milestones and progress", async () => {
    const r = await api.get(`/api/athlete/${a.accessCode}/me`).expect(200);
    const rm = r.body.roadmap;
    expect(rm.objectives.length).toBeGreaterThan(0);
    expect(rm.milestones.length).toBeGreaterThanOrEqual(3);
    expect(rm.adherence.completed).toBe(1);
    expect(rm.baselineMetrics.squat1RM).toBeCloseTo(116.7, 1);
  });

  it("unknown athlete code is 404", async () => {
    await api.get("/api/athlete/nope/me").expect(404);
  });
});

describe("safety gate (Sam)", () => {
  it("requires a recorded medical review note when screening flags exist", async () => {
    const a = await newAthlete(SYNTHETIC_SAM);
    const rep = await api.post(`/api/assessments/${a.assessmentId}/interpret`).expect(201);
    expect(rep.body.safetyFlags.some((f: any) => f.highStakes)).toBe(true);
    const p = await api.post(`/api/assessments/${a.assessmentId}/program`).expect(201);
    await api.post(`/api/programs/${p.body.id}/approve`).send({ clinician: "PT", screeningReviewed: true }).expect(422);
    await api.post(`/api/programs/${p.body.id}/approve`).send({ clinician: "PT", screeningReviewed: true, clearanceNote: "Reviewed with sports physician; cleared for strength work." }).expect(200);
  });
});
