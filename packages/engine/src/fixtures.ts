import type { RunnerAssessment } from "./modules/running/types";

/** SYNTHETIC athletes for development and tests only. Not real people. */
const blankHealth = {
  painModifiedTraining: false, painSite: "none" as const, menstrualIrregularity: false, amenorrheaOver3Months: false,
  lowMorningErectionsOrLibido: false, unintendedWeightLossOver5Pct: false, bsiHistoryCount: 0,
  eatingDisorderConcern: false, cardiacSymptoms: false, dxaZScore: null, notes: "",
};

export const SYNTHETIC_ALEX: RunnerAssessment = {
  profile: { name: "Alex Rivera (synthetic)", sex: "male", age: 32, bodyMassKg: 72, heightCm: 178 },
  goals: { event: "10k", targetDistanceM: 10000, targetTimeSec: 38 * 60 + 30, raceDate: null, narrative: "Break 38:30 for 10k this autumn and stay healthy through the block." },
  history: { weeklyKm: 55, longestRunKm: 18, longestRunMin: 90, recentRace: { distanceM: 10000, timeSec: 40 * 60 + 30, daysAgo: 60 }, breakDays: 0, crossTrainedDuringBreak: false, strengthTrainingYears: 2 },
  health: { ...blankHealth },
  biomechanics: { footStrike: "rearfoot", cadenceSpm: 164, overstride: true, peakKneeFlexionDeg: 42, peakHipExtensionDeg: 8, verticalOscillation: "moderate", pelvicDrop: "marked", kneeValgus: false, crossover: false, heelWhip: false, notes: "Treadmill, 6 min acclimation at 15 km/h." },
  consent: { given: true, date: "2026-10-01", notes: "Synthetic demo athlete" },
  physical: { squatLoadKg: 100, squatReps: 5, imtpPeakForceN: 2300, cmjPeakForceN: 1500, cmjHeightCm: 36, broadJumpM: 2.3, sebtAsymmetryCm: 5, calfRaiseLeftReps: 22, calfRaiseRightReps: 18, nordicForceN: 330, notes: "" },
};

export const SYNTHETIC_SAM: RunnerAssessment = {
  profile: { name: "Sam Okafor (synthetic)", sex: "female", age: 28, bodyMassKg: 58, heightCm: 165 },
  goals: { event: "marathon", targetDistanceM: 42195, targetTimeSec: 3 * 3600 + 45 * 60, raceDate: null, narrative: "Run a first marathon under 3:45 without another stress injury." },
  history: { weeklyKm: 48, longestRunKm: 22, longestRunMin: 125, recentRace: { distanceM: 21097, timeSec: 1 * 3600 + 55 * 60, daysAgo: 45 }, breakDays: 21, crossTrainedDuringBreak: true, strengthTrainingYears: 0.5 },
  health: { ...blankHealth, painModifiedTraining: true, painSite: "tibia", menstrualIrregularity: true, bsiHistoryCount: 1 },
  biomechanics: { footStrike: "midfoot", cadenceSpm: 170, overstride: false, peakKneeFlexionDeg: 45, peakHipExtensionDeg: 10, verticalOscillation: "low", pelvicDrop: "mild", kneeValgus: true, crossover: false, heelWhip: false, notes: "" },
  consent: { given: true, date: "2026-10-01", notes: "Synthetic demo athlete" },
  physical: { squatLoadKg: 45, squatReps: 5, imtpPeakForceN: null, cmjPeakForceN: null, cmjHeightCm: 24, broadJumpM: 1.7, sebtAsymmetryCm: 2, calfRaiseLeftReps: 15, calfRaiseRightReps: 16, nordicForceN: null, notes: "" },
};
