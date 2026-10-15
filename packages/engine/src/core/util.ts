export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const roundTo = (n: number, step: number) => Math.round(n / step) * step;
/** Plate-friendly rounding used for barbell/dumbbell loads. */
export const roundLoad = (kg: number) => roundTo(kg, 2.5);

/** Epley estimate of 1RM from a load lifted for `reps` reps (reps=1 returns the load). */
export function epley1RM(loadKg: number, reps: number): number {
  if (reps <= 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
