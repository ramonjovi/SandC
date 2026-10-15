import { describe, expect, it } from "vitest";
import { running } from "../src";
import { SYNTHETIC_ALEX, SYNTHETIC_SAM } from "../src/fixtures";

const { ANALYSIS_PHASES, ANALYSIS_PHASE_IDS, phaseById } = running;

describe("analysis phases (pictures from the video)", () => {
  it("has unique ids, a capture instruction and a report title for each", () => {
    expect(new Set(ANALYSIS_PHASE_IDS).size).toBe(ANALYSIS_PHASES.length);
    for (const p of ANALYSIS_PHASES) {
      expect(p.capture.length, p.id).toBeGreaterThan(10);
      expect(p.reportTitle.length, p.id).toBeGreaterThan(3);
      expect(p.lookFor.length, p.id).toBeGreaterThan(5);
    }
    expect(phaseById("overstride")?.view).toBe("side");
    expect(phaseById("pelvic-drop")?.view).toBe("rear");
  });

  it("every phase produces text for the synthetic athletes without failing", () => {
    for (const a of [SYNTHETIC_ALEX, SYNTHETIC_SAM]) for (const p of ANALYSIS_PHASES) {
      expect(typeof p.discussion(a)).toBe("string");
      const f = p.finding(a);
      expect(f === null || typeof f === "string").toBe(true);
    }
  });

  it("findings come from what was entered in the form", () => {
    expect(phaseById("overstride")!.finding(SYNTHETIC_ALEX)).toMatch(/ahead of the pelvis/);
    expect(phaseById("knee-flexion")!.finding(SYNTHETIC_ALEX)).toMatch(/42/);
    expect(phaseById("pelvic-drop")!.finding(SYNTHETIC_ALEX)).toMatch(/Marked/);
    expect(phaseById("cmj")!.finding(SYNTHETIC_ALEX)).toBe("36 cm");
    expect(phaseById("pogo")!.finding(SYNTHETIC_ALEX)).toBeNull(); // no pogo data in the fixture
  });

  it("the overstride discussion follows the symptoms: a trial only when symptomatic", () => {
    const well = phaseById("overstride")!.discussion(SYNTHETIC_ALEX);
    expect(well).toMatch(/would not change your running form/);
    expect(well).not.toMatch(/10% more steps/);
    const hurt = { ...SYNTHETIC_ALEX, health: { ...SYNTHETIC_ALEX.health, painModifiedTraining: true, painSite: "knee" as const } };
    expect(phaseById("overstride")!.discussion(hurt)).toMatch(/10% more steps/);
  });

  it("the wording stays hedged: observations, not diagnoses or promises", () => {
    const all = ANALYSIS_PHASES.flatMap((p) => [SYNTHETIC_ALEX, SYNTHETIC_SAM].map((a) => p.discussion(a))).join(" ").toLowerCase();
    for (const bad of ["you have an injury", "will cause", "guarantee", "cure", "proven to cause"]) expect(all).not.toContain(bad);
    expect(all).toMatch(/not a diagnosis|has not been proven|debated|is noted/);
  });

  it("knee flexion text flags under 40 degrees but not 45", () => {
    const low = { ...SYNTHETIC_ALEX, biomechanics: { ...SYNTHETIC_ALEX.biomechanics, peakKneeFlexionDeg: 36 } };
    const ok = { ...SYNTHETIC_ALEX, biomechanics: { ...SYNTHETIC_ALEX.biomechanics, peakKneeFlexionDeg: 45 } };
    expect(phaseById("knee-flexion")!.discussion(low)).toMatch(/knee-cap pain/);
    expect(phaseById("knee-flexion")!.discussion(ok)).toMatch(/usual way/);
  });
});
