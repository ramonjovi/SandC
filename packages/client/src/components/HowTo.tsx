import { ListChecks } from "lucide-react";
import type { TestProtocol } from "@tpc/engine";
import { StatusBadge } from "./RuleBadge";
import { useMeta } from "@/lib/meta";

/** Inline "how to run this test" panel for the assessment form. Content comes from the same protocols as the Test protocols page. */
export function HowTo({ id }: { id: string }) {
  const { modules } = useMeta();
  const p = (((modules[0] as any).protocols ?? []) as TestProtocol[]).find((x) => x.id === id);
  if (!p) return null;
  return (
    <details className="col-span-full rounded-lg border border-sky-200 bg-sky-50/60 text-sm">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 font-medium text-sky-900">
        <ListChecks className="h-4 w-4" /> How to run: {p.name} <StatusBadge status={p.status} />
      </summary>
      <div className="space-y-2 px-3 pb-3 pt-1">
        <p className="text-muted-foreground">{p.purpose}</p>
        <div><b>Equipment:</b> {p.equipment.join("; ")}</div>
        <div><b>Set up</b><ul className="ml-5 list-disc">{p.setup.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div><b>Steps</b><ol className="ml-5 list-decimal space-y-0.5">{p.steps.map((s) => <li key={s}>{s}</li>)}</ol></div>
        <div><b>Enter below:</b> {p.records}</div>
        {p.safety && <div className="text-amber-900"><b>Safety:</b> {p.safety}</div>}
        {p.status !== "source_verified" && <div className="text-xs text-muted-foreground">This is the clinic's proposed standard, not from a supplied source: run it exactly the same way at every retest.</div>}
      </div>
    </details>
  );
}
