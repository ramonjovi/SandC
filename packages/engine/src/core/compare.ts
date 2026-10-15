import type { EngineReport, Priority, StrategyKey } from "./types";

export interface PtInterpretation {
  /** Priority keys the PT selected, ordered by importance. */
  priorityKeys: string[];
  strategy: StrategyKey;
  /** Free-text clinical reasoning. */
  reasoning: string;
  /** Clinical context the engine cannot see. */
  concerns?: string;
}

export interface Disagreement {
  kind: "priority_engine_only" | "priority_pt_only" | "strategy" | "rank";
  key: string;
  label: string;
  engine: string;
  pt: string;
  engineReasoning: string;
  ruleIds: string[];
}

export interface Comparison {
  agreement: Array<{ key: string; label: string }>;
  disagreements: Disagreement[];
  strategyAgrees: boolean;
  summary: string;
}

export const STRATEGY_LABEL: Record<StrategyKey, string> = {
  high_load: "High-load resistance emphasis",
  plyometric: "Plyometric / reactive emphasis",
  combined: "Combined (heavy + plyometric)",
};

/** Compare the engine's independent conclusions with the PT's. Never changes either side. */
export function compareInterpretations(
  engine: EngineReport,
  pt: PtInterpretation,
  labelFor: (key: string) => string = (k) => k,
): Comparison {
  const enginePri = new Map<string, Priority>(engine.priorities.map((p) => [p.key, p]));
  const ptSet = new Set(pt.priorityKeys);
  const agreement: Comparison["agreement"] = [];
  const disagreements: Disagreement[] = [];

  for (const p of engine.priorities) {
    if (ptSet.has(p.key)) {
      agreement.push({ key: p.key, label: p.label });
      const ptRank = pt.priorityKeys.indexOf(p.key) + 1;
      if (Math.abs(ptRank - p.rank) >= 2) {
        disagreements.push({
          kind: "rank",
          key: p.key,
          label: p.label,
          engine: `Engine rank #${p.rank}`,
          pt: `PT rank #${ptRank}`,
          engineReasoning: p.rationale,
          ruleIds: p.ruleIds,
        });
      }
    } else {
      disagreements.push({
        kind: "priority_engine_only",
        key: p.key,
        label: p.label,
        engine: `Prioritised (#${p.rank})`,
        pt: "Not selected",
        engineReasoning: p.rationale,
        ruleIds: p.ruleIds,
      });
    }
  }
  for (const k of pt.priorityKeys) {
    if (!enginePri.has(k)) {
      disagreements.push({
        kind: "priority_pt_only",
        key: k,
        label: labelFor(k),
        engine: "Not flagged by engine",
        pt: "Selected by PT",
        engineReasoning:
          "The engine found no data-driven reason to prioritise this quality. Clinical context outside the entered data may justify it.",
        ruleIds: [],
      });
    }
  }
  const strategyAgrees = pt.strategy === engine.strategy.key;
  if (!strategyAgrees) {
    disagreements.push({
      kind: "strategy",
      key: "strategy",
      label: "S&C strategy",
      engine: STRATEGY_LABEL[engine.strategy.key],
      pt: STRATEGY_LABEL[pt.strategy],
      engineReasoning: engine.strategy.rationale,
      ruleIds: engine.strategy.ruleIds,
    });
  }
  const summary =
    disagreements.length === 0
      ? "PT and engine reached the same priorities and strategy."
      : `${agreement.length} shared priorit${agreement.length === 1 ? "y" : "ies"}; ${disagreements.length} point${disagreements.length === 1 ? "" : "s"} of disagreement to review.`;
  return { agreement, disagreements, strategyAgrees, summary };
}
