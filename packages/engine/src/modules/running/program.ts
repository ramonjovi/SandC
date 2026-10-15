import type {
  EngineReport, Milestone, Objective, PrescribedExercise, Program, ProgramSession, ProgramWeek,
} from "../../core/types";
import { roundLoad } from "../../core/util";
import { EXERCISES, SITE_EXCLUSIONS, type ExerciseDef, type LoadTag } from "./exercises";
import { computeMetrics } from "./interpret";
import type { Params } from "../../core/params";
import { defaultParams } from "./params";
import { tierLimits, trainingTier, type TrainingTier } from "./tier";
import { retestList } from "./protocols";
import type { RunnerAssessment, RunnerProgramOpts } from "./types";

interface WeekPlan {
  week: number; phase: string; label: string; pct: number; sets: number; reps: number; rir: number;
  unload: boolean; /** second half of the block: contrast pairs / higher plyometric exposure */ build: boolean;
}

/** Intermediate / experienced: 3:1 summated microcycles (rule core.periodization.3to1). Editable defaults. */
const PLAN_STANDARD: WeekPlan[] = [
  { week: 1, phase: "Accumulation", label: "Load 1", pct: 0.8, sets: 3, reps: 6, rir: 2, unload: false, build: false },
  { week: 2, phase: "Accumulation", label: "Load 2", pct: 0.825, sets: 4, reps: 5, rir: 2, unload: false, build: false },
  { week: 3, phase: "Accumulation", label: "Load 3 (peak)", pct: 0.85, sets: 4, reps: 5, rir: 1, unload: false, build: false },
  { week: 4, phase: "Accumulation", label: "Unload + reassess", pct: 0.8, sets: 4, reps: 5, rir: 3, unload: true, build: false },
  { week: 5, phase: "Transmutation", label: "Load 1", pct: 0.825, sets: 3, reps: 4, rir: 2, unload: false, build: true },
  { week: 6, phase: "Transmutation", label: "Load 2", pct: 0.85, sets: 3, reps: 4, rir: 2, unload: false, build: true },
  { week: 7, phase: "Transmutation", label: "Load 3 (peak)", pct: 0.875, sets: 4, reps: 3, rir: 1, unload: false, build: true },
  { week: 8, phase: "Transmutation", label: "Unload + retest", pct: 0.85, sets: 4, reps: 3, rir: 3, unload: true, build: true },
];

/** Novice: 2:1 build-to-recover (rule core.periodization.2to1), 3 sets or fewer, lower intensities. */
const PLAN_NOVICE: WeekPlan[] = [
  { week: 1, phase: "Foundation", label: "Learn the lifts", pct: 0.7, sets: 3, reps: 6, rir: 3, unload: false, build: false },
  { week: 2, phase: "Foundation", label: "Load 2", pct: 0.75, sets: 3, reps: 6, rir: 2, unload: false, build: false },
  { week: 3, phase: "Foundation", label: "Unload", pct: 0.7, sets: 3, reps: 6, rir: 3, unload: true, build: false },
  { week: 4, phase: "Foundation", label: "Load 1", pct: 0.75, sets: 3, reps: 6, rir: 2, unload: false, build: false },
  { week: 5, phase: "Build", label: "Load 2", pct: 0.775, sets: 3, reps: 5, rir: 2, unload: false, build: true },
  { week: 6, phase: "Build", label: "Unload + reassess", pct: 0.75, sets: 3, reps: 5, rir: 3, unload: true, build: true },
  { week: 7, phase: "Build", label: "Load 1", pct: 0.8, sets: 3, reps: 5, rir: 2, unload: false, build: true },
  { week: 8, phase: "Build", label: "Unload + retest", pct: 0.75, sets: 3, reps: 5, rir: 3, unload: true, build: true },
];

const SECONDARY_PCT = 0.75;
const MAIN_LIFTS = new Set(["back_squat", "leg_press", "trap_bar_deadlift", "hip_thrust"]);
const LOW_LEVEL_PLYO = new Set(["pogo_hops", "skips_for_height"]);

const PROG_HEAVY =
  "Next session: all sets/reps completed at target RIR -> +2.5-5% (to nearest 2.5 kg); incomplete -> hold; >2 reps missed -> -5%. Pain >=4/10 holds and flags the clinician.";
const PROG_SECONDARY = "Double progression: when all sets reach the top of the rep target at RIR >=2, add the smallest load increment.";
const PROG_PLYO = "Hold contacts. Stop the set if ground contact visibly lengthens or jump height drops >10%. Progress by box/hurdle height only with clinician approval.";
const PROG_BW = "Add reps within the set, then external load. Quality over quantity.";

const WARMUP = [
  "5 min easy aerobic (bike, brisk walk or jog)",
  "Dynamic mobility: leg swings, hip openers, ankle circles, bodyweight squats (about 5 min)",
  "Activation: glute bridge x10, lateral band walk x10 each way",
  "Ramp-up: 2-3 progressively heavier sets of the first lift before the working sets",
];

/** Which side to give an extra set, from the calf-raise result (the weaker side). */
function weakerSide(a: RunnerAssessment, calfPct: number): "left" | "right" | null {
  const l = a.physical.calfRaiseLeftReps, r = a.physical.calfRaiseRightReps;
  if (l == null || r == null || l === r) return null;
  const asym = (Math.abs(l - r) / Math.max(l, r)) * 100;
  return asym > calfPct ? (l < r ? "left" : "right") : null;
}

const contactsOf = (list: PrescribedExercise[]) => list.filter((e) => e.unit === "contacts").reduce((n, e) => n + e.sets * e.reps, 0);

/** Scale plyometric volume down until a session is within its experience-tier contact cap (rule running.plyo.contacts). */
export function enforceContactCap(list: PrescribedExercise[], cap: number) {
  let guard = 200;
  while (contactsOf(list) > cap && guard-- > 0) {
    const plyos = list.filter((e) => e.unit === "contacts").sort((x, y) => y.sets * y.reps - x.sets * x.reps);
    const top = plyos[0];
    if (top.reps > 3) top.reps -= 1;
    else if (top.sets > 1) top.sets -= 1;
    else break;
  }
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function generateRunnerProgram(a: RunnerAssessment, report: EngineReport, opts: RunnerProgramOpts = {}): Program {
  const metrics = computeMetrics(a);
  const squat1RM = metrics.squat1RM as number | null;
  const emphasis = report.strategy.emphasis;
  const tier: TrainingTier = trainingTier(a.history.strengthTrainingYears);
  const params: Params = opts.params ?? defaultParams;
  const limits = tierLimits(params)[tier];
  const side = weakerSide(a, params.get("running.symmetry", "calfPct"));
  const squatRel = metrics.squatRel as number | null;
  const plyoRatio = params.get("running.plyo.prerequisites", "squatRatio");
  const reactiveAllowed = !limits.lowLevelPlyoOnly && squatRel != null && squatRel >= plyoRatio;
  const unloadCut = params.get("core.periodization.3to1", "unloadVolumeCut");
  const taperCut = params.get("running.taper.window", "taperSetCut");
  const raceCut = params.get("running.taper.window", "raceWeekSetCut");
  const assumptions: string[] = [
    `Strength-training tier: ${tier}${a.history.strengthTrainingYears == null ? " (experience not entered, treated conservatively)" : ""}. Sets are capped at ${limits.maxSets}; plyometric contacts at ${limits.contactCap} per session${limits.lowLevelPlyoOnly ? " (low-level plyometrics only)" : ""}.`,
    "Two gym sessions per week (A: squat pattern, B: hinge/robustness). Leave at least 6 hours between a gym session and a hard run, avoid hard gym and hard run on the same day, and follow a heavy gym session with an easy, low-volume run only.",
    "Loads for secondary lifts are starting estimates as a ratio of squat 1RM (needs verification): confirm each in week 1 and edit.",
    "Percentages, set/rep schemes and unload cuts are proposed software defaults derived from the knowledge base; the clinician may edit any prescription.",
    "Submaximal-load (15-25 rep) and isometric training are not used: the meta-analysis found no economy benefit.",
  ];
  if (squat1RM == null) assumptions.push("No squat test entered: all loads are blank. Establish a 5RM in week 1 under supervision and edit the loads.");
  if (!limits.lowLevelPlyoOnly && !reactiveAllowed) {
    assumptions.push(squatRel == null
      ? `Reactive plyometrics (drop jumps, hurdle hops, bounding) are held back: no squat test, so the strength base (about ${plyoRatio}x body mass, NSCA) cannot be confirmed. Only low-level drills are used.`
      : `Reactive plyometrics (drop jumps, hurdle hops, bounding) are held back until the squat reaches about ${plyoRatio}x body mass (currently ${squatRel}x; NSCA recommendation). Only low-level drills are used.`);
  }
  if (side) assumptions.push(`The ${side} side is weaker on the single-leg calf raise: it gets one extra set on single-side exercises.`);
  const rulesUsed = new Set<string>([
    ...report.rulesUsed, "running.program.structure", "running.program.starting-loads", "core.periodization.3to1",
    "running.strength.training-age", "running.plyo.contacts", "running.plyo.prerequisites", "running.concurrent.scheduling",
  ]);
  if (tier === "novice") rulesUsed.add("core.periodization.2to1");

  // ---- race-aware length and taper ----
  const start = parseDate(opts.startDate) ?? new Date();
  const race = parseDate(a.goals.raceDate);
  let duration = 8;
  let raceWeek: number | null = null;
  if (race) {
    const weeksUntil = Math.ceil((race.getTime() - start.getTime()) / (7 * 86400_000));
    if (weeksUntil < 1) assumptions.push("The race date is in the past or this week: no taper was built. Update the race date.");
    else if (weeksUntil <= 8) {
      raceWeek = weeksUntil; duration = weeksUntil; rulesUsed.add("running.taper.window"); rulesUsed.add("running.taper.race-week");
      assumptions.push(`The race falls in week ${raceWeek}, so the program ends at the race with a taper in the last two weeks (volume cut, intensity kept).`);
    }
  }
  const basePlan = (tier === "novice" ? PLAN_NOVICE : PLAN_STANDARD).slice(0, duration);

  // ---- site restrictions ----
  const excluded = new Set<LoadTag>();
  const restrictionsApplied: string[] = [];
  for (const r of report.restrictions) {
    const ex = SITE_EXCLUSIONS[r.site as keyof typeof SITE_EXCLUSIONS];
    if (ex) ex.tags.forEach((t) => excluded.add(t));
  }
  const resolve = (id: string): ExerciseDef | null => {
    let def: ExerciseDef | undefined = EXERCISES[id];
    const seen = new Set<string>();
    while (def && !seen.has(def.id)) {
      seen.add(def.id);
      if (!def.tags.some((t) => excluded.has(t))) return def;
      def = def.substitutes?.map((s) => EXERCISES[s]).find((d) => d && !d.tags.some((t) => excluded.has(t)));
    }
    return null;
  };
  const noteRestriction = (orig: string, got: ExerciseDef | null) => {
    const msg = got && got.id !== orig ? `${EXERCISES[orig].name} replaced by ${got.name} (painful-site restriction).` : !got ? `${EXERCISES[orig].name} removed (painful-site restriction).` : null;
    if (msg && !restrictionsApplied.includes(msg)) restrictionsApplied.push(msg);
  };

  const hipStab = report.priorities.some((p) => p.key === "hip_stability");
  const contactBase = emphasis === "strength" ? 24 : emphasis === "power" ? 48 : 36;

  const weeks: ProgramWeek[] = basePlan.map((w) => {
    const isRaceWeek = raceWeek != null && w.week === raceWeek;
    const isTaperWeek = raceWeek != null && w.week === raceWeek - 1 && raceWeek >= 3;
    const taper = isRaceWeek || isTaperWeek;
    const cut = isRaceWeek ? 1 - raceCut : isTaperWeek ? 1 - taperCut : w.unload ? 1 - unloadCut : 1;
    const baseSets = Math.min(w.sets, limits.maxSets);
    const sets = cut < 1 ? Math.max(2, Math.round(baseSets * cut)) : baseSets;
    const secSets = taper || w.unload ? 2 : 3;
    const rir = taper ? 3 : w.rir;
    const contrast = w.build && reactiveAllowed && !isRaceWeek;
    const plyoScale = (w.unload || taper ? 0.6 : 1) * (w.build ? 1.15 : 1);

    const make = (origId: string, d: number, o: { sets: number; reps: number; pct?: number; pair?: string; note?: string; rirOverride?: number | null; sided?: boolean }): PrescribedExercise | null => {
      const def = resolve(origId);
      noteRestriction(origId, def);
      if (!def) return null;
      const main = MAIN_LIFTS.has(def.id);
      const pct = def.oneRmRatio != null ? (o.pct ?? (main ? w.pct : SECONDARY_PCT)) : null;
      const loadKg = pct != null && squat1RM != null && def.oneRmRatio != null ? Math.max(2.5, roundLoad(squat1RM * def.oneRmRatio * pct)) : null;
      const needsLoad = def.oneRmRatio != null && loadKg == null;
      const extra = o.sided && def.perSide && side && !taper ? side : undefined;
      const gate = def.id === "drop_jump" || def.id === "hurdle_hops" || def.id === "bounding"
        ? "Competency gate: only progress to this once low-level plyometrics have been completed pain-free and single-leg landing control is good." : undefined;
      const notes = [o.note, gate, extra ? `Add +1 set on the ${extra} (weaker) side.` : null, needsLoad ? "Load not set: find a load that gives the target RIR and enter it." : null, !main && def.oneRmRatio != null && loadKg != null ? "Starting estimate: confirm in week 1." : null].filter(Boolean).join(" ");
      return {
        id: `w${w.week}-d${d}-${def.id}`, exerciseId: def.id, name: def.name, category: def.category,
        sets: o.sets, reps: o.reps, unit: def.unit, perSide: def.perSide, loadKg, pct1RM: pct != null ? Math.round(pct * 1000) / 10 : null,
        rir: def.category === "plyometric" ? null : o.rirOverride === undefined ? rir : o.rirOverride, restSec: def.restSec,
        pairedWith: o.pair, extraSetSide: extra, cue: def.cue,
        progressionRule: def.category === "plyometric" ? PROG_PLYO : main ? PROG_HEAVY : def.oneRmRatio != null ? PROG_SECONDARY : PROG_BW,
        notes: notes || undefined,
        ruleIds: def.category === "plyometric" ? ["running.strength.plyometric", "running.plyo.contacts"] : main ? ["running.strength.high-load", "running.strength.training-age"] : ["running.program.soleus", "running.program.starting-loads"],
      };
    };
    const push = (list: PrescribedExercise[], e: PrescribedExercise | null) => { if (e) list.push(e); };
    const plyoReps = (per: number) => Math.max(3, Math.round((contactBase * plyoScale) / per));

    const A: PrescribedExercise[] = [];
    const B: PrescribedExercise[] = [];

    const sq = make("back_squat", 1, { sets, reps: w.reps });
    push(A, sq);
    if (contrast) {
      const djReps = emphasis === "strength" ? 4 : emphasis === "power" ? 6 : 5;
      push(A, make("drop_jump", 1, { sets, reps: djReps, pair: sq?.id, note: "Contrast pair: perform 2-3 min after the squat set, then rest 3 min before the next pair." }));
    }
    push(A, make("split_squat", 1, { sets: secSets, reps: 6, sided: true }));
    push(A, make("seated_soleus_raise", 1, { sets: secSets, reps: 8 }));
    if (!contrast && !isRaceWeek) {
      push(A, make("side_plank", 1, { sets: 3, reps: 30, rirOverride: null }));
      if (emphasis !== "strength" || w.build || limits.lowLevelPlyoOnly) push(A, make("skips_for_height", 1, { sets: 3, reps: plyoReps(3), rirOverride: null }));
    }
    if (isRaceWeek) push(A, make("side_plank", 1, { sets: 2, reps: 30, rirOverride: null }));

    if (!isRaceWeek) {
      const td = make("trap_bar_deadlift", 2, { sets, reps: w.reps });
      push(B, td);
      if (contrast) {
        const hhReps = emphasis === "strength" ? 5 : emphasis === "power" ? 8 : 6;
        push(B, make("hurdle_hops", 2, { sets, reps: hhReps, pair: td?.id, note: "Contrast pair: reactive, minimal ground contact." }));
        if (emphasis === "power") push(B, make("bounding", 2, { sets: 3, reps: w.unload || taper ? 5 : 8, rirOverride: null }));
      }
      push(B, make("nordic_hamstring", 2, { sets: secSets, reps: 5, rirOverride: null }));
      push(B, make("single_leg_calf_raise", 2, { sets: secSets, reps: 8, sided: true }));
      if (!contrast) push(B, make("pogo_hops", 2, { sets: 3, reps: plyoReps(3), rirOverride: null }));
      push(B, make("pallof_press", 2, { sets: 3, reps: 10, rirOverride: null }));
      if (hipStab) push(B, make("lateral_band_walk", 2, { sets: 2, reps: 12, rirOverride: null }));
    }

    enforceContactCap(A, limits.contactCap);
    enforceContactCap(B, limits.contactCap);

    const sessions: ProgramSession[] = [
      { id: `w${w.week}-d1`, week: w.week, day: 1, name: "Session A", warmup: WARMUP, focus: isRaceWeek ? "Race week: one light session early in the week (the books' marathon example is about 6 days before)" : contrast ? "Squat + drop-jump contrast, unilateral, soleus" : "Heavy squat, unilateral, soleus", exercises: A },
    ];
    if (!isRaceWeek) sessions.push({ id: `w${w.week}-d2`, week: w.week, day: 2, name: "Session B", warmup: WARMUP, focus: contrast ? "Deadlift + hurdle-hop contrast, posterior chain" : "Heavy hinge, posterior chain, robustness", exercises: B });

    const phase = isRaceWeek ? "Taper" : isTaperWeek ? "Taper" : w.phase;
    const label = isRaceWeek ? "Race week" : isTaperWeek ? "Taper" : w.label;
    const note = isRaceWeek
      ? "Race week: one light session (about half the sets, same intensity), no plyometrics, no eccentric hamstring work. Do it early in the week (the books' marathon example is about 6 days before the race); timing for shorter events is a clinician decision. Keep running frequency."
      : isTaperWeek
        ? "Taper: sets cut about 40%, intensity kept, plyometric contacts reduced. Keep running frequency; cut running volume and intensity per the running plan."
        : w.unload ? `Unload: sets cut about 45%, intensity maintained.${w.label.includes("reassess") || w.label.includes("retest") ? " Reassess this week." : ""}`
        : `${w.phase}: ${Math.round(w.pct * 1000) / 10}% target on main lifts, ${rir} RIR on the final set.`;
    return { week: w.week, phase, label, isUnload: w.unload || taper, note, sessions };
  });

  const { objectives, milestones } = buildObjectivesAndMilestones(a, report, metrics, duration, raceWeek, tier, params.get("running.gait.cadence", "cadenceIncreasePct"), { cmj: params.get("running.field-tests.tracking", "cmjPct"), rsi: params.get("running.field-tests.tracking", "rsiPct"), bj: params.get("running.field-tests.tracking", "broadJumpPct") });
  return {
    moduleId: "running", generatedAt: new Date().toISOString(), durationWeeks: duration,
    strategy: report.strategy, weeks, objectives, milestones, assumptions, restrictionsApplied, trainingTier: tier, rulesUsed: [...rulesUsed], paramOverrides: params.overrides(),
  };
}

function buildObjectivesAndMilestones(a: RunnerAssessment, report: EngineReport, m: ReturnType<typeof computeMetrics>, weeks: number, raceWeek: number | null, tier: TrainingTier, cadencePct: number, fieldPct: { cmj: number; rsi: number; bj: number }) {
  const objectives: Objective[] = [];
  const num = (k: string) => (typeof m[k] === "number" ? (m[k] as number) : null);
  const add = (o: Objective) => objectives.push(o);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const sq = num("squat1RM");
  if (sq != null) add({ id: "squat1RM", label: "Estimated back squat 1RM", metric: "squat1RM", unit: "kg", baseline: sq, target: r1(sq * (tier === "novice" ? 1.15 : 1.1)), rationale: `+${tier === "novice" ? 15 : 10}% over the block (editable default; novices usually gain faster). The KB treats a >=5% change as meaningful on retest.`, status: "proposed_default" });
  const imtp = num("imtpRel");
  if (imtp != null) add({ id: "imtpRel", label: "IMTP relative peak force", metric: "imtpRel", unit: "N/kg", baseline: imtp, target: r1(imtp * 1.05), rationale: "+5% (editable default).", status: "proposed_default" });
  const dsi = num("dsi");
  if (dsi != null && (dsi < 0.6 || dsi > 0.8)) add({ id: "dsi", label: "Dynamic Strength Index", metric: "dsi", unit: "ratio", baseline: dsi, target: 0.7, rationale: "Move toward the 0.60-0.80 balanced band (band itself needs verification).", status: "needs_verification" });
  const calf = num("calfRaiseAvg");
  if (calf != null) add({ id: "calfRaiseAvg", label: "Single-leg calf raise (average reps)", metric: "calfRaiseAvg", unit: "reps", baseline: calf, target: r1(calf * 1.2), rationale: "+20% (editable default).", status: "proposed_default" });
  const cmj = num("cmjHeightCm");
  if (cmj != null) add({ id: "cmj", label: "CMJ height (phone video)", metric: "cmjHeightCm", unit: "cm", baseline: cmj, target: r1(cmj * (1 + fieldPct.cmj / 100)), rationale: `+${fieldPct.cmj}% (editable default). Tracked against the athlete's own baseline; no runner cutoffs exist.`, status: "proposed_default" });
  const rsi = num("rsi");
  if (rsi != null) add({ id: "rsi", label: "Pogo-hop reactive strength index", metric: "rsi", unit: "ratio", baseline: rsi, target: Math.round(rsi * (1 + fieldPct.rsi / 100) * 100) / 100, rationale: `+${fieldPct.rsi}% (editable default). Keep hop count, surface and frame rate identical.`, status: "proposed_default" });
  const bj = num("broadJumpM");
  if (bj != null) add({ id: "broadJump", label: "Standing broad jump", metric: "broadJumpM", unit: "m", baseline: bj, target: Math.round(bj * (1 + fieldPct.bj / 100) * 100) / 100, rationale: `+${fieldPct.bj}% (editable default).`, status: "proposed_default" });
  const sebt = num("sebtAsymmetryCm");
  if (sebt != null && sebt > 4) add({ id: "sebt", label: "SEBT asymmetry", metric: "sebtAsymmetryCm", unit: "cm", baseline: sebt, target: 4, lowerIsBetter: true, rationale: "Bring side-to-side difference to 4 cm or less (default flag).", status: "needs_verification" });
  const cad = num("cadenceSpm");
  if (cad != null && report.priorities.some((p) => p.key === "gait_mechanics")) add({ id: "cadence", label: "Running cadence", metric: "cadenceSpm", unit: "spm", baseline: cad, target: Math.round(cad * (1 + cadencePct / 100)), rationale: `+${cadencePct}% cadence trial for symptomatic overstriding (book range 5-10%).`, status: "proposed_default" });
  const pred = num("goalPredictedTimeSec");
  if (pred != null && a.goals.targetTimeSec) add({ id: "goal", label: `${a.goals.event} race goal`, metric: "goalPredictedTimeSec", unit: "s", baseline: pred, target: a.goals.targetTimeSec, lowerIsBetter: true, rationale: "Predicted time from current VDOT vs. athlete goal. Strength training supports economy; fitness gains come from the running plan.", status: "source_verified" });

  const retest = retestList(a.physical).join(", ") || "all baseline tests";
  const milestones: Milestone[] = [{ id: "m1", week: 1, label: "Baseline and load check", detail: "Confirm every starting load gives the target RIR; edit as needed." }];
  const mid = Math.min(tier === "novice" ? 6 : 4, weeks - 1);
  if (mid >= 3 && mid < weeks - 1) milestones.push({ id: "m2", week: mid, label: "Unload week + mid-block reassessment", detail: `Retest: ${retest}. Review VDOT (3-4 week cycle) and all objectives.` });
  if (raceWeek == null) milestones.push({ id: "m3", week: weeks, label: "End-of-block reassessment", detail: `Full retest (${retest}), compare to baseline, decide next block.` });
  else {
    milestones.push({ id: "m3", week: Math.max(2, raceWeek - 2), label: "Taper begins", detail: "Cut gym volume, keep intensity, keep running frequency." });
    milestones.push({ id: "m4", week: raceWeek, label: `Race: ${a.goals.event}`, detail: `Target date ${a.goals.raceDate}. Reassess after recovery.` });
  }
  if (raceWeek == null && a.goals.raceDate) milestones.push({ id: "m4", week: weeks + 1, label: `Race: ${a.goals.event}`, detail: `Target date ${a.goals.raceDate}. Plan the taper (1-4 weeks, volume down, intensity kept) around this date.` });
  return { objectives, milestones };
}
