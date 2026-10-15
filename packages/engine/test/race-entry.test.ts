import { describe, expect, it } from "vitest";
import { running } from "../src";
import { SYNTHETIC_ALEX } from "../src/fixtures";

const { interpretRunner, computeMetrics } = running;
const withRace = (distanceM: number, timeSec: number, goal = SYNTHETIC_ALEX.goals) => ({
  ...SYNTHETIC_ALEX, goals: goal,
  history: { ...SYNTHETIC_ALEX.history, recentRace: { distanceM, timeSec, daysAgo: 30 } },
});

describe("implausible race entries are not turned into numbers", () => {
  it("a distance typed in km (5 instead of 5000) gives no VDOT, paces or prediction, and says why", () => {
    const a = withRace(5, 3600);
    const m = computeMetrics(a);
    expect(m.vdot).toBeNull();
    expect(m.vdotRaw).toBeNull();
    expect(m.goalPredictedTimeSec).toBeNull();
    const r = interpretRunner(a);
    const f = r.findings.find((x) => x.id === "race-entry")!;
    expect(f.text).toMatch(/metres/);
    expect(f.text).toMatch(/5 m in 1:00:00/);
    expect(r.findings.some((x) => x.id === "vdot")).toBe(false);
    expect(r.missingData.join(" ")).toMatch(/race entry/i);
  });

  it("does not use the bad race to set the target speed when there is no goal time", () => {
    const a = withRace(5, 3600, { ...SYNTHETIC_ALEX.goals, targetTimeSec: null });
    expect(computeMetrics(a).targetSpeedKmh).toBeNull();
  });

  it("an impossibly fast entry is also rejected", () => {
    const m = computeMetrics(withRace(10000, 300));
    expect(m.vdot).toBeNull();
    expect(m.raceEntryProblem).toBeTruthy();
  });

  it("normal entries from 1500 m to a marathon still work", () => {
    for (const [d, t] of [[1500, 330], [5000, 1200], [10000, 2400], [21097, 5400], [42195, 12600]] as const) {
      const m = computeMetrics(withRace(d, t));
      expect(m.vdot, `${d} m in ${t}s`).not.toBeNull();
      expect(m.raceEntryProblem).toBeNull();
    }
  });
});
