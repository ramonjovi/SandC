import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Copy, FileText, Trash2, UserPlus } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Tabs } from "@/components/ui";
import { LogForm } from "@/components/LogForm";
import { Trends } from "@/components/Trends";
import { Roadmap } from "@/components/Roadmap";
import { api, useApi } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { AssessmentForm } from "./AssessmentForm";
import { Interpretation } from "./Interpretation";
import { ProgramEditor } from "./ProgramEditor";
import { CaseGuide } from "@/components/CaseGuide";
import { AthleteLifecycle } from "@/components/AthleteLifecycle";

type Tab = "assess" | "interpret" | "program" | "progress" | "audit";

export function CasePage() {
  const { id } = useParams();
  const { data, error, reload } = useApi<any>(`/athletes/${id}`);
  const [tab, setTab] = useState<Tab>("assess");
  const [aid, setAid] = useState<string | null>(null);
  const [invite, setInvite] = useState("");

  useEffect(() => { if (data && !aid) setAid(data.baselineId); }, [data, aid]);
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  if (!data || !aid) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const assessment = data.assessments.find((a: any) => a.id === aid) ?? data.assessments[0];
  const forAssessment = data.programs.filter((p: any) => p.assessmentId === assessment.id);
  const programRow = forAssessment.find((p: any) => p.status === "approved") ?? forAssessment.find((p: any) => p.status === "draft") ?? null;
  async function makeInvite() {
    const r = await api(`/athletes/${id}/invite`, { method: "POST", body: {} });
    setInvite(`${location.origin}/invite/${r.token}`);
  }

  async function reassess() {
    const r = await api(`/athletes/${id}/reassessments`, { method: "POST", body: {} });
    await reload(); setAid(r.assessmentId); setTab("assess");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">{data.athlete.name}{data.athlete.isSynthetic && <Badge variant="outline">synthetic</Badge>}</h1>
          <p className="text-sm text-muted-foreground">{assessment.data.goals.event} · {assessment.data.profile.sex}, {assessment.data.profile.age} y · {assessment.data.profile.bodyMassKg} kg</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-8 w-auto text-xs" value={assessment.id} onChange={(e) => setAid(e.target.value)} aria-label="Assessment">
            {data.assessments.map((a: any, i: number) => <option key={a.id} value={a.id}>{a.kind === "baseline" ? "Baseline" : `Reassessment ${i}`} · {fmtDateTime(a.createdAt)}</option>)}
          </Select>
          <Button size="sm" variant="outline" onClick={reassess}>New reassessment</Button>
          {data.account
            ? <Badge variant="ok" title={`Last login ${data.account.lastLoginAt ? fmtDateTime(data.account.lastLoginAt) : "never"}`}>Athlete account: {data.account.email}</Badge>
            : <Button size="sm" variant="secondary" onClick={makeInvite}><UserPlus className="h-3.5 w-3.5" /> Invite athlete</Button>}
        </div>
      </div>

      {invite && (
        <Alert tone="ok" className="space-y-1">
          <div>Send this one-time link to the athlete (valid 7 days). It is shown only now.</div>
          <div className="flex items-center gap-2"><code className="break-all text-xs">{invite}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(invite)}><Copy className="h-3.5 w-3.5" /> Copy</Button></div>
        </Alert>
      )}

      {!data.athlete.archivedAt && !assessment.data.consent?.given && (
        <Alert tone="warn"><b>Consent not recorded.</b> Give the athlete the privacy notice and consent form and record their agreement in the Assess tab before collecting health information.</Alert>
      )}
      <AthleteLifecycle athlete={data.athlete} onChanged={reload} />
      <CaseGuide data={data} assessment={assessment} programRow={programRow} goTab={setTab} />

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "assess", label: "1 · Assess" }, { id: "interpret", label: "2 · Interpret" }, { id: "program", label: "3 · Program" },
        { id: "progress", label: "4 · Progress" }, { id: "audit", label: "Audit" },
      ]} />

      {tab === "assess" && <AssessmentForm assessment={assessment} onSaved={reload} onInterpreted={async () => { await reload(); setTab("interpret"); }} />}
      {tab === "interpret" && <Interpretation assessment={assessment} onChanged={reload} goProgram={() => setTab("program")} />}
      {tab === "program" && <ProgramEditor athleteId={data.athlete.id} assessment={assessment} programRow={programRow} onChanged={reload} />}
      {tab === "progress" && <Progress id={id!} data={data} reload={reload} />}
      {tab === "audit" && <Audit id={id!} />}
    </div>
  );
}

function Progress({ id, data, reload }: { id: string; data: any; reload: () => void }) {
  const { data: roadmap, reload: reloadRoadmap } = useApi<any>(`/athletes/${id}/roadmap`);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [logging, setLogging] = useState<string | null>(null);
  const logs = data.sessionLogs as any[];
  const program = (data.programs.find((p: any) => p.status === "approved")?.data ?? null) as any;
  const refresh = () => { reload(); void reloadRoadmap(); };
  async function apply(logId: string) {
    const r = await api(`/session-logs/${logId}/apply`, { method: "POST", body: {} });
    setMsg(r.changes.length ? `Applied ${r.changes.length} target change(s) to next week.` : "Nothing to apply (all holds)."); refresh();
  }
  async function remove(logId: string) {
    if (!confirm("Delete this session log? This is recorded in the audit history.")) return;
    setErr(""); try { await api(`/session-logs/${logId}`, { method: "DELETE" }); refresh(); } catch (e) { setErr((e as Error).message); }
  }
  const grid: any[] = roadmap?.sessionGrid ?? [];
  const weeks = [...new Set(grid.map((c) => c.week))];
  const openSession = logging ? program?.weeks.flatMap((w: any) => w.sessions).find((s: any) => s.id === logging) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Progress</h2>
        <Link to={`/c/${id}/report`}><Button variant="outline"><FileText className="h-4 w-4" /> Create PDF report for athlete</Button></Link>
      </div>
      {!program && <Alert>Approve a program first; sessions, charts and the roadmap build from it.</Alert>}
      {err && <Alert tone="danger">{err}</Alert>}

      {program && (
        <Card>
          <CardHeader><CardTitle>Sessions</CardTitle><CardDescription>If the athlete forgot to log, enter the session for them (pick the date it was done). Entries you make are marked as clinician-entered.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              {weeks.map((w) => (
                <div key={w} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-14 text-muted-foreground">Week {w}</span>
                  {grid.filter((c) => c.week === w).map((c) => {
                    const sid = `w${c.week}-d${c.day}`;
                    return c.done ? (
                      <span key={sid} className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1">
                        <Badge variant="ok">✓ {c.name}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtDate(c.at)}{c.loggedBy !== "athlete" ? ` · entered by ${c.loggedBy}` : ""}</span>
                        <button className="cursor-pointer text-muted-foreground hover:text-destructive" aria-label={`Delete ${c.name} week ${c.week} log`} onClick={() => remove(c.logId)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                    ) : (
                      <Button key={sid} size="sm" variant={logging === sid ? "default" : "outline"} onClick={() => setLogging(logging === sid ? null : sid)}>Log {c.name}</Button>
                    );
                  })}
                </div>
              ))}
            </div>
            {openSession && (
              <LogForm key={openSession.id} session={openSession} withDate title={`Enter ${openSession.name}, week ${openSession.week}, for the athlete`}
                submit={(body) => api(`/athletes/${id}/session-logs`, { method: "POST", body })} onCancel={() => setLogging(null)} onDone={() => { setLogging(null); setMsg("Session logged on the athlete's behalf."); refresh(); }} />
            )}
          </CardContent>
        </Card>
      )}

      <WeekForClinician athleteId={id} onSaved={refresh} />

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Trends</h3>
        {roadmap ? <Trends roadmap={roadmap} /> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>{roadmap ? <Roadmap roadmap={roadmap} clinician /> : <Alert>Generate a program to see the roadmap.</Alert>}</div>
        <Card>
          <CardHeader><CardTitle>Session logs and proposed next targets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {msg && <Alert tone="ok">{msg}</Alert>}
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No sessions logged yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between"><b>Week {l.week} · Session {String.fromCharCode(64 + l.day)}</b><span className="text-xs text-muted-foreground">{fmtDateTime(l.data.performedAt ?? l.createdAt)}{l.loggedBy !== "athlete" ? ` · by ${l.loggedBy}` : ""}</span></div>
                {l.data.notes && <p className="text-muted-foreground">{l.data.notes}</p>}
                <ul className="mt-1 space-y-1">
                  {l.proposals.filter((p: any) => p.action !== "hold" || l.data.exercises.some((e: any) => e.prescribedId === p.prescribedId)).map((p: any) => (
                    <li key={p.prescribedId} className="text-xs">
                      <Badge variant={p.action === "increase" ? "ok" : p.action === "hold" ? "default" : "warn"}>{p.action.replace("_", " ")}</Badge>{" "}
                      <span className="font-medium">{p.exerciseId.replace(/_/g, " ")}</span>{p.nextLoadKg != null ? ` → ${p.nextLoadKg} kg` : ""}: {p.reason}
                    </li>
                  ))}
                </ul>
                <div className="mt-2">{l.appliedAt ? <Badge variant="ok">Applied {fmtDateTime(l.appliedAt)}</Badge> : <Button size="sm" variant="outline" onClick={() => apply(l.id)}>Apply to next week</Button>}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WeekForClinician({ athleteId, onSaved }: { athleteId: string; onSaved: () => void }) {
  const monday = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(monday());
  const [km, setKm] = useState("");
  const [pain, setPain] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    try { setRes(await api(`/athletes/${athleteId}/weekly-logs`, { method: "POST", body: { weekStart, runKm: Number(km), painModifiedTraining: pain } })); setKm(""); setPain(false); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Card>
      <CardHeader><div className="flex items-center justify-between"><CardTitle>Weekly running volume</CardTitle><Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Close" : "Enter a week for the athlete"}</Button></div></CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Week starting (Monday)</Label><Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} /></div>
            <div><Label>Running distance (km)</Label><Input type="number" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={pain} onChange={(e) => setPain(e.target.checked)} />Pain changed training</label>
          </div>
          {err && <Alert tone="danger">{err}</Alert>}
          {res?.volumeFlag && !res.volumeFlag.ok && <Alert tone="warn">+{res.volumeFlag.increasePct}% on the previous week: above the 10% flag.</Alert>}
          {res && (!res.volumeFlag || res.volumeFlag.ok) && <Alert tone="ok">Saved.</Alert>}
          <Button onClick={save} disabled={!km}>Save week</Button>
        </CardContent>
      )}
    </Card>
  );
}

function Audit({ id }: { id: string }) {
  const { data } = useApi<any[]>(`/athletes/${id}/audit`);
  return (
    <Card><CardHeader><CardTitle>Audit history</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {data?.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b pb-1.5 last:border-0">
            <span className="w-40 text-xs text-muted-foreground">{fmtDateTime(e.at)}</span>
            <Badge variant="outline">{e.actor}</Badge><b>{e.action}</b><span className="text-muted-foreground">{e.entity}</span>
          </div>
        ))}
        {data?.length === 0 && <p className="text-muted-foreground">No entries.</p>}
      </CardContent></Card>
  );
}
