/** Sport-agnostic types shared by every sport module. */

/** Evidence classification required for every rule the engine applies. */
export type RuleStatus = "source_verified" | "proposed_default" | "needs_verification";

export interface Rule {
  id: string;
  title: string;
  status: RuleStatus;
  /** Named source in the supplied knowledge base (or null for pure software defaults). */
  source: string | null;
  /** What the rule says, in plain language. */
  statement: string;
  /** How the rule was checked / why it has this status. */
  verification: string;
  /** Clinician-editable default value(s), when the rule carries numbers. */
  defaults?: Record<string, number | string>;
}

export type Severity = "info" | "attention" | "priority";

export interface Finding {
  id: string;
  domain: string;
  severity: Severity;
  text: string;
  data?: Record<string, number | string | boolean | null>;
  ruleIds: string[];
}

export interface Priority {
  /** Stable key used for PT-vs-engine comparison. */
  key: string;
  label: string;
  rank: number;
  rationale: string;
  ruleIds: string[];
}

export interface SafetyFlag {
  id: string;
  text: string;
  /** High-stakes medical flags: engine never classifies or clears these, it only surfaces them. */
  highStakes: boolean;
  ruleIds: string[];
}

export interface SiteRestriction {
  site: string;
  text: string;
}

export type StrategyKey = "high_load" | "plyometric" | "combined";
export type Emphasis = "strength" | "power" | "balanced";

export interface Strategy {
  key: StrategyKey;
  emphasis: Emphasis;
  rationale: string;
  ruleIds: string[];
}

export interface EngineReport {
  moduleId: string;
  engineVersion: string;
  generatedAt: string;
  metrics: Record<string, number | string | null>;
  findings: Finding[];
  priorities: Priority[];
  strategy: Strategy;
  safetyFlags: SafetyFlag[];
  restrictions: SiteRestriction[];
  missingData: string[];
  /** Rule ids that were actually used, so the UI can show provenance. */
  rulesUsed: string[];
}

/* ---------------- Program ---------------- */

export type ExerciseCategory = "strength" | "plyometric" | "robustness" | "core";
export type RepUnit = "reps" | "contacts" | "sec";

export interface PrescribedExercise {
  id: string;
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  sets: number;
  reps: number;
  unit: RepUnit;
  perSide: boolean;
  /** Prescribed external load; null = bodyweight / load to be established by clinician. */
  loadKg: number | null;
  pct1RM: number | null;
  /** Target reps in reserve on the final set. */
  rir: number | null;
  restSec: number;
  /** Set when this exercise is the plyometric half of a contrast pair. */
  pairedWith?: string;
  cue?: string;
  progressionRule: string;
  notes?: string;
  ruleIds: string[];
}

export interface ProgramSession {
  id: string;
  week: number;
  day: number;
  name: string;
  focus: string;
  exercises: PrescribedExercise[];
}

export interface ProgramWeek {
  week: number;
  phase: string;
  label: string;
  isUnload: boolean;
  note: string;
  sessions: ProgramSession[];
}

export interface Objective {
  id: string;
  label: string;
  metric: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  /** True when lower is better. */
  lowerIsBetter?: boolean;
  rationale: string;
  status: RuleStatus;
}

export interface Milestone {
  id: string;
  week: number;
  label: string;
  detail: string;
}

export interface Program {
  moduleId: string;
  generatedAt: string;
  durationWeeks: number;
  strategy: Strategy;
  weeks: ProgramWeek[];
  objectives: Objective[];
  milestones: Milestone[];
  assumptions: string[];
  restrictionsApplied: string[];
  rulesUsed: string[];
}

/* ---------------- Logging & progression ---------------- */

export interface SetLog {
  reps: number;
  loadKg: number | null;
}

export interface ExerciseLog {
  prescribedId: string;
  exerciseId: string;
  sets: SetLog[];
  /** Reps in reserve reported for the final set. */
  rirFinal: number | null;
  /** 0-10 pain/discomfort during this exercise. */
  pain: number | null;
}

export interface SessionLog {
  week: number;
  day: number;
  performedAt: string;
  /** Optional pre-session countermovement-jump height average (cm). */
  cmjHeightCm?: number | null;
  sessionRpe?: number | null;
  notes?: string;
  exercises: ExerciseLog[];
}

export type NextAction = "increase" | "hold" | "reduce" | "pain_hold";

export interface NextTarget {
  prescribedId: string;
  exerciseId: string;
  action: NextAction;
  nextLoadKg: number | null;
  nextSets: number;
  nextReps: number;
  reason: string;
  ruleIds: string[];
}
