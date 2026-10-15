import type { Params } from "./params";
import type { EngineReport, Program, Rule, TestProtocol } from "./types";

/** Contract every sport module implements. The core never imports a specific sport. */
export interface SportModule<Assessment = any, ProgramOpts = any> {
  id: string;
  name: string;
  rules: Rule[];
  protocols?: TestProtocol[];
  priorityKeys(): Array<{ key: string; label: string }>;
  computeMetrics(assessment: Assessment): Record<string, number | string | null>;
  interpret(assessment: Assessment, params?: Params): EngineReport;
  generateProgram(assessment: Assessment, report: EngineReport, opts: ProgramOpts): Program;
}

const registry = new Map<string, SportModule>();

export function registerModule(m: SportModule) {
  registry.set(m.id, m);
}
export function getModule(id: string): SportModule {
  const m = registry.get(id);
  if (!m) throw new Error(`Unknown sport module: ${id}`);
  return m;
}
export function listModules(): SportModule[] {
  return [...registry.values()];
}
