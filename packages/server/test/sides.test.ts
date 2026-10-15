import { describe, expect, it } from "vitest";
import { SYNTHETIC_ALEX, running } from "@tpc/engine";
import { parseAssessment } from "../src/schemas";

describe("left/right findings and reason for visit", () => {
  it("keeps the per-side measures, the visit text and the dynamometer values", () => {
    const input = structuredClone(SYNTHETIC_ALEX) as any;
    input.biomechanics = { ...input.biomechanics, pelvicDropLeftStanceDeg: 3.9, pelvicDropRightStanceDeg: 9.7, heelWhipRightDeg: 25, heelWhipRightDirection: "medial", heelEversionLeftDeg: 7.4 };
    input.physical = { ...input.physical, hipAbductionLeftKg: 6.5, hipAbductionRightKg: 9 };
    input.visit = { reason: "Right shin pain after runs", otherFindings: "Squat shifts right until the left hip is cued" };
    const out = parseAssessment(input);
    expect(out.biomechanics.pelvicDropRightStanceDeg).toBe(9.7);
    expect(out.biomechanics.heelWhipRightDirection).toBe("medial");
    expect(out.physical.hipAbductionLeftKg).toBe(6.5);
    expect(out.visit?.reason).toBe("Right shin pain after runs");
  });

  it("still accepts older assessments that have none of these fields", () => {
    const out = parseAssessment(structuredClone(SYNTHETIC_ALEX));
    expect(out.physical.hipAbductionLeftKg ?? null).toBeNull();
    expect(out.visit?.reason ?? "").toBe("");
  });

  it("rejects an invalid heel whip direction", () => {
    const input = structuredClone(SYNTHETIC_ALEX) as any;
    input.biomechanics = { ...input.biomechanics, heelWhipLeftDirection: "sideways" };
    expect(() => parseAssessment(input)).toThrow();
  });

  it("adds hip abduction to the retest list", () => {
    const p = { ...SYNTHETIC_ALEX.physical, hipAbductionLeftKg: 6.5, hipAbductionRightKg: 9 };
    expect(running.retestList(p)).toContain("Hip abduction (dynamometer)");
  });
});
