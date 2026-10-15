import { describe, expect, it } from "vitest";
import { running, allRules } from "../src";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM } from "../src/fixtures";

const { generateRunnerProgram, interpretRunner, EXERCISES, EXERCISE_GUIDES } = running;

const gen = (a = SYNTHETIC_ALEX, sessionsPerWeek?: 1 | 2 | 3, extra: object = {}) => generateRunnerProgram(a, interpretRunner(a), { sessionsPerWeek, ...extra });
const contacts = (list: Array<{ unit: string; sets: number; reps: number }>) => list.filter((e) => e.unit === "contacts").reduce((n, e) => n + e.sets * e.reps, 0);
const allEx = (p: ReturnType<typeof gen>) => p.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises));

describe("sessions per week", () => {
  it("defaults to two sessions and records the choice", () => {
    const p = gen();
    expect(p.sessionsPerWeek).toBe(2);
    expect(p.weeks.slice(0, 7).every((w) => w.sessions.length === 2)).toBe(true);
    expect(gen(SYNTHETIC_ALEX, 7 as any).sessionsPerWeek).toBe(2); // invalid values fall back
  });

  it("one session keeps both heavy lifts in a single whole-body session", () => {
    const p = gen(SYNTHETIC_ALEX, 1);
    expect(p.sessionsPerWeek).toBe(1);
    for (const w of p.weeks) {
      expect(w.sessions).toHaveLength(1);
      const ids = w.sessions[0].exercises.map((e) => e.exerciseId);
      expect(ids).toContain("back_squat");
      expect(ids).toContain("trap_bar_deadlift");
      expect(ids).toContain("seated_soleus_raise");
    }
    expect(p.assumptions.join(" ")).toMatch(/One gym session per week/);
  });

  it("three sessions add a light third session with no heavy lifts", () => {
    const p = gen(SYNTHETIC_ALEX, 3);
    expect(p.sessionsPerWeek).toBe(3);
    const normal = p.weeks.filter((w) => w.label !== "Race week");
    for (const w of normal) {
      expect(w.sessions.map((s) => s.name)).toEqual(["Session A", "Session B", "Session C"]);
      const c = w.sessions[2].exercises;
      expect(c.length).toBeGreaterThan(0);
      expect(c.some((e) => ["back_squat", "trap_bar_deadlift", "leg_press", "hip_thrust"].includes(e.exerciseId))).toBe(false);
      expect(c.some((e) => e.category === "plyometric" && !["pogo_hops", "skips_for_height"].includes(e.exerciseId))).toBe(false);
    }
    expect(p.assumptions.join(" ")).toMatch(/Three gym sessions/);
    // the lifts are not duplicated across days
    const w1 = p.weeks[0].sessions;
    expect(w1[0].exercises.some((e) => e.exerciseId === "seated_soleus_raise")).toBe(false);
    expect(w1[2].exercises.some((e) => e.exerciseId === "seated_soleus_raise")).toBe(true);
  });

  it("exercise ids are unique within every program and session days match the choice", () => {
    for (const n of [1, 2, 3] as const) {
      const p = gen(SYNTHETIC_ALEX, n);
      const ids = allEx(p).map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const w of p.weeks) w.sessions.forEach((s, i) => expect(s.day).toBe(i + 1));
    }
  });

  it("every choice respects contact caps, set caps and pairs reference real exercises", () => {
    for (const n of [1, 2, 3] as const) {
      const p = gen(SYNTHETIC_ALEX, n);
      for (const w of p.weeks) for (const s of w.sessions) {
        expect(contacts(s.exercises)).toBeLessThanOrEqual(80);
        for (const e of s.exercises.filter((x) => x.category === "strength")) expect(e.sets).toBeLessThanOrEqual(4);
        for (const e of s.exercises.filter((x) => x.pairedWith)) expect(s.exercises.some((x) => x.id === e.pairedWith)).toBe(true);
      }
    }
  });

  it("race week is a single light session whatever the weekly choice", () => {
    const a = { ...SYNTHETIC_ALEX, goals: { ...SYNTHETIC_ALEX.goals, raceDate: "2026-12-09" } };
    for (const n of [1, 2, 3] as const) {
      const p = generateRunnerProgram(a, interpretRunner(a), { startDate: "2026-10-14", sessionsPerWeek: n });
      const race = p.weeks[7];
      expect(race.label).toBe("Race week");
      expect(race.sessions).toHaveLength(1);
    }
  });

  it("pain-site restrictions still apply with three sessions", () => {
    const p = gen(SYNTHETIC_SAM, 3);
    expect(allEx(p).some((e) => e.category === "plyometric")).toBe(false);
    expect(allEx(p).some((e) => e.exerciseId === "back_squat" || e.exerciseId === "trap_bar_deadlift")).toBe(false);
  });

  it("the frequency rule is registered and used", () => {
    expect(allRules().some((r) => r.id === "running.program.frequency")).toBe(true);
    expect(gen().rulesUsed).toContain("running.program.frequency");
  });
});

describe("exercise coaching guides", () => {
  it("every exercise in the library has a complete guide", () => {
    for (const id of Object.keys(EXERCISES)) {
      const g = EXERCISE_GUIDES[id];
      expect(g, id).toBeTruthy();
      expect(g.setup.length, id).toBeGreaterThan(0);
      expect(g.steps.length, id).toBeGreaterThan(0);
      expect(g.cues.length, id).toBeGreaterThan(0);
      expect(g.errors.length, id).toBeGreaterThan(0);
      expect(g.stopIf.length, id).toBeGreaterThan(0);
    }
  });
  it("every prescribed exercise (all layouts) has a guide", () => {
    for (const n of [1, 2, 3] as const) for (const e of allEx(gen(SYNTHETIC_ALEX, n))) expect(EXERCISE_GUIDES[e.exerciseId], e.exerciseId).toBeTruthy();
  });
  it("reactive plyometric guides warn about strength base and progression approval", () => {
    for (const id of ["drop_jump", "hurdle_hops", "bounding"]) expect(EXERCISE_GUIDES[id].setup.join(" ") + EXERCISE_GUIDES[id].harder).toMatch(/strength base|clinician approval/);
  });
});
