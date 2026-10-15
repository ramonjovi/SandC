export type TrainingTier = "novice" | "intermediate" | "experienced";

/** Strength-training experience tier. Unknown experience is treated conservatively as novice. */
export function trainingTier(years: number | null | undefined): TrainingTier {
  if (years == null || years < 1) return "novice";
  return years < 3 ? "intermediate" : "experienced";
}

export const TIER_LIMITS: Record<TrainingTier, { maxSets: number; contactCap: number; lowLevelPlyoOnly: boolean }> = {
  novice: { maxSets: 3, contactCap: 50, lowLevelPlyoOnly: true },
  intermediate: { maxSets: 4, contactCap: 80, lowLevelPlyoOnly: false },
  experienced: { maxSets: 4, contactCap: 100, lowLevelPlyoOnly: false },
};
