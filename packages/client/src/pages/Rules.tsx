import { useState } from "react";
import { Pencil } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, Input, Label, Tabs, Textarea } from "@/components/ui";
import { StatusBadge } from "@/components/RuleBadge";
import { api, useApi } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { fmtDateTime } from "@/lib/utils";

type F = "all" | "source_verified" | "proposed_default" | "needs_verification";
type View = "registry" | "history";
interface Override { ruleId: string; key: string; value: number; updatedBy: string; updatedAt: string }

export function RulesPage() {
  const { rules } = useMeta();
  const [f, setF] = useState<F>("all");
  const [view, setView] = useState<View>("registry");
  const overrides = useApi<Override[]>("/rules/overrides");
  const audit = useApi<any[]>("/rules/audit");
  const shown = rules.filter((r) => f === "all" || r.status === f);
  const count = (s: F) => rules.filter((r) => s === "all" || r.status === s).length;
  const ovFor = (ruleId: string) => (overrides.data ?? []).filter((o) => o.ruleId === ruleId);
  const reload = () => { void overrides.reload(); void audit.reload(); };
  const customised = new Set((overrides.data ?? []).map((o) => o.ruleId)).size;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Rule registry</h1>
        <p className="text-sm text-muted-foreground">
          Every rule the engine applies, classified by evidence. "Source-verified" means checked against the cited paper or book text. Numeric defaults can be
          edited for the whole clinic; every change needs a reason and is kept in the change history.
        </p>
      </div>
      <Tabs<View> value={view} onChange={setView} tabs={[{ id: "registry", label: `Rules${customised ? ` (${customised} customised)` : ""}` }, { id: "history", label: "Change history" }]} />

      {view === "history" && <History rows={audit.data ?? []} />}

      {view === "registry" && (
        <>
          <Tabs<F> value={f} onChange={setF} tabs={[
            { id: "all", label: `All (${count("all")})` },
            { id: "source_verified", label: `Verified (${count("source_verified")})` },
            { id: "proposed_default", label: `Defaults (${count("proposed_default")})` },
            { id: "needs_verification", label: `Needs verification (${count("needs_verification")})` },
          ]} />
          <div className="grid gap-3">
            {shown.map((r) => <RuleCard key={r.id} rule={r} overrides={ovFor(r.id)} onSaved={reload} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RuleCard({ rule, overrides, onSaved }: { rule: any; overrides: Override[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const meta = rule.paramMeta as Record<string, { label: string; min: number; max: number; step?: number; unit?: string }> | undefined;
  const current = (k: string): number => overrides.find((o) => o.key === k)?.value ?? rule.defaults[k];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function begin() { setVals(Object.fromEntries(Object.keys(meta!).map((k) => [k, String(current(k))]))); setReason(""); setErr(""); setOpen(true); }
  async function save(reset: boolean) {
    setBusy(true); setErr("");
    try {
      await api(`/rules/${rule.id}/defaults`, { method: "PUT", body: reset ? { reset: true, reason } : { values: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v === "" ? NaN : Number(v)])), reason } });
      setOpen(false); onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardContent className="space-y-1.5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{rule.title}</span>
          <StatusBadge status={rule.status} />
          {overrides.length > 0 && <Badge variant="warn">customised</Badge>}
          <code className="text-[11px] text-muted-foreground">{rule.id}</code>
          {meta && !open && <Button size="sm" variant="outline" className="ml-auto" onClick={begin}><Pencil className="h-3.5 w-3.5" /> Edit values</Button>}
        </div>
        <p className="text-sm">{rule.statement}</p>
        {rule.source && <p className="text-xs text-muted-foreground"><b>Source:</b> {rule.source}</p>}
        <p className="text-xs text-muted-foreground"><b>Verification:</b> {rule.verification}</p>

        {meta && !open && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
            {Object.keys(meta).map((k) => {
              const o = overrides.find((x) => x.key === k);
              return (
                <span key={k} className={o ? "font-medium text-amber-800" : "text-muted-foreground"}>
                  {meta[k].label}: <b>{current(k)}</b> {meta[k].unit}{o ? ` (default ${rule.defaults[k]}; set by ${o.updatedBy}, ${fmtDateTime(o.updatedAt)})` : ""}
                </span>
              );
            })}
          </div>
        )}

        {meta && open && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <Alert tone="info">
              Changes apply to <b>new</b> interpretations, newly generated programs and future athlete logging. Programs already generated or approved keep the values they were built with.
              {rule.status === "source_verified" && " This rule is source-verified: values are limited to the range the source supports, and any change departs from the built-in default."}
              {rule.status === "needs_verification" && " This rule is not yet verified against a source: your value becomes the clinic's working assumption."}
            </Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(meta).map(([k, m]) => (
                <div key={k}>
                  <Label htmlFor={`${rule.id}-${k}`}>{m.label}{m.unit ? ` (${m.unit})` : ""}</Label>
                  <Input id={`${rule.id}-${k}`} type="number" step={m.step ?? "any"} min={m.min} max={m.max} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
                  <div className="text-[11px] text-muted-foreground">Default {rule.defaults[k]} · allowed {m.min} to {m.max}</div>
                </div>
              ))}
            </div>
            <div><Label htmlFor={`${rule.id}-reason`}>Reason for this change (required, kept in the history)</Label>
              <Textarea id={`${rule.id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the clinic changing this?" /></div>
            {err && <Alert tone="danger">{err}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || reason.trim().length < 5} onClick={() => save(false)}>Save changes</Button>
              {overrides.length > 0 && <Button variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => save(true)}>Reset to built-in defaults</Button>}
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function History({ rows }: { rows: any[] }) {
  const { rules } = useMeta();
  const title = (id: string) => rules.find((r) => r.id === id)?.title ?? id;
  const label = (id: string, key: string) => (rules.find((r) => r.id === id) as any)?.paramMeta?.[key]?.label ?? key;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No changes yet. All values are the built-in defaults.</p>;
  return (
    <div className="space-y-3">
      {rows.map((e) => (
        <Card key={e.id}>
          <CardContent className="space-y-1 pt-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{title(e.entityId)}</b>
              <Badge variant={e.action === "reset-default" ? "default" : "warn"}>{e.action === "reset-default" ? "reset to defaults" : "edited"}</Badge>
              <span className="text-xs text-muted-foreground">{e.actor} · {fmtDateTime(e.at)}</span>
            </div>
            <ul className="ml-4 list-disc">
              {e.detail?.changes?.map((c: any) => (
                <li key={c.key}>{label(e.entityId, c.key)}: <b>{c.from}</b> → <b>{c.to}</b> <span className="text-muted-foreground">(default {c.default})</span></li>
              ))}
            </ul>
            <p className="text-muted-foreground"><b>Reason:</b> {e.detail?.reason}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
