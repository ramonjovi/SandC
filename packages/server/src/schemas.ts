import { z } from "zod";
import type { running } from "@tpc/engine";

const num = z.number().finite().nullable().default(null);
const bool = z.boolean().default(false);
const triBool = z.boolean().nullable().default(null);

export const PainSite = z.enum(["none", "tibia", "foot", "achilles", "calf", "knee", "hip", "hamstring", "lumbar", "other"]);

const SideExamSchema = z.object({
  tibialTenderness: z.enum(["none", "diffuse", "focal"]).nullable().default(null),
  hopPain: triBool,
  trendelenburg: z.enum(["negative", "positive"]).nullable().default(null),
  singleLegSquat: z.enum(["good", "fair", "poor"]).nullable().default(null),
  singleLegStanceEyesOpenSec: z.number().min(0).max(600).nullable().default(null),
  singleLegStanceEyesClosedSec: z.number().min(0).max(600).nullable().default(null),
  ankleDorsiflexionCm: z.number().min(0).max(30).nullable().default(null),
  firstToeExtensionDeg: z.number().min(0).max(120).nullable().default(null),
  hipInternalRotationDeg: z.number().min(0).max(120).nullable().default(null),
}).default({});

export const AssessmentSchema = z.object({
  profile: z.object({
    name: z.string().min(1),
    sex: z.enum(["male", "female", "other"]),
    age: z.number().int().min(10).max(100),
    bodyMassKg: z.number().min(25).max(200),
    heightCm: num,
  }),
  goals: z.object({
    event: z.string().default("10k"),
    targetDistanceM: z.number().min(100).max(100000),
    targetTimeSec: num,
    raceDate: z.string().nullable().default(null),
    narrative: z.string().default(""),
  }),
  consent: z.object({
    given: bool,
    date: z.string().nullable().default(null),
    notes: z.string().default(""),
  }).default({}),
  history: z.object({
    weeklyKm: z.number().min(0).default(0),
    longestRunKm: z.number().min(0).default(0),
    longestRunMin: num,
    recentRace: z.object({
      distanceM: z.number().min(800, "Race distance is in metres: 5 km = 5000, 10 km = 10000.").max(100000, "Race distance is in metres: that looks too long."),
      timeSec: z.number().min(120, "Race time looks too short: use m:ss or h:mm:ss."),
      daysAgo: z.number().min(0),
    }).nullable().default(null),
    breakDays: z.number().min(0).default(0),
    crossTrainedDuringBreak: bool,
    strengthTrainingYears: num,
  }).default({}),
  health: z.object({
    painModifiedTraining: bool,
    painSite: PainSite.default("none"),
    menstrualIrregularity: bool,
    amenorrheaOver3Months: bool,
    lowMorningErectionsOrLibido: bool,
    unintendedWeightLossOver5Pct: bool,
    bsiHistoryCount: z.number().int().min(0).default(0),
    eatingDisorderConcern: bool,
    cardiacSymptoms: bool,
    dxaZScore: num,
    notes: z.string().default(""),
  }).default({}),
  biomechanics: z.object({
    footStrike: z.enum(["rearfoot", "midfoot", "forefoot"]).nullable().default(null),
    cadenceSpm: num,
    overstride: triBool,
    peakKneeFlexionDeg: num,
    peakHipExtensionDeg: num,
    verticalOscillation: z.enum(["low", "moderate", "high"]).nullable().default(null),
    pelvicDrop: z.enum(["none", "mild", "marked"]).nullable().default(null),
    kneeValgus: triBool,
    crossover: triBool,
    heelWhip: triBool,
    pelvicDropLeftStanceDeg: num,
    pelvicDropRightStanceDeg: num,
    heelWhipLeftDeg: num,
    heelWhipRightDeg: num,
    heelWhipLeftDirection: z.enum(["medial", "lateral"]).nullable().default(null),
    heelWhipRightDirection: z.enum(["medial", "lateral"]).nullable().default(null),
    heelEversionLeftDeg: num,
    heelEversionRightDeg: num,
    notes: z.string().default(""),
  }).default({}),
  physical: z.object({
    squatLoadKg: num,
    squatReps: num,
    imtpPeakForceN: num,
    cmjPeakForceN: num,
    cmjHeightCm: num,
    broadJumpM: num,
    sebtAsymmetryCm: num,
    calfRaiseLeftReps: num,
    calfRaiseRightReps: num,
    nordicForceN: num,
    rsiFlightMs: num,
    rsiContactMs: num,
    nordicBreakAngleDeg: num,
    hipAbductionLeftKg: num,
    hipAbductionRightKg: num,
    notes: z.string().default(""),
  }).default({}),
  visit: z.object({
    reason: z.string().default(""),
    otherFindings: z.string().default(""),
  }).default({}),
  exam: z.object({
    symptomSide: z.enum(["left", "right", "both"]).nullable().default(null),
    painNow: z.number().min(0).max(10).nullable().default(null),
    painDuringRun: z.number().min(0).max(10).nullable().default(null),
    painAfterRun: z.number().min(0).max(10).nullable().default(null),
    settlesWithin24h: triBool,
    nightPain: triBool,
    painWalking: triBool,
    left: SideExamSchema,
    right: SideExamSchema,
    notes: z.string().default(""),
  }).default({}),
});

export function parseAssessment(input: unknown): running.RunnerAssessment {
  return AssessmentSchema.parse(input) as running.RunnerAssessment;
}

export const CreateAthleteSchema = z.object({
  profile: AssessmentSchema.shape.profile,
  goals: AssessmentSchema.shape.goals,
  clinician: z.string().optional(),
});

export const PtSchema = z.object({
  clinician: z.string().optional(),
  priorityKeys: z.array(z.string()),
  strategy: z.enum(["high_load", "plyometric", "combined"]),
  reasoning: z.string().default(""),
  concerns: z.string().optional(),
});

export const ApproveSchema = z.object({
  clinician: z.string().optional(),
  screeningReviewed: z.literal(true, { errorMap: () => ({ message: "Screening must be reviewed and acknowledged before approval." }) }),
  clearanceNote: z.string().optional(),
});

export const SessionLogSchema = z.object({
  week: z.number().int().min(1),
  day: z.number().int().min(1),
  performedAt: z.string().optional(),
  cmjHeightCm: z.number().nullable().optional(),
  sessionRpe: z.number().min(0).max(10).nullable().optional(),
  notes: z.string().optional(),
  exercises: z.array(z.object({
    prescribedId: z.string(),
    exerciseId: z.string(),
    sets: z.array(z.object({ reps: z.number().min(0), loadKg: z.number().nullable() })),
    rirFinal: z.number().min(0).max(10).nullable(),
    pain: z.number().min(0).max(10).nullable(),
  })),
});

export const WeeklyLogSchema = z.object({
  weekStart: z.string(),
  runKm: z.number().min(0),
  painModifiedTraining: z.boolean().default(false),
  notes: z.string().optional(),
});
