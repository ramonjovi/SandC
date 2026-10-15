import type { Rule } from "./types";

/** Sport-agnostic rules. Status reflects honest verification state (see docs/rule-classification.md). */
export const CORE_RULES: Rule[] = [
  {
    id: "core.progression.load",
    title: "Load progression from logged performance",
    status: "proposed_default",
    source: "Knowledge file 01, Block 5.3 Rule 2 (HPT Ch.1 attribution)",
    statement:
      "If all prescribed sets/reps are completed, increase load next session: +5% when final-set RIR >= 2, +2.5% when RIR is 0-1; hold if incomplete; reduce 5% if more than 2 reps were missed.",
    verification:
      "The KB says '+2.5% to +5% when completed with <=1 RIR', which is ambiguous. The RIR split is a software interpretation. Page-level source check pending.",
    defaults: { incEasyPct: 5, incHardPct: 2.5, rirEasy: 2, reducePct: 5, missedRepsToReduce: 2 },
    paramMeta: {
      incEasyPct: { label: "Increase when final-set RIR is high", min: 0, max: 10, step: 0.5, unit: "%" },
      incHardPct: { label: "Increase when final-set RIR is low", min: 0, max: 10, step: 0.5, unit: "%" },
      rirEasy: { label: "RIR counted as 'easy'", min: 0, max: 5, step: 1, unit: "reps" },
      reducePct: { label: "Load reduction after missed reps", min: 0, max: 20, step: 0.5, unit: "%" },
      missedRepsToReduce: { label: "Missed reps that trigger a reduction", min: 1, max: 10, step: 1, unit: "reps" },
    },
  },
  {
    id: "core.progression.nonloaded",
    title: "Bodyweight / plyometric progression",
    status: "proposed_default",
    source: null,
    statement: "Bodyweight work progresses by small volume or added load once completed; plyometric contacts are set by phase and held.",
    verification: "Software default; no supplied source quantifies this.",
  },
  {
    id: "core.progression.pain",
    title: "Pain holds progression",
    status: "proposed_default",
    source: "AMSSM Runner Health Surveillance (Tenforde 2023) defines the injury; hold threshold is a default",
    statement: "Pain of 4/10 or more during an exercise holds load and flags clinician review.",
    verification: "Threshold of 4/10 is a software default.",
    defaults: { painHold: 4 },
    paramMeta: { painHold: { label: "Pain level that holds progression", min: 1, max: 10, step: 1, unit: "/10" } },
  },
  {
    id: "core.progression.cmj-fatigue",
    title: "CMJ fatigue check halves volume",
    status: "needs_verification",
    source: "Knowledge file 01, Part 5.3 (CMJ >5% drop)",
    statement: "If pre-session CMJ height is more than 5% below baseline, halve set volume next session.",
    verification: "The 5% and 50% values were not located in a supplied PDF page; treat as editable defaults.",
    defaults: { cmjDropFraction: 0.05, cmjVolumeCut: 0.5 },
    paramMeta: {
      cmjDropFraction: { label: "CMJ drop that counts as fatigue", min: 0.01, max: 0.2, step: 0.01, unit: "fraction" },
      cmjVolumeCut: { label: "Volume cut after fatigue flag", min: 0.1, max: 0.8, step: 0.05, unit: "fraction" },
    },
  },
  {
    id: "core.load.weekly-cap",
    title: "10% weekly running-volume progression flag",
    status: "proposed_default",
    source: "Knowledge file 00 (<10% rule-of-thumb)",
    statement: "Flag weekly running-volume increases above 10% over the previous week.",
    verification: "The KB itself calls this a rule-of-thumb and notes ACWR criticism. Used as an alert only, never a hard block.",
    defaults: { capPct: 10 },
    paramMeta: { capPct: { label: "Weekly running-volume increase that is flagged", min: 3, max: 25, step: 1, unit: "%" } },
  },
  {
    id: "core.periodization.3to1",
    title: "3:1 summated microcycle (3 loading weeks, 1 unload)",
    status: "source_verified",
    source: "NSCA Guide to Program Design; Developing Endurance (as cited in KB)",
    statement: "Three loading weeks followed by an unload week with reduced volume and maintained intensity.",
    verification: "Structure is standard and attributed in KB. The 40-50% volume reduction is an editable default.",
    defaults: { unloadVolumeCut: 0.45 },
    paramMeta: { unloadVolumeCut: { label: "Set reduction in unload weeks", min: 0.2, max: 0.7, step: 0.05, unit: "fraction" } },
  },
  {
    id: "core.periodization.2to1",
    title: "2:1 build-to-recover cycle for novices",
    status: "source_verified",
    source: "NSCA Developing Endurance 2nd ed., ch. 3",
    statement: "Novice athletes are better served by a 2:1 week build-to-recover model than the traditional 3:1, to ensure enough recovery.",
    verification: "Read in the book text.",
  },
  {
    id: "core.screening.no-auto-clearance",
    title: "No automated medical clearance",
    status: "source_verified",
    source: "Product requirement; IOC REDs CAT2 is a clinician-administered tool",
    statement:
      "The engine surfaces screening flags but never classifies REDs risk or grants medical clearance. A clinician must review and acknowledge before a program can be approved.",
    verification: "Design decision by TPC, consistent with REDs CAT2 requiring multidisciplinary clinical assessment.",
  },
];
