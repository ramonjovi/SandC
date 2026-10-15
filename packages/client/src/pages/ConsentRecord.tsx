import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { ConsentText } from "@/components/ConsentText";
import { useApi } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/utils";

/** Print-ready copy of the athlete's signed consent (exact wording they saw). */
export function ConsentRecordPage() {
  const { id } = useParams();
  const { data } = useApi<any>(`/athletes/${id}/consent`);
  const { data: detail } = useApi<any>(`/athletes/${id}`);
  if (!data || !detail) return <div className="text-sm text-muted-foreground">Loading...</div>;
  const c = data.history[0];
  if (!c) return <Alert>No consent record to show. {data.summary.status === "active" ? "The older 'consent given' tick on the assessment is the only record." : ""}</Alert>;
  const s = c.snapshot;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/c/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back to case</Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / save as PDF</Button>
      </div>
      <article className="space-y-4 rounded-xl border bg-white p-6 print:border-0 print:p-0">
        <header>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">TPC Performance · Consent record</div>
          <h1 className="text-xl font-semibold">{detail.athlete.name}</h1>
          <div className="text-sm text-muted-foreground">
            {c.mode === "paper"
              ? <>Signed paper form dated {fmtDate(c.signedOn)} by {c.signerName}{c.signerRole === "guardian" ? " (parent or guardian)" : ""}. {s.reference}. Recorded by {c.recordedBy} on {fmtDateTime(c.createdAt)}.</>
              : <>{s.title}, version {c.templateVersion} (reviewed and approved by {s.approvedBy}{s.approvedAt ? `, ${fmtDate(s.approvedAt)}` : ""}). Signed {fmtDate(c.signedOn)} by typing the name below, {c.signedVia === "athlete account" ? "in the athlete's own account" : `on the clinic device (recorded by ${c.recordedBy})`}.</>}
          </div>
          {c.status === "withdrawn" && <div className="mt-1 text-sm font-medium text-rose-700">WITHDRAWN {fmtDate(c.withdrawnAt)}: {c.withdrawnReason}</div>}
        </header>
        {c.mode !== "paper" && (
          <>
            <ConsentText body={s.body} />
            <section>
              <h3 className="font-semibold">What was agreed</h3>
              <ul className="mt-1 space-y-1 text-sm">{s.items.map((i: any) => <li key={i.id}>{i.agreed ? "☑" : "☐"} {i.text} <span className="text-xs text-muted-foreground">({i.required ? "required" : "optional"})</span></li>)}</ul>
            </section>
            <section className="text-sm">
              <div><b>Signed by:</b> {c.signerName}{c.signerRole === "guardian" ? ` (parent or guardian, ${s.relationship})` : " (athlete)"}</div>
              <div><b>Date:</b> {fmtDate(c.signedOn)}</div>
              <div><b>Where records are kept (at the time of signing):</b> {s.hosting}</div>
            </section>
          </>
        )}
      </article>
    </div>
  );
}
