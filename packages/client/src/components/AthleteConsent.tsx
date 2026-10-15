import { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { ConsentText } from "./ConsentText";
import { api } from "@/lib/api";

/** Shown to an athlete who has signed in but has no active consent yet: read the form, tick, type your name. */
export function AthleteConsent({ name, status, onDone }: { name: string; status: string; onDone: () => void }) {
  const [form, setForm] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/me/consent").then(setForm).catch((e) => setErr(e.message)); }, []);

  if (!form) return err ? <Alert tone="danger">{err}</Alert> : <div className="text-sm text-muted-foreground">Loading...</div>;
  const t = form.template;
  const missing = t ? t.items.filter((i: any) => i.required && !answers[i.id]).length : 0;

  async function sign() {
    setBusy(true); setErr("");
    try { await api("/me/consent", { method: "POST", body: { templateId: t.id, answers, signerName: typed } }); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Before we start</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {status === "withdrawn" && <Alert tone="warn">Your consent was withdrawn. Please speak to your clinician.</Alert>}
        {form.minor && <Alert tone="info">Because you are under 18, a parent or guardian needs to sign this with your clinician. Please ask your clinic.</Alert>}
        {!t && <Alert tone="info">Your clinic has not published the consent form yet. Please check with them.</Alert>}
        {t && !form.minor && status !== "withdrawn" && (
          <>
            <p className="text-sm text-muted-foreground">Please read this, tick the boxes and type your full name, {name}. Your clinician can answer any questions.</p>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4"><ConsentText body={t.body} /></div>
            <div className="space-y-2">
              {t.items.map((i: any) => (
                <label key={i.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={Boolean(answers[i.id])} onChange={(e) => setAnswers({ ...answers, [i.id]: e.target.checked })} />
                  <span>{i.text} <span className="text-xs text-muted-foreground">({i.required ? "required" : "optional"})</span></span></label>
              ))}
            </div>
            <div><Label htmlFor="sig">Type your full name to sign</Label><Input id="sig" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="name" /></div>
            {err && <Alert tone="danger">{err}</Alert>}
            <Button className="w-full" onClick={sign} disabled={busy || missing > 0 || typed.trim().length < 3}>I agree and sign</Button>
            {missing > 0 && <div className="text-center text-xs text-muted-foreground">{missing} required box{missing > 1 ? "es" : ""} left to tick</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
