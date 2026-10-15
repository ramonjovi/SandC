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
  const [inc, setInc] = useState({ results: true, video: true, objectives: true, charts: true, plan: true, exercises: true, log: true });
  const [summary, setSummary] = useState("");
  const [interp, setInterp] = useState("");
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
  const vctx = baseA ? videoCtx(baseA, lastA, baseline, hasRetest, imgBase.data ?? [], imgLast.data ?? []) : null;
  const videoRows = inc.video && vctx ? vctx.rows.length > 0 : false;
  const videoFrames = inc.video && vctx ? vctx.phases.length > 0 : false;
  const showData = (inc.results && shown.length > 0) || videoRows;
  const showInterp = videoFrames || interp.trim().length > 0;
  const showProgress = !baseline && (inc.charts || inc.log);
  const showPlan = (inc.plan && !!program) || (inc.objectives && rm.objectives.length > 0);
  let partNo = 0;
  const nData = showData ? ++partNo : 0;
  const nInterp = showInterp ? ++partNo : 0;
  const nPlan = showPlan ? ++partNo : 0;
  const nProgress = showProgress ? ++partNo : 0;
  const contents = [{ n: nData, t: "Data & results" }, { n: nInterp, t: "Interpretation" }, { n: nPlan, t: "Suggested plan" }, { n: nProgress, t: "Progress" }].filter((c) => c.n);
  const tileKeys = ["vdot", "squat1RM", "cmjHeightCm", "calfRaiseAvg"];
  const tiles = tileKeys.map((k) => ROWS.find((r) => r.k === k)!).filter((r) => (hasRetest && !baseline ? cur[r.k] : base[r.k]) != null).map((r) => {
    const v = hasRetest && !baseline ? cur[r.k] : base[r.k];
    const d = hasRetest && !baseline ? change(r) : "";
    return { k: r.k, label: r.label, value: fmt(r, v), delta: d, good: d.includes("improved") };
  });

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
            {([["results", "Test results"], ["video", "Running analysis (video)"], ["objectives", "Goals"], ["charts", "Trend charts"], ["plan", "The plan"], ["exercises", "Week 1 exercises"], ["log", "Training log"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={inc[k]} onChange={(e) => setInc({ ...inc, [k]: e.target.checked })} />{l}</label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Summary at a glance (printed at the top)</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="2-4 plain sentences: what we found and what we will do." /></div>
          <div><Label>Interpretation (printed under Interpretation)</Label><Textarea value={interp} onChange={(e) => setInterp(e.target.value)} placeholder="What the results and video mean for this athlete, in plain language." /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Notes from your clinician (printed)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div><Label>Next steps (printed)</Label><Textarea value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Screening answers, engine reasoning and clinician-only notes are never included. In the print dialog choose "Save as PDF" and turn off headers and footers.</p>
      </div>

      <article className="viz space-y-6 rounded-xl border bg-white p-8 print:rounded-none print:border-0 print:p-0" style={{ color: "var(--viz-ink)" }}>
        <header className="flex items-end justify-between gap-4 border-b-4 pb-4" style={{ borderColor: "var(--viz-brand)" }}>
          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--viz-brand)" }}>TPC Performance · Running</div>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">{title}</h1>
            <div className="mt-0.5 text-base" style={{ color: "var(--viz-ink2)" }}>{athlete.data.athlete.name}</div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-xs" style={{ color: "var(--viz-ink2)" }}>
            <dt>Date</dt><dd className="font-medium" style={{ color: "var(--viz-ink)" }}>{fmtDate(new Date())}</dd>
            {!baseline && <><dt>Program week</dt><dd className="font-medium" style={{ color: "var(--viz-ink)" }}>{rm.currentWeek}</dd></>}
            {by && <><dt>Prepared by</dt><dd className="font-medium" style={{ color: "var(--viz-ink)" }}>{by}</dd></>}
          </dl>
        </header>

        {contents.length > 0 && (
          <nav className="flex flex-wrap gap-2 text-xs" aria-label="Report contents">
            {contents.map((c) => <span key={c.n} className="rounded-full border px-2.5 py-0.5" style={{ borderColor: "var(--viz-brand)", color: "var(--viz-brand)" }}><b>{c.n}</b> {c.t}</span>)}
          </nav>
        )}

        {summary.trim() && (
          <section className="break-inside-avoid rounded-lg border-l-4 p-4 text-sm leading-relaxed" style={{ borderColor: "var(--viz-brand)", background: "var(--viz-brand-soft)" }}>
            <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-brand)" }}>At a glance</div>
            <p className="whitespace-pre-wrap">{summary}</p>
          </section>
        )}

        <section className="break-inside-avoid rounded-lg p-4" style={{ background: "var(--viz-tint)" }}>
          <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-ink2)" }}>Your goal</div>
          <p className="text-sm leading-relaxed">{a?.goals?.narrative || "—"}{a?.goals?.targetTimeSec ? ` Target: ${a.goals.event} in ${formatTime(a.goals.targetTimeSec)}.` : ""}{a?.goals?.raceDate ? ` Race date: ${fmtDate(a.goals.raceDate)}.` : ""}</p>
        </section>

        {showData && (
          <div className="space-y-4">
            <PartHeading n={nData} title="Data & results" sub="What we measured" />
            {inc.results && tiles.length > 0 && (
              <div className="grid break-inside-avoid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map((t) => (
                  <div key={t.k} className="rounded-lg border p-3" style={{ borderColor: "var(--viz-line)" }}>
                    <div className="text-[0.6875rem] uppercase tracking-wide" style={{ color: "var(--viz-ink2)" }}>{t.label}</div>
                    <div className="mt-0.5 text-xl font-semibold tabular-nums">{t.value}</div>
                    {t.delta && <div className="text-xs font-medium" style={{ color: t.good ? "var(--viz-good)" : "var(--viz-ink2)" }}>{t.delta}</div>}
                  </div>
                ))}
              </div>
            )}
            {inc.results && shown.length > 0 && (
              <section className="break-inside-avoid">
                <h3 className="mb-1 text-sm font-semibold">{baseline || !hasRetest ? "Test results" : "Test results: baseline and latest"}</h3>
                <table className="report-table">
                  <thead><tr><th>Measure</th><th className="num">Baseline</th>{!baseline && hasRetest && <><th className="num">Latest</th><th>Change</th></>}</tr></thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.k}>
                        <td>{r.label}</td><td className="num">{fmt(r, base[r.k])}</td>
                        {!baseline && hasRetest && <><td className="num">{fmt(r, cur[r.k])}</td><td className="text-xs">{change(r)}</td></>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!baseline && !hasRetest && <p className="mt-1 text-xs" style={{ color: "var(--viz-ink2)" }}>Your first retest will appear here next to these baseline numbers.</p>}
              </section>
            )}
            {videoRows && vctx && (
              <section className="break-inside-avoid">
                <h3 className="mb-1 text-sm font-semibold">Running video observations</h3>
                <table className="report-table">
                  <thead><tr><th>What we looked at</th><th>{vctx.compare ? "Baseline" : "Result"}</th>{vctx.compare && <th>Latest</th>}</tr></thead>
                  <tbody>{vctx.rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{cap(r.get(baseA.data))}</td>{vctx.compare && <td>{cap(r.get(vctx.latest.data))}</td>}</tr>)}</tbody>
                </table>
                {!videoFrames && <p className="mt-1 text-xs" style={{ color: "var(--viz-ink2)" }}>{VIDEO_NOTE}</p>}
              </section>
            )}
          </div>
        )}

        {showInterp && (
          <div className="space-y-4">
            <PartHeading n={nInterp} title="Interpretation" sub="What it might mean" />
            {interp.trim() && <p className="whitespace-pre-wrap text-sm leading-relaxed">{interp}</p>}
            {videoFrames && vctx && <RunningFrames ctx={vctx} imgBase={imgBase.data ?? []} imgLast={imgLast.data ?? []} />}
          </div>
        )}

        {showPlan && (
          <div className="space-y-4">
            <PartHeading n={nPlan} title="Suggested plan" sub="What we will do next" />
            {inc.objectives && rm.objectives.length > 0 && (
              <section className="break-inside-avoid">
                <h3 className="mb-1 text-sm font-semibold">Your goals for this block</h3>
                <table className="report-table">
                  <thead><tr><th>Goal</th><th className="num">Baseline</th>{!baseline && <th className="num">Now</th>}<th className="num">Target</th>{!baseline && <th className="num">Progress</th>}</tr></thead>
                  <tbody>
                    {rm.objectives.map((o: any) => {
                      const f = (v: number | null) => (v == null ? "—" : o.unit === "s" ? formatTime(v) : `${v}${o.unit && o.unit !== "ratio" ? ` ${o.unit}` : ""}`);
                      return (
                        <tr key={o.id}>
                          <td>{o.label}</td><td className="num">{f(o.baseline)}</td>{!baseline && <td className="num">{f(o.current)}</td>}<td className="num">{f(o.target)}</td>
                          {!baseline && <td className="num">{o.progressPct == null ? "—" : o.progressPct >= 100 ? "Target reached" : `${Math.max(0, o.progressPct)}%`}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
            {inc.plan && program && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">The gym plan</h3>
                <p className="text-sm leading-relaxed">{STRATEGY_PLAIN[program.strategy.key] ?? STRATEGY_LABEL[program.strategy.key]} It runs for {program.durationWeeks} weeks, {program.sessionsPerWeek === 1 ? "one gym session" : program.sessionsPerWeek === 3 ? "three gym sessions" : "two gym sessions"} per week, with lighter "unload" weeks built in so your body can adapt.</p>
                {inc.exercises && program.weeks[0] && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {program.weeks[0].sessions.map((sess) => (
                      <div key={sess.id} className="break-inside-avoid rounded-lg border p-3" style={{ borderColor: "var(--viz-line)" }}>
                        <div className="mb-1 text-sm font-semibold" style={{ color: "var(--viz-brand)" }}>Week 1 · {sess.name}</div>
                        {sess.focus && <div className="mb-1 text-xs" style={{ color: "var(--viz-ink2)" }}>{sess.focus}</div>}
                        <table className="report-table">
                          <thead><tr><th>Exercise</th><th className="num">Sets × reps</th><th className="num">Load</th></tr></thead>
                          <tbody>{sess.exercises.map((e) => <tr key={e.id}><td>{e.name}</td><td className="num">{exDose(e)}</td><td className="num">{e.loadKg != null ? `${e.loadKg} kg` : "BW"}</td></tr>)}</tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
                {inc.exercises && program.weeks[0] && <p className="text-xs" style={{ color: "var(--viz-ink2)" }}>BW = bodyweight or load set in your first session. Reps or load go up a little each week, and loads are confirmed together in your first session.</p>}
                <table className="report-table">
                  <thead><tr><th>Week</th><th>Phase</th><th>Focus</th></tr></thead>
                  <tbody>{program.weeks.map((w) => <tr key={w.week}><td>{w.week}</td><td>{w.phase}</td><td>{w.label}{w.isUnload ? " (lighter week)" : ""}</td></tr>)}</tbody>
                </table>
                {program.milestones.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm">{program.milestones.map((m) => <li key={m.id}><b>Week {m.week}: {m.label}.</b> {m.detail}</li>)}</ul>}
              </section>
            )}
          </div>
        )}

        {showProgress && (
          <div className="space-y-4">
            <PartHeading n={nProgress} title="Progress" sub="How you are tracking" />
            {inc.charts && <section><Trends roadmap={rm} /></section>}
            {inc.log && (
              <section className="break-inside-avoid rounded-lg p-4 text-sm" style={{ background: "var(--viz-tint)" }}>
                <span className="font-semibold">Training log: </span>gym sessions completed <b>{rm.adherence.completed} of {rm.adherence.planned}</b> ({rm.adherence.pct}%).
              </section>
            )}
          </div>
        )}

        {(notes || next) && (
          <section className="break-inside-avoid space-y-3 rounded-lg border-2 p-4 text-sm leading-relaxed" style={{ borderColor: "var(--viz-brand)" }}>
            {notes && <div><div className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-brand)" }}>Notes from your clinician</div><p className="whitespace-pre-wrap">{notes}</p></div>}
            {next && <div><div className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-brand)" }}>Next steps</div><p className="whitespace-pre-wrap">{next}</p></div>}
          </section>
        )}

        <footer className="flex items-start justify-between gap-4 border-t pt-3 text-xs" style={{ color: "var(--viz-ink2)", borderColor: "var(--viz-line)" }}>
          <span>{by ? `Prepared by ${by}. ` : ""}This report supports your clinician's plan and is not a medical diagnosis. Strength and jump results are compared with your own baseline, not with population norms.</span>
          <span className="shrink-0 font-semibold" style={{ color: "var(--viz-brand)" }}>TPC Performance</span>
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

const VIDEO_NOTE = "These are observations from video, not a diagnosis. No measurement from running video has been shown to predict injury on its own, so each point is read together with your symptoms, strength tests and training.";
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");

/** Which video rows and phases have something to show, and which assessment is "latest". */
function videoCtx(baseA: any, lastA: any, baseline: boolean, hasRetest: boolean, imgBase: any[], imgLast: any[]) {
  const compare = !baseline && hasRetest && !!lastA && lastA.id !== baseA.id;
  const latest = compare ? lastA : baseA;
  const rows = VIDEO_ROWS.filter((r) => r.get(baseA.data) != null || r.get(latest.data) != null);
  const shownImgs = compare ? [...imgBase, ...imgLast] : imgBase;
  const phases = running.ANALYSIS_PHASES.filter((p) => shownImgs.some((i) => i.phase === p.id));
  return { compare, latest, rows, phases };
}

/** Numbered part heading: a filled number badge and a rule. Colours are kept when printed. */
function PartHeading({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex break-after-avoid items-center gap-3 border-b pb-2 pt-3" style={{ borderColor: "var(--viz-brand)" }}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: "var(--viz-brand)" }}>{n}</span>
      <div className="leading-tight">
        <h2 className="text-lg font-semibold uppercase tracking-wide">{title}</h2>
        <div className="text-xs" style={{ color: "var(--viz-ink2)" }}>{sub}</div>
      </div>
    </div>
  );
}

/** "3 x 8 each side" style dose for the printed exercise table. */
function exDose(e: { sets: number; reps: number; unit: string; perSide: boolean }) {
  const unit = e.unit === "sec" ? " s" : e.unit === "contacts" ? " contacts" : "";
  return `${e.sets} × ${e.reps}${unit}${e.perSide ? " each side" : ""}`;
}

/** Saved video frames: pictures on the left, what we saw and what it might mean on the right. */
function RunningFrames({ ctx, imgBase, imgLast }: { ctx: ReturnType<typeof videoCtx>; imgBase: any[]; imgLast: any[] }) {
  const { compare, latest, phases } = ctx;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Your running analysis (from video)</h3>
      {phases.map((p) => {
        const b = imgBase.filter((i) => i.phase === p.id);
        const l = compare ? imgLast.filter((i) => i.phase === p.id) : [];
        const text = [...l, ...b].find((i) => i.discussion)?.discussion;
        const finding = p.finding(latest.data);
        const groups = [...(compare && b.length ? [{ label: "Baseline", imgs: b }] : [{ label: "", imgs: b }]), ...(l.length ? [{ label: "Latest", imgs: l }] : [])].filter((g) => g.imgs.length);
        return (
          <figure key={p.id} className="grid break-inside-avoid gap-4 rounded-lg border p-3 text-sm sm:grid-cols-[auto_1fr]" style={{ borderColor: "var(--viz-line)" }}>
            <div className="flex flex-wrap gap-3">
              {groups.map((g) => (
                <div key={g.label || "one"} className="space-y-1">
                  {g.label && <div className="text-xs font-medium" style={{ color: "var(--viz-ink2)" }}>{g.label}</div>}
                  <div className="flex gap-2">
                    {g.imgs.map((i) => (
                      <div key={i.id} className="max-w-[9.5rem]">
                        <img src={`/api/images/${i.id}/file`} alt={i.caption || p.label} className="max-h-52 w-auto rounded border" />
                        {i.measure && <div className="mt-0.5 text-xs font-medium" style={{ color: "var(--viz-brand)" }}>{i.measure}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 leading-relaxed">
              <figcaption className="font-semibold" style={{ color: "var(--viz-brand)" }}>{p.reportTitle}</figcaption>
              {finding && <div><b>What we saw:</b> {finding}.</div>}
              {text && <div><b>What this might mean:</b> {text}</div>}
            </div>
          </figure>
        );
      })}
      <p className="text-xs" style={{ color: "var(--viz-ink2)" }}>{VIDEO_NOTE}</p>
    </section>
  );
}
