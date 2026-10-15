import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { STRATEGY_LABEL, running, type Program } from "@tpc/engine";
import { Alert, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { Trends } from "@/components/Trends";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useMeta } from "@/lib/meta";
import { fmtDate, formatTime } from "@/lib/utils";

/** "baseline" = first visit: results and proposed plan. "progress" = a later update with retest comparisons and charts. */
type Kind = "baseline" | "progress";

const ROWS: Array<{ k: string; label: string; hint: string; unit?: string; time?: boolean; lowerBetter?: boolean }> = [
  { k: "vdot", label: "Running fitness (VDOT)", hint: "A score worked out from your recent race. Higher means fitter." },
  { k: "goalPredictedTimeSec", label: "Predicted race time at current fitness", hint: "An estimate for your goal distance. It assumes you have trained for that distance.", time: true, lowerBetter: true },
  { k: "squat1RM", label: "Estimated squat 1RM", hint: "The heaviest squat you could lift once, estimated from your test.", unit: "kg" },
  { k: "squatRel", label: "Squat strength ÷ body mass", hint: "Your maximum squat divided by your body weight.", unit: "×" },
  { k: "cmjHeightCm", label: "Countermovement jump height", hint: "How high you jump. A simple measure of leg power.", unit: "cm" },
  { k: "broadJumpM", label: "Standing broad jump", hint: "How far you can jump from standing.", unit: "m" },
  { k: "rsi", label: "Pogo-hop reactive strength index", hint: "How quickly your ankles rebound. Higher is springier." },
  { k: "calfRaiseAvg", label: "Single-leg calf raise (average)", hint: "Heel raises on one leg, averaged over both legs.", unit: "reps" },
  { k: "calfRaiseAsymPct", label: "Calf raise left–right difference", hint: "How much weaker one side is than the other.", unit: "%", lowerBetter: true },
  { k: "sebtAsymmetryCm", label: "Balance reach left–right difference", hint: "From a reaching balance test. Smaller is more even.", unit: "cm", lowerBetter: true },
  { k: "cadenceSpm", label: "Running cadence", hint: "Steps per minute on the treadmill.", unit: "spm" },
];

const STRATEGY_PLAIN: Record<string, string> = {
  high_load: "Your plan leads with heavy strength work, with light jumping and hopping alongside it.",
  plyometric: "Your plan emphasises springy, reactive work, with heavy lifts kept in so strength keeps building.",
  combined: "Your plan combines heavy strength work with jumping and hopping, the mix that gave the best results in research on runners.",
};

const PHASE_PLAIN: Record<string, string> = { Accumulation: "Build", Transmutation: "Strong and springy", Foundation: "Learn the lifts", Build: "Build", Taper: "Taper" };

const weekTile = (w: { label: string; isUnload: boolean }) => {
  if (w.label === "Race week") return "Race week";
  if (w.label === "Taper") return "Taper";
  if (w.isUnload) return "Lighter week + check-in";
  return w.label.replace(/^Load (\d)( \(peak\))?/, (_m, n, p) => `Build ${n}${p ? " (hardest)" : ""}`);
};

const plainMilestone = (m: { week: number; label: string }, event: string): string => {
  if (/race/i.test(m.label)) return `Race day: ${event}`;
  if (/taper/i.test(m.label)) return "Taper begins: less gym volume, same effort";
  if (/unload|mid-block/i.test(m.label)) return "Check-in: an easier week, then we repeat your key tests";
  if (/end-of-block/i.test(m.label)) return "Full retest: we compare with today and plan the next block";
  return "Start: we confirm your starting weights in your first session";
};

const lines = (s: string) => s.split("\n").map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/** Print-ready report for the athlete (browser Print → Save as PDF). Leaves out screening answers and engine internals on purpose. */
export function ReportPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const athlete = useApi<any>(`/athletes/${id}`);
  const roadmap = useApi<any>(`/athletes/${id}/roadmap`);
  const [kind, setKind] = useState<Kind>("baseline");
  const [inc, setInc] = useState({ results: true, video: true, objectives: true, charts: true, plan: true, exercises: true, log: true });
  const [summary, setSummary] = useState("");
  const [going, setGoing] = useState("");
  const [focus, setFocus] = useState("");
  const [interp, setInterp] = useState("");
  const [notes, setNotes] = useState("");
  const [noteEdit, setNoteEdit] = useState<Record<string, string>>({});
  const [next, setNext] = useState("");
  const [by, setBy] = useState(user?.name ?? "");
  const { modules } = useMeta();
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
  const compareMode = !baseline && hasRetest;
  const fmt = (r: (typeof ROWS)[number], v: unknown) => (v == null ? "—" : r.time ? formatTime(v as number) : `${v}${r.unit ? ` ${r.unit}` : ""}`);
  const change = (r: (typeof ROWS)[number]) => {
    const b = base[r.k], c = cur[r.k];
    if (typeof b !== "number" || typeof c !== "number" || b === c) return "";
    const d = Math.round((c - b) * 100) / 100;
    const good = r.lowerBetter ? d < 0 : d > 0;
    return `${d > 0 ? "+" : ""}${r.time ? formatTime(Math.abs(d)).replace(/^/, d < 0 ? "−" : "+") : d}${r.unit && !r.time ? ` ${r.unit}` : ""} ${good ? "▲ improved" : "▼"}`;
  };
  const shown = ROWS.filter((r) => base[r.k] != null || cur[r.k] != null);
  const title = baseline ? "Your results and proposed plan" : "Progress update";
  const vctx = baseA ? videoCtx(baseA, lastA, baseline, hasRetest, imgBase.data ?? [], imgLast.data ?? []) : null;
  const videoRows = inc.video && vctx ? vctx.rows.length > 0 : false;
  const videoFrames = inc.video && vctx ? vctx.phases.length > 0 : false;
  const sideData = (compareMode ? lastA : baseA)?.data;
  const sideRows = sideData ? buildSideRows(sideData) : [];
  const prioLabels: Record<string, string> = Object.fromEntries(((modules[0] as any)?.priorities ?? []).map((p: any) => [p.key, p.label]));
  const prioKeys: string[] = baseA?.pt?.data?.priorityKeys ?? [];
  const priorities = prioKeys.map((k) => prioLabels[k]).filter(Boolean);
  const reason = (a?.visit?.reason ?? "").trim();
  const otherFindings = lines(sideData?.visit?.otherFindings ?? a?.visit?.otherFindings ?? "");
  const showData = (inc.results && shown.length > 0) || videoRows;
  const showInterp = videoFrames || interp.trim().length > 0 || sideRows.length > 0 || otherFindings.length > 0;
  const showProgress = !baseline && (inc.charts || inc.log);
  const goalObj = rm.objectives.find((o: any) => o.id === "goal");
  const objRows = rm.objectives.filter((o: any) => !(baseline && o.id === "goal"));
  const showPlan = (inc.plan && !!program) || (inc.objectives && rm.objectives.length > 0);
  let partNo = 0;
  const nData = showData ? ++partNo : 0;
  const nInterp = showInterp ? ++partNo : 0;
  const nPlan = showPlan ? ++partNo : 0;
  const nProgress = showProgress ? ++partNo : 0;
  const contents = [{ n: nData, t: "Your results" }, { n: nInterp, t: "What it means" }, { n: nPlan, t: "Your plan" }, { n: nProgress, t: "Progress" }].filter((c) => c.n);
  const tileKeys = ["vdot", "squat1RM", "cmjHeightCm", "calfRaiseAvg"];
  const tiles = tileKeys.map((k) => ROWS.find((r) => r.k === k)!).filter((r) => (compareMode ? cur[r.k] : base[r.k]) != null).map((r) => {
    const v = compareMode ? cur[r.k] : base[r.k];
    const d = compareMode ? change(r) : "";
    return { k: r.k, label: r.label.replace(/ \(.*\)$/, ""), value: fmt(r, v), delta: d, good: d.includes("improved") };
  });
  const goingList = lines(going), focusList = lines(focus);
  const phys = a?.physical ?? {};
  const autoNote = (k: string): string => {
    const v = base[k];
    switch (k) {
      case "vdot": return "A fitness score worked out from your recent race. It sets your training paces and predicts race times.";
      case "goalPredictedTimeSec": return goalObj && goalObj.baseline != null && goalObj.target != null
        ? (goalObj.baseline <= goalObj.target ? "Faster than your goal time, so fitness is not the limit. Staying healthy and building distance matter more." : "Slower than your goal time, so your running training needs to close the gap.")
        : "An estimate for your goal distance, assuming you have trained for it.";
      case "squat1RM": return "The heaviest squat you could lift once, estimated from your test. Strength supports running economy and protects tissues.";
      case "squatRel": return typeof v === "number" ? (v < 1.2 ? "Below the working reference of 1.2× body weight (a proposed default, not a fixed standard): a strength gap worth building." : "At or above the 1.2× working reference.") : "";
      case "cmjHeightCm": return "A measure of leg power. There is no runner norm, so we compare with your own retest.";
      case "broadJumpM": return "Another power measure, tracked against your own results.";
      case "rsi": return "How quickly your ankles rebound. Tracked against your own retest.";
      case "calfRaiseAvg": return "Calf endurance helps the calf share load with the shin and Achilles. Building it is a priority when the shin is sore.";
      case "calfRaiseAsymPct": {
        const l = phys.calfRaiseLeftReps, r = phys.calfRaiseRightReps;
        const weaker = typeof l === "number" && typeof r === "number" && l !== r ? (l < r ? "left" : "right") : null;
        return weaker ? `Your ${weaker} calf tires sooner (we flag a difference of more than 10%).` : "Your calves are about even.";
      }
      case "sebtAsymmetryCm": return typeof v === "number" && v > 4 ? "The reach differs between legs by more than 4 cm (a proposed flag), a clue to balance or control on one side." : "The reach is similar on both legs.";
      case "cadenceSpm": return "No target applies. About 180 is a rough idea only, and a 10% increase is optional.";
      default: return "";
    }
  };
  const note = (key: string, auto: string) => noteEdit[key] ?? auto;
  const event = a?.goals?.event ?? "your race";
  const goalSentence = goalObj && baseline && goalObj.baseline != null && goalObj.target != null
    ? goalObj.baseline <= goalObj.target
      ? `Your recent race points to a ${event} time of about ${formatTime(goalObj.baseline)}, faster than your ${formatTime(goalObj.target)} goal, so fitness is not the limit here. Our focus is staying healthy and building up the distance.`
      : `Your recent race points to a ${event} time of about ${formatTime(goalObj.baseline)} against a ${formatTime(goalObj.target)} goal. The gym plan supports this, and the gap is closed mainly by your running training.`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-3 rounded-xl border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/c/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to case</Link>
          <Button className="ml-auto" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / save as PDF</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Report type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}><option value="baseline">Results and proposed plan (first visit)</option><option value="progress">Progress update (after a retest)</option></Select></div>
          <div><Label>Prepared by</Label><Input value={by} onChange={(e) => setBy(e.target.value)} /></div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1 text-sm">
            {([["results", "Test results"], ["video", "Running analysis (video)"], ["objectives", "Goals"], ["charts", "Trend charts (progress)"], ["plan", "The plan"], ["exercises", "Week 1 exercises"], ["log", "Training log (progress)"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={inc[k]} onChange={(e) => setInc({ ...inc, [k]: e.target.checked })} />{l}</label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Summary at a glance (printed on page 1)</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="2-4 plain sentences: what we found and what we will do." /></div>
          <div><Label>What it means overall (printed under "What it means")</Label><Textarea value={interp} onChange={(e) => setInterp(e.target.value)} placeholder="The story of the results, in plain language." /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>What is going well (one point per line)</Label><Textarea value={going} onChange={(e) => setGoing(e.target.value)} placeholder={"Efficient running form\nGood knee bend through the stride"} /></div>
          <div><Label>What we will work on (one point per line)</Label><Textarea value={focus} onChange={(e) => setFocus(e.target.value)} placeholder={"Hip control on one leg\nCalf strength and endurance"} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Notes from your clinician (printed)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div><Label>Next steps (printed)</Label><Textarea value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Edit what each result means (optional, printed in the "What it means" column)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {shown.map((r) => (
              <div key={r.k}><Label>{r.label}</Label><Textarea className="min-h-12" value={note(`t:${r.k}`, autoNote(r.k))} onChange={(e) => setNoteEdit({ ...noteEdit, [`t:${r.k}`]: e.target.value })} /></div>
            ))}
            {vctx && vctx.rows.map((r) => (
              <div key={r.label}><Label>{r.label}</Label><Textarea className="min-h-12" value={note(`v:${r.label}`, r.note(vctx.latest.data))} onChange={(e) => setNoteEdit({ ...noteEdit, [`v:${r.label}`]: e.target.value })} /></div>
            ))}
          </div>
        </details>
        <p className="text-xs text-muted-foreground">Screening answers, engine reasoning and clinician-only notes are never included. In the print dialog choose "Save as PDF" and turn off headers and footers.</p>
      </div>

      <article className="viz space-y-4 rounded-xl border bg-white p-6 print:rounded-none print:border-0 print:p-0" style={{ color: "var(--viz-ink)" }}>
        <header className="flex items-end justify-between gap-4 border-b-4 pb-3" style={{ borderColor: "var(--viz-brand)" }}>
          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--viz-brand)" }}>TPC Performance · Running</div>
            <h1 className="mt-0.5 text-2xl font-semibold leading-tight">{title}</h1>
            <div className="mt-0.5 text-base" style={{ color: "var(--viz-ink2)" }}>Prepared for {athlete.data.athlete.name}</div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-xs" style={{ color: "var(--viz-ink2)" }}>
            <dt>Date</dt><dd className="font-medium" style={{ color: "var(--viz-ink)" }}>{fmtDate(new Date())}</dd>
            {!baseline && <><dt>Program week</dt><dd className="font-medium" style={{ color: "var(--viz-ink)" }}>{rm.currentWeek}</dd></>}
            {by && <><dt>Prepared by</dt><dd className="font-medium" style={{ color: "var(--viz-ink)" }}>{by}</dd></>}
          </dl>
        </header>

        {contents.length > 0 && (
          <nav className="flex flex-wrap items-center gap-2 text-xs" aria-label="Report contents">
            <span style={{ color: "var(--viz-ink2)" }}>In this report:</span>
            {contents.map((c) => <span key={c.n} className="rounded-full border px-2.5 py-0.5" style={{ borderColor: "var(--viz-brand)", color: "var(--viz-brand)" }}><b>{c.n}</b> {c.t}</span>)}
          </nav>
        )}

        <section className="break-inside-avoid rounded-lg px-4 py-3" style={{ background: "var(--viz-tint)" }}>
          <div className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-ink2)" }}>Your goal</div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {a?.goals?.targetTimeSec ? <div className="text-lg font-semibold">{a.goals.event} in {formatTime(a.goals.targetTimeSec)}</div> : null}
            {a?.goals?.raceDate ? <div className="text-sm" style={{ color: "var(--viz-ink2)" }}>Race day: <b style={{ color: "var(--viz-ink)" }}>{fmtDate(a.goals.raceDate)}</b></div> : null}
          </div>
          {a?.goals?.narrative && !(a.goals.targetTimeSec && a.goals.narrative.length < 70) && <p className="mt-1 text-sm">In your words: {a.goals.narrative}</p>}
        </section>

        {reason && (
          <section className="break-inside-avoid rounded-lg px-4 py-3" style={{ background: "var(--viz-tint)" }}>
            <div className="mb-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-ink2)" }}>Why you came in</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{reason}</p>
          </section>
        )}

        {summary.trim() && (
          <section className="break-inside-avoid rounded-lg border-l-4 p-4 text-sm leading-relaxed" style={{ borderColor: "var(--viz-brand)", background: "var(--viz-brand-soft)" }}>
            <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-brand)" }}>At a glance</div>
            <p className="whitespace-pre-wrap">{summary}</p>
          </section>
        )}

        {(goingList.length > 0 || focusList.length > 0) && (
          <div className="grid break-inside-avoid gap-3 sm:grid-cols-2">
            {goingList.length > 0 && (
              <section className="rounded-lg p-4" style={{ background: "#eaf5ee" }}>
                <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-good)" }}>What is going well</div>
                <ul className="space-y-1 text-sm">{goingList.map((x) => <li key={x} className="flex gap-2"><span style={{ color: "var(--viz-good)" }}>✓</span><span>{x}</span></li>)}</ul>
              </section>
            )}
            {focusList.length > 0 && (
              <section className="rounded-lg p-4" style={{ background: "#fdf3e6" }}>
                <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "#a35a00" }}>What we will work on</div>
                <ul className="space-y-1 text-sm">{focusList.map((x) => <li key={x} className="flex gap-2"><span style={{ color: "#a35a00" }}>→</span><span>{x}</span></li>)}</ul>
              </section>
            )}
          </div>
        )}

        {showData && (
          <div className="space-y-3">
            <PartHeading n={nData} title="Your results" sub="What we measured" />
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
              <section>
                <h3 className="mb-1 text-sm font-semibold">{compareMode ? "Your tests: baseline and latest" : "Your tests"}</h3>
                <table className="report-table">
                  <thead><tr><th>What we tested</th><th className="num">{compareMode ? "Baseline" : "Result"}</th>{compareMode && <><th className="num">Latest</th><th>Change</th></>}<th>What it means</th></tr></thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.k}>
                        <td className="font-medium">{r.label}</td>
                        <td className="num whitespace-nowrap font-semibold">{fmt(r, base[r.k])}</td>
                        {compareMode && <><td className="num whitespace-nowrap font-semibold">{fmt(r, cur[r.k])}</td><td className="text-xs">{change(r)}</td></>}
                        <td className="text-xs leading-snug" style={{ color: "var(--viz-ink2)" }}>{note(`t:${r.k}`, autoNote(r.k))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs" style={{ color: "var(--viz-ink2)" }}>These are compared with your own results over time, not with other people.</p>
              </section>
            )}
            {videoRows && vctx && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Your running video</h3>
                <table className="report-table">
                  <thead><tr><th>What we looked at</th><th>{vctx.compare ? "Baseline" : "Result"}</th>{vctx.compare && <th>Latest</th>}<th>What it means</th></tr></thead>
                  <tbody>{vctx.rows.map((r) => <tr key={r.label}><td className="font-medium">{r.label}</td><td className="whitespace-nowrap font-semibold">{cap(r.get(baseA.data))}</td>{vctx.compare && <td className="whitespace-nowrap font-semibold">{cap(r.get(vctx.latest.data))}</td>}<td className="text-xs leading-snug" style={{ color: "var(--viz-ink2)" }}>{note(`v:${r.label}`, r.note(vctx.latest.data))}</td></tr>)}</tbody>
                </table>
              </section>
            )}
          </div>
        )}

        {showInterp && (
          <div className="space-y-3">
            <PartHeading n={nInterp} title="What it means" sub="Reading your results" />
            {interp.trim() && <p className="whitespace-pre-wrap text-sm leading-relaxed">{interp}</p>}
            {sideRows.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Left versus right</h3>
                <table className="report-table">
                  <thead><tr><th>What we compared</th><th className="num">Left</th><th className="num">Right</th><th style={{ width: "28%" }}>Side by side</th><th>What it means</th></tr></thead>
                  <tbody>
                    {sideRows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.label}<div className="text-[0.6875rem] font-normal" style={{ color: "var(--viz-ink2)" }}>{r.diff}</div></td>
                        <td className="num whitespace-nowrap font-semibold">{r.lText}</td>
                        <td className="num whitespace-nowrap font-semibold">{r.rText}</td>
                        <td><SideBars l={r.l} r={r.r} /></td>
                        <td className="text-xs leading-snug" style={{ color: "var(--viz-ink2)" }}>{note(`s:${r.id}`, r.note)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-1 flex gap-4 text-[0.6875rem]" style={{ color: "var(--viz-ink2)" }}><span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: "var(--viz-s1)" }} />Left</span><span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: "var(--viz-s2)" }} />Right</span></div>
              </section>
            )}
            {otherFindings.length > 0 && (
              <section className="break-inside-avoid">
                <h3 className="mb-1 text-sm font-semibold">Other things we noticed</h3>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">{otherFindings.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            )}
            {videoFrames && vctx && <RunningFrames ctx={vctx} imgBase={imgBase.data ?? []} imgLast={imgLast.data ?? []} />}
          </div>
        )}

        {showPlan && (
          <div className="space-y-3">
            <PartHeading n={nPlan} title="Your plan" sub="What we will do next" />
            {priorities.length > 0 && (
              <section className="break-inside-avoid">
                <h3 className="mb-1 text-sm font-semibold">What we will focus on, in order</h3>
                <ol className="space-y-1 text-sm">
                  {priorities.map((x, i) => (
                    <li key={x} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: "var(--viz-brand)" }}>{i + 1}</span><span>{x}</span></li>
                  ))}
                </ol>
              </section>
            )}
            {inc.plan && program && (
              <section className="space-y-3">
                <p className="text-sm leading-relaxed">{STRATEGY_PLAIN[program.strategy.key] ?? STRATEGY_LABEL[program.strategy.key]} It runs for {program.durationWeeks} weeks, {program.sessionsPerWeek === 1 ? "one gym session" : program.sessionsPerWeek === 3 ? "three gym sessions" : "two gym sessions"} a week, with lighter weeks built in so your body can adapt.</p>
                <div className="break-inside-avoid">
                  <h3 className="mb-1 text-sm font-semibold">Your {program.durationWeeks} weeks at a glance</h3>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {program.weeks.map((w) => (
                      <div key={w.week} className="rounded-md border p-2 text-center" style={{ borderColor: w.isUnload ? "var(--viz-line)" : "var(--viz-brand)", background: w.isUnload ? "var(--viz-tint)" : "var(--viz-brand-soft)" }}>
                        <div className="text-[0.6875rem] font-semibold" style={{ color: "var(--viz-brand)" }}>Week {w.week}</div>
                        <div className="text-[0.6875rem] leading-tight">{weekTile(w)}</div>
                        <div className="mt-0.5 text-[0.625rem] leading-tight" style={{ color: "var(--viz-ink2)" }}>{PHASE_PLAIN[w.phase] ?? w.phase}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {inc.exercises && program.weeks[0] && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Your first week</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {program.weeks[0].sessions.map((sess) => (
                        <div key={sess.id} className="break-inside-avoid rounded-lg border p-3" style={{ borderColor: "var(--viz-line)" }}>
                          <div className="text-sm font-semibold" style={{ color: "var(--viz-brand)" }}>{sess.name}</div>
                          {sess.focus && <div className="mb-1 text-xs" style={{ color: "var(--viz-ink2)" }}>{sess.focus}</div>}
                          <table className="report-table">
                            <thead><tr><th>Exercise</th><th className="num">Sets × reps</th><th className="num">Weight</th></tr></thead>
                            <tbody>{sess.exercises.map((e) => <tr key={e.id}><td>{e.name}</td><td className="num">{exDose(e)}</td><td className="num">{e.loadKg != null ? `${e.loadKg} kg` : "Body weight"}</td></tr>)}</tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--viz-ink2)" }}>Weights are a careful starting point and are confirmed with you in your first session. Reps or weight go up a little each week.</p>
                  </div>
                )}
                {program.milestones.length > 0 && (
                  <div className="break-inside-avoid">
                    <h3 className="mb-1 text-sm font-semibold">Key dates</h3>
                    <ol className="space-y-1.5 text-sm">
                      {program.milestones.map((m, i) => (
                        <li key={m.id} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: "var(--viz-brand)" }}>{i + 1}</span>
                          <span><b>Week {m.week}.</b> {plainMilestone(m, event)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>
            )}
            {inc.objectives && objRows.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">{baseline ? "Where we are aiming" : "Your goals for this block"}</h3>
                <table className="report-table">
                  <thead><tr><th>Goal</th><th className="num">{baseline ? "Today" : "Baseline"}</th>{!baseline && <th className="num">Now</th>}<th className="num">Target</th>{!baseline && <th className="num">Progress</th>}</tr></thead>
                  <tbody>
                    {objRows.map((o: any) => {
                      const f = (v: number | null) => (v == null ? "—" : o.unit === "s" ? formatTime(v) : `${v}${o.unit && o.unit !== "ratio" ? ` ${o.unit}` : ""}`);
                      return (
                        <tr key={o.id}>
                          <td>{o.label}</td><td className="num">{f(o.baseline)}</td>{!baseline && <td className="num">{f(o.current)}</td>}<td className="num font-medium">{f(o.target)}</td>
                          {!baseline && <td className="num">{o.progressPct == null ? "—" : o.progressPct >= 100 ? "Target reached" : `${Math.max(0, o.progressPct)}%`}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {goalSentence && <p className="mt-2 text-sm leading-relaxed">{goalSentence} <span style={{ color: "var(--viz-ink2)" }}>This is an estimate, not a promise.</span></p>}
              </section>
            )}
          </div>
        )}

        {showProgress && (
          <div className="space-y-3">
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
            {next && <div><div className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--viz-brand)" }}>Your next steps</div><p className="whitespace-pre-wrap">{next}</p></div>}
          </section>
        )}

        <footer className="flex items-start justify-between gap-4 border-t pt-3 text-xs" style={{ color: "var(--viz-ink2)", borderColor: "var(--viz-line)" }}>
          <span>{by ? `Prepared by ${by}. ` : ""}This report supports your clinician's plan and is not a medical diagnosis. Your results are compared with your own baseline, not with population norms.</span>
          <span className="shrink-0 font-semibold" style={{ color: "var(--viz-brand)" }}>TPC Performance</span>
        </footer>
      </article>
    </div>
  );
}

const VIDEO_ROWS: Array<{ label: string; get: (a: any) => string | null; note: (a: any) => string }> = [
  { label: "Foot strike", get: (a) => a.biomechanics?.footStrike ?? null, note: () => "No landing pattern is proven better or worse for injury, so no change is planned." },
  { label: "Cadence", get: (a) => (a.biomechanics?.cadenceSpm != null ? `${a.biomechanics.cadenceSpm} steps/min` : null), note: () => "No target applies. A 10% increase is the one change shown to cut load per step, and it is optional." },
  { label: "Foot lands ahead of the pelvis (overstride)", get: (a) => (a.biomechanics?.overstride == null ? null : a.biomechanics.overstride ? "Yes" : "No"), note: (a) => (a.biomechanics?.overstride ? "Landing ahead of the body can add braking load." : "The foot lands under the body, which keeps braking low.") },
  { label: "Peak knee bend in stance", get: (a) => (a.biomechanics?.peakKneeFlexionDeg != null ? `${a.biomechanics.peakKneeFlexionDeg}°` : null), note: (a) => ((a.biomechanics?.peakKneeFlexionDeg ?? 45) >= 40 ? "In the typical range (about 45°)." : "Under about 40°, which has been linked with some knee-pain groups.") },
  { label: "Peak hip extension", get: (a) => (a.biomechanics?.peakHipExtensionDeg != null ? `${a.biomechanics.peakHipExtensionDeg}°` : null), note: () => "Read with your stride length. Around 10° can be fine for a compact stride." },
  { label: "Vertical bounce", get: (a) => a.biomechanics?.verticalOscillation ?? null, note: () => "No accepted normal value, so we compare with your own retest." },
  { label: "Pelvic drop", get: (a) => a.biomechanics?.pelvicDrop ?? null, note: (a) => (/marked|moderate/i.test(a.biomechanics?.pelvicDrop ?? "") ? "The hips dip on the swinging side, a clue to hip and trunk control on the standing leg." : "The hips stay fairly level.") },
  { label: "Knee window closes", get: (a) => (a.biomechanics?.kneeValgus == null ? null : a.biomechanics.kneeValgus ? "Yes" : "No"), note: (a) => (a.biomechanics?.kneeValgus ? "The knees move toward each other, so hip and foot control are worth checking." : "The knees stay apart through the stride.") },
  { label: "Feet cross the midline", get: (a) => (a.biomechanics?.crossover == null ? null : a.biomechanics.crossover ? "Yes" : "No"), note: (a) => (a.biomechanics?.crossover ? "A narrow base can add load and is worth checking." : "Each foot lands on its own side of the midline.") },
  { label: "Heel whip over about 5°", get: (a) => (a.biomechanics?.heelWhip == null ? null : a.biomechanics.heelWhip ? "Yes" : "No"), note: (a) => (a.biomechanics?.heelWhip ? "Common in runners and of low importance alone. Which side and which way it swings matters more than the size." : "No clear heel swing.") },
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
    <div className="flex break-after-avoid items-center gap-2.5 border-b pb-1.5 pt-2" style={{ borderColor: "var(--viz-brand)" }}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: "var(--viz-brand)" }}>{n}</span>
      <div className="leading-tight">
        <h2 className="text-base font-semibold uppercase tracking-wide">{title}</h2>
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

/** Saved video frames, two cards across: pictures on top, what we saw and what it might mean underneath. */
function RunningFrames({ ctx, imgBase, imgLast }: { ctx: ReturnType<typeof videoCtx>; imgBase: any[]; imgLast: any[] }) {
  const { compare, latest, phases } = ctx;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Your running, frame by frame</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {phases.map((p) => {
          const b = imgBase.filter((i) => i.phase === p.id);
          const l = compare ? imgLast.filter((i) => i.phase === p.id) : [];
          const text = [...l, ...b].find((i) => i.discussion)?.discussion;
          const finding = p.finding(latest.data);
          const groups = [...(compare && b.length ? [{ label: "Baseline", imgs: b }] : [{ label: "", imgs: b }]), ...(l.length ? [{ label: "Latest", imgs: l }] : [])].filter((g) => g.imgs.length);
          const count = groups.reduce((n, g) => n + g.imgs.length, 0);
          return (
            <figure key={p.id} className={cn("flex break-inside-avoid gap-2.5 rounded-lg border p-2.5 text-[0.8125rem]", count >= 3 && "sm:col-span-2")} style={{ borderColor: "var(--viz-line)" }}>
              <div className="flex shrink-0 flex-wrap content-start gap-1.5">
                {groups.map((g) => (
                  <div key={g.label || "one"} className="space-y-0.5">
                    {g.label && <div className="text-[0.6875rem] font-medium" style={{ color: "var(--viz-ink2)" }}>{g.label}</div>}
                    <div className="flex gap-1.5">
                      {g.imgs.map((i) => (
                        <div key={i.id} className="max-w-[4.75rem]">
                          <img src={`/api/images/${i.id}/file`} alt={i.caption || p.label} className="max-h-28 w-auto rounded border" />
                          {i.measure && <div className="mt-0.5 text-[0.625rem] font-medium leading-tight" style={{ color: "var(--viz-brand)" }}>{plainMeasure(p.id, i.measure)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="min-w-0 space-y-1 leading-snug">
                <figcaption className="font-semibold" style={{ color: "var(--viz-brand)" }}>{p.label}</figcaption>
                {finding && finding.length > 6 && <div><b>Saw:</b> {finding}.</div>}
                {text && <div><b>Means:</b> {text}</div>}
                {sideLine(p.id, latest.data) && <div><b>Left vs right:</b> {sideLine(p.id, latest.data)}</div>}
              </div>
            </figure>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: "var(--viz-ink2)" }}>{VIDEO_NOTE}</p>
    </section>
  );
}

const f1 = (n: number) => String(Math.round(n * 10) / 10);

/** Picture labels in plain words: heel tilt is shown as the tilt (180 minus the inside angle), pixel heights without the jargon. */
function plainMeasure(phase: string, m: string): string {
  const ang = /Angle ([\d.]+)°/.exec(m);
  if (phase === "heel-eversion" && ang) return `Tilt about ${f1(180 - Number(ang[1]))}°`;
  return m.replace(/Vertical gap (\d+) px \(no scale\)/, "Marker height $1 px").replace(/\s*\(no scale\)/, "");
}

type SideRow = { id: string; label: string; l: number | null; r: number | null; lText: string; rText: string; diff: string; note: string };

/** Rows that compare the left and right sides, built from whatever per-side values were entered. */
function buildSideRows(d: any): SideRow[] {
  const ph = d.physical ?? {}, bio = d.biomechanics ?? {};
  const rows: SideRow[] = [];
  const add = (id: string, label: string, l: unknown, r: unknown, unit: string, higherIsBetter: boolean | null, note: string, extraL = "", extraR = "") => {
    const ln = typeof l === "number" ? l : null, rn = typeof r === "number" ? r : null;
    if (ln == null && rn == null) return;
    let diff = "";
    if (ln != null && rn != null && ln !== rn) {
      const pct = Math.round((Math.abs(ln - rn) / Math.max(ln, rn)) * 100);
      const lowerSide = ln < rn ? "Left" : "Right", higherSide = ln < rn ? "Right" : "Left";
      diff = higherIsBetter ? `${lowerSide} about ${pct}% lower` : `${higherSide} about ${pct}% larger`;
    } else if (ln != null && rn != null) diff = "About the same";
    rows.push({ id, label, l: ln, r: rn, lText: ln == null ? "—" : `${f1(ln)}${unit}${extraL}`, rText: rn == null ? "—" : `${f1(rn)}${unit}${extraR}`, diff, note });
  };
  add("calf", "Calf endurance (single-leg raises)", ph.calfRaiseLeftReps, ph.calfRaiseRightReps, " reps", true, "The calves help share load with the shin and Achilles. The weaker side gets an extra set.");
  add("hip", "Hip abduction strength", ph.hipAbductionLeftKg, ph.hipAbductionRightKg, " kg", true, "The muscles that lift the leg out to the side keep your pelvis level on one leg. A weaker side is less able to do that. There is no validated runner norm, so we track change.");
  add("pdrop", "Pelvic drop when standing on that leg", bio.pelvicDropLeftStanceDeg, bio.pelvicDropRightStanceDeg, "°", false, "A bigger dip while standing on one leg is a clue to hip and trunk control on that side. Its meaning is debated.");
  add("whip", "Heel swing at toe-off (from vertical)", bio.heelWhipLeftDeg, bio.heelWhipRightDeg, "°", false, "Direction matters as well as size: medial means the heel swings toward the other leg. It is common and of low importance on its own.", bio.heelWhipLeftDirection ? ` ${bio.heelWhipLeftDirection}` : "", bio.heelWhipRightDirection ? ` ${bio.heelWhipRightDirection}` : "");
  add("evers", "Heel tilt at mid-stance", bio.heelEversionLeftDeg, bio.heelEversionRightDeg, "°", false, "Some inward tilt is normal. A bigger tilt on one side can load the inner shin more, but no amount is proven to cause injury.");
  return rows;
}

/** Two thin bars (left blue, right orange) scaled to the larger value. */
function SideBars({ l, r }: { l: number | null; r: number | null }) {
  const max = Math.max(l ?? 0, r ?? 0) || 1;
  const bar = (v: number | null, color: string) => <div className="h-2 rounded-sm" style={{ width: `${v == null ? 0 : Math.max(4, (v / max) * 100)}%`, background: color }} />;
  return <div className="space-y-1">{bar(l, "var(--viz-s1)")}{bar(r, "var(--viz-s2)")}</div>;
}

/** One plain sentence that puts the two sides of a finding together, from the per-side values. */
function sideLine(phase: string, d: any): string | null {
  const bio = d.biomechanics ?? {};
  const pair = (l: unknown, r: unknown) => (typeof l === "number" && typeof r === "number" ? [l, r] as const : null);
  if (phase === "heel-whip") {
    const p = pair(bio.heelWhipLeftDeg, bio.heelWhipRightDeg);
    if (!p) return null;
    const dirs = [bio.heelWhipLeftDirection, bio.heelWhipRightDirection];
    const same = dirs[0] && dirs[0] === dirs[1] ? `Both heels swing ${dirs[0]}ly. ` : "";
    return `${same}The right foot swings about ${f1(p[1])}° and the left about ${f1(p[0])}° from vertical.`;
  }
  if (phase === "heel-eversion") {
    const p = pair(bio.heelEversionLeftDeg, bio.heelEversionRightDeg);
    return p ? `The right heel tilts in about ${f1(p[1])}° and the left about ${f1(p[0])}°.` : null;
  }
  if (phase === "pelvic-drop") {
    const p = pair(bio.pelvicDropLeftStanceDeg, bio.pelvicDropRightStanceDeg);
    return p ? `Standing on the right leg the left side of the pelvis drops about ${f1(p[1])}°; standing on the left leg the right side drops about ${f1(p[0])}°.` : null;
  }
  return null;
}
