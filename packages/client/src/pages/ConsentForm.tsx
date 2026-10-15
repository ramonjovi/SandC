import { useEffect, useState } from "react";
import { CheckCircle2, FilePlus2, Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from "@/components/ui";
import { ConsentText } from "@/components/ConsentText";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";

interface Item { id: string; text: string; required: boolean }
interface Template {
  id: string; version: number; title: string; body: string; items: Item[]; status: "draft" | "approved" | "retired";
  createdByName: string; lastEditedByName: string; approvedByName: string | null; approvedAt: string | null; reviewNote: string | null;
  updatedAt: string; unresolved: string[];
}
const TONE = { draft: "warn", approved: "ok", retired: "default" } as const;

/** Manage the consent / privacy form: draft, edit, and approval by a second clinician. */
export function ConsentFormPage() {
  const { data, reload } = useApi<{ hosting: string; activeId: string | null; templates: Template[] }>("/consent/templates");
  const { user } = useAuth();
  const [err, setErr] = useState("");
  if (!data) return <div className="text-sm text-muted-foreground">Loading...</div>;
  const draft = data.templates.find((t) => t.status === "draft");
  const active = data.templates.find((t) => t.id === data.activeId);
  const others = data.templates.filter((t) => t !== draft && t !== active);

  async function newVersion() {
    setErr("");
    try { await api("/consent/templates", { method: "POST", body: {} }); reload(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Consent form</h1>
        <p className="text-sm text-muted-foreground">
          The privacy notice and consent athletes agree to. Every version is written by one clinician and must be <b>reviewed and approved by a different clinician</b> before it can be used.
          A signed record keeps the exact wording the athlete saw.
        </p>
      </div>
      <Alert tone="info">
        <b>Where it says your data is kept:</b> {data.hosting}. This line is filled in automatically from where the app is running, so a form signed on the clinic computer never claims cloud hosting and vice versa.
      </Alert>
      <Alert tone="warn">This is a plain-language template, not legal advice. Have the wording checked against the privacy and health-records law that applies where TPC operates before using it with patients.</Alert>
      {err && <Alert tone="danger">{err}</Alert>}

      {!active && <Alert tone="danger"><b>No approved form yet.</b> Athletes cannot sign in the app until a second clinician approves the draft below. You can still record a signed paper form on an athlete's case page.</Alert>}

      {draft && <DraftEditor key={draft.id + draft.updatedAt} t={draft} me={user?.name ?? ""} onSaved={reload} />}

      {active && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2"><CardTitle>Current form: version {active.version}</CardTitle><Badge variant="ok">in use</Badge></div>
            <CardDescription>
              Written by {active.createdByName}, last edited by {active.lastEditedByName}. <b>Reviewed and approved by {active.approvedByName}</b> on {fmtDateTime(active.approvedAt)}.
              {active.reviewNote ? ` Review note: "${active.reviewNote}"` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <details><summary className="cursor-pointer text-sm font-medium">Read the form and tick-boxes</summary>
              <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4"><ConsentText body={active.body.replaceAll("{{hosting}}", data.hosting)} />
                <ul className="space-y-1 text-sm">{active.items.map((i) => <li key={i.id}>☐ {i.text.replaceAll("{{hosting}}", data.hosting)} <span className="text-xs text-muted-foreground">({i.required ? "required" : "optional"})</span></li>)}</ul></div>
            </details>
            {!draft && <Button variant="outline" onClick={newVersion}><FilePlus2 className="h-4 w-4" /> Start a new version</Button>}
          </CardContent>
        </Card>
      )}

      {others.length > 0 && (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Earlier versions ({others.length})</summary>
          <ul className="mt-2 space-y-1">{others.map((t) => <li key={t.id}>Version {t.version}: <Badge variant={TONE[t.status]}>{t.status}</Badge> approved by {t.approvedByName ?? "—"} {t.approvedAt ? fmtDateTime(t.approvedAt) : ""}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function DraftEditor({ t, me, onSaved }: { t: Template; me: string; onSaved: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const [items, setItems] = useState<Item[]>(t.items);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTitle(t.title); setBody(t.body); setItems(t.items); }, [t.id, t.updatedAt]);

  const blanks = [...new Set((body + " " + items.map((i) => i.text).join(" ")).match(/\[\[[^\]]*\]\]/g) ?? [])];
  const dirty = title !== t.title || body !== t.body || JSON.stringify(items) !== JSON.stringify(t.items);
  const iEditedIt = t.lastEditedByName === me || t.createdByName === me;

  async function save() {
    setBusy(true); setMsg(null);
    try { await api(`/consent/templates/${t.id}`, { method: "PUT", body: { title, body, items } }); setMsg({ tone: "ok", text: "Draft saved." }); onSaved(); }
    catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function approve() {
    setBusy(true); setMsg(null);
    try { await api(`/consent/templates/${t.id}/approve`, { method: "POST", body: { note } }); onSaved(); }
    catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); } finally { setBusy(false); }
  }
  const setItem = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Card className="border-amber-300">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>Draft: version {t.version}</CardTitle><Badge variant="warn">not in use yet</Badge></div>
        <CardDescription>Written by {t.createdByName}; last edited by {t.lastEditedByName}. Fill in every <mark className="rounded bg-amber-200 px-1">[[bracketed]]</mark> part, then ask a <b>different clinician</b> to review and approve it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div><Label htmlFor="ct">Title</Label><Input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label htmlFor="cb">Text (## makes a heading; {"{{hosting}}"} is replaced with where the data is really kept)</Label>
          <Textarea id="cb" className="min-h-96 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Tick-boxes the athlete agrees to</Label>
          {items.map((it, i) => (
            <div key={it.id} className="flex items-start gap-2">
              <Textarea className="min-h-12 flex-1" value={it.text} onChange={(e) => setItem(i, { text: e.target.value })} aria-label={`Tick-box ${i + 1}`} />
              <label className="flex items-center gap-1 pt-2 text-xs"><input type="checkbox" checked={it.required} onChange={(e) => setItem(i, { required: e.target.checked })} /> required</label>
              <Button variant="ghost" size="icon" aria-label="Remove tick-box" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setItems([...items, { id: `i${Date.now() % 100000}`, text: "", required: false }])}><Plus className="h-4 w-4" /> Add tick-box</Button>
        </div>
        <details><summary className="cursor-pointer text-sm font-medium">Preview as the athlete will see it</summary>
          <div className="mt-2 rounded-lg border bg-muted/30 p-4"><ConsentText body={body} /></div></details>

        {blanks.length > 0 && <Alert tone="warn"><b>{blanks.length} blank{blanks.length > 1 ? "s" : ""} still to fill in:</b> {blanks.join(" · ")}</Alert>}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={busy || !dirty}>{dirty ? "Save draft" : "Saved"}</Button></div>

        <div className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 font-medium text-sm"><CheckCircle2 className="h-4 w-4" /> Review and approve (second clinician)</div>
          {iEditedIt
            ? <Alert tone="info">You wrote or last edited this version, so you cannot approve it. Ask another clinician to sign in and approve it. (After they approve, you can use it right away.)</Alert>
            : <>
                <Label htmlFor="rn">What did you check? (required, kept with the approval)</Label>
                <Textarea id="rn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: read every section and tick-box; wording is clear; hosting line is accurate." />
                <Button onClick={approve} disabled={busy || dirty || blanks.length > 0 || note.trim().length < 5}>Approve this version</Button>
                {dirty && <div className="text-xs text-muted-foreground">Save the draft first.</div>}
              </>}
        </div>
      </CardContent>
    </Card>
  );
}
