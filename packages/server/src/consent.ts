import type { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { schema, type Db } from "./db";

const { consentTemplates, consents, assessments } = schema;

export interface ConsentItem { id: string; text: string; required: boolean }

/** Where the data lives, worked out from the environment so a signed form never states a place that is not true. */
export function hostingLabel(): string {
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return "Railway, a cloud hosting service, behind individual sign-in accounts";
  return "the clinic's own computer, behind individual sign-in accounts";
}

export const PLACEHOLDER = /\[\[[^\]]*\]\]/g;
export const unresolved = (text: string) => [...new Set(text.match(PLACEHOLDER) ?? [])];
const fill = (text: string) => text.replaceAll("{{hosting}}", hostingLabel());

export const DEFAULT_TITLE = "Privacy notice and consent";
export const DEFAULT_BODY = `## Who we are
[[Clinic full name and address]]. Contact for privacy questions: [[name, phone, email]].

## What we record about you
Your name, age, sex, body weight, running goals and training history; health and injury screening answers; test results (running, strength, jumping, balance); notes on how you run, taken from video; your gym program; the sessions and weekly running you log; and notes from your clinician.

## Why
To assess you, build and adjust your strength program, track your progress, and give you reports. We do not use your information for advertising and we do not sell it.

## How decisions are made
Your clinician makes every decision. The TPC system is software that follows written rules and gives a second opinion on your test results. It does not use artificial intelligence services. It never clears you medically, and it does not replace a diagnosis. Your clinician reviews, can change or reject anything it suggests, and approves your program before you receive it. Changes to this form are reviewed and approved by a second clinician.

## Video
Video of you running or testing is recorded on a clinic device only to assess your movement. [[What happens to videos and how long they are kept]]. You can decline video and still be assessed.

## Who can see it
The TPC clinicians who treat you, and you, through your own login if you use it. We do not share it with anyone else unless you ask us to or the law requires it. [[Any referring doctor, coach or insurer you will share with, and only with the athlete's permission]].

## Where it is kept
Your information is stored on {{hosting}}. Access is by individual password. If this changes, we will tell you.

## How long
[[How long records are kept and the rule that requires it]], then they are deleted.

## Your rights
You may ask to see your information, correct it, receive a copy, or have it deleted (we may have to keep some records by law). You may withdraw consent at any time; this will not affect care already given. To do any of these contact [[name and contact]].

## Risks of testing and training
Tests and exercises can cause muscle soreness and, rarely, injury. You can stop any test or exercise at any time. Tell your clinician about any pain or health problem before and during sessions.

## If something goes wrong
If your information is ever lost or seen by someone who should not have seen it, we will tell you [[and the authority, if the law requires, within how many days]].`;

export const DEFAULT_ITEMS: ConsentItem[] = [
  { id: "read", text: "I have read (or had read to me) this privacy notice and my questions were answered.", required: true },
  { id: "records", text: "I agree that TPC may record and use my information as described, to assess me and plan my training.", required: true },
  { id: "software", text: "I understand my program is produced with the help of rule-based software, is reviewed and approved by my clinician, and is not a medical diagnosis or medical clearance.", required: true },
  { id: "stop", text: "I understand I can stop any test or exercise at any time and should tell my clinician about any pain or health problem.", required: true },
  { id: "hosting", text: "I understand my information is stored on {{hosting}}.", required: true },
  { id: "video", text: "I agree to being recorded on video for movement assessment. (You can decline and still be assessed without video.)", required: false },
  { id: "login", text: "I agree to receive my program and reports through the TPC athlete login.", required: false },
  { id: "deid", text: "I agree that my information, with my name and details removed, may be used to improve TPC's service.", required: false },
];

type HttpErrorCtor = new (status: number, message: string) => Error;
export interface ConsentCtx {
  db: Db;
  app: Express;
  clinician: Router;
  me: Router;
  HttpError: HttpErrorCtor;
  h: (fn: (req: Request, res: Response) => Promise<unknown>) => RequestHandler;
  param: (req: Request, k: string) => string;
  actorOf: (req: Request) => string;
  audit: (actor: string, action: string, entity: string, entityId: string, athleteId: string | null, detail?: unknown) => Promise<unknown>;
  getAthlete: (id: string) => Promise<{ id: string; name: string }>;
}

export type ConsentSummary = {
  status: "none" | "active" | "withdrawn";
  source: "in-app" | "paper form" | "assessment record" | null;
  id: string | null; version: number | null; signedOn: string | null; signerName: string | null; signerRole: string | null; recordedBy: string | null;
};

/** Current consent for an athlete: the newest consent record wins; otherwise the older "consent given" box on the baseline assessment counts as a paper record. */
export async function consentSummary(db: Db, athleteId: string): Promise<ConsentSummary> {
  const [latest] = await db.select().from(consents).where(eq(consents.athleteId, athleteId)).orderBy(desc(consents.createdAt));
  if (latest) {
    return {
      status: latest.status === "withdrawn" ? "withdrawn" : "active", source: latest.mode === "paper" ? "paper form" : "in-app",
      id: latest.id, version: latest.templateVersion, signedOn: latest.signedOn, signerName: latest.signerName, signerRole: latest.signerRole, recordedBy: latest.recordedBy,
    };
  }
  const [base] = await db.select().from(assessments).where(and(eq(assessments.athleteId, athleteId), eq(assessments.kind, "baseline")));
  const c = (base?.data as any)?.consent;
  if (c?.given) return { status: "active", source: "assessment record", id: null, version: null, signedOn: c.date ?? null, signerName: null, signerRole: null, recordedBy: null };
  return { status: "none", source: null, id: null, version: null, signedOn: null, signerName: null, signerRole: null, recordedBy: null };
}

export function registerConsent(ctx: ConsentCtx) {
  const { db, clinician, me, HttpError, h, param, actorOf, audit, getAthlete } = ctx;
  const id = () => randomUUID();
  const who = (req: Request) => ({ id: req.user!.id, name: req.user!.name });

  const view = (t: typeof consentTemplates.$inferSelect) => ({
    id: t.id, version: t.version, title: t.title, body: t.body, items: t.items as ConsentItem[], status: t.status,
    createdByName: t.createdByName, lastEditedByName: t.lastEditedByName, approvedByName: t.approvedByName, approvedAt: t.approvedAt,
    reviewNote: t.reviewNote, updatedAt: t.updatedAt,
    unresolved: unresolved(t.body + " " + (t.items as ConsentItem[]).map((i) => i.text).join(" ")),
  });
  const rendered = (t: typeof consentTemplates.$inferSelect) => ({
    ...view(t), body: fill(t.body), items: (t.items as ConsentItem[]).map((i) => ({ ...i, text: fill(i.text) })),
  });

  async function ensureDefault() {
    if ((await db.select().from(consentTemplates).limit(1)).length) return;
    await db.insert(consentTemplates).values({
      id: id(), version: 1, title: DEFAULT_TITLE, body: DEFAULT_BODY, items: DEFAULT_ITEMS, status: "draft",
      createdById: null, createdByName: "System (starting template)", lastEditedById: null, lastEditedByName: "System (starting template)",
    });
  }
  const allTemplates = async () => { await ensureDefault(); return db.select().from(consentTemplates).orderBy(desc(consentTemplates.version)); };
  const activeTemplate = async () => (await db.select().from(consentTemplates).where(eq(consentTemplates.status, "approved")).orderBy(desc(consentTemplates.version)))[0];
  const getTemplate = async (tid: string) => {
    const [t] = await db.select().from(consentTemplates).where(eq(consentTemplates.id, tid));
    if (!t) throw new HttpError(404, "Consent form not found");
    return t;
  };

  function cleanItems(raw: unknown): ConsentItem[] {
    if (!Array.isArray(raw)) throw new HttpError(400, "Items must be a list.");
    const items = raw.map((r: any, i) => ({ id: String(r?.id || `i${i + 1}-${Math.random().toString(36).slice(2, 6)}`), text: String(r?.text ?? "").trim(), required: Boolean(r?.required) }));
    if (items.some((i) => !i.text)) throw new HttpError(400, "Every tick-box needs wording.");
    if (new Set(items.map((i) => i.id)).size !== items.length) throw new HttpError(400, "Duplicate tick-box ids.");
    if (!items.some((i) => i.required)) throw new HttpError(400, "At least one tick-box must be required.");
    return items;
  }

  /* ---------- the form itself (clinicians) ---------- */
  clinician.get("/consent/templates", h(async (_req, res) => {
    const all = await allTemplates();
    const active = all.find((t) => t.status === "approved");
    res.json({ hosting: hostingLabel(), activeId: active?.id ?? null, templates: all.map(view) });
  }));

  clinician.get("/consent/active", h(async (_req, res) => {
    await ensureDefault();
    const t = await activeTemplate();
    res.json({ hosting: hostingLabel(), template: t ? rendered(t) : null });
  }));

  /** Start a new draft from the current approved form (or a chosen one). */
  clinician.post("/consent/templates", h(async (req, res) => {
    const all = await allTemplates();
    if (all.some((t) => t.status === "draft")) throw new HttpError(409, "There is already a draft. Finish or edit that one first.");
    const from = req.body?.fromId ? all.find((t) => t.id === req.body.fromId) : all.find((t) => t.status === "approved") ?? all[0];
    if (!from) throw new HttpError(404, "Nothing to copy from.");
    const u = who(req);
    const version = Math.max(...all.map((t) => t.version)) + 1;
    const tid = id();
    await db.insert(consentTemplates).values({
      id: tid, version, title: from.title, body: from.body, items: from.items, status: "draft",
      createdById: u.id, createdByName: u.name, lastEditedById: u.id, lastEditedByName: u.name,
    });
    await audit(u.name, "create-draft", "consent_template", tid, null, { version, from: from.version });
    res.status(201).json({ id: tid });
  }));

  clinician.put("/consent/templates/:id", h(async (req, res) => {
    const t = await getTemplate(param(req, "id"));
    if (t.status !== "draft") throw new HttpError(409, "Only a draft can be edited. Start a new version instead.");
    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    if (!title || body.length < 50) throw new HttpError(400, "A title and the full text are required.");
    const items = cleanItems(req.body?.items);
    const u = who(req);
    await db.update(consentTemplates).set({ title, body, items, lastEditedById: u.id, lastEditedByName: u.name, updatedAt: new Date() }).where(eq(consentTemplates.id, t.id));
    await audit(u.name, "edit-draft", "consent_template", t.id, null, { version: t.version });
    res.json({ ok: true });
  }));

  /** Second-clinician approval: not the author, not the last editor, and no [[placeholders]] left. */
  clinician.post("/consent/templates/:id/approve", h(async (req, res) => {
    const t = await getTemplate(param(req, "id"));
    if (t.status !== "draft") throw new HttpError(409, "Only a draft can be approved.");
    const u = who(req);
    if (u.id === t.createdById || u.id === t.lastEditedById) {
      throw new HttpError(403, "A different clinician must review and approve this form: you wrote or last edited it.");
    }
    const open = unresolved(t.body + " " + (t.items as ConsentItem[]).map((i) => i.text).join(" "));
    if (open.length) throw new HttpError(422, `Fill in every [[bracketed]] part before approval. Still open: ${open.join(", ")}`);
    const note = String(req.body?.note ?? "").trim();
    if (note.length < 5) throw new HttpError(400, "Record what you reviewed (at least a few words).");
    for (const old of await db.select().from(consentTemplates).where(eq(consentTemplates.status, "approved"))) {
      await db.update(consentTemplates).set({ status: "retired" }).where(eq(consentTemplates.id, old.id));
    }
    await db.update(consentTemplates).set({ status: "approved", approvedById: u.id, approvedByName: u.name, approvedAt: new Date(), reviewNote: note, updatedAt: new Date() }).where(eq(consentTemplates.id, t.id));
    await audit(u.name, "approve-form", "consent_template", t.id, null, { version: t.version, author: t.createdByName, lastEditor: t.lastEditedByName, note });
    res.json({ ok: true });
  }));

  /* ---------- an athlete's consent ---------- */
  async function ageOf(athleteId: string): Promise<number | null> {
    const [base] = await db.select().from(assessments).where(and(eq(assessments.athleteId, athleteId), eq(assessments.kind, "baseline")));
    const age = (base?.data as any)?.profile?.age;
    return typeof age === "number" ? age : null;
  }

  async function sign(req: Request, athleteId: string, via: "clinic device" | "athlete account", forceRole?: "athlete") {
    const t = await activeTemplate();
    if (!t) throw new HttpError(409, "No approved consent form yet. A second clinician must approve the form first (Consent form page), or record a signed paper form instead.");
    if (req.body?.templateId && req.body.templateId !== t.id) throw new HttpError(409, "The consent form was updated. Reload and show the athlete the current version.");
    const items = t.items as ConsentItem[];
    const answers = (req.body?.answers ?? {}) as Record<string, boolean>;
    const missing = items.filter((i) => i.required && answers[i.id] !== true);
    if (missing.length) throw new HttpError(400, "Every required tick-box must be agreed: " + missing.map((m) => `"${fill(m.text).slice(0, 50)}..."`).join(", "));
    const signerName = String(req.body?.signerName ?? "").trim();
    if (signerName.length < 3) throw new HttpError(400, "Type the full name of the person signing.");
    const age = await ageOf(athleteId);
    const minor = age != null && age < 18;
    let role: "athlete" | "guardian" = forceRole ?? (req.body?.signerRole === "guardian" ? "guardian" : "athlete");
    if (minor && role !== "guardian") throw new HttpError(400, "The athlete is under 18: a parent or guardian must sign.");
    if (role === "guardian" && String(req.body?.relationship ?? "").trim().length < 2) throw new HttpError(400, "Say how the guardian is related to the athlete.");
    const snapshot = {
      title: t.title, version: t.version, body: fill(t.body), hosting: hostingLabel(),
      approvedBy: t.approvedByName, approvedAt: t.approvedAt, reviewNote: t.reviewNote,
      items: items.map((i) => ({ id: i.id, text: fill(i.text), required: i.required, agreed: answers[i.id] === true })),
      relationship: role === "guardian" ? String(req.body.relationship).trim() : null,
    };
    const cid = id();
    await db.insert(consents).values({
      id: cid, athleteId, mode: "in-app", templateId: t.id, templateVersion: t.version, snapshot, signerName, signerRole: role,
      signedOn: new Date().toISOString().slice(0, 10), signedVia: via, recordedBy: req.user!.name,
    });
    await audit(req.user!.name, "consent-signed", "consent", cid, athleteId, { version: t.version, via, signerRole: role });
    return cid;
  }

  clinician.get("/athletes/:id/consent", h(async (req, res) => {
    const athleteId = param(req, "id");
    await getAthlete(athleteId);
    const history = await db.select().from(consents).where(eq(consents.athleteId, athleteId)).orderBy(desc(consents.createdAt));
    res.json({ summary: await consentSummary(db, athleteId), history });
  }));

  clinician.post("/athletes/:id/consent", h(async (req, res) => {
    const athleteId = param(req, "id");
    await getAthlete(athleteId);
    if (req.body?.mode === "paper") {
      const signerName = String(req.body?.signerName ?? "").trim();
      const reference = String(req.body?.reference ?? "").trim();
      const signedOn = String(req.body?.signedOn ?? "");
      if (signerName.length < 3) throw new HttpError(400, "Type the name of the person who signed the paper form.");
      if (reference.length < 3) throw new HttpError(400, "Say which form and where the signed copy is kept.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(signedOn)) throw new HttpError(400, "Enter the date on the paper form.");
      const minor = ((await ageOf(athleteId)) ?? 99) < 18;
      const role = req.body?.signerRole === "guardian" ? "guardian" : "athlete";
      if (minor && role !== "guardian") throw new HttpError(400, "The athlete is under 18: a parent or guardian must sign.");
      const cid = id();
      await db.insert(consents).values({
        id: cid, athleteId, mode: "paper", snapshot: { reference, note: "Clinician confirms a signed paper form is on file." }, signerName, signerRole: role,
        signedOn, signedVia: "paper form", recordedBy: actorOf(req),
      });
      await audit(actorOf(req), "consent-paper-recorded", "consent", cid, athleteId, { signerRole: role });
      return res.status(201).json({ id: cid });
    }
    res.status(201).json({ id: await sign(req, athleteId, "clinic device") });
  }));

  clinician.post("/consents/:id/withdraw", h(async (req, res) => {
    const [c] = await db.select().from(consents).where(eq(consents.id, param(req, "id")));
    if (!c) throw new HttpError(404, "Consent not found");
    if (c.status === "withdrawn") throw new HttpError(409, "Already withdrawn.");
    const reason = String(req.body?.reason ?? "").trim();
    if (reason.length < 3) throw new HttpError(400, "Record who withdrew consent and why, even briefly.");
    await db.update(consents).set({ status: "withdrawn", withdrawnAt: new Date(), withdrawnReason: reason }).where(eq(consents.id, c.id));
    await audit(actorOf(req), "consent-withdrawn", "consent", c.id, c.athleteId, { reason });
    res.json({ ok: true });
  }));

  /* ---------- the athlete's own view ---------- */
  me.get("/consent", h(async (req, res) => {
    const athleteId = req.user!.athleteId;
    if (!athleteId) throw new HttpError(403, "No athlete record linked to this account.");
    await ensureDefault();
    const t = await activeTemplate();
    const minor = ((await ageOf(athleteId)) ?? 99) < 18;
    res.json({ summary: await consentSummary(db, athleteId), template: t ? rendered(t) : null, minor });
  }));

  me.post("/consent", h(async (req, res) => {
    const athleteId = req.user!.athleteId;
    if (!athleteId) throw new HttpError(403, "No athlete record linked to this account.");
    const age = await ageOf(athleteId);
    if (age != null && age < 18) throw new HttpError(403, "Because you are under 18, a parent or guardian signs with your clinician.");
    res.status(201).json({ id: await sign(req, athleteId, "athlete account", "athlete") });
  }));
}

/** Throws unless the athlete has an active consent. Used before a program is approved or the athlete's data is shown to them. */
export async function requireActiveConsent(db: Db, athleteId: string, HttpError: HttpErrorCtor, message: string) {
  const s = await consentSummary(db, athleteId);
  if (s.status !== "active") throw new HttpError(422, s.status === "withdrawn" ? "Consent was withdrawn for this athlete. " + message : message);
  return s;
}

