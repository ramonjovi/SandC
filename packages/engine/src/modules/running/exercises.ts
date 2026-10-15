import type { ExerciseCategory, RepUnit } from "../../core/types";
import type { PainSite } from "./types";

export type LoadTag =
  | "axial_heavy" | "plyo" | "calf_load" | "knee_loaded" | "hamstring_ecc" | "hinge_heavy" | "hip_load";

export interface ExerciseDef {
  id: string;
  name: string;
  category: ExerciseCategory;
  unit: RepUnit;
  perSide: boolean;
  tags: LoadTag[];
  /**
   * Estimated 1RM-equivalent of this exercise as a multiple of the athlete's back-squat 1RM.
   * null = bodyweight / not %1RM driven. Starting estimates only (rule running.program.starting-loads).
   */
  oneRmRatio: number | null;
  restSec: number;
  cue: string;
  substitutes?: string[];
}

export const EXERCISES: Record<string, ExerciseDef> = {
  back_squat: { id: "back_squat", name: "Back squat (to parallel)", category: "strength", unit: "reps", perSide: false, tags: ["axial_heavy", "knee_loaded"], oneRmRatio: 1.0, restSec: 150, cue: "Brace, drive the floor away fast, controlled descent.", substitutes: ["leg_press"] },
  leg_press: { id: "leg_press", name: "Leg press", category: "strength", unit: "reps", perSide: false, tags: ["knee_loaded"], oneRmRatio: 1.6, restSec: 150, cue: "Full control; do not lock out hard.", substitutes: ["trap_bar_deadlift"] },
  trap_bar_deadlift: { id: "trap_bar_deadlift", name: "Trap bar deadlift", category: "strength", unit: "reps", perSide: false, tags: ["hinge_heavy", "axial_heavy"], oneRmRatio: 1.1, restSec: 150, cue: "Push the floor away, flat back, fast concentric.", substitutes: ["hip_thrust"] },
  hip_thrust: { id: "hip_thrust", name: "Barbell hip thrust", category: "strength", unit: "reps", perSide: false, tags: ["hip_load"], oneRmRatio: 1.0, restSec: 120, cue: "Ribs down, full hip extension, pause 1 s." },
  split_squat: { id: "split_squat", name: "Rear-foot-elevated split squat (dumbbells, load per hand)", category: "strength", unit: "reps", perSide: true, tags: ["knee_loaded"], oneRmRatio: 0.3, restSec: 120, cue: "Torso tall, front knee tracks over mid-foot.", substitutes: ["hip_thrust"] },
  seated_soleus_raise: { id: "seated_soleus_raise", name: "Seated soleus raise (heavy)", category: "robustness", unit: "reps", perSide: false, tags: ["calf_load"], oneRmRatio: 0.7, restSec: 90, cue: "2 s up, 1 s pause, 3 s down; full range." },
  single_leg_calf_raise: { id: "single_leg_calf_raise", name: "Single-leg standing calf raise (load per hand)", category: "robustness", unit: "reps", perSide: true, tags: ["calf_load"], oneRmRatio: 0.2, restSec: 90, cue: "Straight knee, slow tempo, full range." },
  nordic_hamstring: { id: "nordic_hamstring", name: "Nordic hamstring lowering", category: "robustness", unit: "reps", perSide: false, tags: ["hamstring_ecc"], oneRmRatio: null, restSec: 90, cue: "Hips extended, lower as slowly as possible, catch with hands." },
  lateral_band_walk: { id: "lateral_band_walk", name: "Lateral band walk", category: "robustness", unit: "reps", perSide: true, tags: [], oneRmRatio: null, restSec: 60, cue: "Knees out, pelvis level, short steps." },
  pallof_press: { id: "pallof_press", name: "Pallof press (anti-rotation)", category: "core", unit: "reps", perSide: true, tags: [], oneRmRatio: null, restSec: 60, cue: "Resist rotation, ribs stacked over pelvis." },
  side_plank: { id: "side_plank", name: "Side plank", category: "core", unit: "sec", perSide: true, tags: [], oneRmRatio: null, restSec: 45, cue: "Straight line ear to ankle, pelvis lifted." },
  pogo_hops: { id: "pogo_hops", name: "Pogo hops (ankle hops)", category: "plyometric", unit: "contacts", perSide: false, tags: ["plyo"], oneRmRatio: null, restSec: 120, cue: "Stiff ankles, minimal ground contact, quiet landings." },
  skips_for_height: { id: "skips_for_height", name: "A-skips / skipping for height", category: "plyometric", unit: "contacts", perSide: false, tags: ["plyo"], oneRmRatio: null, restSec: 90, cue: "Tall posture, rhythmic, quick ground contacts." },
  hurdle_hops: { id: "hurdle_hops", name: "Hurdle hops (low hurdles)", category: "plyometric", unit: "contacts", perSide: false, tags: ["plyo"], oneRmRatio: null, restSec: 180, cue: "Reactive: land and leave. Stop if contacts get longer." },
  drop_jump: { id: "drop_jump", name: "Drop jump (20-40 cm box)", category: "plyometric", unit: "contacts", perSide: false, tags: ["plyo"], oneRmRatio: null, restSec: 180, cue: "Minimal contact time, jump as high as possible." },
  bounding: { id: "bounding", name: "Alternate-leg bounding", category: "plyometric", unit: "contacts", perSide: false, tags: ["plyo", "hamstring_ecc"], oneRmRatio: null, restSec: 150, cue: "Long, powerful strides; stay springy." },
};

/** Conservative default mapping from a reported pain site to excluded load tags. */
export const SITE_EXCLUSIONS: Record<Exclude<PainSite, "none">, { tags: LoadTag[]; text: string }> = {
  tibia: { tags: ["axial_heavy", "plyo"], text: "Tibial pain: no heavy axial loading and no plyometrics until cleared." },
  foot: { tags: ["plyo"], text: "Foot pain: no plyometrics until cleared." },
  achilles: { tags: ["plyo", "calf_load"], text: "Achilles pain: no plyometrics or loaded calf work until reviewed." },
  calf: { tags: ["plyo", "calf_load"], text: "Calf pain: no plyometrics or loaded calf work until reviewed." },
  knee: { tags: ["plyo", "knee_loaded"], text: "Knee pain: no plyometrics or knee-dominant loading until reviewed." },
  hip: { tags: ["plyo", "axial_heavy", "hip_load"], text: "Hip pain: no plyometrics, heavy axial or hip-extension loading until reviewed." },
  hamstring: { tags: ["plyo", "hamstring_ecc"], text: "Hamstring pain: no plyometrics or eccentric hamstring work until reviewed." },
  lumbar: { tags: ["axial_heavy", "hinge_heavy"], text: "Low back pain: no heavy axial or hinge loading until reviewed." },
  other: { tags: ["plyo"], text: "Pain at an unspecified site: no plyometrics until reviewed." },
};
