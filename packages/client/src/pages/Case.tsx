import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Copy, UserPlus } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Select, Tabs } from "@/components/ui";
import { Roadmap } from "@/components/Roadmap";
import { api, useApi } from "@/lib/api";
import { fmtDateTime } from "@/lib/utils";
import { AssessmentForm } from "./AssessmentForm";
import { Interpretation } from "./Interpretation";
import { ProgramEditor } from "./ProgramEditor";

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
  const { data: roadmap } = useApi<any>(`/athletes/${id}/roadmap`);
  const [msg, setMsg] = useState("");
  const logs = data.sessionLogs as any[];
  async function apply(logId: string) {
    const r = await api(`/session-logs/${logId}/apply`, { method: "POST", body: {} });
    setMsg(r.changes.length ? `Applied ${r.changes.length} target change(s) to next week.` : "Nothing to apply (all holds)."); reload();
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>{roadmap ? <Roadmap roadmap={roadmap} clinician /> : <Alert>Generate a program to see the roadmap.</Alert>}</div>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Session logs and proposed next targets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {msg && <Alert tone="ok">{msg}</Alert>}
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No sessions logged yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between"><b>Week {l.week} · Session {l.day === 1 ? "A" : "B"}</b><span className="text-xs text-muted-foreground">{fmtDateTime(l.createdAt)}</span></div>
                {l.data.notes && <p className="text-muted-foreground">{l.data.notes}</p>}
                <ul className="mt-1 space-y-1">
                  {l.proposals.filter((p: any) => p.action !== "hold" || l.data.exercises.some((e: any) => e.prescribedId === p.prescribedId)).map((p: any) => (
                    <li key={p.prescribedId} className="text-xs">
                      <Badge variant={p.action === "increase" ? "ok" : p.action === "increase" ? "ok" : p.action === "hold" ? "default" : "warn"}>{p.action.replace("_", " ")}</Badge>{" "}
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
