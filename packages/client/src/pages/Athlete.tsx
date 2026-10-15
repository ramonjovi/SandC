import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarCheck, CheckCircle2, Dumbbell, Map as MapIcon, UserRound } from "lucide-react";
import type { PrescribedExercise, ProgramSession } from "@tpc/engine";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from "@/components/ui";
import { Roadmap } from "@/components/Roadmap";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ChangePassword } from "./Account";
import { cn } from "@/lib/utils";

type View = "work" | "roadmap" | "week" | "account";

const call = (_code: string, path: string, body?: unknown) => api(`/me${path === "/me" ? "" : path}`, body ? { method: "POST", body } : {});

export function AthleteApp() {
  const code = "";
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState<View>("work");
  const load = useCallback(() => call(code, "/me").then(setMe).catch((e) => setErr(e.message)), [code]);
  useEffect(() => { void load(); }, [load]);

  if (err) return <div className="mx-auto mt-20 max-w-sm px-4"><Alert tone="danger">{err}. Check your link or ask your clinician for a new one.</Alert></div>;
  if (!me) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  const nav: Array<{ id: View; label: string; icon: typeof Dumbbell }> = [
    { id: "work", label: "Workouts", icon: Dumbbell }, { id: "roadmap", label: "Roadmap", icon: MapIcon }, { id: "week", label: "Weekly log", icon: CalendarCheck }, { id: "account", label: "Account", icon: UserRound },
  ];
  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-24">
      <header className="flex items-center gap-2 border-b bg-card px-4 py-3">
        <Activity className="h-5 w-5 text-primary" /><span className="font-semibold">TPC Performance</span>
        <span className="ml-auto text-sm text-muted-foreground">{me.name}</span>
        <button className="text-sm text-muted-foreground cursor-pointer" onClick={async () => { await logout(); navigate("/login"); }}>Sign out</button>
      </header>
      <main className="space-y-4 px-4 py-4">
        {view === "work" && <Workouts code={code} me={me} reload={load} />}
        {view === "roadmap" && <Roadmap roadmap={me.roadmap} />}
        {view === "week" && <WeeklyLog code={code} me={me} reload={load} />}
        {view === "account" && <ChangePassword />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs cursor-pointer", view === n.id ? "text-primary font-semibold" : "text-muted-foreground")}>
              <n.icon className="h-5 w-5" />{n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

const unitLabel = (e: PrescribedExercise) => (e.unit === "contacts" ? "contacts" : e.unit === "sec" ? "sec" : "reps") + (e.perSide ? " / side" : "");

function Workouts({ code, me, reload }: { code: string; me: any; reload: () => void }) {
  const program = me.program;
  const logs: any[] = me.sessionLogs;
  const done = (w: number, d: number) => logs.find((l) => l.week === w && l.day === d);
  const firstOpen = program?.weeks.find((w: any) => w.sessions.some((s: ProgramSession) => !done(w.week, s.day)))?.week ?? 1;
  const [week, setWeek] = useState<number>(firstOpen);
  const [logging, setLogging] = useState<string | null>(null);

  if (!program) return <Alert>Your clinician is still preparing your program. It will appear here once approved.</Alert>;
  const wk = program.weeks.find((w: any) => w.week === week);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {program.weeks.map((w: any) => {
          const all = w.sessions.every((s: ProgramSession) => done(w.week, s.day));
          return (
            <button key={w.week} onClick={() => setWeek(w.week)} className={cn("flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-sm cursor-pointer", week === w.week ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
              {all && <CheckCircle2 className="h-3.5 w-3.5" />}Wk {w.week}
            </button>
          );
        })}
      </div>
      <div className="text-sm text-muted-foreground"><b>{wk.phase} · {wk.label}</b>. {wk.note}</div>

      {wk.sessions.map((s: ProgramSession) => {
        const log = done(wk.week, s.day);
        return (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-center justify-between"><CardTitle>{s.name}</CardTitle>{log && <Badge variant="ok">Logged</Badge>}</div>
              <CardDescription>{s.focus}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.exercises.map((e) => {
                const prop = log?.proposals.find((p: any) => p.prescribedId === e.id);
                return (
                  <div key={e.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="font-medium text-sm">{e.name}</div>
                    <div className="text-sm">{e.sets} × {e.reps} {unitLabel(e)}{e.loadKg != null ? ` @ ${e.loadKg} kg` : e.category === "plyometric" ? " · bodyweight" : ""}{e.rir != null ? ` · stop with ${e.rir} reps left` : ""} · rest {Math.round(e.restSec / 60 * 10) / 10} min</div>
                    {e.cue && <div className="text-xs text-muted-foreground">{e.cue}</div>}
                    {e.notes && <div className="text-xs text-amber-800">{e.notes}</div>}
                    {prop && <div className="mt-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-900"><b>Next time:</b> {prop.nextLoadKg != null ? `${prop.nextLoadKg} kg · ` : ""}{prop.nextSets} × {prop.nextReps}. {prop.reason} <i>(your clinician confirms)</i></div>}
                  </div>
                );
              })}
              {logging === s.id ? <LogForm code={code} session={s} onDone={() => { setLogging(null); reload(); }} onCancel={() => setLogging(null)} />
                : !log && <Button onClick={() => setLogging(s.id)} className="w-full">Log this session</Button>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LogForm({ code, session, onDone, onCancel }: { code: string; session: ProgramSession; onDone: () => void; onCancel: () => void }) {
  type ExState = { sets: Array<{ reps: string; loadKg: string }>; rir: string; pain: string };
  const [ex, setEx] = useState<Record<string, ExState>>(() =>
    Object.fromEntries(session.exercises.map((e) => [e.id, { sets: Array.from({ length: e.sets }, () => ({ reps: String(e.reps), loadKg: e.loadKg != null ? String(e.loadKg) : "" })), rir: e.rir != null ? String(e.rir) : "", pain: "" }])));
  const [cmj, setCmj] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (id: string, fn: (s: ExState) => ExState) => setEx((o) => ({ ...o, [id]: fn(o[id]) }));
  const n = (v: string) => (v === "" ? null : Number(v));

  async function submit() {
    setBusy(true); setErr("");
    try {
      await call(code, "/session-logs", {
        week: session.week, day: session.day, cmjHeightCm: n(cmj), sessionRpe: n(rpe), notes: notes || undefined,
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
      <div className="text-sm font-semibold">What you actually did</div>
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
      <div className="flex gap-2"><Button onClick={submit} disabled={busy} className="flex-1">Save session</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
    </div>
  );
}

function WeeklyLog({ code, me, reload }: { code: string; me: any; reload: () => void }) {
  const monday = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const [weekStart, setWeekStart] = useState(monday());
  const [km, setKm] = useState("");
  const [pain, setPain] = useState(false);
  const [notes, setNotes] = useState("");
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    try { setRes(await call(code, "/weekly-logs", { weekStart, runKm: Number(km), painModifiedTraining: pain, notes: notes || undefined })); setKm(""); setNotes(""); setPain(false); reload(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Log your week</CardTitle><CardDescription>How much did you run, and how did your body feel?</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Week starting</Label><Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} /></div>
            <div><Label>Running distance (km)</Label><Input type="number" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></div>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={pain} onChange={(e) => setPain(e.target.checked)} />
            Pain made me change my training this week (for 7+ days, or 3 sessions in a row)</label>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {err && <Alert tone="danger">{err}</Alert>}
          {res?.volumeFlag && !res.volumeFlag.ok && <Alert tone="warn">That is {res.volumeFlag.increasePct}% more than last week. A jump above 10% is flagged; your clinician will review.</Alert>}
          {res?.painFlag && <Alert tone="warn">Thanks for flagging pain. Your clinician will follow up before loading increases.</Alert>}
          {res && !res.painFlag && (!res.volumeFlag || res.volumeFlag.ok) && <Alert tone="ok">Saved.</Alert>}
          <Button onClick={save} disabled={!km || !weekStart} className="w-full">Save week</Button>
        </CardContent>
      </Card>
      <div className="space-y-1.5">
        {me.weeklyLogs.map((w: any) => (
          <div key={w.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
            <span>{w.weekStart}</span>
            <span className="flex items-center gap-2">{w.volumeFlag && !w.volumeFlag.ok && <Badge variant="warn">+{w.volumeFlag.increasePct}%</Badge>}{w.painModifiedTraining && <Badge variant="danger">pain</Badge>}<b>{w.runKm} km</b></span>
          </div>
        ))}
      </div>
    </div>
  );
}
