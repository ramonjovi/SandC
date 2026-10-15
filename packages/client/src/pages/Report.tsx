import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { STRATEGY_LABEL, running, type Program } from "@tpc/engine";
import { Alert, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Trends } from "@/components/Trends";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { fmtDate, formatTime } from "@/lib/utils";

type Kind = "baseline" | "progress";

const ROWS: Array<{ k: string; label: string; unit?: string; time?: boolean; lowerBetter?: boolean }> = [
  { k: "vdot", label: "Running fitness (VDOT)" },
  { k: "goalPredictedTimeSec", label: "Predicted race time at current fitness", time: true, lowerBetter: true },
  { k: "squat1RM", label: "Estimated squat 1RM", unit: "kg" },
  { k: "squatRel", label: "Squat strength ÷ body mass", unit: "×" },
  { k: "cmjHeightCm", label: "Countermovement jump height", unit: "cm" },
  { k: "broadJumpM", label: "Standing broad jump", unit: "m" },
  { k: "rsi", label: "Pogo-hop reactive strength index" },
  { k: "calfRaiseAvg", label: "Single-leg calf raise (average)", unit: "reps" },
  { k: "calfRaiseAsymPct", label: "Calf raise left–right difference", unit: "%", lowerBetter: true },
  { k: "sebtAsymmetryCm", label: "Balance reach left–right difference", unit: "cm", lowerBetter: true },
  { k: "cadenceSpm", label: "Running cadence", unit: "spm" },
];

const STRATEGY_PLAIN: Record<string, string> = {
  high_load: "Your plan leads with heavy strength work, with light jumping and hopping alongside it.",
  plyometric: "Your plan emphasises springy, reactive work, with heavy lifts kept in so strength keeps building.",
  combined: "Your plan combines heavy strength work with jumping and hopping, the mix that gave the best results in research on runners.",
};

/** Print-ready report for the athlete (browser Print → Save as PDF). Leaves out screening answers and engine internals on purpose. */
export function ReportPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const athlete = useApi<any>(`/athletes/${id}`);
  const roadmap = useApi<any>(`/athletes/${id}/roadmap`);
  const [kind, setKind] = useState<Kind>("progress");
  const [inc, setInc] = useState({ results: true, video: true, objectives: true, charts: true, plan: true, log: true });
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const [by, setBy] = useState(user?.name ?? "");
  const baseline = kind === "baseline";
  const allA: any[] = athlete.data?.assessments ?? [];
  const baseA = allA.find((x) => x.kind === "baseline");
  const lastA = allA.length ? allA[allA.length - 1] : null;
  const imgBase = useApi<any[]>(baseA ? `/assessments/${baseA.id}/images` : null);
  const imgLast = useApi<any[]>(lastA && lastA.id !== baseA?.id ? `/assessments/${lastA.id}/images` : null);

  const program: Program | null = useMemo(() => {
    const ps = athlete.data?.programs ?? [];
    return (ps.find((p: any) => p.status === "approved") ?? ps.find((p: any) => p.status === "draft"))?.data ?? null;
  }, [athlete.data]);

  if (athlete.error || roadmap.error) return <Alert tone="danger">{(athlete.error ?? roadmap.error)!.message}</Alert>;
  if (!athlete.data || !roadmap.data) return <div className="text-sm text-muted-foreground">Loading...</div>;
  const rm = roadmap.data;
  const a = athlete.data.assessments.find((x: any) => x.kind === "baseline")?.data;
  const hasRetest = rm.series.assessments.length > 1;
  const base = rm.baselineMetrics, cur = rm.currentMetrics;
  const fmt = (r: (typeof ROWS)[number], v: unknown) => (v == null ? "—" : r.time ? formatTime(v as number) : `${v}${r.unit ? ` ${r.unit}` : ""}`);
  const change = (r: (typeof ROWS)[number]) => {
    const b = base[r.k], c = cur[r.k];
    if (typeof b !== "number" || typeof c !== "number" || b === c) return "";
    const d = Math.round((c - b) * 100) / 100;
    const good = r.lowerBetter ? d < 0 : d > 0;
    return `${d > 0 ? "+" : ""}${r.time ? formatTime(Math.abs(d)).replace(/^/, d < 0 ? "−" : "+") : d}${r.unit && !r.time ? ` ${r.unit}` : ""} ${good ? "▲ improved" : "▼"}`;
  };
  const shown = ROWS.filter((r) => base[r.k] != null || cur[r.k] != null);
  const title = baseline ? "Baseline report" : "Progress update";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-3 rounded-xl border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/c/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to case</Link>
          <Button className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / save as PDF</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Report type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}><option value="baseline">Baseline (where we are now)</option><option value="progress">Progress update</option></Select></div>
          <div><Label>Prepared by</Label><Input value={by} onChange={(e) => setBy(e.target.value)} /></div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1 text-sm">
            {([["results", "Test results"], ["video", "Running analysis (video)"], ["objectives", "Goals"], ["charts", "Trend charts"], ["plan", "The plan"], ["log", "Training log"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={inc[k]} onChange={(e) => setInc({ ...inc, [k]: e.target.checked })} />{l}</label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Notes from your clinician (printed)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div><Label>Next steps (printed)</Label><Textarea value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Screening answers, engine reasoning and clinician-only notes are never included. In the print dialog choose "Save as PDF" and turn off headers and footers.</p>
      </div>

      <article className="viz space-y-6 rounded-xl border bg-white p-6 print:border-0 print:p-0" style={{ color: "var(--viz-ink)" }}>
        <header className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--viz-ink2)" }}>TPC Performance · Running</div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <div className="text-sm" style={{ color: "var(--viz-ink2)" }}>{athlete.data.athlete.name}</div>
          </div>
          <div className="text-right text-sm" style={{ color: "var(--viz-ink2)" }}>
            <div>{fmtDate(new Date())}</div>
            {!baseline && <div>Program week {rm.currentWeek}</div>}
          </div>
        </header>

        <section className="break-inside-avoid">
          <h2 className="mb-1 text-base font-semibold">Your goal</h2>
          <p className="text-sm">{a?.goals?.narrative || "—"}{a?.goals?.targetTimeSec ? ` Target: ${a.goals.event} in ${formatTime(a.goals.targetTimeSec)}.` : ""}{a?.goals?.raceDate ? ` Race date: ${fmtDate(a.goals.raceDate)}.` : ""}</p>
        </section>

        {inc.results && (
          <section className="break-inside-avoid">
            <h2 className="mb-1 text-base font-semibold">{baseline || !hasRetest ? "Where you are now" : "Your results: baseline and latest test"}</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left" style={{ color: "var(--viz-ink2)" }}><th className="py-1 font-medium">Measure</th><th className="font-medium">Baseline</th>{!baseline && hasRetest && <><th className="font-medium">Latest</th><th className="font-medium">Change</th></>}</tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.k} className="border-b last:border-0">
                    <td className="py-1">{r.label}</td><td className="tabular-nums">{fmt(r, base[r.k])}</td>
                    {!baseline && hasRetest && <><td className="tabular-nums">{fmt(r, cur[r.k])}</td><td className="text-xs">{change(r)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!baseline && !hasRetest && <p className="mt-1 text-xs" style={{ color: "var(--viz-ink2)" }}>Your first retest will appear here next to these baseline numbers.</p>}
          </section>
        )}

        {inc.video && baseA && (
          <RunningAnalysis baseA={baseA} lastA={lastA} baseline={baseline} hasRetest={hasRetest} imgBase={imgBase.data ?? []} imgLast={imgLast.data ?? []} />
        )}

        {inc.objectives && rm.objectives.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-1 text-base font-semibold">Your goals for this block</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left" style={{ color: "var(--viz-ink2)" }}><th className="py-1 font-medium">Goal</th><th className="font-medium">Baseline</th>{!baseline && <th className="font-medium">Now</th>}<th className="font-medium">Target</th>{!baseline && <th className="font-medium">Progress</th>}</tr></thead>
              <tbody>
                {rm.objectives.map((o: any) => {
                  const f = (v: number | null) => (v == null ? "—" : o.unit === "s" ? formatTime(v) : `${v}${o.unit && o.unit !== "ratio" ? ` ${o.unit}` : ""}`);
                  return (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-1">{o.label}</td><td className="tabular-nums">{f(o.baseline)}</td>{!baseline && <td className="tabular-nums">{f(o.current)}</td>}<td className="tabular-nums">{f(o.target)}</td>
                      {!baseline && <td className="tabular-nums">{o.progressPct == null ? "—" : o.progressPct >= 100 ? "Target reached" : `${Math.max(0, o.progressPct)}%`}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {inc.charts && !baseline && <section><h2 className="mb-2 text-base font-semibold">Trends</h2><Trends roadmap={rm} /></section>}

        {inc.plan && program && (
          <section>
            <h2 className="mb-1 text-base font-semibold">Your plan</h2>
            <p className="text-sm">{STRATEGY_PLAIN[program.strategy.key] ?? STRATEGY_LABEL[program.strategy.key]} It runs for {program.durationWeeks} weeks, {program.sessionsPerWeek === 1 ? "one gym session" : program.sessionsPerWeek === 3 ? "three gym sessions" : "two gym sessions"} per week, with lighter "unload" weeks built in so your body can adapt.</p>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="border-b text-left" style={{ color: "var(--viz-ink2)" }}><th className="py-1 font-medium">Week</th><th className="font-medium">Phase</th><th className="font-medium">Focus</th></tr></thead>
              <tbody>{program.weeks.map((w) => <tr key={w.week} className="border-b last:border-0 break-inside-avoid"><td className="py-1">{w.week}</td><td>{w.phase}</td><td>{w.label}{w.isUnload ? " (lighter week)" : ""}</td></tr>)}</tbody>
            </table>
            {program.milestones.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{program.milestones.map((m) => <li key={m.id}><b>Week {m.week}: {m.label}.</b> {m.detail}</li>)}</ul>}
          </section>
        )}

        {inc.log && !baseline && (
          <section className="break-inside-avoid">
            <h2 className="mb-1 text-base font-semibold">Training log</h2>
            <p className="text-sm">Gym sessions completed: <b>{rm.adherence.completed} of {rm.adherence.planned}</b> ({rm.adherence.pct}%).</p>
          </section>
        )}

        {(notes || next) && (
          <section className="break-inside-avoid space-y-2 rounded-lg border p-3 text-sm">
            {notes && <div><b>Notes from your clinician</b><p className="whitespace-pre-wrap">{notes}</p></div>}
            {next && <div><b>Next steps</b><p className="whitespace-pre-wrap">{next}</p></div>}
          </section>
        )}

        <footer className="border-t pt-2 text-xs" style={{ color: "var(--viz-ink2)" }}>
          {by ? `Prepared by ${by}. ` : ""}This report supports your clinician's plan and is not a medical diagnosis. Strength and jump results are compared with your own baseline, not with population norms.
        </footer>
      </article>
    </div>
  );
}

const VIDEO_ROWS: Array<{ label: string; get: (a: any) => string | null }> = [
  { label: "Foot strike", get: (a) => a.biomechanics?.footStrike ?? null },
  { label: "Cadence", get: (a) => (a.biomechanics?.cadenceSpm != null ? `${a.biomechanics.cadenceSpm} steps/min` : null) },
  { label: "Foot lands ahead of the pelvis (overstride)", get: (a) => (a.biomechanics?.overstride == null ? null : a.biomechanics.overstride ? "Yes" : "No") },
  { label: "Peak knee bend in stance", get: (a) => (a.biomechanics?.peakKneeFlexionDeg != null ? `${a.biomechanics.peakKneeFlexionDeg}°` : null) },
  { label: "Peak hip extension", get: (a) => (a.biomechanics?.peakHipExtensionDeg != null ? `${a.biomechanics.peakHipExtensionDeg}°` : null) },
  { label: "Vertical bounce", get: (a) => a.biomechanics?.verticalOscillation ?? null },
  { label: "Pelvic drop", get: (a) => a.biomechanics?.pelvicDrop ?? null },
  { label: "Knee window closes", get: (a) => (a.biomechanics?.kneeValgus == null ? null : a.biomechanics.kneeValgus ? "Yes" : "No") },
  { label: "Feet cross the midline", get: (a) => (a.biomechanics?.crossover == null ? null : a.biomechanics.crossover ? "Yes" : "No") },
  { label: "Heel whip over about 5°", get: (a) => (a.biomechanics?.heelWhip == null ? null : a.biomechanics.heelWhip ? "Yes" : "No") },
];

/** Running-video observations table plus the saved frames with what each might mean. Hidden if there is nothing to show. */
function RunningAnalysis({ baseA, lastA, baseline, hasRetest, imgBase, imgLast }: { baseA: any; lastA: any; baseline: boolean; hasRetest: boolean; imgBase: any[]; imgLast: any[] }) {
  const compare = !baseline && hasRetest && lastA && lastA.id !== baseA.id;
  const latest = compare ? lastA : baseA;
  const rows = VIDEO_ROWS.filter((r) => r.get(baseA.data) != null || r.get(latest.data) != null);
  const shownImgs = compare ? [...imgBase, ...imgLast] : imgBase;
  const phases = running.ANALYSIS_PHASES.filter((p) => shownImgs.some((i) => i.phase === p.id));
  if (rows.length === 0 && phases.length === 0) return null;
  const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Your running analysis (from video)</h2>
      {rows.length > 0 && (
        <table className="w-full break-inside-avoid text-sm">
          <thead><tr className="border-b text-left" style={{ color: "var(--viz-ink2)" }}><th className="py-1 font-medium">What we looked at</th><th className="font-medium">{compare ? "Baseline" : "Result"}</th>{compare && <th className="font-medium">Latest</th>}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label} className="border-b last:border-0"><td className="py-1">{r.label}</td><td>{cap(r.get(baseA.data))}</td>{compare && <td>{cap(r.get(latest.data))}</td>}</tr>)}</tbody>
        </table>
      )}
      {phases.map((p) => {
        const b = imgBase.filter((i) => i.phase === p.id);
        const l = compare ? imgLast.filter((i) => i.phase === p.id) : [];
        const text = [...l, ...b].find((i) => i.discussion)?.discussion;
        const finding = p.finding(latest.data);
        return (
          <figure key={p.id} className="break-inside-avoid space-y-2 rounded-lg border p-3 text-sm">
            <figcaption className="font-medium">{p.reportTitle}</figcaption>
            <div className={cn("grid gap-3", compare && l.length && b.length ? "grid-cols-2" : "grid-cols-1")}>
              {[...(compare && b.length ? [{ label: "Baseline", imgs: b }] : [{ label: "", imgs: b }]), ...(l.length ? [{ label: "Latest", imgs: l }] : [])]
                .filter((g) => g.imgs.length)
                .map((g) => (
                  <div key={g.label || "one"} className="space-y-1">
                    {g.label && <div className="text-xs font-medium" style={{ color: "var(--viz-ink2)" }}>{g.label}</div>}
                    {g.imgs.map((i) => (
                      <div key={i.id}>
                        <img src={`/api/images/${i.id}/file`} alt={i.caption || p.label} className="max-h-72 w-auto rounded border" />
                        {(i.caption || i.measure) && <div className="mt-0.5 text-xs" style={{ color: "var(--viz-ink2)" }}>{[i.caption, i.measure].filter(Boolean).join(" · ")}</div>}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
            {finding && <div><b>What we saw:</b> {finding}.</div>}
            {text && <div><b>What this might mean:</b> {text}</div>}
          </figure>
        );
      })}
      <p className="text-xs" style={{ color: "var(--viz-ink2)" }}>These are observations from video, not a diagnosis. No measurement from running video has been shown to predict injury on its own, so each point is read together with your symptoms, strength tests and training.</p>
    </section>
  );
}
