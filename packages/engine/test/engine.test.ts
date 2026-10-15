import { describe, expect, it } from "vitest";
import {
  allRules, objectiveProgress, checkWeeklyVolume, compareInterpretations, epley1RM, proposeNextTargets, roundLoad, running,
  type PrescribedExercise, type SessionLog,
} from "../src";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM } from "../src/fixtures";

const { vdotFromRace, predictTimeSec, paceZones, breakMultiplier, interpretRunner, generateRunnerProgram } = running;

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
    expect(breakMultiplier(10.5, false)).toBeCloseTo((0.994 + 0.973) / 2, 3);
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
    expect(r.metrics.squat1RM).toBeCloseTo(116.7, 1);
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
    expect(sq.loadKg).toBe(roundLoad(116.7 * 0.8));
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
  it("keeps plyometric contacts per session at or below 60", () => {
    for (const w of p.weeks) for (const s of w.sessions) {
      const c = s.exercises.filter((e) => e.unit === "contacts").reduce((a, e) => a + e.sets * e.reps, 0);
      expect(c).toBeLessThanOrEqual(60);
    }
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
