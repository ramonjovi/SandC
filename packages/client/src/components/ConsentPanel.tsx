import { useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature, Printer } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, Input, Label, Select, Textarea } from "@/components/ui";
import { ConsentText } from "./ConsentText";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/utils";

interface Summary { status: "none" | "active" | "withdrawn"; source: string | null; id: string | null; version: number | null; signedOn: string | null; signerName: string | null; signerRole: string | null; recordedBy: string | null }

/** Consent card for the case page: shows the status, records consent (in-app on the clinic device, or a signed paper form), and withdrawal. */
export function ConsentPanel({ athleteId, athleteName, summary, onChanged }: { athleteId: string; athleteName: string; summary: Summary; onChanged: () => void }) {
  const [mode, setMode] = useState<null | "in-app" | "paper" | "withdraw">(null);
  const active = summary.status === "active";
  return (
    <Card className={active ? "border-emerald-200" : "border-amber-300"}>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <FileSignature className="h-4 w-4" />
          <span className="font-semibold">Consent</span>
          {active && <Badge variant="ok">Recorded{summary.version ? ` · form v${summary.version}` : ""} · {summary.source}</Badge>}
          {summary.status === "withdrawn" && <Badge variant="danger">Withdrawn</Badge>}
          {summary.status === "none" && <Badge variant="warn">Not recorded</Badge>}
          {active && <span className="text-xs text-muted-foreground">{summary.signerName ? `${summary.signerName}${summary.signerRole === "guardian" ? " (guardian)" : ""}, ` : ""}{summary.signedOn ? fmtDate(summary.signedOn) : ""}{summary.recordedBy ? ` · recorded by ${summary.recordedBy}` : ""}</span>}
          <span className="ml-auto flex flex-wrap gap-2">
            {summary.id && <Link to={`/c/${athleteId}/consent`}><Button size="sm" variant="outline"><Printer className="h-3.5 w-3.5" /> View / print</Button></Link>}
            {active && summary.id && <Button size="sm" variant="ghost" onClick={() => setMode(mode === "withdraw" ? null : "withdraw")}>Withdraw</Button>}
          </span>
        </div>

        {summary.status !== "active" && (
          <>
            <Alert tone={summary.status === "withdrawn" ? "danger" : "warn"}>
              {summary.status === "withdrawn"
                ? "Consent was withdrawn. Program approval and the athlete's own view are blocked. Record new consent to continue, or archive the athlete if they have left."
                : "Record consent before collecting health information and before approving a program. Choose how it was given:"}
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setMode(mode === "in-app" ? null : "in-app")}>Read and sign here</Button>
              <Button size="sm" variant="outline" onClick={() => setMode(mode === "paper" ? null : "paper")}>Signed paper form is on file</Button>
            </div>
          </>
        )}
        {summary.status === "active" && (
          <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setMode(mode === "in-app" ? null : "in-app")}>Record a new signature</Button></div>
        )}

        {mode === "in-app" && <SignHere athleteId={athleteId} athleteName={athleteName} onDone={() => { setMode(null); onChanged(); }} />}
        {mode === "paper" && <Paper athleteId={athleteId} athleteName={athleteName} onDone={() => { setMode(null); onChanged(); }} />}
        {mode === "withdraw" && summary.id && <Withdraw id={summary.id} onDone={() => { setMode(null); onChanged(); }} />}
      </CardContent>
    </Card>
  );
}

function SignHere({ athleteId, athleteName, onDone }: { athleteId: string; athleteName: string; onDone: () => void }) {
  const [loaded, setLoaded] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<"athlete" | "guardian">("athlete");
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!loaded) {
    api("/consent/active").then(setLoaded).catch((e) => setErr(e.message));
    return err ? <Alert tone="danger">{err}</Alert> : <div className="text-sm text-muted-foreground">Loading the form...</div>;
  }
  const t = loaded.template;
  if (!t) return <Alert tone="danger">No consent form has been approved yet. A second clinician must approve it on the Consent form page, or record a signed paper form instead.</Alert>;
  const missing = t.items.filter((i: any) => i.required && !answers[i.id]).length;
  async function submit() {
    setBusy(true); setErr("");
    try {
      await api(`/athletes/${athleteId}/consent`, { method: "POST", body: { mode: "in-app", templateId: t.id, answers, signerName: name, signerRole: role, relationship: rel } });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">Give the athlete this screen (or read it aloud), let them ask questions, then they tick and type their name. Form version {t.version}, reviewed and approved by {t.approvedByName}.</div>
      <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-4"><ConsentText body={t.body} /></div>
      <div className="space-y-2">
        {t.items.map((i: any) => (
          <label key={i.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={Boolean(answers[i.id])} onChange={(e) => setAnswers({ ...answers, [i.id]: e.target.checked })} />
            <span>{i.text} <span className="text-xs text-muted-foreground">({i.required ? "required" : "optional"})</span></span></label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label>Who is signing</Label><Select value={role} onChange={(e) => setRole(e.target.value as any)}><option value="athlete">The athlete</option><option value="guardian">Parent or guardian</option></Select></div>
        <div><Label>Type your full name (this is the signature)</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "athlete" ? athleteName : "Parent / guardian name"} /></div>
        {role === "guardian" && <div><Label>Relationship to the athlete</Label><Input value={rel} onChange={(e) => setRel(e.target.value)} placeholder="mother, father, guardian..." /></div>}
      </div>
      {err && <Alert tone="danger">{err}</Alert>}
      <Button onClick={submit} disabled={busy || missing > 0 || name.trim().length < 3}>I agree and sign</Button>
      {missing > 0 && <span className="ml-2 text-xs text-muted-foreground">{missing} required tick-box{missing > 1 ? "es" : ""} left</span>}
    </div>
  );
}

function Paper({ athleteId, athleteName, onDone }: { athleteId: string; athleteName: string; onDone: () => void }) {
  const [name, setName] = useState(athleteName);
  const [role, setRole] = useState<"athlete" | "guardian">("athlete");
  const [ref, setRef] = useState("");
  const [on, setOn] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  async function submit() {
    setErr("");
    try { await api(`/athletes/${athleteId}/consent`, { method: "POST", body: { mode: "paper", signerName: name, signerRole: role, reference: ref, signedOn: on } }); onDone(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">Use this when the athlete signed a printed copy of the privacy notice and consent form. By saving, you confirm the signed copy is on file.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Who signed</Label><Select value={role} onChange={(e) => setRole(e.target.value as any)}><option value="athlete">The athlete</option><option value="guardian">Parent or guardian</option></Select></div>
        <div><Label>Name on the form</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Date on the form</Label><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></div>
        <div><Label>Which form, and where the signed copy is kept</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TPC consent form, blue folder" /></div>
      </div>
      {err && <Alert tone="danger">{err}</Alert>}
      <Button onClick={submit}>Save paper consent</Button>
    </div>
  );
}

function Withdraw({ id, onDone }: { id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  async function submit() { try { await api(`/consents/${id}/withdraw`, { method: "POST", body: { reason } }); onDone(); } catch (e) { setErr((e as Error).message); } }
  return (
    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
      <p className="text-sm">Withdrawing blocks new program approvals and the athlete's own view. It does not erase records: use Archive, then Delete permanently, if they ask for deletion.</p>
      <Label>Who withdrew and why</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      {err && <Alert tone="danger">{err}</Alert>}
      <Button variant="destructive" size="sm" disabled={reason.trim().length < 3} onClick={submit}>Record withdrawal</Button>
    </div>
  );
}
