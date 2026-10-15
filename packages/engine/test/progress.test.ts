import { describe, expect, it } from "vitest";
import { running } from "../src";
import { SYNTHETIC_ALEX } from "../src/fixtures";

const { generateRunnerProgram, interpretRunner, planSessionProgression, EXERCISES } = running;

const base = () => {
  const p = generateRunnerProgram(SYNTHETIC_ALEX, interpretRunner(SYNTHETIC_ALEX), { sessionsPerWeek: 2 });
  const add = (id: string, o: Partial<{ sets: number; reps: number; loadKg: number | null }> = {}) => {
    const d = EXERCISES[id];
    p.weeks[0].sessions[0].exercises.push({
      id: `w1-d1-${id}-x`, exerciseId: id, name: d.name, category: d.category, sets: o.sets ?? 3, reps: o.reps ?? 8, unit: d.unit, perSide: d.perSide,
      loadKg: o.loadKg ?? null, pct1RM: null, rir: 2, restSec: d.restSec, cue: d.cue, progressionRule: "x", ruleIds: [],
    });
  };
  add("hip_airplane", { sets: 3, reps: 6 });
  add("single_leg_stance", { sets: 3, reps: 30 });
  return { p, add };
};
const find = (p: ReturnType<typeof base>["p"], week: number, id: string) => p.weeks[week - 1].sessions[0].exercises.find((e) => e.exerciseId === id);

describe("planSessionProgression", () => {
  it("adds the exercise to later weeks and raises reps (seconds for holds) through a loading block", () => {
    const { p } = base();
    const out = planSessionProgression(p, 1, 0);
    expect([2, 3].map((w) => find(out, w, "hip_airplane")!.reps)).toEqual([7, 8]);
    expect([2, 3].map((w) => find(out, w, "single_leg_stance")!.reps)).toEqual([35, 40]);
  });

  it("cuts sets in unload weeks and starts a new block afterwards", () => {
    const { p } = base();
    const out = planSessionProgression(p, 1, 0);
    expect(find(out, 4, "hip_airplane")!.sets).toBe(2);
    expect(find(out, 5, "hip_airplane")!.reps).toBe(6);
    expect(find(out, 5, "hip_airplane")!.sets).toBe(3);
    expect(find(out, 5, "hip_airplane")!.notes).toMatch(/harder/);
    expect(find(out, 6, "hip_airplane")!.reps).toBe(7);
  });

  it("adds a load step after each unload week for loaded exercises", () => {
    const { p } = base();
    const calf = find(p, 1, "single_leg_calf_raise") ?? undefined;
    p.weeks[0].sessions[0].exercises.push({ ...(find(p, 1, "seated_soleus_raise") ?? calf)!, id: "w1-d1-soleus-x", exerciseId: "seated_soleus_raise", loadKg: 37.5, reps: 8 });
    const out = planSessionProgression(p, 1, 0);
    const loads = [1, 2, 3, 4, 5, 6].map((w) => find(out, w, "seated_soleus_raise")!.loadKg);
    expect(loads[3]).toBe(loads[2]);
    expect(loads[4]!).toBeGreaterThan(loads[3]!);
    expect(loads[5]).toBe(loads[4]);
  });

  it("leaves main lifts, plyometrics, the base week and the input untouched", () => {
    const { p } = base();
    const before = JSON.stringify(p);
    const out = planSessionProgression(p, 1, 0);
    expect(JSON.stringify(p)).toBe(before);
    expect(JSON.stringify(out.weeks[0])).toBe(JSON.stringify(p.weeks[0]));
    for (const w of [2, 3, 5]) expect(JSON.stringify(find(out, w, "back_squat"))).toBe(JSON.stringify(find(p, w, "back_squat")));
  });

  it("keeps the base week's order in later weeks", () => {
    const { p } = base();
    const out = planSessionProgression(p, 1, 0);
    const ids = (w: number) => out.weeks[w - 1].sessions[0].exercises.map((e) => e.exerciseId);
    const baseIds = ids(1).filter((id) => ids(5).includes(id));
    expect(ids(5).filter((id) => baseIds.includes(id))).toEqual(baseIds);
  });
});
