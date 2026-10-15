import type { ExerciseLog, NextTarget, PrescribedExercise, SessionLog } from "./types";
import type { Params } from "./params";
import { roundLoad } from "./util";

/** Editable defaults for load progression (rules core.progression.*). */
export interface ProgressionConfig {
  /** Increase when all work completed and final-set RIR >= rirEasy. */
  incEasyPct: number;
  /** Increase when all work completed but final-set RIR < rirEasy (hard but completed). */
  incHardPct: number;
  rirEasy: number;
  /** Reduce load by this when total reps missed exceeds missedRepsToReduce. */
  reducePct: number;
  missedRepsToReduce: number;
  /** Pain (0-10) at or above this holds load and flags clinician. */
  painHold: number;
  /** Pre-session CMJ drop beyond this fraction triggers a volume cut. */
  cmjDropFraction: number;
  cmjVolumeCut: number;
}

export const DEFAULT_PROGRESSION: ProgressionConfig = {
  incEasyPct: 5,
  incHardPct: 2.5,
  rirEasy: 2,
  reducePct: 5,
  missedRepsToReduce: 2,
  painHold: 4,
  cmjDropFraction: 0.05,
  cmjVolumeCut: 0.5,
};

/** Build the progression config from rule parameters (clinician overrides applied). */
export function progressionConfigFrom(p: Params): ProgressionConfig {
  return {
    incEasyPct: p.get("core.progression.load", "incEasyPct"),
    incHardPct: p.get("core.progression.load", "incHardPct"),
    rirEasy: p.get("core.progression.load", "rirEasy"),
    reducePct: p.get("core.progression.load", "reducePct"),
    missedRepsToReduce: p.get("core.progression.load", "missedRepsToReduce"),
    painHold: p.get("core.progression.pain", "painHold"),
    cmjDropFraction: p.get("core.progression.cmj-fatigue", "cmjDropFraction"),
    cmjVolumeCut: p.get("core.progression.cmj-fatigue", "cmjVolumeCut"),
  };
}

/**
 * Propose next-session targets for each prescribed exercise from what was actually done.
 * Deterministic. Always a *proposal* for clinician review.
 */
export function proposeNextTargets(
  prescribed: PrescribedExercise[],
  log: SessionLog,
  opts: { cmjBaselineCm?: number | null; config?: ProgressionConfig } = {},
): NextTarget[] {
  const cfg = opts.config ?? DEFAULT_PROGRESSION;
  const fatigue =
    opts.cmjBaselineCm && log.cmjHeightCm != null
      ? (opts.cmjBaselineCm - log.cmjHeightCm) / opts.cmjBaselineCm > cfg.cmjDropFraction
      : false;

  return prescribed.map((p) => {
    const l = log.exercises.find((e) => e.prescribedId === p.id);
    return nextForExercise(p, l, cfg, fatigue);
  });
}

function nextForExercise(
  p: PrescribedExercise,
  l: ExerciseLog | undefined,
  cfg: ProgressionConfig,
  fatigue: boolean,
): NextTarget {
  const base = {
    prescribedId: p.id,
    exerciseId: p.exerciseId,
    nextLoadKg: p.loadKg,
    nextSets: p.sets,
    nextReps: p.reps,
  };
  if (!l || l.sets.length === 0) {
    return { ...base, action: "hold", reason: "No data logged for this exercise; repeat prescription.", ruleIds: ["core.progression.load"] };
  }
  if (l.pain != null && l.pain >= cfg.painHold) {
    return {
      ...base,
      action: "pain_hold",
      reason: `Pain ${l.pain}/10 reported (>= ${cfg.painHold}). Hold load and flag for clinician review before progressing.`,
      ruleIds: ["core.progression.pain"],
    };
  }
  if (fatigue) {
    return {
      ...base,
      action: "reduce",
      nextSets: Math.max(1, Math.round(p.sets * (1 - cfg.cmjVolumeCut))),
      reason: `Pre-session CMJ fell more than ${cfg.cmjDropFraction * 100}% below baseline: halve volume next session (load kept).`,
      ruleIds: ["core.progression.cmj-fatigue"],
    };
  }

  const isLoaded = p.unit === "reps" && p.loadKg != null;
  const completedSets = l.sets.length >= p.sets;
  const missed =
    l.sets.reduce((acc, s) => acc + Math.max(0, p.reps - s.reps), 0) +
    Math.max(0, p.sets - l.sets.length) * p.reps;

  if (!isLoaded) {
    const ok = completedSets && missed === 0;
    if (ok && p.unit === "contacts") {
      return { ...base, action: "hold", reason: "Plyometric volume is set by the program phase; hold contacts and quality-check ground contact time.", ruleIds: ["core.progression.nonloaded"] };
    }
    if (ok) {
      return { ...base, action: "increase", nextReps: p.reps + (p.unit === "sec" ? 5 : 1), reason: "All work completed: add a small amount of volume, or add external load if bodyweight is easy.", ruleIds: ["core.progression.nonloaded"] };
    }
    return { ...base, action: "hold", reason: "Prescription not fully completed; repeat.", ruleIds: ["core.progression.nonloaded"] };
  }

  const loadUsed = l.sets.find((s) => s.loadKg != null)?.loadKg ?? p.loadKg!;
  if (missed > cfg.missedRepsToReduce) {
    return {
      ...base,
      action: "reduce",
      nextLoadKg: roundLoad(loadUsed * (1 - cfg.reducePct / 100)),
      reason: `${missed} reps missed (> ${cfg.missedRepsToReduce}): reduce load ${cfg.reducePct}% and rebuild.`,
      ruleIds: ["core.progression.load"],
    };
  }
  if (missed > 0 || !completedSets) {
    return { ...base, nextLoadKg: loadUsed, action: "hold", reason: "Prescription not fully completed: hold load and repeat.", ruleIds: ["core.progression.load"] };
  }
  const rir = l.rirFinal ?? p.rir ?? 2;
  const pct = rir >= cfg.rirEasy ? cfg.incEasyPct : cfg.incHardPct;
  const next = Math.max(roundLoad(loadUsed * (1 + pct / 100)), loadUsed + 2.5);
  return {
    ...base,
    action: "increase",
    nextLoadKg: next,
    reason: `All sets/reps completed with ${rir} RIR on the final set: +${pct}% (rounded to 2.5 kg).`,
    ruleIds: ["core.progression.load"],
  };
}

/** Weekly cap percentage with clinician overrides applied (rule core.load.weekly-cap, key capPct). */
export const weeklyCapPct = (p: Params) => p.get("core.load.weekly-cap", "capPct");

/** Weekly running-volume cap check (rule core.load.weekly-cap). */
export function checkWeeklyVolume(prevKm: number, nextKm: number, capPct = 10) {
  if (prevKm <= 0) return { ok: true, increasePct: 0, cappedKm: nextKm };
  const increasePct = ((nextKm - prevKm) / prevKm) * 100;
  return {
    ok: increasePct <= capPct,
    increasePct: Math.round(increasePct * 10) / 10,
    cappedKm: Math.round(Math.min(nextKm, prevKm * (1 + capPct / 100)) * 10) / 10,
  };
}
