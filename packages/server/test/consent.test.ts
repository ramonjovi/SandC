import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX } from "@tpc/engine";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { openDb, schema, type DbHandle } from "../src/db";

let handle: DbHandle;
let pt: ReturnType<typeof request.agent>;

beforeAll(async () => {
  handle = await openDb({ memory: true });
  const app = createApp(handle.db);
  await handle.db.insert(schema.users).values({ id: randomUUID(), email: "pt@x.test", name: "Dr. PT", role: "clinician", passwordHash: await hashPassword("correct-horse-1") });
  pt = request.agent(app).set("x-requested-with", "tpc");
  await pt.post("/api/auth/login").send({ email: "pt@x.test", password: "correct-horse-1" }).expect(200);
}, 60000);
afterAll(async () => { await handle.close(); });

describe("consent record", () => {
  it("defaults to not given and is saved with the assessment", async () => {
    const f = SYNTHETIC_ALEX;
    const a = (await pt.post("/api/athletes").send({ profile: f.profile, goals: f.goals }).expect(201)).body;
    const fresh = (await pt.get(`/api/athletes/${a.id}`)).body.assessments[0].data;
    expect(fresh.consent).toEqual({ given: false, date: null, notes: "" });

    await pt.put(`/api/assessments/${a.assessmentId}`).send({ data: { ...f, consent: { given: true, date: "2026-10-15", notes: "Signed form on file" } } }).expect(200);
    const saved = (await pt.get(`/api/athletes/${a.id}`)).body.assessments[0].data;
    expect(saved.consent).toEqual({ given: true, date: "2026-10-15", notes: "Signed form on file" });
  });
});
