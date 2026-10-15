import type { Objective } from "./types";

export interface ObjectiveProgress extends Objective {
  current: number | null;
  /** 0-100+ progress from baseline toward target; null if not measurable. */
  progressPct: number | null;
}

/** Progress of each objective from baseline to target using the latest metrics. */
export function objectiveProgress(objectives: Objective[], current: Record<string, number | string | null>): ObjectiveProgress[] {
  return objectives.map((o) => {
    const raw = current[o.metric];
    const cur = typeof raw === "number" ? raw : null;
    let pct: number | null = null;
    if (cur != null && o.baseline != null && o.target != null && o.target !== o.baseline) {
      pct = Math.round(((cur - o.baseline) / (o.target - o.baseline)) * 100);
    }
    return { ...o, current: cur, progressPct: pct };
  });
}

export function adherence(planned: number, completed: number) {
  return planned === 0 ? 0 : Math.round((completed / planned) * 100);
}
