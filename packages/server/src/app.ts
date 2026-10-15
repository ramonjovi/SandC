import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { ZodError } from "zod";
import {
  allRules, checkWeeklyVolume, compareInterpretations, epley1RM, getModule, listModules, objectiveProgress, proposeNextTargets,
  type EngineReport, type PtInterpretation, type Program, type PrescribedExercise, type SessionLog,
} from "@tpc/engine";
import { schema, type Db } from "./db";
import {
  ApproveSchema, AssessmentSchema, CreateAthleteSchema, PtSchema, SessionLogSchema, WeeklyLogSchema, parseAssessment,
} from "./schemas";

const { athletes, assessments, engineReports, ptInterpretations, programs, sessionLogs, weeklyLogs, auditLog } = schema;

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const nf = (what: string) => new HttpError(404, `${what} not found`);
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};
const id = () => randomUUID();
const param = (req: Request, k: string) => String(req.params[k]);

export function createApp(db: Db) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const actorOf = (req: Request) => String(req.header("x-actor") ?? "clinician").slice(0, 80);
  const audit = (actor: string, action: string, entity: string, entityId: string, athleteId: string | null, detail?: unknown) =>
    db.insert(auditLog).values({ actor, action, entity, entityId, athleteId, detail: detail ?? null });

  /* ---------- clinician auth (shared token; replace with real auth before real patient data) ---------- */
  const requireClinician = (req: Request, _res: Response, next: NextFunction) => {
    const token = process.env.CLINICIAN_TOKEN;
    if (token && req.header("x-clinician-token") !== token) return next(new HttpError(401, "Clinician token required."));
    next();
  };

  /* ---------- loaders ---------- */
  const getAthlete = async (athleteId: string) => {
    const [a] = await db.select().from(athletes).where(eq(athletes.id, athleteId));
    if (!a) throw nf("Athlete");
    return a;
  };
  const getAssessment = async (assessmentId: string) => {
    const [a] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
    if (!a) throw nf("Assessment");
    return a;
  };
  const getProgram = async (programId: string) => {
    const [p] = await db.select().from(programs).where(eq(programs.id, programId));
    if (!p) throw nf("Program");
    return p;
  };
  const assessmentsFor = (athleteId: string) =>
    db.select().from(assessments).where(eq(assessments.athleteId, athleteId)).orderBy(asc(assessments.createdAt));
  const latestReport = async (assessmentId: string) =>
    (await db.select().from(engineReports).where(eq(engineReports.assessmentId, assessmentId)).orderBy(desc(engineReports.createdAt)))[0];
  const latestPt = async (assessmentId: string) =>
    (await db.select().from(ptInterpretations).where(eq(ptInterpretations.assessmentId, assessmentId)).orderBy(desc(ptInterpretations.createdAt)))[0];

  async function roadmapFor(athleteId: string) {
    const athlete = await getAthlete(athleteId);
    const mod = getModule(athlete.moduleId);
    const all = await assessmentsFor(athleteId);
    const baseline = all.find((a) => a.kind === "baseline");
    if (!baseline) throw nf("Baseline assessment");
    const latest = all[all.length - 1];
    const progs = await db.select().from(programs).where(eq(programs.athleteId, athleteId)).orderBy(desc(programs.updatedAt));
    const prog = progs.find((p) => p.status === "approved") ?? progs.find((p) => p.status === "draft");
    const program = prog?.data as Program | undefined;
    const baseMetrics = mod.computeMetrics(baseline.data as any);
    const curMetrics = { ...mod.computeMetrics(latest.data as any) };
    const logs = prog ? await db.select().from(sessionLogs).where(eq(sessionLogs.programId, prog.id)).orderBy(asc(sessionLogs.createdAt)) : [];

    // Training-log estimate of current squat strength (only upgrades the figure).
    let logSquat: number | null = null;
    for (const l of logs) for (const e of (l.data as SessionLog).exercises) {
      if (e.exerciseId !== "back_squat") continue;
      for (const s of e.sets) if (s.loadKg && s.reps > 0 && s.reps <= 10) logSquat = Math.max(logSquat ?? 0, epley1RM(s.loadKg, s.reps));
    }
    let squatSource = "assessment";
    if (logSquat != null && (typeof curMetrics.squat1RM !== "number" || logSquat > curMetrics.squat1RM)) {
      curMetrics.squat1RM = Math.round(logSquat * 10) / 10;
      squatSource = "training log (estimated)";
    }
    const objectives = program ? objectiveProgress(program.objectives, curMetrics) : [];
    const done = new Set(logs.map((l) => `${l.week}-${l.day}`));
    const totalSessions = program ? program.weeks.reduce((n, w) => n + w.sessions.length, 0) : 0;
    const currentWeek = logs.length ? Math.max(...logs.map((l) => l.week)) : 1;
    const milestones = (program?.milestones ?? []).map((m) => ({
      ...m, status: m.week < currentWeek ? "done" : m.week === currentWeek ? "current" : "upcoming",
    }));
    const weekly = await db.select().from(weeklyLogs).where(eq(weeklyLogs.athleteId, athleteId)).orderBy(asc(weeklyLogs.weekStart));
    return {
      athleteName: athlete.name,
      goals: (baseline.data as any).goals,
      baselineMetrics: baseMetrics, currentMetrics: curMetrics, squatSource,
      objectives, milestones, currentWeek,
      adherence: { completed: done.size, planned: totalSessions, pct: totalSessions ? Math.round((done.size / totalSessions) * 100) : 0 },
      weeklyLogs: weekly,
      programStatus: prog?.status ?? null,
    };
  }

  /* ---------- meta ---------- */
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  const clinician = express.Router();
  clinician.use(requireClinician);
  app.use("/api", (req, res, next) => (req.path.startsWith("/athlete/") || req.path === "/health" ? next() : clinician(req, res, next)));

  clinician.get("/meta", (_req, res) => {
    res.json({
      authRequired: Boolean(process.env.CLINICIAN_TOKEN),
      rules: allRules(),
      modules: listModules().map((m) => ({ id: m.id, name: m.name, priorities: m.priorityKeys() })),
    });
  });

  /* ---------- athletes ---------- */
  clinician.get("/athletes", h(async (_req, res) => {
    const rows = await db.select().from(athletes).orderBy(desc(athletes.createdAt));
    const out = [];
    for (const a of rows) {
      const progs = await db.select().from(programs).where(eq(programs.athleteId, a.id));
      out.push({ ...a, programStatus: progs.find((p) => p.status === "approved") ? "approved" : progs.find((p) => p.status === "draft") ? "draft" : null });
    }
    res.json(out);
  }));

  clinician.post("/athletes", h(async (req, res) => {
    const body = CreateAthleteSchema.parse(req.body);
    const athleteId = id();
    const accessCode = randomBytes(5).toString("hex");
    await db.insert(athletes).values({ id: athleteId, name: body.profile.name, accessCode, moduleId: "running", isSynthetic: Boolean(req.body.isSynthetic) });
    const data = parseAssessment({ profile: body.profile, goals: body.goals });
    const assessmentId = id();
    await db.insert(assessments).values({ id: assessmentId, athleteId, kind: "baseline", data });
    await audit(body.clinician, "create", "athlete", athleteId, athleteId, { name: body.profile.name });
    res.status(201).json({ id: athleteId, accessCode, assessmentId });
  }));

  clinician.get("/athletes/:id", h(async (req, res) => {
    const athleteId = param(req, "id");
    const athlete = await getAthlete(athleteId);
    const all = await assessmentsFor(athleteId);
    const progs = await db.select().from(programs).where(eq(programs.athleteId, athleteId)).orderBy(desc(programs.updatedAt));
    const baseline = all.find((a) => a.kind === "baseline") ?? null;
    const out = [];
    for (const a of all) {
      const rep = await latestReport(a.id);
      const pt = await latestPt(a.id);
      out.push({ ...a, report: rep?.report ?? null, reportAt: rep?.createdAt ?? null, pt: pt ? { ...pt } : null });
    }
    const logs = await db.select().from(sessionLogs).where(eq(sessionLogs.athleteId, athleteId)).orderBy(desc(sessionLogs.createdAt));
    const weekly = await db.select().from(weeklyLogs).where(eq(weeklyLogs.athleteId, athleteId)).orderBy(desc(weeklyLogs.weekStart));
    res.json({ athlete, baselineId: baseline?.id ?? null, assessments: out, programs: progs, sessionLogs: logs, weeklyLogs: weekly });
  }));

  clinician.get("/athletes/:id/roadmap", h(async (req, res) => res.json(await roadmapFor(param(req, "id")))));
  clinician.get("/athletes/:id/audit", h(async (req, res) => {
    res.json(await db.select().from(auditLog).where(eq(auditLog.athleteId, param(req, "id"))).orderBy(desc(auditLog.at)).limit(300));
  }));

  /* ---------- assessments ---------- */
  clinician.put("/assessments/:id", h(async (req, res) => {
    const a = await getAssessment(param(req, "id"));
    const data = parseAssessment(req.body.data ?? req.body);
    await db.update(assessments).set({ data, updatedAt: new Date() }).where(eq(assessments.id, a.id));
    await audit(actorOf(req), "update", "assessment", a.id, a.athleteId, { before: a.data, after: data });
    res.json({ ok: true });
  }));

  clinician.post("/athletes/:id/reassessments", h(async (req, res) => {
    const athleteId = param(req, "id");
    await getAthlete(athleteId);
    const all = await assessmentsFor(athleteId);
    const source = req.body?.data ?? all[all.length - 1]?.data;
    const data = parseAssessment(source);
    const assessmentId = id();
    await db.insert(assessments).values({ id: assessmentId, athleteId, kind: "reassessment", data });
    await audit(actorOf(req), "create", "reassessment", assessmentId, athleteId);
    res.status(201).json({ assessmentId });
  }));

  clinician.post("/assessments/:id/interpret", h(async (req, res) => {
    const a = await getAssessment(param(req, "id"));
    const athlete = await getAthlete(a.athleteId);
    const report = getModule(athlete.moduleId).interpret(parseAssessment(a.data));
    const reportId = id();
    await db.insert(engineReports).values({ id: reportId, athleteId: a.athleteId, assessmentId: a.id, report });
    await audit("engine", "interpret", "engine_report", reportId, a.athleteId, { engineVersion: report.engineVersion, strategy: report.strategy.key });
    // Re-compare any existing PT interpretation against the fresh engine report.
    const pt = await latestPt(a.id);
    if (pt) {
      const mod = getModule(athlete.moduleId);
      const labels = Object.fromEntries(mod.priorityKeys().map((p) => [p.key, p.label]));
      const comparison = compareInterpretations(report, pt.data as PtInterpretation, (k) => labels[k] ?? k);
      await db.update(ptInterpretations).set({ comparison }).where(eq(ptInterpretations.id, pt.id));
    }
    res.status(201).json(report);
  }));

  clinician.put("/assessments/:id/pt-interpretation", h(async (req, res) => {
    const a = await getAssessment(param(req, "id"));
    const athlete = await getAthlete(a.athleteId);
    const body = PtSchema.parse(req.body);
    const rep = await latestReport(a.id);
    const { clinician: who, ...ptData } = body;
    let comparison = null;
    if (rep) {
      const mod = getModule(athlete.moduleId);
      const labels = Object.fromEntries(mod.priorityKeys().map((p) => [p.key, p.label]));
      comparison = compareInterpretations(rep.report as EngineReport, ptData as PtInterpretation, (k) => labels[k] ?? k);
    }
    const ptId = id();
    await db.insert(ptInterpretations).values({ id: ptId, athleteId: a.athleteId, assessmentId: a.id, clinician: who, data: ptData, comparison });
    await audit(who, "record", "pt_interpretation", ptId, a.athleteId, ptData);
    res.status(201).json({ id: ptId, comparison });
  }));

  /* ---------- programs ---------- */
  clinician.post("/assessments/:id/program", h(async (req, res) => {
    const a = await getAssessment(param(req, "id"));
    const athlete = await getAthlete(a.athleteId);
    const mod = getModule(athlete.moduleId);
    const data = parseAssessment(a.data);
    const rep = (await latestReport(a.id))?.report as EngineReport | undefined;
    const report = rep ?? mod.interpret(data);
    const program = mod.generateProgram(data, report, {});
    // Replace any existing draft; approved programs stay until the new one is approved.
    const existing = await db.select().from(programs).where(and(eq(programs.athleteId, a.athleteId), eq(programs.status, "draft")));
    for (const e of existing) await db.update(programs).set({ status: "archived", updatedAt: new Date() }).where(eq(programs.id, e.id));
    const programId = id();
    await db.insert(programs).values({ id: programId, athleteId: a.athleteId, assessmentId: a.id, status: "draft", data: program });
    await audit(actorOf(req), "generate", "program", programId, a.athleteId, { strategy: program.strategy.key, weeks: program.durationWeeks });
    res.status(201).json({ id: programId });
  }));

  clinician.put("/programs/:id", h(async (req, res) => {
    const p = await getProgram(param(req, "id"));
    if (p.status === "archived") throw new HttpError(409, "Archived programs cannot be edited.");
    const data = req.body.data as Program;
    if (!data?.weeks?.length) throw new HttpError(400, "Program data required.");
    await db.update(programs).set({ data, version: p.version + 1, updatedAt: new Date() }).where(eq(programs.id, p.id));
    await audit(actorOf(req), "edit", "program", p.id, p.athleteId, { status: p.status, version: p.version + 1 });
    res.json({ ok: true, version: p.version + 1 });
  }));

  clinician.post("/programs/:id/approve", h(async (req, res) => {
    const p = await getProgram(param(req, "id"));
    if (p.status === "archived") throw new HttpError(409, "Archived programs cannot be approved.");
    const body = ApproveSchema.parse(req.body);
    const rep = await latestReport(p.assessmentId);
    const hasHighStakes = ((rep?.report as EngineReport | undefined)?.safetyFlags ?? []).some((f) => f.highStakes);
    if (hasHighStakes && !(body.clearanceNote && body.clearanceNote.trim().length >= 10)) {
      throw new HttpError(422, "Health screening flags are present. Record the medical review/clearance decision (at least a short note) before approving.");
    }
    const prior = await db.select().from(programs).where(and(eq(programs.athleteId, p.athleteId), eq(programs.status, "approved")));
    for (const e of prior) if (e.id !== p.id) await db.update(programs).set({ status: "archived", updatedAt: new Date() }).where(eq(programs.id, e.id));
    await db.update(programs).set({
      status: "approved", screeningReviewed: true, clearanceNote: body.clearanceNote ?? null,
      approvedBy: body.clinician, approvedAt: new Date(), updatedAt: new Date(),
    }).where(eq(programs.id, p.id));
    await audit(body.clinician, "approve", "program", p.id, p.athleteId, { clearanceNote: body.clearanceNote ?? null, hasHighStakes });
    res.json({ ok: true });
  }));

  clinician.post("/session-logs/:id/apply", h(async (req, res) => {
    const [log] = await db.select().from(sessionLogs).where(eq(sessionLogs.id, param(req, "id")));
    if (!log) throw nf("Session log");
    const p = await getProgram(log.programId);
    const program = structuredClone(p.data) as Program;
    const changes: Array<{ exerciseId: string; week: number; from: number | null; to: number | null; sets: number }> = [];
    for (const t of log.proposals as Array<import("@tpc/engine").NextTarget>) {
      if (t.action === "hold" || t.action === "pain_hold") continue;
      const next = program.weeks.find((w) => w.week === log.week + 1);
      const ex = next?.sessions.find((s) => s.day === log.day)?.exercises.find((e) => e.exerciseId === t.exerciseId);
      if (!ex) continue;
      changes.push({ exerciseId: t.exerciseId, week: log.week + 1, from: ex.loadKg, to: t.nextLoadKg, sets: t.nextSets });
      if (t.nextLoadKg != null) ex.loadKg = t.nextLoadKg;
      if (t.action === "reduce") ex.sets = Math.min(ex.sets, t.nextSets);
    }
    await db.update(programs).set({ data: program, version: p.version + 1, updatedAt: new Date() }).where(eq(programs.id, p.id));
    await db.update(sessionLogs).set({ appliedAt: new Date() }).where(eq(sessionLogs.id, log.id));
    await audit(actorOf(req), "apply-targets", "session_log", log.id, log.athleteId, { changes });
    res.json({ ok: true, changes });
  }));

  /* ---------- athlete interface ---------- */
  const athleteByCode = async (code: string) => {
    const [a] = await db.select().from(athletes).where(eq(athletes.accessCode, code));
    if (!a) throw nf("Athlete link");
    return a;
  };
  const approvedFor = async (athleteId: string) =>
    (await db.select().from(programs).where(and(eq(programs.athleteId, athleteId), eq(programs.status, "approved"))))[0];

  app.get("/api/athlete/:code/me", h(async (req, res) => {
    const a = await athleteByCode(param(req, "code"));
    const prog = await approvedFor(a.id);
    const logs = prog ? await db.select().from(sessionLogs).where(eq(sessionLogs.programId, prog.id)).orderBy(desc(sessionLogs.createdAt)) : [];
    const weekly = await db.select().from(weeklyLogs).where(eq(weeklyLogs.athleteId, a.id)).orderBy(desc(weeklyLogs.weekStart));
    const program = prog?.data as Program | undefined;
    res.json({
      name: a.name,
      program: program ? { id: prog!.id, version: prog!.version, durationWeeks: program.durationWeeks, weeks: program.weeks, approvedAt: prog!.approvedAt } : null,
      sessionLogs: logs.map((l) => ({ id: l.id, week: l.week, day: l.day, createdAt: l.createdAt, data: l.data, proposals: l.proposals })),
      weeklyLogs: weekly,
      roadmap: prog ? await roadmapFor(a.id) : null,
    });
  }));

  app.post("/api/athlete/:code/session-logs", h(async (req, res) => {
    const a = await athleteByCode(param(req, "code"));
    const prog = await approvedFor(a.id);
    if (!prog) throw new HttpError(409, "No approved program yet.");
    const body = SessionLogSchema.parse(req.body);
    const program = prog.data as Program;
    const session = program.weeks.find((w) => w.week === body.week)?.sessions.find((s) => s.day === body.day);
    if (!session) throw new HttpError(400, "Unknown session.");
    const log: SessionLog = { ...body, performedAt: body.performedAt ?? new Date().toISOString(), exercises: body.exercises };
    const all = await assessmentsFor(a.id);
    const cmjBase = (all[0]?.data as any)?.physical?.cmjHeightCm ?? null;
    const proposals = proposeNextTargets(session.exercises as PrescribedExercise[], log, { cmjBaselineCm: cmjBase });
    const logId = id();
    await db.insert(sessionLogs).values({ id: logId, athleteId: a.id, programId: prog.id, week: body.week, day: body.day, data: log, proposals });
    await audit("athlete", "log-session", "session_log", logId, a.id, { week: body.week, day: body.day });
    res.status(201).json({ id: logId, proposals });
  }));

  app.post("/api/athlete/:code/weekly-logs", h(async (req, res) => {
    const a = await athleteByCode(param(req, "code"));
    const body = WeeklyLogSchema.parse(req.body);
    const prev = (await db.select().from(weeklyLogs).where(eq(weeklyLogs.athleteId, a.id)).orderBy(desc(weeklyLogs.weekStart)))
      .find((w) => w.weekStart < body.weekStart);
    const volumeFlag = prev ? checkWeeklyVolume(prev.runKm, body.runKm) : null;
    const logId = id();
    await db.insert(weeklyLogs).values({ id: logId, athleteId: a.id, weekStart: body.weekStart, runKm: body.runKm, painModifiedTraining: body.painModifiedTraining, notes: body.notes ?? null, volumeFlag });
    await audit("athlete", "log-week", "weekly_log", logId, a.id, { ...body, volumeFlag });
    res.status(201).json({ id: logId, volumeFlag, painFlag: body.painModifiedTraining });
  }));

  /* ---------- static client (production) ---------- */
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}

export { AssessmentSchema };
