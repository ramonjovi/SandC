import { useState } from "react";
import { Card, CardContent, Tabs } from "@/components/ui";
import { StatusBadge } from "@/components/RuleBadge";
import { useMeta } from "@/lib/meta";

type F = "all" | "source_verified" | "proposed_default" | "needs_verification";

export function RulesPage() {
  const { rules } = useMeta();
  const [f, setF] = useState<F>("all");
  const shown = rules.filter((r) => f === "all" || r.status === f);
  const count = (s: F) => rules.filter((r) => s === "all" || r.status === s).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Rule registry</h1>
        <p className="text-sm text-muted-foreground">
          Every rule the engine applies, classified by evidence. "Source-verified" means checked by reading the cited paper page in this project's
          knowledge base. Defaults are editable starting points, not clinical standards.
        </p>
      </div>
      <Tabs<F> value={f} onChange={setF} tabs={[
        { id: "all", label: `All (${count("all")})` },
        { id: "source_verified", label: `Verified (${count("source_verified")})` },
        { id: "proposed_default", label: `Defaults (${count("proposed_default")})` },
        { id: "needs_verification", label: `Needs verification (${count("needs_verification")})` },
      ]} />
      <div className="grid gap-3">
        {shown.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-1.5 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.title}</span>
                <StatusBadge status={r.status} />
                <code className="text-[11px] text-muted-foreground">{r.id}</code>
              </div>
              <p className="text-sm">{r.statement}</p>
              {r.source && <p className="text-xs text-muted-foreground"><b>Source:</b> {r.source}</p>}
              <p className="text-xs text-muted-foreground"><b>Verification:</b> {r.verification}</p>
              {r.defaults && <p className="text-xs text-muted-foreground"><b>Default values:</b> {Object.entries(r.defaults).map(([k, v]) => `${k}=${v}`).join(", ")}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
