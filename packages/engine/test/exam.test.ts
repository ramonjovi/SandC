import { describe, expect, it } from "vitest";
import { running, allRules } from "../src";
import { SYNTHETIC_ALEX } from "../src/fixtures";

const { interpretRunner, generateRunnerProgram } = running;
const withExam = (exam: any, extra: any = {}) => ({ ...structuredClone(SYNTHETIC_ALEX), ...extra, exam });
const flag = (r: ReturnType<typeof interpretRunner>, id: string) => r.safetyFlags.find((f) => f.id === id);

describe("bone-stress screen", () => {
  it("raises a high-stakes flag for focal tenderness, hop pain, night pain or pain on walking", () => {
    for (const exam of [{ left: { tibialTenderness: "focal" } }, { right: { hopPain: true } }, { nightPain: true }, { painWalking: true }]) {
      const f = flag(interpretRunner(withExam(exam)), "bone-stress-screen");
      expect(f, JSON.stringify(exam)).toBeTruthy();
      expect(f!.highStakes).toBe(true);
      expect(f!.text).toMatch(/does not diagnose or clear/);
    }
  });

  it("does not flag diffuse tenderness or a negative screen", () => {
    expect(flag(interpretRunner(withExam({ left: { tibialTenderness: "diffuse" }, nightPain: false, painWalking: false })), "bone-stress-screen")).toBeUndefined();
  });

  it("applies the site restrictions so heavy axial loading and plyometrics leave the program", () => {
    const a = withExam({ right: { tibialTenderness: "focal" } }, { health: { ...SYNTHETIC_ALEX.health, painSite: "none", painModifiedTraining: false } });
    const rep = interpretRunner(a);
    expect(rep.restrictions.some((r) => r.site === "tibia")).toBe(true);
    const ids = generateRunnerProgram(a, rep).weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
    expect(ids).not.toContain("back_squat");
    expect(ids).not.toContain("pogo_hops");
  });

  it("reminds the clinician to complete the screen when the shin hurts and nothing was entered", () => {
    const a = withExam({ symptomSide: "right" }, { health: { ...SYNTHETIC_ALEX.health, painSite: "tibia" } });
    expect(interpretRunner(a).missingData.join(" ")).toMatch(/Bone-stress screen not completed/);
  });
});

describe("left/right exam findings", () => {
  it("flags hip abduction asymmetry above the editable threshold, names the weaker side and raises the priority once", () => {
    const a = withExam({ symptomSide: "right" }, { physical: { ...SYNTHETIC_ALEX.physical, hipAbductionLeftKg: 6.5, hipAbductionRightKg: 9 } });
    const rep = interpretRunner(a);
    const f = rep.findings.find((x) => x.id === "hip-abd-asym")!;
    expect(f.text).toMatch(/left weaker/);
    expect(f.text).toMatch(/opposite side to the symptoms/);
    expect(rep.priorities.filter((p) => p.key === "hip_stability")).toHaveLength(1);
    expect(rep.priorities.some((p) => p.key === "unilateral_symmetry")).toBe(true);
  });

  it("does not flag a difference under the threshold", () => {
    const a = withExam({}, { physical: { ...SYNTHETIC_ALEX.physical, hipAbductionLeftKg: 9, hipAbductionRightKg: 9.5 } });
    expect(interpretRunner(a).findings.find((x) => x.id === "hip-abd-asym")!.severity).toBe("info");
  });

  it("a positive Trendelenburg adds hip control as a priority and the exam findings are recorded without cut-offs", () => {
    const a = withExam({ right: { trendelenburg: "positive", ankleDorsiflexionCm: 9 }, left: { ankleDorsiflexionCm: 11 } });
    const rep = interpretRunner(a);
    expect(rep.priorities.some((p) => p.key === "hip_stability")).toBe(true);
    expect(rep.findings.find((x) => x.id === "exam-sides")!.text).toMatch(/No validated cut-off/);
  });

  it("every rule id used is registered, including the new ones", () => {
    const ids = new Set(allRules().map((r) => r.id));
    const a = withExam({ symptomSide: "left", left: { hopPain: true, trendelenburg: "positive" } }, { physical: { ...SYNTHETIC_ALEX.physical, hipAbductionLeftKg: 6, hipAbductionRightKg: 9 } });
    for (const id of interpretRunner(a).rulesUsed) expect(ids.has(id), id).toBe(true);
    expect(ids.has("running.screen.bone-stress")).toBe(true);
    expect(ids.has("running.exam.record")).toBe(true);
  });
});
