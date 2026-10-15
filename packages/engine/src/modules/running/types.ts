export type PainSite =
  | "none" | "tibia" | "foot" | "achilles" | "calf" | "knee" | "hip" | "hamstring" | "lumbar" | "other";

export interface RunnerProfile {
  name: string;
  sex: "male" | "female" | "other";
  age: number;
  bodyMassKg: number;
  heightCm?: number | null;
}

export interface RunnerGoals {
  event: string; // e.g. "5k", "10k", "half", "marathon", "1500m"
  targetDistanceM: number;
  targetTimeSec: number | null;
  raceDate: string | null; // ISO date
  narrative: string;
}

export interface TrainingHistory {
  weeklyKm: number;
  longestRunKm: number;
  longestRunMin: number | null;
  recentRace: { distanceM: number; timeSec: number; daysAgo: number } | null;
  breakDays: number;
  crossTrainedDuringBreak: boolean;
  strengthTrainingYears: number | null;
}

/** Screening items. The engine surfaces these; it never classifies REDs risk or clears an athlete. */
export interface HealthScreen {
  /** AMSSM item: pain causing modified training >= 7 days or 3 consecutive sessions. */
  painModifiedTraining: boolean;
  painSite: PainSite;
  menstrualIrregularity: boolean;
  amenorrheaOver3Months: boolean;
  lowMorningErectionsOrLibido: boolean;
  unintendedWeightLossOver5Pct: boolean;
  bsiHistoryCount: number;
  eatingDisorderConcern: boolean;
  cardiacSymptoms: boolean;
  dxaZScore: number | null;
  notes: string;
}

export interface Biomechanics {
  footStrike: "rearfoot" | "midfoot" | "forefoot" | null;
  cadenceSpm: number | null;
  /** Lateral malleolus line anterior to pelvis at loading response. */
  overstride: boolean | null;
  peakKneeFlexionDeg: number | null;
  peakHipExtensionDeg: number | null;
  verticalOscillation: "low" | "moderate" | "high" | null;
  pelvicDrop: "none" | "mild" | "marked" | null;
  kneeValgus: boolean | null;
  crossover: boolean | null;
  heelWhip: boolean | null;
  notes: string;
}

export interface PhysicalTests {
  /** Squat test: load lifted for reps (reps = 1 means a true 1RM). */
  squatLoadKg: number | null;
  squatReps: number | null;
  imtpPeakForceN: number | null;
  cmjPeakForceN: number | null;
  cmjHeightCm: number | null;
  broadJumpM: number | null;
  sebtAsymmetryCm: number | null;
  calfRaiseLeftReps: number | null;
  calfRaiseRightReps: number | null;
  nordicForceN: number | null;
  notes: string;
}

export interface RunnerAssessment {
  profile: RunnerProfile;
  goals: RunnerGoals;
  history: TrainingHistory;
  health: HealthScreen;
  biomechanics: Biomechanics;
  physical: PhysicalTests;
}

export interface RunnerProgramOpts {
  startDate?: string | null;
  /** Rule parameters (clinician overrides applied). Defaults are used when omitted. */
  params?: import("../../core/params").Params;
}
