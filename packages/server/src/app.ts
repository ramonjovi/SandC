import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { ZodError } from "zod";
import {
  allRules, checkWeeklyVolume, compareInterpretations, getModule, listModules, objectiveProgress, paramsFor, progressionConfigFrom,
  proposeNextTargets, running, weeklyCapPct, type RuleOverrides,
  type EngineReport, type PtInterpretation, type Program, type PrescribedExercise, type SessionLog,
} from "@tpc/engine";
import { schema, type Db } from "./db";
import {
  AuthError, attachUser, endSession, hashPassword, makeLimiter, newToken, passwordProblem, requireCsrfHeader, requireRole, sha256,
  startSession, verifyPassword,
} from "./auth";
import {
  ApproveSchema, AssessmentSchema, CreateAthleteSchema, PtSchema, SessionLogSchema, WeeklyLogSchema, parseAssessment,
} from "./schemas";

const { athletes, assessments, engineReports, ptInterpretations, programs, sessionLogs, weeklyLogs, auditLog, users, invites, ruleOverrides } = schema;

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

  const actorOf = (req: Request) => req.user?.name ?? "system";
  const audit = (actor: string, action: string, entity: string, entityId: string, athleteId: string | null, detail?: unknown) =>
    db.insert(auditLog).values({ actor, action, entity, entityId, athleteId, detail: detail ?? null });

  app.use("/api", attachUser(db), requireCsrfHeader);
  const loginLimiter = makeLimiter(8, 15 * 60_000);

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

  /** Clinician overrides of rule defaults, as the engine's parameter store. */
  const loadOverrides = async (): Promise<RuleOverrides> => {
    const out: RuleOverrides = {};
    for (const r of await db.select().from(ruleOverrides)) (out[r.ruleId] ??= {})[r.key] = r.value;
    return out;
  };
  const loadParams = async () => paramsFor(await loadOverrides());

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
      for (const s of e.sets) if (s.loadKg && s.reps > 0 && s.reps <= 10) logSquat = Math.max(logSquat ?? 0, running.estimate1RM(s.loadKg, s.reps));
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

    // Trend data for charts and PDF reports.
    const when = (l: (typeof logs)[number]) => String((l.data as SessionLog).performedAt ?? l.createdAt.toISOString());
    const sessionLoads: Array<{ at: string; week: number; day: number; exerciseId: string; topLoadKg: number; e1rm: number | null }> = [];
    for (const l of [...logs].sort((x, y) => when(x).localeCompare(when(y)))) {
      for (const e of (l.data as SessionLog).exercises) {
        if (e.exerciseId !== "back_squat" && e.exerciseId !== "trap_bar_deadlift") continue;
        const best = e.sets.filter((x) => x.loadKg && x.reps > 0).sort((p, q) => (q.loadKg ?? 0) - (p.loadKg ?? 0))[0];
        if (!best) continue;
        sessionLoads.push({ at: when(l), week: l.week, day: l.day, exerciseId: e.exerciseId, topLoadKg: best.loadKg!, e1rm: e.exerciseId === "back_squat" && best.reps <= 10 ? Math.round(running.estimate1RM(best.loadKg!, best.reps) * 10) / 10 : null });
      }
    }
    const series = {
      assessments: all.map((a) => ({ at: a.createdAt.toISOString(), kind: a.kind, metrics: mod.computeMetrics(a.data as any) })),
      sessionLoads,
      weeklyKm: weekly.map((w) => ({ weekStart: w.weekStart, runKm: w.runKm, volumeFlag: w.volumeFlag, painModifiedTraining: w.painModifiedTraining })),
    };
    const sessionGrid = (program?.weeks ?? []).flatMap((w) => w.sessions.map((s) => {
      const log = logs.find((l) => l.week === w.week && l.day === s.day);
      return { week: w.week, day: s.day, name: s.name, phase: w.phase, done: Boolean(log), logId: log?.id ?? null, loggedBy: log?.loggedBy ?? null, at: log ? when(log) : null };
    }));
    return {
      athleteName: athlete.name,
      goals: (baseline.data as any).goals,
      baselineMetrics: baseMetrics, currentMetrics: curMetrics, squatSource,
      objectives, milestones, currentWeek,
      adherence: { completed: done.size, planned: totalSessions, pct: totalSessions ? Math.round((done.size / totalSessions) * 100) : 0 },
      weeklyLogs: weekly,
      series, sessionGrid,
      programName: program ? `${program.durationWeeks}-week S&C program` : null,
      programStatus: prog?.status ?? null,
    };
  }

  /* ---------- meta ---------- */
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  /* ---------- auth ---------- */
  const publicUser = (u: { id: string; email: string; name: string; role: string; athleteId: string | null }) => ({ id: u.id, email: u.email, name: u.name, role: u.role, athleteId: u.athleteId });

  app.post("/api/auth/login", h(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const key = `${req.ip}|${email}`;
    if (!loginLimiter.take(key)) throw new HttpError(429, "Too many attempts. Try again in a few minutes.");
    const [u] = await db.select().from(users).where(eq(users.email, email));
    // Always run a hash comparison so timing does not reveal whether the account exists.
    const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA==");
    if (!u || !ok || u.disabled) {
      await audit(email || "unknown", "login-failed", "user", u?.id ?? "-", u?.athleteId ?? null);
      throw new HttpError(401, "Incorrect email or password.");
    }
    loginLimiter.reset(key);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    await startSession(db, req, res, u.id);
    await audit(u.name, "login", "user", u.id, u.athleteId);
    res.json(publicUser(u));
  }));
  app.post("/api/auth/logout", h(async (req, res) => { await endSession(db, req, res); res.json({ ok: true }); }));
  app.get("/api/auth/me", (req, res) => res.json(req.user ? publicUser(req.user) : null));
  app.post("/api/auth/change-password", requireRole("admin", "clinician", "athlete"), h(async (req, res) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (!(await verifyPassword(String(req.body?.current ?? ""), u.passwordHash))) throw new HttpError(401, "Current password is incorrect.");
    const next = String(req.body?.next ?? "");
    const problem = passwordProblem(next);
    if (problem) throw new HttpError(400, problem);
    await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, u.id));
    // Sign out all other sessions, then start a fresh one for this device.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
    await startSession(db, req, res, u.id);
    await audit(u.name, "change-password", "user", u.id, u.athleteId);
    res.json({ ok: true });
  }));

  /* ---------- athlete invites (public side) ---------- */
  const findInvite = async (token: string) => {
    const [inv] = await db.select().from(invites).where(eq(invites.tokenHash, sha256(token)));
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) throw new HttpError(410, "This invite link is invalid or has expired. Ask your clinician for a new one.");
    return inv;
  };
  app.get("/api/invites/:token", h(async (req, res) => {
    const inv = await findInvite(param(req, "token"));
    res.json({ athleteName: (await getAthlete(inv.athleteId)).name });
  }));
  app.post("/api/invites/:token/accept", h(async (req, res) => {
    const inv = await findInvite(param(req, "token"));
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);
    const [taken] = await db.select().from(users).where(eq(users.email, email));
    if (taken) throw new HttpError(409, "An account with this email already exists.");
    const athlete = await getAthlete(inv.athleteId);
    const userId = id();
    await db.insert(users).values({ id: userId, email, name: athlete.name, role: "athlete", passwordHash: await hashPassword(password), athleteId: athlete.id });
    await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.tokenHash, inv.tokenHash));
    await audit(athlete.name, "accept-invite", "user", userId, athlete.id);
    await startSession(db, req, res, userId);
    res.status(201).json({ id: userId, email, name: athlete.name, role: "athlete", athleteId: athlete.id });
  }));

  /* ---------- admin ---------- */
  const admin = express.Router();
  admin.use(requireRole("admin"));
  admin.get("/users", h(async (_req, res) => {
    const rows = await db.select().from(users);
    res.json(rows.map((u) => ({ ...publicUser(u), disabled: u.disabled, lastLoginAt: u.lastLoginAt })));
  }));
  admin.post("/users", h(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim();
    const role = req.body?.role === "admin" ? "admin" : "clinician";
    const password = String(req.body?.password ?? "");
    if (!name || !email.includes("@")) throw new HttpError(400, "Name and a valid email are required.");
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);
    if ((await db.select().from(users).where(eq(users.email, email))).length) throw new HttpError(409, "Email already in use.");
    const userId = id();
    await db.insert(users).values({ id: userId, email, name, role, passwordHash: await hashPassword(password) });
    await audit(actorOf(req), "create-user", "user", userId, null, { email, role });
    res.status(201).json({ id: userId });
  }));
  admin.patch("/users/:id", h(async (req, res) => {
    const uid = param(req, "id");
    if (uid === req.user!.id) throw new HttpError(400, "You cannot change your own account here.");
    const patch: Partial<typeof users.$inferInsert> = {};
    if (typeof req.body?.disabled === "boolean") patch.disabled = req.body.disabled;
    if (req.body?.password) {
      const problem = passwordProblem(String(req.body.password));
      if (problem) throw new HttpError(400, problem);
      patch.passwordHash = await hashPassword(String(req.body.password));
    }
    await db.update(users).set(patch).where(eq(users.id, uid));
    if (patch.disabled || patch.passwordHash) await db.delete(schema.sessions).where(eq(schema.sessions.userId, uid));
    await audit(actorOf(req), "update-user", "user", uid, null, { disabled: patch.disabled, passwordReset: Boolean(patch.passwordHash) });
    res.json({ ok: true });
  }));
  app.use("/api/admin", admin);

  const clinician = express.Router();
  clinician.use(requireRole("clinician", "admin"));

  clinician.get("/meta", (_req, res) => {
    res.json({
      rules: allRules(),
      modules: listModules().map((m) => ({ id: m.id, name: m.name, priorities: m.priorityKeys(), protocols: m.protocols ?? [] })),
    });
  });

  /* ---------- athletes ---------- */
  /* ---------- rule defaults (global, clinician-editable, audited) ---------- */
  clinician.get("/rules/overrides", h(async (_req, res) => {
    const rows = await db.select().from(ruleOverrides);
    res.json(rows.map((r) => ({ ruleId: r.ruleId, key: r.key, value: r.value, updatedBy: r.updatedBy, updatedAt: r.updatedAt })));
  }));

  clinician.get("/rules/audit", h(async (_req, res) => {
    res.json(await db.select().from(auditLog).where(eq(auditLog.entity, "rule_default")).orderBy(desc(auditLog.at)).limit(200));
  }));

  clinician.put("/rules/:ruleId/defaults", h(async (req, res) => {
    const ruleId = param(req, "ruleId");
    const rule = allRules().find((r) => r.id === ruleId);
    if (!rule?.paramMeta) throw new HttpError(404, "This rule has no editable values.");
    const reason = String(req.body?.reason ?? "").trim();
    if (reason.length < 5) throw new HttpError(400, "A reason for the change is required (at least 5 characters).");
    const current = (await loadOverrides())[ruleId] ?? {};
    const effective = (k: string) => current[k] ?? (rule.defaults![k] as number);
    const next: Record<string, number> = {};
    if (req.body?.reset === true) {
      for (const k of Object.keys(rule.paramMeta)) next[k] = rule.defaults![k] as number;
    } else {
      const values = req.body?.values;
      if (!values || typeof values !== "object") throw new HttpError(400, "No values supplied.");
      for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
        const meta = rule.paramMeta[k];
        if (!meta) throw new HttpError(400, `${k} is not an editable value of this rule.`);
        if (typeof v !== "number" || !Number.isFinite(v)) throw new HttpError(400, `${meta.label}: enter a number.`);
        if (v < meta.min || v > meta.max) throw new HttpError(400, `${meta.label}: must be between ${meta.min} and ${meta.max}.`);
        next[k] = v;
      }
    }
    const changes = Object.entries(next).filter(([k, v]) => v !== effective(k)).map(([k, v]) => ({ key: k, from: effective(k), to: v, default: rule.defaults![k] as number }));
    if (changes.length === 0) throw new HttpError(400, "Nothing changed.");
    const actor = actorOf(req);
    for (const c of changes) {
      if (c.to === c.default) await db.delete(ruleOverrides).where(and(eq(ruleOverrides.ruleId, ruleId), eq(ruleOverrides.key, c.key)));
      else await db.insert(ruleOverrides).values({ ruleId, key: c.key, value: c.to, updatedBy: actor })
        .onConflictDoUpdate({ target: [ruleOverrides.ruleId, ruleOverrides.key], set: { value: c.to, updatedBy: actor, updatedAt: new Date() } });
    }
    await audit(actor, req.body?.reset === true ? "reset-default" : "edit-default", "rule_default", ruleId, null, { reason, ruleStatus: rule.status, changes });
    res.json({ ok: true, changes });
  }));

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
    await db.insert(athletes).values({ id: athleteId, name: body.profile.name, moduleId: "running", isSynthetic: Boolean(req.body.isSynthetic) });
    const data = parseAssessment({ profile: body.profile, goals: body.goals });
    const assessmentId = id();
    await db.insert(assessments).values({ id: assessmentId, athleteId, kind: "baseline", data });
    await audit(actorOf(req), "create", "athlete", athleteId, athleteId, { name: body.profile.name });
    res.status(201).json({ id: athleteId, assessmentId });
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
    const account = (await db.select().from(users).where(eq(users.athleteId, athleteId)))[0];
    res.json({ account: account ? { email: account.email, lastLoginAt: account.lastLoginAt, disabled: account.disabled } : null, athlete, baselineId: baseline?.id ?? null, assessments: out, programs: progs, sessionLogs: logs, weeklyLogs: weekly });
  }));

  clinician.post("/athletes/:id/invite", h(async (req, res) => {
    const athleteId = param(req, "id");
    await getAthlete(athleteId);
    const token = newToken();
    await db.insert(invites).values({ tokenHash: sha256(token), athleteId, createdBy: actorOf(req), expiresAt: new Date(Date.now() + 7 * 86400_000) });
    await audit(actorOf(req), "invite", "athlete", athleteId, athleteId);
    res.status(201).json({ token, expiresInDays: 7 });
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
    const report = getModule(athlete.moduleId).interpret(parseAssessment(a.data), await loadParams());
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
    const { clinician: _ignored, ...ptData } = body;
    const who = actorOf(req);
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
    const params = await loadParams();
    const report = rep ?? mod.interpret(data, params);
    const program = mod.generateProgram(data, report, { params });
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
      approvedBy: actorOf(req), approvedAt: new Date(), updatedAt: new Date(),
    }).where(eq(programs.id, p.id));
    await audit(actorOf(req), "approve", "program", p.id, p.athleteId, { clearanceNote: body.clearanceNote ?? null, hasHighStakes });
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

  /* ---------- session and weekly logging (athlete or clinician on their behalf) ---------- */
  async function recordSession(athleteId: string, raw: unknown, loggedBy: string, actor: string, rejectDuplicate: boolean) {
    const prog = await approvedFor(athleteId);
    if (!prog) throw new HttpError(409, "No approved program yet.");
    const body = SessionLogSchema.parse(raw);
    const program = prog.data as Program;
    const session = program.weeks.find((w) => w.week === body.week)?.sessions.find((s) => s.day === body.day);
    if (!session) throw new HttpError(400, "Unknown session.");
    if (rejectDuplicate) {
      const existing = await db.select().from(sessionLogs).where(and(eq(sessionLogs.programId, prog.id), eq(sessionLogs.week, body.week), eq(sessionLogs.day, body.day)));
      if (existing.length) throw new HttpError(409, "That session is already logged. Delete the existing log first if it needs correcting.");
    }
    const log: SessionLog = { ...body, performedAt: body.performedAt ?? new Date().toISOString(), exercises: body.exercises };
    const all = await assessmentsFor(athleteId);
    const cmjBase = (all[0]?.data as any)?.physical?.cmjHeightCm ?? null;
    const proposals = proposeNextTargets(session.exercises as PrescribedExercise[], log, { cmjBaselineCm: cmjBase, config: progressionConfigFrom(await loadParams()) });
    const logId = id();
    await db.insert(sessionLogs).values({ id: logId, athleteId, programId: prog.id, week: body.week, day: body.day, data: log, proposals, loggedBy });
    await audit(actor, loggedBy === "athlete" ? "log-session" : "log-session-for-athlete", "session_log", logId, athleteId, { week: body.week, day: body.day, loggedBy });
    return { id: logId, proposals };
  }
  async function recordWeek(athleteId: string, raw: unknown, actor: string, loggedBy: string) {
    const body = WeeklyLogSchema.parse(raw);
    const prev = (await db.select().from(weeklyLogs).where(eq(weeklyLogs.athleteId, athleteId)).orderBy(desc(weeklyLogs.weekStart)))
      .find((w) => w.weekStart < body.weekStart);
    const volumeFlag = prev ? checkWeeklyVolume(prev.runKm, body.runKm, weeklyCapPct(await loadParams())) : null;
    const logId = id();
    await db.insert(weeklyLogs).values({ id: logId, athleteId, weekStart: body.weekStart, runKm: body.runKm, painModifiedTraining: body.painModifiedTraining, notes: body.notes ?? null, volumeFlag });
    await audit(actor, "log-week", "weekly_log", logId, athleteId, { ...body, volumeFlag, loggedBy });
    return { id: logId, volumeFlag, painFlag: body.painModifiedTraining };
  }
  const approvedFor = async (athleteId: string) =>
    (await db.select().from(programs).where(and(eq(programs.athleteId, athleteId), eq(programs.status, "approved"))))[0];

  clinician.post("/athletes/:id/session-logs", h(async (req, res) => {
    const athleteId = param(req, "id");
    await getAthlete(athleteId);
    res.status(201).json(await recordSession(athleteId, req.body, actorOf(req), actorOf(req), true));
  }));
  clinician.post("/athletes/:id/weekly-logs", h(async (req, res) => {
    const athleteId = param(req, "id");
    await getAthlete(athleteId);
    res.status(201).json(await recordWeek(athleteId, req.body, actorOf(req), actorOf(req)));
  }));
  clinician.delete("/session-logs/:id", h(async (req, res) => {
    const [log] = await db.select().from(sessionLogs).where(eq(sessionLogs.id, param(req, "id")));
    if (!log) throw nf("Session log");
    await db.delete(sessionLogs).where(eq(sessionLogs.id, log.id));
    await audit(actorOf(req), "delete-session-log", "session_log", log.id, log.athleteId, { week: log.week, day: log.day, loggedBy: log.loggedBy, data: log.data });
    res.json({ ok: true });
  }));
  clinician.delete("/weekly-logs/:id", h(async (req, res) => {
    const [w] = await db.select().from(weeklyLogs).where(eq(weeklyLogs.id, param(req, "id")));
    if (!w) throw nf("Weekly log");
    await db.delete(weeklyLogs).where(eq(weeklyLogs.id, w.id));
    await audit(actorOf(req), "delete-weekly-log", "weekly_log", w.id, w.athleteId, { weekStart: w.weekStart, runKm: w.runKm });
    res.json({ ok: true });
  }));

  /* ---------- athlete interface ---------- */
  const me = express.Router();
  me.use(requireRole("athlete"));
  const myAthlete = async (req: Request) => {
    if (!req.user?.athleteId) throw new AuthError(403, "No athlete record linked to this account.");
    return getAthlete(req.user.athleteId);
  };
  me.get("/", h(async (req, res) => {
    const a = await myAthlete(req);
    const prog = await approvedFor(a.id);
    const logs = prog ? await db.select().from(sessionLogs).where(eq(sessionLogs.programId, prog.id)).orderBy(desc(sessionLogs.createdAt)) : [];
    const weekly = await db.select().from(weeklyLogs).where(eq(weeklyLogs.athleteId, a.id)).orderBy(desc(weeklyLogs.weekStart));
    const program = prog?.data as Program | undefined;
    res.json({
      name: a.name,
      program: program ? { id: prog!.id, version: prog!.version, durationWeeks: program.durationWeeks, weeks: program.weeks, approvedAt: prog!.approvedAt } : null,
      sessionLogs: logs.map((l) => ({ id: l.id, week: l.week, day: l.day, createdAt: l.createdAt, loggedBy: l.loggedBy, data: l.data, proposals: l.proposals })),
      weeklyLogs: weekly,
      roadmap: prog ? await roadmapFor(a.id) : null,
    });
  }));

  me.post("/session-logs", h(async (req, res) => {
    const a = await myAthlete(req);
    res.status(201).json(await recordSession(a.id, req.body, "athlete", a.name, false));
  }));

  me.post("/weekly-logs", h(async (req, res) => {
    const a = await myAthlete(req);
    res.status(201).json(await recordWeek(a.id, req.body, a.name, "athlete"));
  }));

  app.use("/api/me", me);
  app.use("/api", clinician);

  /* ---------- static client (production) ---------- */
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}

export { AssessmentSchema };
