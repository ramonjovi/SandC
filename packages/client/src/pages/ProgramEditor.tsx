import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { running, STRATEGY_LABEL, type EngineReport, type PrescribedExercise, type Program } from "@tpc/engine";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";
import { OverrideNotice, RuleBadges } from "@/components/RuleBadge";
import { api } from "@/lib/api";
import { ExerciseHowTo } from "@/components/ExerciseHowTo";
import { useMeta } from "@/lib/meta";
import { cn, fmtDateTime } from "@/lib/utils";

export function ProgramEditor({ athleteId, assessment, programRow, onChanged }: { athleteId: string; assessment: any; programRow: any | null; onChanged: () => void }) {
  const [program, setProgram] = useState<Program | null>(programRow?.data ?? null);
  const [dirty, setDirty] = useState(false);
  const [week, setWeek] = useState(1);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [perWeek, setPerWeek] = useState<number>(programRow?.data?.sessionsPerWeek ?? 2);
  const guides = ((useMeta().modules[0] as any).exerciseGuides ?? {}) as Record<string, any>;
  useEffect(() => { setProgram(programRow?.data ?? null); setDirty(false); }, [programRow?.id, programRow?.version]);

  const report: EngineReport | null = assessment.report;
  const flags = report?.safetyFlags ?? [];
  const highStakes = flags.some((f) => f.highStakes);

  async function generate() {
    setBusy(true); setMsg(null);
    try { await api(`/assessments/${assessment.id}/program`, { method: "POST", body: { sessionsPerWeek: perWeek } }); onChanged(); } catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function save() {
    if (!program || !programRow) return;
    setBusy(true); setMsg(null);
    try { await api(`/programs/${programRow.id}`, { method: "PUT", body: { data: program } }); setDirty(false); setMsg({ tone: "ok", text: "Program saved (audited)." }); onChanged(); } catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); } finally { setBusy(false); }
  }

  if (!programRow || !program) {
    return (
      <Card><CardContent className="space-y-3 pt-5">
        <p className="text-sm">Generate an editable eight-week gym-based S&C program from this assessment{report ? " and the engine's interpretation" : ""}.</p>
        {!report && <Alert tone="warn">The engine has not interpreted this assessment yet; the program will use a fresh interpretation.</Alert>}
        <SessionsChoice value={perWeek} onChange={setPerWeek} />
        <Button onClick={generate} disabled={busy}>Generate eight-week program</Button>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </CardContent></Card>
    );
  }

  const wk = program.weeks[week - 1];
  const upd = (fn: (p: Program) => void) => { const p = structuredClone(program); fn(p); setProgram(p); setDirty(true); };
  const editEx = (si: number, ei: number, patch: Partial<PrescribedExercise>) => upd((p) => { Object.assign(p.weeks[week - 1].sessions[si].exercises[ei], patch); });
  const num = (v: string) => (v === "" ? null : Number(v));

  /** Swap an exercise with its neighbour in this session and week. */
  function move(si: number, ei: number, dir: -1 | 1) {
    upd((p) => {
      const list = p.weeks[week - 1].sessions[si].exercises;
      const j = ei + dir;
      if (j < 0 || j >= list.length) return;
      [list[ei], list[j]] = [list[j], list[ei]];
    });
  }

  /** Copy this session's exercise order to the same session in every other week (exercises a week does not have are left in place after the matched ones). */
  function orderAllWeeks(si: number) {
    upd((p) => {
      const order = p.weeks[week - 1].sessions[si].exercises.map((e) => e.exerciseId);
      for (const w of p.weeks) {
        if (w.week === week) continue;
        const sess = w.sessions[si];
        if (!sess) continue;
        const rank = (id: string) => { const i = order.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
        const idx = sess.exercises.map((e, i) => ({ e, i }));
        idx.sort((a, b) => rank(a.e.exerciseId) - rank(b.e.exerciseId) || a.i - b.i);
        sess.exercises = idx.map((x) => x.e);
      }
    });
    setMsg({ tone: "ok", text: "This session's order was copied to the other weeks. Save the edits to keep it." });
  }

  /** Plan the later weeks of this session from the week being edited (reps, load steps, unload weeks). */
  function planProgression(si: number) {
    if (!program) return;
    setProgram(running.planSessionProgression(program, week, si));
    setDirty(true);
    setMsg({ tone: "ok", text: `Weeks after week ${week} were planned from this session (reps rise through each block, a load or harder-variation step after each unload week, sets cut in unload weeks). Review them, then save.` });
  }

  function addExercise(si: number, exId: string) {
    const def = running.EXERCISES[exId];
    if (!def) return;
    upd((p) => p.weeks[week - 1].sessions[si].exercises.push({
      id: `w${week}-d${si + 1}-${def.id}-${Date.now() % 100000}`, exerciseId: def.id, name: def.name, category: def.category, sets: 3, reps: def.unit === "contacts" ? 6 : 8, unit: def.unit,
      perSide: def.perSide, loadKg: null, pct1RM: null, rir: def.category === "plyometric" ? null : 2, restSec: def.restSec, cue: def.cue,
      progressionRule: "Clinician-added exercise: set the progression manually.", notes: "Added by clinician.", ruleIds: [],
    }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Eight-week S&C program</CardTitle>
            <Badge variant={programRow.status === "approved" ? "ok" : "warn"}>{programRow.status === "approved" ? `Approved by ${programRow.approvedBy} · ${fmtDateTime(programRow.approvedAt)}` : "Draft"}</Badge>
            <Badge variant="outline">v{programRow.version}</Badge>
          </div>
          <CardDescription>Strategy: {STRATEGY_LABEL[program.strategy.key]} ({program.strategy.emphasis} emphasis). You can edit any prescription; edits are audited.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <OverrideNotice overrides={program.paramOverrides} />
          {program.restrictionsApplied.map((r) => <Alert key={r} tone="warn">{r}</Alert>)}
          <details className="text-sm"><summary className="cursor-pointer font-medium">Assumptions to review ({program.assumptions.length})</summary>
            <ul className="ml-5 mt-1 list-disc text-muted-foreground">{program.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
        </CardContent>
      </Card>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {program.weeks.map((w) => (
          <button key={w.week} onClick={() => setWeek(w.week)}
            className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-sm cursor-pointer", week === w.week ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent", w.isUnload && week !== w.week && "border-dashed")}>
            W{w.week}{w.isUnload ? " ↓" : ""}
          </button>
        ))}
      </div>
      <div className="text-sm text-muted-foreground"><b>Week {wk.week} · {wk.phase} · {wk.label}.</b> {wk.note}</div>

      {wk.sessions.map((s, si) => (
        <Card key={s.id}>
          <CardHeader><CardTitle>{s.name}</CardTitle><CardDescription>{s.focus}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {s.warmup && s.warmup.length > 0 && (
              <details className="rounded-lg bg-muted/60 px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">Warm-up</summary>
                <ul className="ml-5 mt-1 list-disc text-muted-foreground">{s.warmup.map((w) => <li key={w}>{w}</li>)}</ul></details>
            )}
            {s.exercises.map((e, ei) => (
              <div key={e.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{e.name} {e.pairedWith && <Badge variant="outline">contrast pair</Badge>} {e.extraSetSide && <Badge variant="warn">+1 set {e.extraSetSide}</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{e.cue}</div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button variant="ghost" size="icon" aria-label="Move exercise up" disabled={ei === 0} onClick={() => move(si, ei, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Move exercise down" disabled={ei === s.exercises.length - 1} onClick={() => move(si, ei, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Remove exercise" onClick={() => upd((p) => p.weeks[week - 1].sessions[si].exercises.splice(ei, 1))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <div><Label>Sets</Label><Input type="number" value={e.sets} onChange={(ev) => editEx(si, ei, { sets: Number(ev.target.value) })} /></div>
                  <div><Label>{e.unit === "contacts" ? "Contacts" : e.unit === "sec" ? "Seconds" : "Reps"}{e.perSide ? "/side" : ""}</Label><Input type="number" value={e.reps} onChange={(ev) => editEx(si, ei, { reps: Number(ev.target.value) })} /></div>
                  <div><Label>Load (kg)</Label><Input type="number" step="2.5" placeholder={e.category === "plyometric" ? "BW" : "—"} value={e.loadKg ?? ""} onChange={(ev) => editEx(si, ei, { loadKg: num(ev.target.value) })} /></div>
                  <div><Label>% 1RM</Label><Input type="number" step="0.5" value={e.pct1RM ?? ""} onChange={(ev) => editEx(si, ei, { pct1RM: num(ev.target.value) })} /></div>
                  <div><Label>RIR</Label><Input type="number" value={e.rir ?? ""} onChange={(ev) => editEx(si, ei, { rir: num(ev.target.value) })} /></div>
                  <div><Label>Rest (s)</Label><Input type="number" step="15" value={e.restSec} onChange={(ev) => editEx(si, ei, { restSec: Number(ev.target.value) })} /></div>
                </div>
                <div className="mt-2"><ExerciseHowTo guide={guides[e.exerciseId]} audience="clinician" /></div>
                <p className="mt-2 text-xs text-muted-foreground"><b>Progression:</b> {e.progressionRule}</p>
                {e.notes && <p className="text-xs text-amber-800">{e.notes}</p>}
                <RuleBadges ids={e.ruleIds} />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => planProgression(si)}>Plan progression for later weeks</Button>
              <Button size="sm" variant="outline" onClick={() => orderAllWeeks(si)}>Use this order in all weeks</Button>
              <Plus className="h-4 w-4 text-muted-foreground" />
              <Select className="max-w-xs" value="" onChange={(ev) => ev.target.value && addExercise(si, ev.target.value)}>
                <option value="">Add exercise...</option>
                {Object.values(running.EXERCISES).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button onClick={save} disabled={busy || !dirty}>{dirty ? "Save edits" : "Saved"}</Button>
        <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Sessions per week</span>
          <Select className="h-8 w-20" value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></Select></div>
        <Button variant="outline" onClick={generate} disabled={busy}>Regenerate from assessment</Button>
        {dirty && <span className="text-xs text-amber-800">Unsaved edits: save before approving.</span>}
      </div>

      <RunningASession />
      <ApprovePanel programRow={programRow} flags={flags} highStakes={highStakes} dirty={dirty} onDone={onChanged} />
      <Objectives program={program} />
    </div>
  );
}

function ApprovePanel({ programRow, flags, highStakes, dirty, onDone }: { programRow: any; flags: EngineReport["safetyFlags"]; highStakes: boolean; dirty: boolean; onDone: () => void }) {
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const approved = programRow.status === "approved";
  async function approve() {
    setErr("");
    try {
      await api(`/programs/${programRow.id}/approve`, { method: "POST", body: { screeningReviewed: true, clearanceNote: note || undefined } });
      onDone();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Card className={cn(!approved && "border-primary/40")}>
      <CardHeader><CardTitle>{approved ? "Approved" : "Approve program"}</CardTitle>
        <CardDescription>{approved ? "The athlete can see this program. Edits stay audited; approving again records a new approval." : "Approval publishes the program to the athlete interface."}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {flags.length > 0 && <Alert tone={highStakes ? "danger" : "warn"}>{flags.length} screening flag{flags.length > 1 ? "s" : ""} on this assessment{highStakes ? ": a recorded medical review decision is required." : "."}</Alert>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I have reviewed the health screening and injury history for this athlete and take clinical responsibility for this program.</label>
        {highStakes && <div><Label>Medical review / clearance decision (required)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who reviewed, what was decided, any conditions." /></div>}
        {err && <Alert tone="danger">{err}</Alert>}
        <Button onClick={approve} disabled={!ack || dirty || (highStakes && note.trim().length < 10)}>{approved ? "Approve again" : "Approve and publish to athlete"}</Button>
      </CardContent>
    </Card>
  );
}

function Objectives({ program }: { program: Program }) {
  return (
    <Card>
      <CardHeader><CardTitle>Objectives and milestones in this program</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {program.objectives.map((o) => (
          <div key={o.id} className="flex flex-wrap justify-between gap-2"><span>{o.label}</span><span className="text-muted-foreground">{o.baseline} → {o.target} {o.unit} ({o.status.replace("_", " ")})</span></div>
        ))}
        <div className="border-t pt-2">{program.milestones.map((m) => <div key={m.id}><b>Week {m.week}:</b> {m.label}</div>)}</div>
      </CardContent>
    </Card>
  );
}

function SessionsChoice({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const opts = [
    { n: 1, t: "1 session", d: "One whole-body session: squat and deadlift together, calves, hamstrings. Best when time or recovery is tight, or late in a block." },
    { n: 2, t: "2 sessions (recommended)", d: "Session A squat pattern, session B hinge and robustness. Matches the runner examples in the books." },
    { n: 3, t: "3 sessions", d: "Adds a light third session for calves, hips and low-level reactive work (no heavy lifts). A software add-on: drop it if running load or recovery suffers." },
  ];
  return (
    <div className="space-y-2">
      <Label>Gym sessions per week</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {opts.map((o) => (
          <button key={o.n} type="button" onClick={() => onChange(o.n)}
            className={cn("rounded-lg border p-3 text-left text-sm cursor-pointer", value === o.n ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent")}>
            <div className="font-medium">{o.t}</div><div className="text-xs text-muted-foreground">{o.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RunningASession() {
  return (
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-medium">Guide: running a gym session with the athlete</summary>
      <ol className="ml-5 mt-2 list-decimal space-y-1.5">
        <li><b>Before:</b> ask about pain, sleep and the last run. If pain is 4/10 or more at a site, skip loads there and note it. Do the warm-up listed on the session (about 10-15 minutes).</li>
        <li><b>Ramp-up:</b> do 2-3 progressively heavier sets of the first lift before the working sets.</li>
        <li><b>Working sets:</b> use the prescribed load and reps and stop at the reps-in-reserve target (RIR 2 = could have done 2 more clean reps). Do not train to failure.</li>
        <li><b>Rest:</b> strength and power work needs 2-5 minutes between sets (the book's range). Contrast pairs: plyometric set 2-3 minutes after the heavy set, then rest about 3 minutes.</li>
        <li><b>Plyometrics:</b> stop the set when ground contact looks longer, landings get noisy, or height drops by about 10%.</li>
        <li><b>Record:</b> actual reps and loads, final-set RIR, and pain 0-10 per exercise. The app proposes the next loads; you approve them with "Apply to next week".</li>
        <li><b>Running around it:</b> keep at least 6 hours between the gym and a hard run, never hard gym and a hard run on the same day, and after heavy lifting keep the run easy and short.</li>
      </ol>
    </details>
  );
}
