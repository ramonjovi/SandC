import { round1 } from "../../core/util";

/** Daniels-Gilbert oxygen cost and %VO2max-sustained formulas (used by Daniels' VDOT tables). */
function vo2AtVelocity(vMetersPerMin: number): number {
  return -4.6 + 0.182258 * vMetersPerMin + 0.000104 * vMetersPerMin ** 2;
}
function fractionSustained(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

export function vdotFromRace(distanceM: number, timeSec: number): number {
  const tMin = timeSec / 60;
  const v = distanceM / tMin;
  return vo2AtVelocity(v) / fractionSustained(tMin);
}

/** Velocity (m/min) at which oxygen cost equals `vo2`. */
function velocityAtVo2(vo2: number): number {
  const a = 0.000104, b = 0.182258, c = -(4.6 + vo2);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Pace in seconds per km at a fraction of VDOT (e.g. 0.86). */
export function paceSecPerKm(vdot: number, fraction: number): number {
  const v = velocityAtVo2(vdot * fraction);
  return 60000 / v;
}

/** Predicted race time (s) for a distance at a given VDOT, by bisection. */
export function predictTimeSec(vdot: number, distanceM: number): number {
  let lo = distanceM / 10, hi = distanceM * 2; // seconds; generous bracket
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    // Faster time => higher VDOT. If implied vdot too high, time too fast => raise lo.
    if (vdotFromRace(distanceM, mid) > vdot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function fmtTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), rr = String(r).padStart(2, "0");
  return h ? `${h}:${mm}:${rr}` : `${mm}:${rr}`;
}
export function fmtPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
}

/** Detraining multipliers (KB Table 9.1 transcription). Rule running.vdot.break-adjustment: needs verification. */
const BREAK_TABLE: Array<[days: number, noCross: number, cross: number]> = [
  [5, 1.0, 1.0], [7, 0.994, 0.997], [14, 0.973, 0.986], [21, 0.952, 0.976],
  [28, 0.931, 0.965], [42, 0.889, 0.944], [56, 0.847, 0.923], [72, 0.8, 0.9],
];

export function breakMultiplier(days: number, crossTrained: boolean): number {
  const col = crossTrained ? 2 : 1;
  if (days <= BREAK_TABLE[0][0]) return 1;
  const last = BREAK_TABLE[BREAK_TABLE.length - 1];
  if (days >= last[0]) return last[col];
  for (let i = 1; i < BREAK_TABLE.length; i++) {
    const [d1, ...c1] = BREAK_TABLE[i];
    const [d0, ...c0] = BREAK_TABLE[i - 1];
    if (days <= d1) {
      const f = (days - d0) / (d1 - d0);
      return c0[col - 1] + f * (c1[col - 1] - c0[col - 1]);
    }
  }
  return 1;
}

export interface PaceZones {
  E: number; M: number; T: number; I: number; R: number;
}

/** Training pace zones (sec/km). Fractions are editable defaults (rule running.vdot.paces). */
export function paceZones(vdot: number): PaceZones {
  const I = paceSecPerKm(vdot, 0.975);
  // R is faster than I by ~6 s per 400 m (8 s when VDOT < 40): 15 s/km or 20 s/km.
  const rGap = (vdot < 40 ? 8 : 6) * 2.5;
  return {
    E: paceSecPerKm(vdot, 0.7),
    M: paceSecPerKm(vdot, 0.8),
    T: paceSecPerKm(vdot, 0.86),
    I,
    R: I - rGap,
  };
}

export const roundVdot = (v: number) => round1(v);
