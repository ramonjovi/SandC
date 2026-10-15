import { useEffect, useState } from "react";
import { AlertTriangle, Bot, UserRound } from "lucide-react";
import { STRATEGY_LABEL, type EngineReport } from "@tpc/engine";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Select, Textarea } from "@/components/ui";
import { RuleBadge, RuleBadges, StatusBadge } from "@/components/RuleBadge";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { cn, formatTime } from "@/lib/utils";

export function Interpretation({ assessment, onChanged, goProgram }: { assessment: any; onChanged: () => void; goProgram: () => void }) {
  const report: EngineReport | null = assessment.report;
  const { modules, rules } = useMeta();
  const priorities = modules[0].priorities;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true); setErr("");
    try { await api(`/assessments/${assessment.id}/interpret`, { method: "POST" }); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!report) {
    return (
      <Card><CardContent className="space-y-3 pt-5">
        <p className="text-sm">The engine has not interpreted this assessment yet. It reads the same data you do and reaches its own conclusions independently.</p>
        <Button onClick={run} disabled={busy}><Bot className="h-4 w-4" /> Run engine interpretation</Button>
        {err && <Alert tone="danger">{err}</Alert>}
      </CardContent></Card>
    );
  }

  const m = report.metrics;
  const metricRows: Array<[string, unknown]> = [
    ["VDOT (adjusted)", m.vdot], ["Predicted time at goal distance", m.goalPredictedTimeSec != null ? formatTime(m.goalPredictedTimeSec as number) : null],
    ["Target speed (km/h)", m.targetSpeedKmh], ["Squat 1RM est. (kg)", m.squat1RM], ["Squat / body mass", m.squatRel],
    ["IMTP (N/kg)", m.imtpRel], ["DSI", m.dsi], ["Calf-raise asymmetry (%)", m.calfRaiseAsymPct],
  ];
  const byDomain = report.findings.reduce<Record<string, typeof report.findings>>((acc, f) => { (acc[f.domain] ??= []).push(f); return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-4 w-4" /> Independent engine interpretation · v{report.engineVersion}</div>
        <Button variant="outline" size="sm" onClick={run} disabled={busy}>Re-run on latest data</Button>
      </div>

      {report.safetyFlags.length > 0 && (
        <Card className="border-rose-300">
          <CardHeader><CardTitle className="flex items-center gap-2 text-rose-800"><AlertTriangle className="h-4 w-4" /> Screening flags for clinician review</CardTitle>
            <CardDescription>The engine surfaces these only. It does not classify REDs risk or grant medical clearance.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {report.safetyFlags.map((f) => (
              <Alert key={f.id} tone={f.highStakes ? "danger" : "warn"}>{f.text}</Alert>
            ))}
            {report.restrictions.map((r) => <Alert key={r.site} tone="warn"><b>Program restriction:</b> {r.text}</Alert>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Where we are</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metricRows.filter(([, v]) => v != null).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-2.5"><div className="text-lg font-semibold">{String(v)}</div><div className="text-xs text-muted-foreground">{k}</div></div>
            ))}
          </div>
          {Object.entries(byDomain).map(([domain, fs]) => (
            <div key={domain}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{domain}</div>
              <ul className="space-y-2">
                {fs.map((f) => (
                  <li key={f.id} className="text-sm">
                    <span className={cn(f.severity === "priority" && "font-medium text-rose-800", f.severity === "attention" && "font-medium text-amber-800")}>{f.text}</span>
                    <RuleBadges ids={f.ruleIds} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {report.missingData.length > 0 && (
            <Alert tone="info"><b>Missing data:</b><ul className="ml-4 list-disc">{report.missingData.map((d) => <li key={d}>{d}</li>)}</ul></Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>What needs improving (engine)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-3">
            {report.priorities.map((p) => (
              <li key={p.key} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{p.rank}</span>
                <div><div className="text-sm font-medium">{p.label}</div><div className="text-sm text-muted-foreground">{p.rationale}</div><RuleBadges ids={p.ruleIds} /></div>
              </li>
            ))}
            {report.priorities.length === 0 && <li className="text-sm text-muted-foreground">No data-driven priorities. Enter more testing data.</li>}
          </ol>
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">Strategy: {STRATEGY_LABEL[report.strategy.key]} <Badge variant="outline">{report.strategy.emphasis} emphasis</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{report.strategy.rationale}</p>
            <RuleBadges ids={report.strategy.ruleIds} />
          </div>
        </CardContent>
      </Card>

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Rules used ({report.rulesUsed.length})</summary>
        <div className="mt-2 space-y-1">
          {report.rulesUsed.map((id) => { const r = rules.find((x) => x.id === id); return r ? <div key={id} className="flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /><span>{r.title}</span></div> : null; })}
        </div>
      </details>

      <PtPanel assessment={assessment} priorities={priorities} onSaved={onChanged} />

      <div className="flex justify-end"><Button onClick={goProgram}>Continue to program</Button></div>
    </div>
  );
}

function PtPanel({ assessment, priorities, onSaved }: { assessment: any; priorities: Array<{ key: string; label: string }>; onSaved: () => void }) {
  const existing = assessment.pt;
  const [keys, setKeys] = useState<string[]>(existing?.data?.priorityKeys ?? []);
  const [strategy, setStrategy] = useState<string>(existing?.data?.strategy ?? assessment.report?.strategy.key ?? "combined");
  const [reasoning, setReasoning] = useState(existing?.data?.reasoning ?? "");
  const [concerns, setConcerns] = useState(existing?.data?.concerns ?? "");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setKeys(existing?.data?.priorityKeys ?? []); setStrategy(existing?.data?.strategy ?? assessment.report?.strategy.key ?? "combined");
    setReasoning(existing?.data?.reasoning ?? ""); setConcerns(existing?.data?.concerns ?? "");
  }, [assessment.id, existing?.id]);
  const toggle = (k: string) => setKeys((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const cmp = existing?.comparison;

  async function save() {
    setMsg("");
    try {
      await api(`/assessments/${assessment.id}/pt-interpretation`, { method: "PUT", body: { priorityKeys: keys, strategy, reasoning, concerns } });
      onSaved();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Your interpretation</CardTitle>
        <CardDescription>Record your own conclusions. Select priorities in order of importance (click order sets rank).</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {priorities.map((p) => {
            const i = keys.indexOf(p.key);
            return (
              <button key={p.key} onClick={() => toggle(p.key)}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm cursor-pointer", i >= 0 ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
                {i >= 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">{i + 1}</span>}{p.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>S&C strategy</Label>
            <Select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              {Object.entries(STRATEGY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select></div>
        </div>
        <div><Label>Clinical reasoning</Label><Textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} /></div>
        <div><Label>Context the engine cannot see (optional)</Label><Textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} /></div>
        {msg && <Alert tone="danger">{msg}</Alert>}
        <Button onClick={save} disabled={keys.length === 0}>Save and compare with engine</Button>

        {cmp && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm font-medium">{cmp.summary}</div>
            {cmp.agreement.length > 0 && <div className="flex flex-wrap gap-1.5">{cmp.agreement.map((a: any) => <Badge key={a.key} variant="ok">Agree: {a.label}</Badge>)}</div>}
            {cmp.disagreements.map((d: any, i: number) => (
              <div key={i} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="font-medium">{d.label}</div>
                <div className="grid gap-1 sm:grid-cols-2"><span><b>You:</b> {d.pt}</span><span><b>Engine:</b> {d.engine}</span></div>
                <p className="mt-1 text-muted-foreground">{d.engineReasoning}</p>
                <div className="mt-1 flex flex-wrap gap-1">{d.ruleIds.map((r: string) => <RuleBadge key={r} id={r} />)}</div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">You have final authority: the program you approve may differ from the engine's recommendation.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
