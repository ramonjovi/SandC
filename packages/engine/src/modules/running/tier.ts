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

import type { Params } from "../../core/params";

/** Tier limits with clinician overrides applied (rules running.strength.training-age and running.plyo.contacts). */
export function tierLimits(p: Params): Record<TrainingTier, { maxSets: number; contactCap: number; lowLevelPlyoOnly: boolean }> {
  const adv = p.get("running.strength.training-age", "advancedMaxSets");
  return {
    novice: { maxSets: p.get("running.strength.training-age", "noviceMaxSets"), contactCap: p.get("running.plyo.contacts", "novice"), lowLevelPlyoOnly: true },
    intermediate: { maxSets: adv, contactCap: p.get("running.plyo.contacts", "intermediate"), lowLevelPlyoOnly: false },
    experienced: { maxSets: adv, contactCap: p.get("running.plyo.contacts", "experienced"), lowLevelPlyoOnly: false },
  };
}
