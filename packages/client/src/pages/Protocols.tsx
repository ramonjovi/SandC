import { Printer } from "lucide-react";
import type { TestProtocol } from "@tpc/engine";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusBadge } from "@/components/RuleBadge";
import { useMeta } from "@/lib/meta";

export function ProtocolsPage() {
  const { modules } = useMeta();
  const protocols = ((modules[0] as any).protocols ?? []) as TestProtocol[];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Test protocols</h1>
          <p className="text-sm text-muted-foreground">
            Field battery for a clinic with a treadmill, barbell and rack, and a phone. Keep every test identical at baseline and retest: these tests are
            tracked for change against the athlete's own results.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>
      <Alert tone="info">
        The label on each protocol says how well it is supported: <b>Source-verified</b> means the procedure was read in the supplied texts;
        <b> Needs verification</b> means it is the clinic's proposed standard, so write down exactly how you ran it.
      </Alert>
      {protocols.map((p, i) => (
        <Card key={p.id} className="break-inside-avoid">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2"><CardTitle>{i + 1}. {p.name}</CardTitle><StatusBadge status={p.status} /></div>
            <p className="text-sm text-muted-foreground">{p.purpose}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><b>Equipment:</b> {p.equipment.join("; ")}</div>
            <div><b>Setup</b><ul className="ml-5 list-disc">{p.setup.map((s) => <li key={s}>{s}</li>)}</ul></div>
            <div><b>Steps</b><ol className="ml-5 list-decimal space-y-0.5">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
            <div><b>Enter in the app:</b> {p.records}</div>
            {p.safety && <Alert tone="warn"><b>Safety:</b> {p.safety}</Alert>}
            <div className="text-xs text-muted-foreground"><b>Used for:</b> {p.usedFor}</div>
            {p.source && <div className="text-xs text-muted-foreground"><b>Source:</b> {p.source}</div>}
            {p.note && <div className="text-xs text-muted-foreground"><b>Note:</b> {p.note}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
