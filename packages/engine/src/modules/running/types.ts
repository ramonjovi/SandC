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
  /** Per-side video measures (optional): degrees; pelvic drop is the dip on the swing side while standing on that leg. */
  pelvicDropLeftStanceDeg?: number | null;
  pelvicDropRightStanceDeg?: number | null;
  heelWhipLeftDeg?: number | null;
  heelWhipRightDeg?: number | null;
  heelWhipLeftDirection?: "medial" | "lateral" | null;
  heelWhipRightDirection?: "medial" | "lateral" | null;
  heelEversionLeftDeg?: number | null;
  heelEversionRightDeg?: number | null;
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
  /** Field tests (phone video). Flight/contact times in milliseconds; Nordic break angle in degrees from the floor. */
  rsiFlightMs?: number | null;
  rsiContactMs?: number | null;
  nordicBreakAngleDeg?: number | null;
  /** Side-lying hip abduction, hand-held dynamometer (average of trials, kg). */
  hipAbductionLeftKg?: number | null;
  hipAbductionRightKg?: number | null;
  notes: string;
}

/** Clinical exam findings for one side. All optional: the clinician records what was examined. */
export interface SideExam {
  /** Palpation along the tibia on this side. */
  tibialTenderness?: "none" | "diffuse" | "focal" | null;
  /** Pain on a single-leg hop on this side. */
  hopPain?: boolean | null;
  /** Standing on this leg: pelvis drops on the opposite side. */
  trendelenburg?: "negative" | "positive" | null;
  /** Observed quality of a single-leg squat on this side. */
  singleLegSquat?: "good" | "fair" | "poor" | null;
  singleLegStanceEyesOpenSec?: number | null;
  singleLegStanceEyesClosedSec?: number | null;
  /** Weight-bearing knee-to-wall distance (cm). */
  ankleDorsiflexionCm?: number | null;
  /** First toe (big toe) extension range under load or passive (degrees). */
  firstToeExtensionDeg?: number | null;
  hipInternalRotationDeg?: number | null;
}

/** Symptom pattern, bone-stress screen and the structured left/right examination. */
export interface Exam {
  /** Which side the symptoms are on. */
  symptomSide?: "left" | "right" | "both" | null;
  /** Pain ratings, 0-10. */
  painNow?: number | null;
  painDuringRun?: number | null;
  painAfterRun?: number | null;
  /** Does the pain settle within 24 hours of a run? */
  settlesWithin24h?: boolean | null;
  /** Bone-stress screen (athlete-level). */
  nightPain?: boolean | null;
  painWalking?: boolean | null;
  left?: SideExam;
  right?: SideExam;
  notes?: string;
}

export interface RunnerAssessment {
  profile: RunnerProfile;
  goals: RunnerGoals;
  /** Athlete consent to record their health information (privacy notice given and agreed). */
  consent?: { given: boolean; date: string | null; notes: string };
  history: TrainingHistory;
  health: HealthScreen;
  biomechanics: Biomechanics;
  physical: PhysicalTests;
  /** Reason for the visit and other clinician findings that have no field of their own (shown in the athlete report). */
  visit?: { reason: string; otherFindings: string };
  /** Symptom side, bone-stress screen and left/right exam. */
  exam?: Exam;
}

export interface RunnerProgramOpts {
  startDate?: string | null;
  /** Gym sessions per week: 1, 2 (default) or 3. */
  sessionsPerWeek?: 1 | 2 | 3;
  /** Rule parameters (clinician overrides applied). Defaults are used when omitted. */
  params?: import("../../core/params").Params;
}
