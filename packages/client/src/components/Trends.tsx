import { BarChart, LineChart, type Series } from "./charts";
import { formatTime } from "@/lib/utils";

const ms = (s: string) => new Date(s).getTime();

/** Trend charts built from the roadmap's time series (assessments, training-log loads, weekly running volume). */
export function Trends({ roadmap }: { roadmap: any }) {
  const series = roadmap?.series;
  if (!series) return null;
  const charts: React.ReactNode[] = [];

  for (const o of roadmap.objectives ?? []) {
    const test: Series = {
      name: o.id === "squat1RM" ? "Squat test" : o.label, slot: 1,
      points: series.assessments.map((a: any) => ({ x: ms(a.at), y: a.metrics[o.metric] })).filter((p: any) => typeof p.y === "number"),
    };
    const lines: Series[] = [test];
    if (o.id === "squat1RM") {
      const fromLog = series.sessionLoads.filter((l: any) => l.exerciseId === "back_squat" && l.e1rm != null).map((l: any) => ({ x: ms(l.at), y: l.e1rm }));
      if (fromLog.length) lines.push({ name: "Estimated from training log", slot: 2, points: fromLog });
    }
    if (!lines.some((l) => l.points.length)) continue;
    const isTime = o.unit === "s";
    const fmt = (v: number) => (isTime ? formatTime(v) : String(Math.round(v * 100) / 100));
    const single = lines.every((l) => l.points.length <= 1);
    charts.push(
      <LineChart key={o.id} title={o.label}
        subtitle={`${o.lowerIsBetter ? "Lower is better. " : ""}Baseline ${o.baseline != null ? fmt(o.baseline) : "—"} → target ${o.target != null ? fmt(o.target) : "—"}${o.unit && !isTime ? ` ${o.unit}` : ""}${single ? ". Retest to see the trend." : ""}`}
        series={lines} target={o.target != null ? { y: o.target, label: "Target" } : null} format={fmt} unit={isTime ? "" : o.unit} />,
    );
  }

  const loads = (id: string, name: string, slot: 1 | 2): Series => ({
    name, slot, points: series.sessionLoads.filter((l: any) => l.exerciseId === id).map((l: any) => ({ x: ms(l.at), y: l.topLoadKg })),
  });
  const lift = [loads("back_squat", "Back squat", 1), loads("trap_bar_deadlift", "Trap bar deadlift", 2)].filter((s) => s.points.length);
  if (lift.length) charts.push(<LineChart key="loads" title="Heaviest set per session" subtitle="Training log, kg" series={lift} unit="kg" />);

  if (series.weeklyKm.length) {
    charts.push(
      <BarChart key="km" title="Weekly running volume" subtitle="Kilometres per week. A rise of more than 10% on the previous week is marked."
        bars={series.weeklyKm.map((w: any) => ({ label: w.weekStart.slice(5), value: w.runKm, note: w.volumeFlag && !w.volumeFlag.ok ? `+${w.volumeFlag.increasePct}%` : undefined }))} unit="km" />,
    );
  }
  if (charts.length === 0) return <p className="text-sm text-muted-foreground">Trend charts appear once there is data to plot.</p>;
  return <div className="viz grid gap-6 lg:grid-cols-2">{charts}</div>;
}
