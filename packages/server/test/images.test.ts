import { randomUUID } from "node:crypto";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX } from "@tpc/engine";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, schema, type DbHandle } from "../src/db";

const PW = "correct-horse-1";
// 1x1 transparent PNG and a minimal JPEG header-less stand-in (only the data URL shape is validated)
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
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

async function athlete() {
  const f = SYNTHETIC_ALEX;
  const r = await pt.post("/api/athletes").send({ profile: f.profile, goals: f.goals }).expect(201);
  await pt.put(`/api/assessments/${r.body.assessmentId}`).send({ data: f }).expect(200);
  return r.body as { id: string; assessmentId: string };
}

describe("analysis pictures from the video", () => {
  it("uploads, lists (without the picture data), serves and deletes a frame", async () => {
    const a = await athlete();
    const up = await pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "overstride", caption: "Side view, loading response", measure: "Ankle 6 cm ahead of pelvis", discussion: "Foot lands ahead.", dataUrl: PNG }).expect(201);
    const list = (await pt.get(`/api/assessments/${a.assessmentId}/images`).expect(200)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: up.body.id, phase: "overstride", measure: "Ankle 6 cm ahead of pelvis", createdBy: "Dr. PT" });
    expect(JSON.stringify(list)).not.toContain("iVBOR"); // the data itself is not in the list

    const file = await pt.get(`/api/images/${up.body.id}/file`).expect(200);
    expect(file.headers["content-type"]).toMatch(/image\/png/);
    expect(file.headers["cache-control"]).toMatch(/no-store/);
    expect(Buffer.from(file.body).length).toBeGreaterThan(20);

    await pt.put(`/api/images/${up.body.id}`).send({ caption: "Changed", discussion: "Edited text" }).expect(200);
    expect((await pt.get(`/api/assessments/${a.assessmentId}/images`)).body[0]).toMatchObject({ caption: "Changed", discussion: "Edited text", measure: "Ankle 6 cm ahead of pelvis" });

    await pt.delete(`/api/images/${up.body.id}`).expect(200);
    expect((await pt.get(`/api/assessments/${a.assessmentId}/images`)).body).toHaveLength(0);
    await pt.get(`/api/images/${up.body.id}/file`).expect(404);
  });

  it("rejects unknown phases, non-images and oversized pictures", async () => {
    const a = await athlete();
    const send = (body: object) => pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "overstride", dataUrl: PNG, ...body });
    await send({ phase: "nonsense" }).expect(400);
    await send({ dataUrl: "data:text/html;base64,PHNjcmlwdD4=" }).expect(400);
    await send({ dataUrl: "https://example.com/x.png" }).expect(400);
    const huge = "data:image/png;base64," + "A".repeat(3_600_000);
    await send({ dataUrl: huge }).expect(413);
    await pt.post("/api/assessments/does-not-exist/images").send({ phase: "overstride", dataUrl: PNG }).expect(404);
  });

  it("caps the number of pictures per assessment", async () => {
    const a = await athlete();
    for (let i = 0; i < 40; i++) await pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "other", dataUrl: PNG }).expect(201);
    await pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "other", dataUrl: PNG }).expect(409);
  }, 60000);

  it("only clinicians can see or change pictures; an athlete account cannot", async () => {
    const a = await athlete();
    const up = await pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "knee-flexion", dataUrl: PNG }).expect(201);
    const inv = (await pt.post(`/api/athletes/${a.id}/invite`).expect(201)).body.token;
    const me = client();
    await me.post(`/api/invites/${inv}/accept`).send({ email: "ath@x.test", password: PW }).expect(201);
    await me.get(`/api/images/${up.body.id}/file`).expect(403);
    await me.get(`/api/assessments/${a.assessmentId}/images`).expect(403);
    await me.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "other", dataUrl: PNG }).expect(403);
    await client().get(`/api/images/${up.body.id}/file`).expect(401);
  });

  it("adds and deletes are audited (without the picture content)", async () => {
    const a = await athlete();
    const up = await pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "pogo", dataUrl: PNG }).expect(201);
    await pt.delete(`/api/images/${up.body.id}`).expect(200);
    const rows = await handle.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, up.body.id));
    expect(rows.map((r) => r.action).sort()).toEqual(["add-image", "delete-image"]);
    expect(JSON.stringify(rows)).not.toContain("iVBOR");
  });

  it("deleting an athlete permanently deletes their pictures", async () => {
    const a = await athlete();
    await pt.post(`/api/assessments/${a.assessmentId}/images`).send({ phase: "overstride", dataUrl: PNG }).expect(201);
    const name = (await pt.get(`/api/athletes/${a.id}`)).body.athlete.name;
    await pt.post(`/api/athletes/${a.id}/archive`).send({}).expect(200);
    await pt.delete(`/api/athletes/${a.id}`).send({ confirmName: name }).expect(200);
    expect((await handle.db.select().from(schema.analysisImages).where(eq(schema.analysisImages.athleteId, a.id))).length).toBe(0);
  });
});
