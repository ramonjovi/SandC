/**
 * Load-to-repetition relationship for endurance athletes (NSCA Developing Endurance 2nd ed., Table 6.3,
 * adapted from Thibaudeau 2006): [reps, % of 1RM]. Rule running.test.1rm-estimate.
 */
export const ENDURANCE_REP_TABLE: Array<[reps: number, pct: number]> = [
  [1, 100], [3, 95], [6, 90], [8, 85], [11, 80], [14, 75], [16, 70], [19, 65],
];

/** % of 1RM that can be lifted for `reps` repetitions (linear between table points, clamped at the ends). */
export function percentOf1RM(reps: number): number {
  const t = ENDURANCE_REP_TABLE;
  if (reps <= 1) return 100;
  if (reps >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    const [r1, p1] = t[i];
    if (reps <= r1) {
      const [r0, p0] = t[i - 1];
      return p0 + ((reps - r0) / (r1 - r0)) * (p1 - p0);
    }
  }
  return 100;
}

/** Estimated 1RM from a tested load and the reps achieved (reps = 1 returns the load). */
export function estimate1RM(loadKg: number, reps: number): number {
  return loadKg / (percentOf1RM(reps) / 100);
}
