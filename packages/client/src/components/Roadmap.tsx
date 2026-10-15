import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Alert, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress } from "./ui";
import { StatusBadge } from "./RuleBadge";
import { cn, formatTime } from "@/lib/utils";

const fmtVal = (metric: string, v: number | null, unit: string) =>
  v == null ? "—" : unit === "s" ? formatTime(v) : `${v}${unit && unit !== "ratio" ? " " + unit : ""}`;

/** Patient-facing Performance Roadmap: baseline, objectives, milestones, progress. `clinician` adds evidence badges. */
export function Roadmap({ roadmap, clinician = false }: { roadmap: any; clinician?: boolean }) {
  if (!roadmap) return <Alert>The roadmap appears here once your program has been approved.</Alert>;
  const pending = roadmap.programStatus === "draft";
  return (
    <div className="space-y-4">
      {pending && <Alert tone="warn">Draft roadmap: the program has not been approved yet.</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Where we're going</CardTitle>
          <CardDescription>{roadmap.goals?.narrative || "Goal"}{roadmap.goals?.targetTimeSec ? ` · ${roadmap.goals.event} in ${formatTime(roadmap.goals.targetTimeSec)}` : ""}{roadmap.goals?.raceDate ? ` · ${roadmap.goals.raceDate}` : ""}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div><div className="text-2xl font-semibold">{roadmap.currentWeek}</div><div className="text-xs text-muted-foreground">Current week</div></div>
          <div><div className="text-2xl font-semibold">{roadmap.adherence.completed}/{roadmap.adherence.planned}</div><div className="text-xs text-muted-foreground">Sessions done</div></div>
          <div><div className="text-2xl font-semibold">{roadmap.adherence.pct}%</div><div className="text-xs text-muted-foreground">Adherence</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Objectives: baseline → now → target</CardTitle>
          <CardDescription>Progress toward each measurable goal{roadmap.squatSource !== "assessment" ? " (squat strength estimated from your training log)" : ""}.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {roadmap.objectives.length === 0 && <p className="text-sm text-muted-foreground">No objectives yet.</p>}
          {roadmap.objectives.map((o: any) => (
            <div key={o.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">{o.label}</span>
                {clinician && <StatusBadge status={o.status} />}
              </div>
              <Progress value={o.progressPct ?? 0} />
              <div className="flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground">
                <span>Baseline {fmtVal(o.metric, o.baseline, o.unit)}</span>
                <span className="font-medium text-foreground">Now {fmtVal(o.metric, o.current, o.unit)}{o.progressPct != null ? ` (${o.progressPct}%)` : ""}</span>
                <span>Target {fmtVal(o.metric, o.target, o.unit)}</span>
              </div>
              {clinician && <p className="text-xs text-muted-foreground">{o.rationale}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {roadmap.milestones.map((m: any) => (
              <li key={m.id} className="flex gap-3">
                {m.status === "done" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : m.status === "current" ? <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                <div className={cn(m.status === "upcoming" && "text-muted-foreground")}>
                  <div className="text-sm font-medium">Week {m.week}: {m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {roadmap.weeklyLogs?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Weekly running volume</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {[...roadmap.weeklyLogs].reverse().slice(0, 8).map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{w.weekStart}</span>
                <span className="flex items-center gap-2">
                  {w.volumeFlag && !w.volumeFlag.ok && <Badge variant="warn">+{w.volumeFlag.increasePct}% vs prior week</Badge>}
                  {w.painModifiedTraining && <Badge variant="danger">pain modified training</Badge>}
                  <b>{w.runKm} km</b>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
