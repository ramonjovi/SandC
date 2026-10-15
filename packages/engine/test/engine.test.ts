import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allRules, makeParams, paramsFor, progressionConfigFrom, weeklyCapPct, objectiveProgress, checkWeeklyVolume, compareInterpretations, epley1RM, proposeNextTargets, roundLoad, running,
  type PrescribedExercise, type SessionLog,
} from "../src";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM } from "../src/fixtures";

const { vdotFromRace, predictTimeSec, paceZones, breakMultiplier, interpretRunner, generateRunnerProgram, pacingGapSecPer400, trainingTier, enforceContactCap } = running;

describe("VDOT", () => {
  it("20:00 5k is about VDOT 49.8", () => {
    expect(vdotFromRace(5000, 20 * 60)).toBeCloseTo(49.8, 0);
  });
  it("predictTime inverts vdotFromRace", () => {
    const v = vdotFromRace(10000, 2400);
    expect(predictTimeSec(v, 10000)).toBeCloseTo(2400, 0);
  });
  it("paces are ordered E > M > T > I > R", () => {
    const z = paceZones(50);
    expect(z.E).toBeGreaterThan(z.M);
    expect(z.M).toBeGreaterThan(z.T);
    expect(z.T).toBeGreaterThan(z.I);
    expect(z.I).toBeGreaterThan(z.R);
  });
  it("break multiplier interpolates the table", () => {
    expect(breakMultiplier(3, false)).toBe(1);
    expect(breakMultiplier(14, false)).toBeCloseTo(0.973);
    expect(breakMultiplier(14, true)).toBeCloseTo(0.986);
    expect(breakMultiplier(12, false)).toBeCloseTo((0.985 + 0.973) / 2, 3);
    expect(breakMultiplier(35, false)).toBe(0.91);
    expect(breakMultiplier(63, true)).toBe(0.913);
    expect(breakMultiplier(100, false)).toBe(0.8);
  });
});

describe("helpers", () => {
  it("epley and rounding", () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 5)).toBeCloseTo(116.67, 1);
    expect(roundLoad(101.3)).toBe(102.5);
  });
  it("weekly volume cap", () => {
    expect(checkWeeklyVolume(50, 54).ok).toBe(true);
    const r = checkWeeklyVolume(50, 60);
    expect(r.ok).toBe(false);
    expect(r.cappedKm).toBe(55);
  });
});

const ex = (over: Partial<PrescribedExercise> = {}): PrescribedExercise => ({
  id: "e1", exerciseId: "back_squat", name: "Back squat", category: "strength", sets: 3, reps: 5, unit: "reps", perSide: false,
  loadKg: 100, pct1RM: 80, rir: 2, restSec: 150, progressionRule: "", ruleIds: [], ...over,
});
const logFor = (sets: Array<[number, number]>, rirFinal: number | null, pain: number | null = null, extra: Partial<SessionLog> = {}): SessionLog => ({
  week: 1, day: 1, performedAt: "2026-01-01", exercises: [{ prescribedId: "e1", exerciseId: "back_squat", sets: sets.map(([reps, loadKg]) => ({ reps, loadKg })), rirFinal, pain }], ...extra,
});

describe("progression", () => {
  it("increases 5% when completed with RIR >= 2", () => {
    const [t] = proposeNextTargets([ex()], logFor([[5, 100], [5, 100], [5, 100]], 2));
    expect(t.action).toBe("increase");
    expect(t.nextLoadKg).toBe(105);
  });
  it("increases 2.5% (min 2.5 kg) when RIR is 0-1", () => {
    const [t] = proposeNextTargets([ex()], logFor([[5, 100], [5, 100], [5, 100]], 1));
    expect(t.nextLoadKg).toBe(102.5);
  });
  it("holds when slightly incomplete, reduces when many reps missed", () => {
    expect(proposeNextTargets([ex()], logFor([[5, 100], [5, 100], [4, 100]], 0))[0].action).toBe("hold");
    const r = proposeNextTargets([ex()], logFor([[5, 100], [3, 100], [2, 100]], 0))[0];
    expect(r.action).toBe("reduce");
    expect(r.nextLoadKg).toBe(95);
  });
  it("pain >= 4 holds and flags", () => {
    const t = proposeNextTargets([ex()], logFor([[5, 100], [5, 100], [5, 100]], 3, 5))[0];
    expect(t.action).toBe("pain_hold");
    expect(t.nextLoadKg).toBe(100);
  });
  it("CMJ drop > 5% halves sets", () => {
    const t = proposeNextTargets([ex({ sets: 4 })], logFor([[5, 100]], 2, null, { cmjHeightCm: 33 }), { cmjBaselineCm: 36 })[0];
    expect(t.action).toBe("reduce");
    expect(t.nextSets).toBe(2);
  });
  it("plyometric contacts are held", () => {
    const p = ex({ exerciseId: "drop_jump", unit: "contacts", loadKg: null, reps: 5 });
    const t = proposeNextTargets([p], logFor([[5, 0], [5, 0], [5, 0]], null))[0];
    expect(t.action).toBe("hold");
  });
});

describe("interpretation (Alex)", () => {
  const r = interpretRunner(SYNTHETIC_ALEX);
  it("computes metrics", () => {
    expect(r.metrics.dsi).toBeCloseTo(0.65, 2);
    expect(r.metrics.squat1RM).toBeCloseTo(109.1, 1); // 100 kg x 5 via the endurance load-to-rep table
    expect(r.metrics.targetSpeedKmh).toBeCloseTo(15.6, 1);
  });
  it("uses the speed tilt toward strength with no deficit", () => {
    expect(r.strategy.emphasis).toBe("strength");
    expect(r.strategy.ruleIds).toContain("running.strategy.speed-tilt");
  });
  it("flags hip control and symmetry; asymptomatic overstride is not a priority", () => {
    const keys = r.priorities.map((p) => p.key);
    expect(keys).toContain("hip_stability");
    expect(keys).toContain("unilateral_symmetry");
    expect(keys).not.toContain("gait_mechanics");
  });
  it("has no safety flags", () => {
    expect(r.safetyFlags).toHaveLength(0);
  });
  it("is deterministic aside from timestamp", () => {
    const r2 = interpretRunner(SYNTHETIC_ALEX);
    expect({ ...r2, generatedAt: "" }).toEqual({ ...r, generatedAt: "" });
  });
});

describe("interpretation (Sam)", () => {
  const r = interpretRunner(SYNTHETIC_SAM);
  it("surfaces high-stakes flags without classifying", () => {
    expect(r.safetyFlags.some((f) => f.highStakes)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/"tier"|clearance granted|green|orange/i);
  });
  it("restricts plyometrics and heavy axial loading for tibial pain", () => {
    expect(r.restrictions[0].site).toBe("tibia");
  });
  it("detects a strength deficit and adjusts for the 21-day break", () => {
    expect(r.priorities[0].key).toBe("max_strength");
    expect(r.strategy.emphasis).toBe("strength");
    expect(r.metrics.vdot as number).toBeLessThan(r.metrics.vdotRaw as number);
  });
  it("reports missing DSI data", () => {
    expect(r.missingData.join(" ")).toMatch(/DSI/);
  });
});

const contacts = (list: Array<{ unit: string; sets: number; reps: number }>) => list.filter((e) => e.unit === "contacts").reduce((a, e) => a + e.sets * e.reps, 0);

describe("program generation", () => {
  const rep = interpretRunner(SYNTHETIC_ALEX);
  const p = generateRunnerProgram(SYNTHETIC_ALEX, rep);
  it("creates 8 weeks x 2 sessions with unload weeks 4 and 8", () => {
    expect(p.weeks).toHaveLength(8);
    expect(p.weeks.every((w) => w.sessions.length === 2)).toBe(true);
    expect(p.weeks.filter((w) => w.isUnload).map((w) => w.week)).toEqual([4, 8]);
  });
  it("cuts squat sets about 45% in unload weeks and keeps intensity >= 80%", () => {
    const sq = (w: number) => p.weeks[w - 1].sessions[0].exercises.find((e) => e.exerciseId === "back_squat")!;
    expect(sq(4).sets).toBeLessThan(sq(3).sets);
    expect(sq(4).pct1RM).toBeGreaterThanOrEqual(80);
    expect(sq(8).pct1RM).toBeGreaterThanOrEqual(80);
  });
  it("loads are plate-rounded and derived from squat 1RM", () => {
    const sq = p.weeks[0].sessions[0].exercises.find((e) => e.exerciseId === "back_squat")!;
    expect(sq.loadKg! % 2.5).toBe(0);
    expect(sq.loadKg).toBe(roundLoad(109.1 * 0.8));
  });
  it("uses contrast pairs in weeks 5-8 that reference real exercises", () => {
    const s = p.weeks[4].sessions[0];
    const pair = s.exercises.find((e) => e.pairedWith)!;
    expect(s.exercises.some((e) => e.id === pair.pairedWith)).toBe(true);
  });
  it("never prescribes submaximal 15-25 rep strength work", () => {
    const heavy = p.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises)).filter((e) => e.category === "strength");
    expect(heavy.every((e) => e.reps <= 8)).toBe(true);
  });
  it("keeps plyometric contacts within the experience-tier cap (intermediate: 80)", () => {
    expect(p.trainingTier).toBe("intermediate");
    for (const w of p.weeks) for (const s of w.sessions) expect(contacts(s.exercises)).toBeLessThanOrEqual(80);
  });
  it("includes soleus work and objectives with baselines", () => {
    expect(p.weeks[0].sessions[0].exercises.some((e) => e.exerciseId === "seated_soleus_raise")).toBe(true);
    expect(p.objectives.find((o) => o.id === "squat1RM")!.target).toBeGreaterThan(p.objectives.find((o) => o.id === "squat1RM")!.baseline!);
  });
  it("applies tibial restrictions (no plyometrics, no heavy axial squat)", () => {
    const sam = generateRunnerProgram(SYNTHETIC_SAM, interpretRunner(SYNTHETIC_SAM));
    const all = sam.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises));
    expect(all.some((e) => e.category === "plyometric")).toBe(false);
    expect(all.some((e) => e.exerciseId === "back_squat" || e.exerciseId === "trap_bar_deadlift")).toBe(false);
    expect(sam.restrictionsApplied.length).toBeGreaterThan(0);
  });
  it("leaves loads blank when no squat test exists", () => {
    const a = { ...SYNTHETIC_ALEX, physical: { ...SYNTHETIC_ALEX.physical, squatLoadKg: null, squatReps: null } };
    const q = generateRunnerProgram(a, interpretRunner(a));
    const sq = q.weeks[0].sessions[0].exercises.find((e) => e.exerciseId === "back_squat")!;
    expect(sq.loadKg).toBeNull();
    expect(sq.notes).toMatch(/Load not set/);
  });
});

describe("compare", () => {
  const rep = interpretRunner(SYNTHETIC_ALEX);
  it("reports agreement and disagreement", () => {
    const c = compareInterpretations(rep, { priorityKeys: ["hip_stability", "power_rfd"], strategy: "combined", reasoning: "" });
    expect(c.strategyAgrees).toBe(false);
    expect(c.disagreements.some((d) => d.kind === "priority_pt_only" && d.key === "power_rfd")).toBe(true);
    expect(c.disagreements.some((d) => d.kind === "priority_engine_only")).toBe(true);
    expect(c.agreement.map((a) => a.key)).toContain("hip_stability");
  });
  it("full agreement yields no disagreements", () => {
    const c = compareInterpretations(rep, { priorityKeys: rep.priorities.map((p) => p.key), strategy: rep.strategy.key, reasoning: "" });
    expect(c.disagreements).toHaveLength(0);
  });
});

describe("roadmap and rule registry", () => {
  it("computes objective progress", () => {
    const p = generateRunnerProgram(SYNTHETIC_ALEX, interpretRunner(SYNTHETIC_ALEX));
    const sq = p.objectives.find((o) => o.id === "squat1RM")!;
    const mid = (sq.baseline! + sq.target!) / 2;
    const prog = objectiveProgress(p.objectives, { squat1RM: mid });
    expect(prog.find((o) => o.id === "squat1RM")!.progressPct).toBe(50);
  });
  it("every rule has a valid status and every used rule exists", () => {
    const rules = allRules();
    const ids = new Set(rules.map((r) => r.id));
    expect(rules.every((r) => ["source_verified", "proposed_default", "needs_verification"].includes(r.status))).toBe(true);
    for (const rep of [interpretRunner(SYNTHETIC_ALEX), interpretRunner(SYNTHETIC_SAM)]) for (const id of rep.rulesUsed) expect(ids.has(id), id).toBe(true);
    const prog = generateRunnerProgram(SYNTHETIC_ALEX, interpretRunner(SYNTHETIC_ALEX));
    for (const id of prog.rulesUsed) expect(ids.has(id), id).toBe(true);
  });
});

describe("pacing", () => {
  it("six-second rule widens for lower VDOT", () => {
    expect(pacingGapSecPer400(60)).toBe(6);
    expect(pacingGapSecPer400(50)).toBe(7);
    expect(pacingGapSecPer400(40)).toBe(8);
  });
  it("R-to-T spacing is close to Daniels' 16 s per 400 at VDOT 51", () => {
    const z = paceZones(51);
    const per400 = ((z.T - z.R) / 1000) * 400;
    expect(per400).toBeGreaterThan(13);
    expect(per400).toBeLessThan(19);
  });
});

describe("training-age tiers", () => {
  it("maps experience to tiers, unknown is novice", () => {
    expect(trainingTier(null)).toBe("novice");
    expect(trainingTier(0.5)).toBe("novice");
    expect(trainingTier(2)).toBe("intermediate");
    expect(trainingTier(5)).toBe("experienced");
  });
  const novice = { ...SYNTHETIC_ALEX, history: { ...SYNTHETIC_ALEX.history, strengthTrainingYears: 0 } };
  const np = generateRunnerProgram(novice, interpretRunner(novice));
  const all = np.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises));
  it("novices get 3 sets or fewer, lower intensities, 2:1 unloads and low-level plyometrics only", () => {
    expect(np.trainingTier).toBe("novice");
    expect(Math.max(...all.filter((e) => e.category === "strength").map((e) => e.sets))).toBeLessThanOrEqual(3);
    expect(Math.max(...all.filter((e) => e.pct1RM != null && e.category === "strength").map((e) => e.pct1RM!))).toBeLessThanOrEqual(80);
    expect(np.weeks.filter((w) => w.isUnload).map((w) => w.week)).toEqual([3, 6, 8]);
    expect(all.filter((e) => e.category === "plyometric").every((e) => ["pogo_hops", "skips_for_height"].includes(e.exerciseId))).toBe(true);
    expect(all.some((e) => e.pairedWith)).toBe(false);
    for (const w of np.weeks) for (const s of w.sessions) expect(contacts(s.exercises)).toBeLessThanOrEqual(50);
  });
  it("experienced runners may reach up to 100 contacts but never more", () => {
    const exp = { ...SYNTHETIC_ALEX, history: { ...SYNTHETIC_ALEX.history, strengthTrainingYears: 6 } };
    const ep = generateRunnerProgram(exp, interpretRunner(exp));
    for (const w of ep.weeks) for (const s of w.sessions) expect(contacts(s.exercises)).toBeLessThanOrEqual(100);
  });
  it("enforceContactCap reduces volume deterministically", () => {
    const mk = (id: string, sets: number, reps: number) => ({ id, exerciseId: id, name: id, category: "plyometric", sets, reps, unit: "contacts", perSide: false, loadKg: null, pct1RM: null, rir: null, restSec: 90, progressionRule: "", ruleIds: [] }) as any;
    const list = [mk("a", 5, 10), mk("b", 3, 8)];
    enforceContactCap(list, 50);
    expect(contacts(list)).toBeLessThanOrEqual(50);
  });
  it("missing experience is flagged and treated as novice", () => {
    const unk = { ...SYNTHETIC_ALEX, history: { ...SYNTHETIC_ALEX.history, strengthTrainingYears: null } };
    const r = interpretRunner(unk);
    expect(r.missingData.join(" ")).toMatch(/experience/i);
    expect(r.metrics.trainingTier).toBe("novice");
  });
});

describe("program content", () => {
  const rep = interpretRunner(SYNTHETIC_ALEX);
  const p = generateRunnerProgram(SYNTHETIC_ALEX, rep);
  it("every session has a warm-up", () => {
    expect(p.weeks.every((w) => w.sessions.every((s) => (s.warmup?.length ?? 0) > 0))).toBe(true);
  });
  it("gives the weaker calf side an extra set", () => {
    const calf = p.weeks[0].sessions[1].exercises.find((e) => e.exerciseId === "single_leg_calf_raise")!;
    expect(calf.extraSetSide).toBe("right"); // fixture: L 22 / R 18
  });
  it("gates reactive plyometrics behind competency", () => {
    const dj = p.weeks[4].sessions[0].exercises.find((e) => e.exerciseId === "drop_jump")!;
    expect(dj.notes).toMatch(/Competency gate/);
  });
  it("states the 6-hour separation rule", () => {
    expect(p.assumptions.join(" ")).toMatch(/6 hours/);
  });
  it("builds a taper when the race falls inside the block", () => {
    const a = { ...SYNTHETIC_ALEX, goals: { ...SYNTHETIC_ALEX.goals, raceDate: "2026-12-09" } };
    const q = generateRunnerProgram(a, interpretRunner(a), { startDate: "2026-10-14" }); // race in week 8
    expect(q.durationWeeks).toBe(8);
    expect(q.weeks[7].label).toBe("Race week");
    expect(q.weeks[7].sessions).toHaveLength(1);
    expect(q.weeks[6].phase).toBe("Taper");
    const raceSets = q.weeks[7].sessions[0].exercises.find((e) => e.exerciseId === "back_squat")!.sets;
    expect(raceSets).toBeLessThanOrEqual(2);
    expect(q.weeks[7].sessions[0].exercises.some((e) => e.category === "plyometric")).toBe(false);
    expect(q.milestones.some((m) => m.label.startsWith("Race"))).toBe(true);
    expect(q.rulesUsed).toContain("running.taper.window");
  });
  it("shortens the block when the race is sooner", () => {
    const a = { ...SYNTHETIC_ALEX, goals: { ...SYNTHETIC_ALEX.goals, raceDate: "2026-11-11" } };
    const q = generateRunnerProgram(a, interpretRunner(a), { startDate: "2026-10-14" }); // 4 weeks
    expect(q.durationWeeks).toBe(4);
    expect(q.weeks).toHaveLength(4);
  });
  it("ignores a race date that is far away or already past", () => {
    const far = { ...SYNTHETIC_ALEX, goals: { ...SYNTHETIC_ALEX.goals, raceDate: "2027-05-01" } };
    expect(generateRunnerProgram(far, interpretRunner(far), { startDate: "2026-10-14" }).durationWeeks).toBe(8);
    const past = { ...SYNTHETIC_ALEX, goals: { ...SYNTHETIC_ALEX.goals, raceDate: "2026-01-01" } };
    const q = generateRunnerProgram(past, interpretRunner(past), { startDate: "2026-10-14" });
    expect(q.durationWeeks).toBe(8);
    expect(q.assumptions.join(" ")).toMatch(/past/);
  });
});

describe("editable rule defaults (overrides)", () => {
  const rules = allRules();
  it("every editable parameter has metadata, valid bounds and a default inside them", () => {
    for (const r of rules) {
      const keys = Object.keys(r.defaults ?? {});
      expect(Object.keys(r.paramMeta ?? {}).sort(), r.id).toEqual(keys.sort());
      for (const [k, m] of Object.entries(r.paramMeta ?? {})) {
        const d = r.defaults![k] as number;
        expect(m.min, `${r.id}.${k}`).toBeLessThan(m.max);
        expect(d, `${r.id}.${k}`).toBeGreaterThanOrEqual(m.min);
        expect(d, `${r.id}.${k}`).toBeLessThanOrEqual(m.max);
      }
    }
  });
  it("every editable parameter is actually read by the engine", () => {
    const dir = path.resolve(__dirname, "../src");
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const code = walk(dir).filter((f) => f.endsWith(".ts") && !f.endsWith("rules.ts")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const r of rules) for (const k of Object.keys(r.defaults ?? {})) expect(code.includes(`"${k}"`), `${r.id}.${k} is never read`).toBe(true);
  });
  it("unknown parameters throw and out-of-registry overrides are ignored", () => {
    const p = paramsFor({ "nope.rule": { x: 1 }, "running.dsi": { strengthDeficitBelow: 0.5, bogus: 3 } });
    expect(p.get("running.dsi", "strengthDeficitBelow")).toBe(0.5);
    expect(() => p.get("running.dsi", "bogus")).toThrow();
    expect(p.overrides()).toEqual({ "running.dsi": { strengthDeficitBelow: 0.5 } });
  });
  it("overrides equal to the default are dropped", () => {
    expect(paramsFor({ "running.dsi": { strengthDeficitBelow: 0.6 } }).overrides()).toEqual({});
  });
  it("DSI bands change the interpretation and are recorded on the report", () => {
    const base = interpretRunner(SYNTHETIC_ALEX); // DSI 0.65 = balanced
    expect(base.priorities.some((p) => p.key === "max_strength")).toBe(false);
    const strict = interpretRunner(SYNTHETIC_ALEX, paramsFor({ "running.dsi": { strengthDeficitBelow: 0.7 } }));
    expect(strict.priorities[0].key).toBe("max_strength");
    expect(strict.paramOverrides).toEqual({ "running.dsi": { strengthDeficitBelow: 0.7 } });
    expect(base.paramOverrides).toEqual({});
  });
  it("speed switch point changes the strategy", () => {
    const noDeficit = { ...SYNTHETIC_ALEX };
    expect(interpretRunner(noDeficit).strategy.emphasis).toBe("strength"); // 15.6 km/h > 12
    expect(interpretRunner(noDeficit, paramsFor({ "running.strategy.speed-tilt": { switchSpeedKmh: 16 } })).strategy.emphasis).toBe("power");
  });
  it("contact caps and set caps apply to generated programs", () => {
    const p0 = paramsFor({ "running.plyo.contacts": { intermediate: 40 }, "running.strength.training-age": { advancedMaxSets: 3 } });
    const rep = interpretRunner(SYNTHETIC_ALEX, p0);
    const prog = generateRunnerProgram(SYNTHETIC_ALEX, rep, { params: p0 });
    for (const w of prog.weeks) for (const s of w.sessions) {
      expect(contacts(s.exercises)).toBeLessThanOrEqual(40);
      for (const e of s.exercises.filter((x) => x.category === "strength")) expect(e.sets).toBeLessThanOrEqual(3);
    }
    expect(prog.paramOverrides).toHaveProperty("running.plyo.contacts");
  });
  it("unload cut changes unload-week set counts", () => {
    const sets = (cut: number) => {
      const p = paramsFor({ "core.periodization.3to1": { unloadVolumeCut: cut } });
      const prog = generateRunnerProgram(SYNTHETIC_ALEX, interpretRunner(SYNTHETIC_ALEX, p), { params: p });
      return prog.weeks[3].sessions[0].exercises.find((e) => e.exerciseId === "back_squat")!.sets;
    };
    expect(sets(0.2)).toBeGreaterThan(sets(0.7));
  });
  it("pace fractions and progression settings flow through", () => {
    expect(paceZones(50, paramsFor({ "running.vdot.paces": { T: 0.89 } })).T).toBeLessThan(paceZones(50).T);
    const cfg = progressionConfigFrom(paramsFor({ "core.progression.load": { incEasyPct: 7.5 } }));
    expect(cfg.incEasyPct).toBe(7.5);
    const [t] = proposeNextTargets([ex()], logFor([[5, 100], [5, 100], [5, 100]], 2), { config: cfg });
    expect(t.nextLoadKg).toBe(107.5);
    expect(weeklyCapPct(paramsFor({ "core.load.weekly-cap": { capPct: 15 } }))).toBe(15);
  });
  it("makeParams accepts a custom rule list", () => {
    expect(makeParams([{ id: "x", title: "", status: "proposed_default", source: null, statement: "", verification: "", defaults: { a: 1 } }]).get("x", "a")).toBe(1);
  });
});

describe("no force plate (treadmill, barbell, phone)", () => {
  const noPlate = {
    ...SYNTHETIC_ALEX,
    physical: { ...SYNTHETIC_ALEX.physical, imtpPeakForceN: null, cmjPeakForceN: null, nordicForceN: null, rsiFlightMs: 160, rsiContactMs: 200, nordicBreakAngleDeg: 35 },
  };
  const rep = interpretRunner(noPlate);
  it("still interprets and chooses a strategy without DSI", () => {
    expect(rep.metrics.dsi).toBeNull();
    expect(rep.strategy.emphasis).toBe("strength"); // falls back to squat ratio then speed tilt
    expect(rep.missingData.join(" ")).toMatch(/DSI unavailable.*force plate/);
  });
  it("computes RSI and records field tests as tracked-only findings", () => {
    expect(rep.metrics.rsi).toBeCloseTo(0.8, 2);
    const f = rep.findings.find((x) => x.id === "field-tests")!;
    expect(f.text).toMatch(/no validated runner cutoffs/);
    expect(f.text).toMatch(/RSI 0.8/);
    expect(rep.priorities.some((p) => p.key === "power_rfd")).toBe(false);
  });
  it("warns when the squat test used more than 5 reps", () => {
    const hi = { ...noPlate, physical: { ...noPlate.physical, squatReps: 8 } };
    const r = interpretRunner(hi);
    expect(r.findings.some((x) => x.id === "squat-reps")).toBe(true);
    expect(rep.findings.some((x) => x.id === "squat-reps")).toBe(false);
  });
  it("adds field-test objectives and a retest list to the milestones", () => {
    const p = generateRunnerProgram(noPlate, rep);
    const ids = p.objectives.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(["cmj", "rsi", "broadJump"]));
    expect(ids).not.toContain("imtpRel");
    const detail = p.milestones.find((m) => m.id === "m3")!.detail;
    expect(detail).toMatch(/Squat 3-5RM/);
    expect(detail).toMatch(/Pogo-hop RSI/);
    expect(detail).not.toMatch(/IMTP/);
  });
  it("field-test targets follow clinician-edited defaults", () => {
    const params = running.runningParams({ "running.field-tests.tracking": { cmjPct: 10 } });
    const p = generateRunnerProgram(noPlate, interpretRunner(noPlate, params), { params });
    const o = p.objectives.find((x) => x.id === "cmj")!;
    expect(o.target).toBeCloseTo(o.baseline! * 1.1, 1);
  });
});

describe("test protocols", () => {
  const prots = running.RUNNING_PROTOCOLS;
  it("every protocol has equipment, steps, what to record and a valid status", () => {
    for (const x of prots) {
      expect(x.equipment.length, x.id).toBeGreaterThan(0);
      expect(x.steps.length, x.id).toBeGreaterThan(0);
      expect(x.records.length, x.id).toBeGreaterThan(0);
      expect(["source_verified", "proposed_default", "needs_verification"]).toContain(x.status);
    }
    expect(new Set(prots.map((x) => x.id)).size).toBe(prots.length);
  });
  it("needs no force plate except the clearly optional one", () => {
    const plate = prots.filter((x) => x.equipment.join(" ").toLowerCase().includes("force plate"));
    expect(plate.map((x) => x.id)).toEqual(["force-plate-optional"]);
  });
  it("squat and treadmill-gait protocols are source-verified; the video power tests are not", () => {
    const st = (id: string) => prots.find((x) => x.id === id)!.status;
    expect(st("squat-rm")).toBe("source_verified");
    expect(st("gait-treadmill")).toBe("source_verified");
    expect(st("cmj-video")).toBe("needs_verification");
    expect(st("rsi-pogo")).toBe("needs_verification");
  });
  it("retest list reflects only what was measured", () => {
    expect(running.retestList(SYNTHETIC_SAM.physical)).not.toContain("IMTP and CMJ force");
    expect(running.retestList(SYNTHETIC_ALEX.physical)).toContain("IMTP and CMJ force");
  });
});

describe("second verification pass (sources)", () => {
  const { estimate1RM, percentOf1RM } = running;
  it("1RM estimate follows the endurance-athlete load-to-repetition table (Developing Endurance Table 6.3)", () => {
    expect(percentOf1RM(1)).toBe(100);
    expect(percentOf1RM(3)).toBe(95);
    expect(percentOf1RM(6)).toBe(90);
    expect(percentOf1RM(8)).toBe(85);
    expect(percentOf1RM(19)).toBe(65);
    expect(percentOf1RM(40)).toBe(65); // never extrapolated
    expect(percentOf1RM(5)).toBeCloseTo(91.67, 1);
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBeCloseTo(109.1, 1);
    expect(estimate1RM(100, 5)).toBeLessThan(epley1RM(100, 5)); // Epley overestimates for runners
  });
  it("DXA is flagged only below -1 (CAT2 primary indicator), not at -1", () => {
    const at = (z: number) => interpretRunner({ ...SYNTHETIC_ALEX, health: { ...SYNTHETIC_ALEX.health, dxaZScore: z } }).safetyFlags.some((f) => f.id === "dxa");
    expect(at(-1)).toBe(false);
    expect(at(-1.2)).toBe(true);
  });
  it("cadence is recorded but never flagged as 'low' (no source cutoff)", () => {
    const r = interpretRunner({ ...SYNTHETIC_ALEX, biomechanics: { ...SYNTHETIC_ALEX.biomechanics, cadenceSpm: 150 } });
    expect(JSON.stringify(r.findings)).not.toMatch(/low cadence/);
    expect(r.findings.some((f) => f.id === "cadence")).toBe(true);
  });
  it("holds back reactive plyometrics until the squat base is met (NSCA 1.5x body weight)", () => {
    const weak = { ...SYNTHETIC_ALEX, physical: { ...SYNTHETIC_ALEX.physical, squatLoadKg: 70, squatReps: 5 } }; // ~1.06x BM
    const q = generateRunnerProgram(weak, interpretRunner(weak));
    const ex = q.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises));
    expect(ex.some((e) => ["drop_jump", "hurdle_hops", "bounding"].includes(e.exerciseId))).toBe(false);
    expect(ex.some((e) => e.category === "plyometric")).toBe(true); // low-level drills remain
    expect(q.assumptions.join(" ")).toMatch(/held back/);
    // lowering the required ratio via the editable parameter releases them
    const p = paramsFor({ "running.plyo.prerequisites": { squatRatio: 1.0 } });
    const q2 = generateRunnerProgram(weak, interpretRunner(weak, p), { params: p });
    expect(q2.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises)).some((e) => e.exerciseId === "drop_jump")).toBe(true);
  });
  it("no squat test also holds reactive plyometrics back", () => {
    const none = { ...SYNTHETIC_ALEX, physical: { ...SYNTHETIC_ALEX.physical, squatLoadKg: null, squatReps: null } };
    const q = generateRunnerProgram(none, interpretRunner(none));
    expect(q.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises)).some((e) => e.exerciseId === "drop_jump")).toBe(false);
  });
  it("classification reflects what was verified", () => {
    const byId = Object.fromEntries(allRules().map((r) => [r.id, r]));
    expect(byId["core.load.weekly-cap"].status).toBe("source_verified");
    expect(byId["running.vdot.break-adjustment"].status).toBe("source_verified");
    expect(byId["running.gait.cadence"].status).toBe("source_verified");
    expect(byId["running.imtp.reference"].status).toBe("source_verified");
    expect(byId["running.reds.cat2-reference"].status).toBe("source_verified");
    expect(byId["running.dsi"].status).toBe("needs_verification");
    expect(byId["running.strength.squat-ratio"].status).toBe("needs_verification");
    expect(byId["running.symmetry"].status).toBe("needs_verification");
    expect(byId["running.reds.cat2-reference"].defaults).toBeUndefined(); // reference only, not editable or applied
  });
  it("the engine never computes a REDs tier or colour", () => {
    const r = interpretRunner(SYNTHETIC_SAM);
    expect(JSON.stringify(r)).not.toMatch(/"(tier|redsTier|colour|color)"|green light|orange light|red light/i);
  });
  it("race week schedules one light session without plyometrics or Nordics, early in the week", () => {
    const a = { ...SYNTHETIC_ALEX, goals: { ...SYNTHETIC_ALEX.goals, raceDate: "2026-12-09" } };
    const q = generateRunnerProgram(a, interpretRunner(a), { startDate: "2026-10-14" });
    const w = q.weeks[7];
    expect(w.sessions).toHaveLength(1);
    expect(w.note).toMatch(/early in the week/);
    expect(w.sessions[0].exercises.some((e) => e.exerciseId === "nordic_hamstring" || e.category === "plyometric")).toBe(false);
  });
  it("cadence objective uses the sourced +10% by default", () => {
    const a = { ...SYNTHETIC_ALEX, health: { ...SYNTHETIC_ALEX.health, painModifiedTraining: true, painSite: "knee" as const } };
    const q = generateRunnerProgram(a, interpretRunner(a));
    const cad = q.objectives.find((o) => o.id === "cadence")!;
    expect(cad.target).toBe(Math.round(164 * 1.1));
  });
});
