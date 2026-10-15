import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/utils";

/** Archive (reversible) and permanent delete (typed-name confirmation, only after archiving). */
export function AthleteLifecycle({ athlete, onChanged }: { athlete: { id: string; name: string; archivedAt?: string | null }; onChanged: () => void }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  if (athlete.archivedAt) {
    return (
      <Alert tone="warn" className="space-y-3">
        <div><b>Archived {fmtDate(athlete.archivedAt)}.</b> This athlete is hidden from the list and cannot sign in. Everything is kept and can be restored.</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await api(`/athletes/${athlete.id}/restore`, { method: "POST" }); onChanged(); })}><ArchiveRestore className="h-4 w-4" /> Restore</Button>
          <Button size="sm" variant="destructive" onClick={() => setOpen(!open)}><Trash2 className="h-4 w-4" /> Delete permanently...</Button>
        </div>
        {open && (
          <div className="space-y-2 rounded-lg border border-rose-300 bg-white p-3 text-rose-900">
            <div><b>This cannot be undone.</b> It erases the athlete's assessments, programs, session and weekly logs, reports, invites and sign-in account. The audit trail keeps only that a deletion happened, who did it and when.</div>
            <Label htmlFor="confirm-name">Type the athlete's exact name to confirm: <b>{athlete.name}</b></Label>
            <Input id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            {err && <Alert tone="danger">{err}</Alert>}
            <Button variant="destructive" disabled={busy || typed !== athlete.name}
              onClick={() => run(async () => { await api(`/athletes/${athlete.id}`, { method: "DELETE", body: { confirmName: typed } }); nav("/"); })}>Delete everything for this athlete</Button>
          </div>
        )}
        {!open && err && <Alert tone="danger">{err}</Alert>}
      </Alert>
    );
  }

  return (
    <div className="text-sm">
      <button className="inline-flex items-center gap-1 text-muted-foreground underline cursor-pointer" onClick={() => setOpen(!open)}><Archive className="h-3.5 w-3.5" /> Archive this athlete</button>
      {open && (
        <div className="mt-2 max-w-md space-y-2 rounded-lg border bg-card p-3">
          <p className="text-muted-foreground">Archiving hides the athlete and blocks their sign-in. Nothing is erased, and you can restore them later. Permanent deletion is a second step.</p>
          <Label htmlFor="arch-reason">Reason (optional)</Label>
          <Input id="arch-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          {err && <Alert tone="danger">{err}</Alert>}
          <Button size="sm" disabled={busy} onClick={() => run(async () => { await api(`/athletes/${athlete.id}/archive`, { method: "POST", body: { reason } }); onChanged(); setOpen(false); })}>Archive</Button>
        </div>
      )}
    </div>
  );
}
