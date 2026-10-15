import { Badge } from "./ui";
import { STATUS_LABEL, STATUS_VARIANT, useMeta } from "@/lib/meta";

/** Shows a rule's evidence status; hover for the statement and how it was verified. */
export function RuleBadge({ id }: { id: string }) {
  const { rules } = useMeta();
  const r = rules.find((x) => x.id === id);
  if (!r) return <Badge variant="outline">{id}</Badge>;
  return (
    <Badge variant={STATUS_VARIANT[r.status]} title={`${STATUS_LABEL[r.status]}: ${r.statement}\nVerification: ${r.verification}`}>
      {r.title.length > 38 ? r.title.slice(0, 36) + "..." : r.title}
    </Badge>
  );
}

export function RuleBadges({ ids }: { ids: string[] }) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return null;
  return <div className="mt-1 flex flex-wrap gap-1">{uniq.map((i) => <RuleBadge key={i} id={i} />)}</div>;
}

export function StatusBadge({ status }: { status: keyof typeof STATUS_VARIANT }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
