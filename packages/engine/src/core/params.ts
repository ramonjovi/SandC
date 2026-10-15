import type { Rule } from "./types";

/** Clinician overrides of rule default values: ruleId -> key -> value. Only differences from the built-in defaults are kept. */
export type RuleOverrides = Record<string, Record<string, number>>;

export interface Params {
  /** Effective value: clinician override if set, otherwise the rule's built-in default. Throws on unknown keys (catches typos). */
  get(ruleId: string, key: string): number;
  /** Overrides in effect (only those that differ from the defaults). */
  overrides(): RuleOverrides;
}

export function makeParams(rules: Rule[], overrides: RuleOverrides = {}): Params {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const effective: RuleOverrides = {};
  for (const [ruleId, vals] of Object.entries(overrides)) {
    const rule = byId.get(ruleId);
    if (!rule?.defaults) continue;
    for (const [k, v] of Object.entries(vals)) {
      const def = rule.defaults[k];
      if (typeof def === "number" && typeof v === "number" && Number.isFinite(v) && v !== def) (effective[ruleId] ??= {})[k] = v;
    }
  }
  return {
    get(ruleId, key) {
      const o = effective[ruleId]?.[key];
      if (o !== undefined) return o;
      const def = byId.get(ruleId)?.defaults?.[key];
      if (typeof def !== "number") throw new Error(`Unknown rule parameter ${ruleId}.${key}`);
      return def;
    },
    overrides: () => structuredClone(effective),
  };
}
