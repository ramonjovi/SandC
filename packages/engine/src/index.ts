import { registerModule, getModule } from "./core/module";
import { CORE_RULES } from "./core/rules";
import { runningModule } from "./modules/running";
import type { Rule } from "./core/types";

registerModule(runningModule);

export * from "./core/types";
export * from "./core/util";
export * from "./core/progression";
export * from "./core/compare";
export * from "./core/roadmap";
export * from "./core/module";
export { CORE_RULES } from "./core/rules";
export { SYNTHETIC_ALEX, SYNTHETIC_SAM } from "./fixtures";
export * as running from "./modules/running";

/** Every rule known to the engine, for the clinician-facing rule registry. */
export function allRules(): Array<Rule & { module: string }> {
  return [
    ...CORE_RULES.map((r) => ({ ...r, module: "core" })),
    ...runningModule.rules.map((r) => ({ ...r, module: runningModule.id })),
  ];
}

export { getModule };
