import type { PrescribedExercise, Program } from "../../core/types";
import { roundLoad } from "../../core/util";
import { EXERCISE_GUIDES } from "./exerciseGuides";

/** Heavy main lifts and plyometrics already follow the generated periodization, so this planner leaves them alone. */
const MAIN_LIFTS = new Set(["back_squat", "leg_press", "trap_bar_deadlift", "hip_thrust"]);

/** Within a block of loading weeks, reps rise by 1 (seconds by 5) per week, up to this many steps. */
const MAX_STEPS = 2;
const UNLOAD_SET_FACTOR = 0.55;

const PLAN_NOTE = "Planned progression (clinic default, editable)";

function stepKg(load: number): number {
  return Math.max(2.5, roundLoad(load * 0.05));
}

/**
 * Plans the later weeks of one session from the exercises in a base week.
 *
 * - Exercises in the base week that are not main lifts or plyometrics are copied into every later week of the same session (if missing).
 * - Loading weeks: reps +1 (seconds +5) each week for up to two steps; after an unload week a new block starts, the load goes up one step
 *   (or, for bodyweight work, the exercise moves to its harder variation from the guide) and reps return to the base number.
 * - Unload and taper weeks: sets cut to about 55%, intensity kept. Race week is left untouched.
 *
 * Pure: returns a new program and leaves the input unchanged. Weeks up to and including the base week are not changed.
 */
export function planSessionProgression(program: Program, baseWeek: number, sessionIndex: number): Program {
  const next: Program = structuredClone(program);
  const base = next.weeks.find((w) => w.week === baseWeek)?.sessions[sessionIndex];
  if (!base) return next;
  const candidates = base.exercises.filter((e) => !MAIN_LIFTS.has(e.exerciseId) && e.category !== "plyometric" && e.unit !== "contacts");
  const order = base.exercises.map((e) => e.exerciseId);

  for (const ex of candidates) {
    let block = 0, pos = 0, load = ex.loadKg, afterUnload = false;
    for (const wk of next.weeks.filter((w) => w.week > baseWeek)) {
      const sess = wk.sessions[sessionIndex];
      if (!sess || wk.label === "Race week") continue;
      let target = sess.exercises.find((e) => e.exerciseId === ex.exerciseId);
      if (!target) {
        target = { ...structuredClone(ex), id: `w${wk.week}-d${sessionIndex + 1}-${ex.exerciseId}` };
        sess.exercises.push(target);
      }

      if (wk.isUnload) {
        afterUnload = true;
        target.sets = Math.max(2, Math.round(ex.sets * UNLOAD_SET_FACTOR));
        target.reps = ex.reps + Math.min(pos, MAX_STEPS) * (ex.unit === "sec" ? 5 : 1);
        target.loadKg = load;
        target.notes = tag(target.notes, `${PLAN_NOTE}: unload week, sets cut, load and reps held.`);
        continue;
      }
      if (afterUnload) { block += 1; pos = 0; afterUnload = false; if (load != null) load = roundLoad(load + stepKg(load)); }
      else pos += 1;
      const step = Math.min(pos, MAX_STEPS);
      target.sets = ex.sets;
      target.reps = ex.reps + step * (ex.unit === "sec" ? 5 : 1);
      target.loadKg = load;
      if (load != null && ex.loadKg != null && ex.pct1RM != null) target.pct1RM = Math.round(ex.pct1RM * (load / ex.loadKg) * 10) / 10;
      const harder = block > 0 && load == null ? ` New block: make it harder (${EXERCISE_GUIDES[ex.exerciseId]?.harder ?? "increase the difficulty"}) and rebuild the reps.` : "";
      target.notes = tag(target.notes, `${PLAN_NOTE}: block ${block + 1}, step ${step + 1}.${harder}`);
      target.progressionRule = "Planned progression: add 1 rep (5 s for holds) each loading week; new block = one load step (or the harder variation); hold if pain is above 3/10 or lasts more than 24 hours.";
    }
  }

  // Keep the base week's order in every later week; exercises a week does not share stay after the matched ones.
  const rank = (id: string) => { const i = order.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  for (const wk of next.weeks.filter((w) => w.week > baseWeek)) {
    const sess = wk.sessions[sessionIndex];
    if (!sess) continue;
    sess.exercises = sess.exercises.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e.exerciseId) - rank(b.e.exerciseId) || a.i - b.i).map((x) => x.e);
  }
  return next;
}

function tag(existing: string | undefined, add: string): string {
  const kept = (existing ?? "").split(". ").filter((s) => s && !s.startsWith(PLAN_NOTE)).join(". ");
  return [kept, add].filter(Boolean).join(" ");
}

/** Exposed for the editor: which exercises of a session would be planned. */
export function plannableExercises(exercises: PrescribedExercise[]): PrescribedExercise[] {
  return exercises.filter((e) => !MAIN_LIFTS.has(e.exerciseId) && e.category !== "plyometric" && e.unit !== "contacts");
}
