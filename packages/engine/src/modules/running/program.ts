import type {
  EngineReport, Milestone, Objective, PrescribedExercise, Program, ProgramSession, ProgramWeek,
} from "../../core/types";
import { roundLoad } from "../../core/util";
import { EXERCISES, SITE_EXCLUSIONS, type ExerciseDef, type LoadTag } from "./exercises";
import { computeMetrics } from "./interpret";
import type { RunnerAssessment, RunnerProgramOpts } from "./types";

interface WeekPlan { week: number; phase: string; label: string; pct: number; sets: number; reps: number; unload: boolean }

/** Eight-week plan: 3 loading weeks + unload, twice (rule running.program.structure). Editable defaults. */
const PLAN: WeekPlan[] = [
  { week: 1, phase: "Accumulation", label: "Load 1", pct: 0.8, sets: 3, reps: 6, unload: false },
  { week: 2, phase: "Accumulation", label: "Load 2", pct: 0.825, sets: 4, reps: 5, unload: false },
  { week: 3, phase: "Accumulation", label: "Load 3 (peak)", pct: 0.85, sets: 4, reps: 5, unload: false },
  { week: 4, phase: "Accumulation", label: "Unload + reassess", pct: 0.8, sets: 4, reps: 5, unload: true },
  { week: 5, phase: "Transmutation", label: "Load 1", pct: 0.825, sets: 3, reps: 4, unload: false },
  { week: 6, phase: "Transmutation", label: "Load 2", pct: 0.85, sets: 3, reps: 4, unload: false },
  { week: 7, phase: "Transmutation", label: "Load 3 (peak)", pct: 0.875, sets: 4, reps: 3, unload: false },
  { week: 8, phase: "Transmutation", label: "Unload + retest", pct: 0.85, sets: 4, reps: 3, unload: true },
];

const SECONDARY_PCT = 0.75;
const MAIN_LIFTS = new Set(["back_squat", "leg_press", "trap_bar_deadlift", "hip_thrust"]);

const PROG_HEAVY =
  "Next session: all sets/reps completed at target RIR -> +2.5-5% (to nearest 2.5 kg); incomplete -> hold; >2 reps missed -> -5%. Pain >=4/10 holds and flags the clinician.";
const PROG_SECONDARY = "Double progression: when all sets reach the top of the rep target at RIR >=2, add the smallest load increment.";
const PROG_PLYO = "Hold contacts. Stop the set if ground contact visibly lengthens or jump height drops >10%. Progress by box/hurdle height only with clinician approval.";
const PROG_BW = "Add reps within the set, then external load. Quality over quantity.";

export function generateRunnerProgram(a: RunnerAssessment, report: EngineReport, _opts: RunnerProgramOpts = {}): Program {
  const metrics = computeMetrics(a);
  const squat1RM = metrics.squat1RM as number | null;
  const emphasis = report.strategy.emphasis;
  const assumptions: string[] = [
    "Two gym sessions per week (Session A lower-strength, Session B hinge/robustness). Place them on hard running days where possible and keep a gap from key interval/threshold runs.",
    "Loads for secondary lifts are starting estimates as a ratio of squat 1RM (needs verification): confirm each in week 1 and edit.",
    "Percentages, set/rep schemes, and unload cuts are proposed software defaults derived from the knowledge base; the clinician may edit any prescription.",
    "Submaximal-load (15-25 rep) and isometric training are not used: the meta-analysis found no economy benefit.",
  ];
  if (squat1RM == null) assumptions.push("No squat test entered: all loads are blank. Establish a 5RM in week 1 under supervision and edit the loads.");
  const rulesUsed = new Set<string>([...report.rulesUsed, "running.program.structure", "running.program.starting-loads", "core.periodization.3to1"]);

  // Site restrictions
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
  const asym = report.priorities.some((p) => p.key === "unilateral_symmetry");
  const contactBase = emphasis === "strength" ? 24 : emphasis === "power" ? 48 : 36;

  const weeks: ProgramWeek[] = PLAN.map((w) => {
    const sets = w.unload ? Math.max(2, Math.round(w.sets * 0.55)) : w.sets;
    const secSets = w.unload ? 2 : 3;
    const rir = w.unload ? 3 : w.label.includes("peak") ? 1 : 2;
    const phase2 = w.phase === "Transmutation";

    const make = (origId: string, d: number, o: { sets: number; reps: number; pct?: number; pair?: string; note?: string; rirOverride?: number | null }): PrescribedExercise | null => {
      const def = resolve(origId);
      noteRestriction(origId, def);
      if (!def) return null;
      const main = MAIN_LIFTS.has(def.id);
      const pct = def.oneRmRatio != null ? (o.pct ?? (main ? w.pct : SECONDARY_PCT)) : null;
      const loadKg = pct != null && squat1RM != null && def.oneRmRatio != null ? Math.max(2.5, roundLoad(squat1RM * def.oneRmRatio * pct)) : null;
      const needsLoad = def.oneRmRatio != null && loadKg == null;
      const notes = [o.note, needsLoad ? "Load not set: find a load that gives the target RIR and enter it." : null, !main && def.oneRmRatio != null && loadKg != null ? "Starting estimate: confirm in week 1." : null].filter(Boolean).join(" ");
      return {
        id: `w${w.week}-d${d}-${def.id}`, exerciseId: def.id, name: def.name, category: def.category,
        sets: o.sets, reps: o.reps, unit: def.unit, perSide: def.perSide, loadKg, pct1RM: pct != null ? Math.round(pct * 1000) / 10 : null,
        rir: def.category === "plyometric" ? null : o.rirOverride === undefined ? rir : o.rirOverride, restSec: def.restSec,
        pairedWith: o.pair, cue: def.cue,
        progressionRule: def.category === "plyometric" ? PROG_PLYO : main ? PROG_HEAVY : def.oneRmRatio != null ? PROG_SECONDARY : PROG_BW,
        notes: notes || undefined,
        ruleIds: def.category === "plyometric" ? ["running.strength.plyometric"] : main ? ["running.strength.high-load"] : ["running.program.soleus", "running.program.starting-loads"],
      };
    };
    const push = (list: PrescribedExercise[], e: PrescribedExercise | null) => { if (e) list.push(e); };

    const A: PrescribedExercise[] = [];
    const B: PrescribedExercise[] = [];

    if (!phase2) {
      const sq = make("back_squat", 1, { sets, reps: w.reps });
      push(A, sq);
      push(A, make("split_squat", 1, { sets: secSets, reps: 6, note: asym ? "Add +1 set on the weaker side." : undefined }));
      push(A, make("seated_soleus_raise", 1, { sets: secSets, reps: 8 }));
      push(A, make("side_plank", 1, { sets: 3, reps: 30, rirOverride: null }));
      if (emphasis !== "strength") push(A, make("skips_for_height", 1, { sets: 3, reps: Math.round((contactBase * (w.unload ? 0.6 : 1)) / 6), rirOverride: null }));

      push(B, make("trap_bar_deadlift", 2, { sets, reps: w.reps }));
      push(B, make("nordic_hamstring", 2, { sets: secSets, reps: 5, rirOverride: null }));
      push(B, make("single_leg_calf_raise", 2, { sets: secSets, reps: 8, note: asym ? "Add +1 set on the weaker side." : undefined }));
      push(B, make("pogo_hops", 2, { sets: 3, reps: Math.round((contactBase * (w.unload ? 0.6 : 1)) / 3), rirOverride: null }));
      push(B, make("pallof_press", 2, { sets: 3, reps: 10, rirOverride: null }));
      if (hipStab) push(B, make("lateral_band_walk", 2, { sets: 2, reps: 12, rirOverride: null }));
    } else {
      const sq = make("back_squat", 1, { sets, reps: w.reps });
      push(A, sq);
      const djReps = emphasis === "strength" ? 4 : emphasis === "power" ? 6 : 5;
      push(A, make("drop_jump", 1, { sets, reps: djReps, pair: sq?.id, note: "Contrast pair: perform 2-3 min after the squat set, then rest 3 min before the next pair." }));
      push(A, make("split_squat", 1, { sets: secSets, reps: 6, note: asym ? "Add +1 set on the weaker side." : undefined }));
      push(A, make("seated_soleus_raise", 1, { sets: secSets, reps: 8 }));

      const td = make("trap_bar_deadlift", 2, { sets, reps: w.reps });
      push(B, td);
      const hhReps = emphasis === "strength" ? 5 : emphasis === "power" ? 8 : 6;
      push(B, make("hurdle_hops", 2, { sets, reps: hhReps, pair: td?.id, note: "Contrast pair: reactive, minimal ground contact." }));
      if (emphasis === "power") push(B, make("bounding", 2, { sets: 3, reps: w.unload ? 5 : 8, rirOverride: null }));
      push(B, make("nordic_hamstring", 2, { sets: secSets, reps: 5, rirOverride: null }));
      push(B, make("single_leg_calf_raise", 2, { sets: secSets, reps: 8, note: asym ? "Add +1 set on the weaker side." : undefined }));
      push(B, make("pallof_press", 2, { sets: 3, reps: 10, rirOverride: null }));
      if (hipStab) push(B, make("lateral_band_walk", 2, { sets: 2, reps: 12, rirOverride: null }));
    }

    const sessions: ProgramSession[] = [
      { id: `w${w.week}-d1`, week: w.week, day: 1, name: "Session A", focus: phase2 ? "Squat + drop-jump contrast, unilateral, soleus" : "Heavy squat, unilateral, soleus", exercises: A },
      { id: `w${w.week}-d2`, week: w.week, day: 2, name: "Session B", focus: phase2 ? "Deadlift + hurdle-hop contrast, posterior chain" : "Heavy hinge, posterior chain, robustness", exercises: B },
    ];
    return {
      week: w.week, phase: w.phase, label: w.label, isUnload: w.unload,
      note: w.unload ? "Unload: sets cut about 45%, intensity maintained. Reassess this week." : `${w.phase}: ${Math.round(w.pct * 1000) / 10}% target on main lifts, ${rir} RIR on the final set.`,
      sessions,
    };
  });

  const { objectives, milestones } = buildObjectivesAndMilestones(a, report, metrics, PLAN.length);
  return {
    moduleId: "running", generatedAt: new Date().toISOString(), durationWeeks: PLAN.length,
    strategy: report.strategy, weeks, objectives, milestones, assumptions, restrictionsApplied, rulesUsed: [...rulesUsed],
  };
}

function buildObjectivesAndMilestones(a: RunnerAssessment, report: EngineReport, m: ReturnType<typeof computeMetrics>, weeks: number) {
  const objectives: Objective[] = [];
  const num = (k: string) => (typeof m[k] === "number" ? (m[k] as number) : null);
  const add = (o: Objective) => objectives.push(o);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const sq = num("squat1RM");
  if (sq != null) add({ id: "squat1RM", label: "Estimated back squat 1RM", metric: "squat1RM", unit: "kg", baseline: sq, target: r1(sq * 1.1), rationale: "+10% over eight weeks (editable default). The KB treats a >=5% change as meaningful on retest.", status: "proposed_default" });
  const imtp = num("imtpRel");
  if (imtp != null) add({ id: "imtpRel", label: "IMTP relative peak force", metric: "imtpRel", unit: "N/kg", baseline: imtp, target: r1(imtp * 1.05), rationale: "+5% (editable default).", status: "proposed_default" });
  const dsi = num("dsi");
  if (dsi != null && (dsi < 0.6 || dsi > 0.8)) add({ id: "dsi", label: "Dynamic Strength Index", metric: "dsi", unit: "ratio", baseline: dsi, target: 0.7, rationale: "Move toward the 0.60-0.80 balanced band (band itself needs verification).", status: "needs_verification" });
  const calf = num("calfRaiseAvg");
  if (calf != null) add({ id: "calfRaiseAvg", label: "Single-leg calf raise (average reps)", metric: "calfRaiseAvg", unit: "reps", baseline: calf, target: r1(calf * 1.2), rationale: "+20% (editable default).", status: "proposed_default" });
  const sebt = num("sebtAsymmetryCm");
  if (sebt != null && sebt > 4) add({ id: "sebt", label: "SEBT asymmetry", metric: "sebtAsymmetryCm", unit: "cm", baseline: sebt, target: 4, lowerIsBetter: true, rationale: "Bring side-to-side difference to 4 cm or less (default flag).", status: "needs_verification" });
  const cad = num("cadenceSpm");
  if (cad != null && report.priorities.some((p) => p.key === "gait_mechanics")) add({ id: "cadence", label: "Running cadence", metric: "cadenceSpm", unit: "spm", baseline: cad, target: Math.round(cad * 1.075), rationale: "+5-10% cadence trial for symptomatic overstriding (midpoint).", status: "proposed_default" });
  const pred = num("goalPredictedTimeSec");
  if (pred != null && a.goals.targetTimeSec) add({ id: "goal", label: `${a.goals.event} race goal`, metric: "goalPredictedTimeSec", unit: "s", baseline: pred, target: a.goals.targetTimeSec, lowerIsBetter: true, rationale: "Predicted time from current VDOT vs. athlete goal. Strength training supports economy; fitness gains come from the running plan.", status: "source_verified" });

  const milestones: Milestone[] = [
    { id: "m1", week: 1, label: "Baseline and load check", detail: "Confirm every starting load gives the target RIR; edit as needed." },
    { id: "m2", week: 4, label: "Unload week + mid-block reassessment", detail: "Retest squat/IMTP/CMJ and review VDOT (3-4 week cycle). Review all objectives." },
    { id: "m3", week: weeks, label: "End-of-block reassessment", detail: "Full retest, compare to baseline, decide next block." },
  ];
  if (a.goals.raceDate) milestones.push({ id: "m4", week: weeks + 1, label: `Race: ${a.goals.event}`, detail: `Target date ${a.goals.raceDate}${a.goals.targetTimeSec ? "" : ""}. Start the pre-race taper plan well before this date.` });
  return { objectives, milestones };
}
