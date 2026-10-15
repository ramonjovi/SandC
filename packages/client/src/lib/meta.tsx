import { createContext, useContext } from "react";
import type { Rule } from "@tpc/engine";

export interface Meta {
  authRequired: boolean;
  rules: Array<Rule & { module: string }>;
  modules: Array<{ id: string; name: string; priorities: Array<{ key: string; label: string }> }>;
}
export const MetaContext = createContext<Meta | null>(null);
export const useMeta = () => {
  const m = useContext(MetaContext);
  if (!m) throw new Error("Meta not loaded");
  return m;
};

export const STATUS_LABEL: Record<Rule["status"], string> = {
  source_verified: "Source-verified",
  proposed_default: "Proposed default",
  needs_verification: "Needs verification",
};
export const STATUS_VARIANT = { source_verified: "verified", proposed_default: "default_", needs_verification: "verify" } as const;
