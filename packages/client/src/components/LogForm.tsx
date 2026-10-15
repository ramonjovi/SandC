import { useState } from "react";
import type { PrescribedExercise, ProgramSession } from "@tpc/engine";
import { Alert, Button, Input, Label, Textarea } from "./ui";

export const unitLabel = (e: PrescribedExercise) => (e.unit === "contacts" ? "contacts" : e.unit === "sec" ? "sec" : "reps") + (e.perSide ? " / side" : "");

/**
 * Session logging form, shared by the athlete (their own phone) and the clinician (entering a session on the athlete's behalf).
 * `submit` posts the payload; `withDate` shows a date field for back-dating.
 */
export function LogForm({ session, submit: post, onDone, onCancel, withDate = false, title = "What you actually did" }: {
  session: ProgramSession; submit: (payload: unknown) => Promise<unknown>; onDone: () => void; onCancel: () => void; withDate?: boolean; title?: string;
}) {
  type ExState = { sets: Array<{ reps: string; loadKg: string }>; rir: string; pain: string };
  const [ex, setEx] = useState<Record<string, ExState>>(() =>
    Object.fromEntries(session.exercises.map((e) => [e.id, { sets: Array.from({ length: e.sets }, () => ({ reps: String(e.reps), loadKg: e.loadKg != null ? String(e.loadKg) : "" })), rir: e.rir != null ? String(e.rir) : "", pain: "" }])));
  const [cmj, setCmj] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (id: string, fn: (s: ExState) => ExState) => setEx((o) => ({ ...o, [id]: fn(o[id]) }));
  const n = (v: string) => (v === "" ? null : Number(v));

  async function go() {
    setBusy(true); setErr("");
    try {
      await post({
        week: session.week, day: session.day, cmjHeightCm: n(cmj), sessionRpe: n(rpe), notes: notes || undefined,
        performedAt: withDate ? new Date(`${date}T12:00:00`).toISOString() : undefined,
        exercises: session.exercises.map((e) => ({
          prescribedId: e.id, exerciseId: e.exerciseId, rirFinal: n(ex[e.id].rir), pain: n(ex[e.id].pain),
          sets: ex[e.id].sets.map((s) => ({ reps: Number(s.reps) || 0, loadKg: n(s.loadKg) })),
        })),
      });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="space-y-4 rounded-xl border-2 border-primary/30 p-3">
      <div className="text-sm font-semibold">{title}</div>
      {withDate && <div className="max-w-xs"><Label>Date the session was done</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>}
      {session.exercises.map((e) => (
        <div key={e.id} className="space-y-1.5">
          <div className="text-sm font-medium">{e.name}</div>
          {ex[e.id].sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              <Input type="number" inputMode="numeric" aria-label={`Set ${i + 1} ${unitLabel(e)}`} value={s.reps} onChange={(v) => patch(e.id, (o) => ({ ...o, sets: o.sets.map((x, j) => (j === i ? { ...x, reps: v.target.value } : x)) }))} />
              {e.category !== "plyometric" && e.unit !== "sec" ? <Input type="number" inputMode="decimal" step="2.5" placeholder="kg" aria-label={`Set ${i + 1} load kg`} value={s.loadKg} onChange={(v) => patch(e.id, (o) => ({ ...o, sets: o.sets.map((x, j) => (j === i ? { ...x, loadKg: v.target.value } : x)) }))} /> : <span className="text-xs text-muted-foreground">{unitLabel(e)}</span>}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            {e.rir != null && <div><Label>Reps left after last set</Label><Input type="number" inputMode="numeric" value={ex[e.id].rir} onChange={(v) => patch(e.id, (o) => ({ ...o, rir: v.target.value }))} /></div>}
            <div><Label>Pain 0-10</Label><Input type="number" inputMode="numeric" min={0} max={10} placeholder="0" value={ex[e.id].pain} onChange={(v) => patch(e.id, (o) => ({ ...o, pain: v.target.value }))} /></div>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Jump height before session (cm, optional)</Label><Input type="number" inputMode="decimal" value={cmj} onChange={(e) => setCmj(e.target.value)} /></div>
        <div><Label>Session effort 0-10</Label><Input type="number" inputMode="decimal" value={rpe} onChange={(e) => setRpe(e.target.value)} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {err && <Alert tone="danger">{err}</Alert>}
      <div className="flex gap-2"><Button onClick={go} disabled={busy} className="flex-1">Save session</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}
