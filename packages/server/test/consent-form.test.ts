import { randomUUID } from "node:crypto";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX } from "@tpc/engine";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth";
import { DEFAULT_BODY } from "../src/consent";
import { openDb, schema, type DbHandle } from "../src/db";

const PW = "correct-horse-1";
let handle: DbHandle;
let app: ReturnType<typeof createApp>;
let drA: ReturnType<typeof request.agent>;
let drB: ReturnType<typeof request.agent>;
const client = () => request.agent(app).set("x-requested-with", "tpc");

async function addUser(email: string, name: string, role = "clinician") {
  await handle.db.insert(schema.users).values({ id: randomUUID(), email, name, role, passwordHash: await hashPassword(PW) });
  const a = client();
  await a.post("/api/auth/login").send({ email, password: PW }).expect(200);
  return a;
}
beforeAll(async () => {
  handle = await openDb({ memory: true });
  app = createApp(handle.db);
  drA = await addUser("a@x.test", "Dr. A");
  drB = await addUser("b@x.test", "Dr. B");
}, 60000);
afterAll(async () => { await handle.close(); delete process.env.RAILWAY_ENVIRONMENT; await handle.close().catch(() => undefined); });

/** Fill every [[bracket]] with real text, as a clinic would. */
const filled = (s: string) => s.replace(/\[\[[^\]]*\]\]/g, "Test Clinic, 1 Example Street");

async function athlete(opts: { age?: number; consentGiven?: boolean } = {}) {
  const f = { ...SYNTHETIC_ALEX, profile: { ...SYNTHETIC_ALEX.profile, name: "Pat " + Math.random().toString(36).slice(2, 7), age: opts.age ?? 30 }, consent: { given: opts.consentGiven ?? false, date: null, notes: "" } };
  const r = await drA.post("/api/athletes").send({ profile: f.profile, goals: f.goals }).expect(201);
  await drA.put(`/api/assessments/${r.body.assessmentId}`).send({ data: f }).expect(200);
  await drA.post(`/api/assessments/${r.body.assessmentId}/interpret`).expect(201);
  return { ...r.body as { id: string; assessmentId: string }, name: f.profile.name };
}
const agree = (items: Array<{ id: string; required: boolean }>, optional = false) => Object.fromEntries(items.map((i) => [i.id, i.required || optional]));

describe("the consent form needs a second clinician", () => {
  let draftId = "";
  it("starts with a draft that still has bracketed blanks, and cannot be approved", async () => {
    const t = (await drA.get("/api/consent/templates").expect(200)).body;
    expect(t.activeId).toBeNull();
    expect(t.templates).toHaveLength(1);
    draftId = t.templates[0].id;
    expect(t.templates[0].status).toBe("draft");
    expect(t.templates[0].unresolved.length).toBeGreaterThan(0);
    await drB.post(`/api/consent/templates/${draftId}/approve`).send({ note: "Looks fine to me" }).expect(422);
  });

  it("signing is impossible until a form is approved", async () => {
    const p = await athlete();
    const r = await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: {}, signerName: "Pat Example" }).expect(409);
    expect(r.body.error).toMatch(/No approved consent form/);
  });

  it("the person who wrote or last edited it cannot approve it", async () => {
    const draft = (await drA.get("/api/consent/templates")).body.templates[0];
    await drA.put(`/api/consent/templates/${draftId}`).send({ title: draft.title, body: filled(draft.body), items: draft.items }).expect(200);
    const r = await drA.post(`/api/consent/templates/${draftId}/approve`).send({ note: "I reviewed my own text" }).expect(403);
    expect(r.body.error).toMatch(/different clinician/);
  });

  it("a different clinician must record what they reviewed", async () => {
    await drB.post(`/api/consent/templates/${draftId}/approve`).send({ note: "ok" }).expect(400);
    await drB.post(`/api/consent/templates/${draftId}/approve`).send({ note: "Read every section and tick-box; wording is clear." }).expect(200);
    const t = (await drB.get("/api/consent/templates")).body;
    expect(t.activeId).toBe(draftId);
    const approved = t.templates.find((x: any) => x.id === draftId);
    expect(approved.status).toBe("approved");
    expect(approved.approvedByName).toBe("Dr. B");
    expect(approved.createdByName).toBe("System (starting template)");
  });

  it("an approved form cannot be edited; a new version needs a fresh review", async () => {
    await drA.put(`/api/consent/templates/${draftId}`).send({ title: "x", body: "y".repeat(80), items: [{ id: "a", text: "t", required: true }] }).expect(409);
    const v2 = (await drB.post("/api/consent/templates").send({}).expect(201)).body.id;
    await drA.post("/api/consent/templates").send({}).expect(409); // only one draft at a time
    const d = (await drB.get("/api/consent/templates")).body.templates.find((t: any) => t.id === v2);
    expect(d.version).toBe(2);
    await drB.put(`/api/consent/templates/${v2}`).send({ title: d.title, body: d.body + "\n\n## Extra\nAn added paragraph for version two.", items: d.items }).expect(200);
    await drB.post(`/api/consent/templates/${v2}/approve`).send({ note: "self review" }).expect(403);
    await drA.post(`/api/consent/templates/${v2}/approve`).send({ note: "Checked the added paragraph." }).expect(200);
    const t = (await drA.get("/api/consent/templates")).body;
    expect(t.activeId).toBe(v2);
    expect(t.templates.find((x: any) => x.id === draftId).status).toBe("retired");
  });

  it("validates tick-boxes", async () => {
    const v3 = (await drA.post("/api/consent/templates").send({}).expect(201)).body.id;
    const d = (await drA.get("/api/consent/templates")).body.templates.find((t: any) => t.id === v3);
    await drA.put(`/api/consent/templates/${v3}`).send({ title: d.title, body: d.body, items: d.items.map((i: any) => ({ ...i, required: false })) }).expect(400);
    await drA.put(`/api/consent/templates/${v3}`).send({ title: d.title, body: d.body, items: [] }).expect(400);
    await drA.put(`/api/consent/templates/${v3}`).send({ title: "", body: d.body, items: d.items }).expect(400);
  });

  it("the approval and the edits are in the audit log", async () => {
    const rows = await handle.db.select().from(schema.auditLog).where(eq(schema.auditLog.entity, "consent_template"));
    expect(rows.some((r) => r.action === "approve-form" && r.actor === "Dr. B")).toBe(true);
    expect(rows.some((r) => r.action === "edit-draft" && r.actor === "Dr. A")).toBe(true);
  });

  it("athletes cannot manage the form", async () => {
    const p = await athlete({ consentGiven: true });
    const inv = (await drA.post(`/api/athletes/${p.id}/invite`).expect(201)).body.token;
    const me = client();
    await me.post(`/api/invites/${inv}/accept`).send({ email: "own@x.test", password: PW }).expect(201);
    await me.get("/api/consent/templates").expect(403);
    await me.post("/api/consent/templates").send({}).expect(403);
  });
});

describe("recording consent", () => {
  it("the 'where it is kept' statement follows the real hosting", async () => {
    const local = (await drA.get("/api/consent/active")).body;
    expect(local.hosting).toMatch(/clinic's own computer/);
    expect(local.template.body).toMatch(/clinic's own computer/);
    expect(local.template.body).not.toMatch(/Railway/);
    process.env.RAILWAY_ENVIRONMENT = "production";
    const cloud = (await drA.get("/api/consent/active")).body;
    expect(cloud.template.body).toMatch(/Railway/);
    delete process.env.RAILWAY_ENVIRONMENT;
  });

  it("requires every required tick-box and a full typed name; optional ones stay optional", async () => {
    const { template } = (await drA.get("/api/consent/active")).body;
    const p = await athlete();
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: {}, signerName: p.name }).expect(400);
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: "Pa" }).expect(400);
    const ok = await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", templateId: template.id, answers: agree(template.items), signerName: p.name }).expect(201);
    const c = (await drA.get(`/api/athletes/${p.id}/consent`)).body;
    expect(c.summary).toMatchObject({ status: "active", source: "in-app", version: template.version, signerName: p.name, recordedBy: "Dr. A" });
    expect(c.history[0].id).toBe(ok.body.id);
    const items = c.history[0].snapshot.items;
    expect(items.filter((i: any) => i.required).every((i: any) => i.agreed)).toBe(true);
    expect(items.filter((i: any) => !i.required).every((i: any) => i.agreed === false)).toBe(true);
    expect(c.history[0].snapshot.approvedBy).toBeTruthy();
  });

  it("a signed record keeps exactly what was shown even after the form changes", async () => {
    const p = await athlete();
    const { template } = (await drA.get("/api/consent/active")).body;
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: p.name }).expect(201);
    const before = (await drA.get(`/api/athletes/${p.id}/consent`)).body.history[0].snapshot.body;
    const existing = (await drA.get("/api/consent/templates")).body.templates.find((t: any) => t.status === "draft");
    const v = existing ? existing.id : (await drA.post("/api/consent/templates").send({}).expect(201)).body.id;
    const d = (await drA.get("/api/consent/templates")).body.templates.find((t: any) => t.id === v);
    await drA.put(`/api/consent/templates/${v}`).send({ title: d.title, body: d.body.replace("Why", "Purpose"), items: d.items }).expect(200);
    await drB.post(`/api/consent/templates/${v}/approve`).send({ note: "Renamed a heading; fine." }).expect(200);
    expect((await drA.get(`/api/athletes/${p.id}/consent`)).body.history[0].snapshot.body).toBe(before);
    // and a form shown before the change is refused
    const stale = await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", templateId: template.id, answers: agree(template.items), signerName: p.name }).expect(409);
    expect(stale.body.error).toMatch(/updated/);
  });

  it("under-18 athletes need a guardian who is named", async () => {
    const { template } = (await drA.get("/api/consent/active")).body;
    const kid = await athlete({ age: 15 });
    const send = (body: object) => drA.post(`/api/athletes/${kid.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: "Sam Parent", ...body });
    await send({ signerRole: "athlete" }).expect(400);
    await send({ signerRole: "guardian" }).expect(400); // relationship missing
    await send({ signerRole: "guardian", relationship: "mother" }).expect(201);
    expect((await drA.get(`/api/athletes/${kid.id}/consent`)).body.summary.signerRole).toBe("guardian");
  });

  it("a signed paper form can be recorded instead", async () => {
    const p = await athlete();
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "paper", signerName: p.name, signedOn: "2026-10-15" }).expect(400); // no reference
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "paper", signerName: p.name, reference: "Paper form, blue folder", signedOn: "15/10/2026" }).expect(400);
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "paper", signerName: p.name, reference: "Paper form, blue folder", signedOn: "2026-10-15" }).expect(201);
    expect((await drA.get(`/api/athletes/${p.id}/consent`)).body.summary).toMatchObject({ status: "active", source: "paper form", signedOn: "2026-10-15" });
  });

  it("the older 'consent given' box on the assessment still counts", async () => {
    const p = await athlete({ consentGiven: true });
    expect((await drA.get(`/api/athletes/${p.id}/consent`)).body.summary).toMatchObject({ status: "active", source: "assessment record" });
  });
});

describe("what consent controls", () => {
  it("a program cannot be approved without consent, and can be after", async () => {
    const p = await athlete();
    const prog = (await drA.post(`/api/assessments/${p.assessmentId}/program`).expect(201)).body.id;
    const blocked = await drA.post(`/api/programs/${prog}/approve`).send({ screeningReviewed: true }).expect(422);
    expect(blocked.body.error).toMatch(/consent/i);
    const { template } = (await drA.get("/api/consent/active")).body;
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: p.name }).expect(201);
    await drA.post(`/api/programs/${prog}/approve`).send({ screeningReviewed: true }).expect(200);
  });

  it("withdrawing consent blocks the athlete's data and new approvals, and re-signing restores it", async () => {
    const p = await athlete();
    const { template } = (await drA.get("/api/consent/active")).body;
    const signed = (await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: p.name }).expect(201)).body.id;
    const prog = (await drA.post(`/api/assessments/${p.assessmentId}/program`).expect(201)).body.id;
    await drA.post(`/api/programs/${prog}/approve`).send({ screeningReviewed: true }).expect(200);
    const inv = (await drA.post(`/api/athletes/${p.id}/invite`).expect(201)).body.token;
    const me = client();
    await me.post(`/api/invites/${inv}/accept`).send({ email: `w${Date.now()}@x.test`, password: PW }).expect(201);
    expect((await me.get("/api/me")).body.program).toBeTruthy();

    await drA.post(`/api/consents/${signed}/withdraw`).send({}).expect(400);
    await drA.post(`/api/consents/${signed}/withdraw`).send({ reason: "Athlete asked to stop" }).expect(200);
    expect((await drA.get(`/api/athletes/${p.id}`)).body.consent.status).toBe("withdrawn");
    const mine = (await me.get("/api/me")).body;
    expect(mine.consentRequired).toBe(true);
    expect(mine.program).toBeNull();
    expect(JSON.stringify(mine)).not.toContain("sessionLogs\":[{");
    await me.post("/api/me/weekly-logs").send({ weekStart: "2026-10-05", runKm: 30 }).expect(422);
    const prog2 = (await drA.post(`/api/assessments/${p.assessmentId}/program`).expect(201)).body.id;
    const again = await drA.post(`/api/programs/${prog2}/approve`).send({ screeningReviewed: true }).expect(422);
    expect(again.body.error).toMatch(/withdrawn/);

    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: p.name }).expect(201);
    expect((await me.get("/api/me")).body.consentRequired).toBeUndefined();
  });

  it("an adult athlete can read and sign the form in their own account", async () => {
    const p = await athlete();
    const inv = (await drA.post(`/api/athletes/${p.id}/invite`).expect(201)).body.token;
    const me = client();
    await me.post(`/api/invites/${inv}/accept`).send({ email: `s${Date.now()}@x.test`, password: PW }).expect(201);
    const gate = (await me.get("/api/me")).body;
    expect(gate.consentRequired).toBe(true);
    const form = (await me.get("/api/me/consent").expect(200)).body;
    expect(form.template.items.length).toBeGreaterThan(3);
    await me.post("/api/me/consent").send({ answers: {}, signerName: p.name }).expect(400);
    await me.post("/api/me/consent").send({ answers: agree(form.template.items), signerName: p.name }).expect(201);
    expect((await drA.get(`/api/athletes/${p.id}/consent`)).body.summary).toMatchObject({ status: "active", source: "in-app" });
    expect((await drA.get(`/api/athletes/${p.id}/consent`)).body.history[0].signedVia).toBe("athlete account");
    expect((await me.get("/api/me")).body.consentRequired).toBeUndefined();
  });

  it("an under-18 athlete cannot sign alone", async () => {
    const kid = await athlete({ age: 16 });
    const inv = (await drA.post(`/api/athletes/${kid.id}/invite`).expect(201)).body.token;
    const me = client();
    await me.post(`/api/invites/${inv}/accept`).send({ email: `k${Date.now()}@x.test`, password: PW }).expect(201);
    const form = (await me.get("/api/me/consent")).body;
    expect(form.minor).toBe(true);
    await me.post("/api/me/consent").send({ answers: agree(form.template.items), signerName: "Kid Name" }).expect(403);
  });

  it("deleting an athlete permanently also deletes their consent records", async () => {
    const p = await athlete();
    const { template } = (await drA.get("/api/consent/active")).body;
    await drA.post(`/api/athletes/${p.id}/consent`).send({ mode: "in-app", answers: agree(template.items), signerName: p.name }).expect(201);
    await drA.post(`/api/athletes/${p.id}/archive`).send({}).expect(200);
    await drA.delete(`/api/athletes/${p.id}`).send({ confirmName: p.name }).expect(200);
    expect((await handle.db.select().from(schema.consents).where(eq(schema.consents.athleteId, p.id))).length).toBe(0);
  });
});

it("default text is plain and includes the sections a privacy notice needs", () => {
  for (const heading of ["Who we are", "What we record", "How decisions are made", "Where it is kept", "How long", "Your rights", "Risks"]) expect(DEFAULT_BODY).toContain(heading);
  expect(DEFAULT_BODY).toContain("{{hosting}}");
  expect(DEFAULT_BODY).toMatch(/second clinician/);
});
