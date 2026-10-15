import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { running, STRATEGY_LABEL, type EngineReport, type PrescribedExercise, type Program } from "@tpc/engine";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";
import { RuleBadges } from "@/components/RuleBadge";
import { api } from "@/lib/api";
import { cn, fmtDateTime } from "@/lib/utils";

export function ProgramEditor({ athleteId, assessment, programRow, onChanged }: { athleteId: string; assessment: any; programRow: any | null; onChanged: () => void }) {
  const [program, setProgram] = useState<Program | null>(programRow?.data ?? null);
  const [dirty, setDirty] = useState(false);
  const [week, setWeek] = useState(1);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setProgram(programRow?.data ?? null); setDirty(false); }, [programRow?.id, programRow?.version]);

  const report: EngineReport | null = assessment.report;
  const flags = report?.safetyFlags ?? [];
  const highStakes = flags.some((f) => f.highStakes);

  async function generate() {
    setBusy(true); setMsg(null);
    try { await api(`/assessments/${assessment.id}/program`, { method: "POST" }); onChanged(); } catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); } finally { setBusy(false); }
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
        <Button onClick={generate} disabled={busy}>Generate eight-week program</Button>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </CardContent></Card>
    );
  }

  const wk = program.weeks[week - 1];
  const upd = (fn: (p: Program) => void) => { const p = structuredClone(program); fn(p); setProgram(p); setDirty(true); };
  const editEx = (si: number, ei: number, patch: Partial<PrescribedExercise>) => upd((p) => { Object.assign(p.weeks[week - 1].sessions[si].exercises[ei], patch); });
  const num = (v: string) => (v === "" ? null : Number(v));

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
            {s.exercises.map((e, ei) => (
              <div key={e.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{e.name} {e.pairedWith && <Badge variant="outline">contrast pair</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{e.cue}</div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove exercise" onClick={() => upd((p) => p.weeks[week - 1].sessions[si].exercises.splice(ei, 1))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <div><Label>Sets</Label><Input type="number" value={e.sets} onChange={(ev) => editEx(si, ei, { sets: Number(ev.target.value) })} /></div>
                  <div><Label>{e.unit === "contacts" ? "Contacts" : e.unit === "sec" ? "Seconds" : "Reps"}{e.perSide ? "/side" : ""}</Label><Input type="number" value={e.reps} onChange={(ev) => editEx(si, ei, { reps: Number(ev.target.value) })} /></div>
                  <div><Label>Load (kg)</Label><Input type="number" step="2.5" placeholder={e.category === "plyometric" ? "BW" : "—"} value={e.loadKg ?? ""} onChange={(ev) => editEx(si, ei, { loadKg: num(ev.target.value) })} /></div>
                  <div><Label>% 1RM</Label><Input type="number" step="0.5" value={e.pct1RM ?? ""} onChange={(ev) => editEx(si, ei, { pct1RM: num(ev.target.value) })} /></div>
                  <div><Label>RIR</Label><Input type="number" value={e.rir ?? ""} onChange={(ev) => editEx(si, ei, { rir: num(ev.target.value) })} /></div>
                  <div><Label>Rest (s)</Label><Input type="number" step="15" value={e.restSec} onChange={(ev) => editEx(si, ei, { restSec: Number(ev.target.value) })} /></div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground"><b>Progression:</b> {e.progressionRule}</p>
                {e.notes && <p className="text-xs text-amber-800">{e.notes}</p>}
                <RuleBadges ids={e.ruleIds} />
              </div>
            ))}
            <div className="flex items-center gap-2">
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
        <Button variant="outline" onClick={generate} disabled={busy}>Regenerate from assessment</Button>
        {dirty && <span className="text-xs text-amber-800">Unsaved edits: save before approving.</span>}
      </div>

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
