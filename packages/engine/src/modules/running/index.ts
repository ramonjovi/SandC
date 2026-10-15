import type { SportModule } from "../../core/module";
import { generateRunnerProgram } from "./program";
import { computeMetrics, interpretRunner, PRIORITY_DEFS } from "./interpret";
import { RUNNING_RULES } from "./rules";
import { RUNNING_PROTOCOLS } from "./protocols";
import { EXERCISE_GUIDES } from "./exerciseGuides";
import type { RunnerAssessment, RunnerProgramOpts } from "./types";

export const runningModule: SportModule<RunnerAssessment, RunnerProgramOpts> = {
  id: "running",
  name: "Running (800 m to marathon)",
  rules: RUNNING_RULES,
  protocols: RUNNING_PROTOCOLS,
  exerciseGuides: EXERCISE_GUIDES,
  priorityKeys: () => PRIORITY_DEFS,
  interpret: interpretRunner,
  computeMetrics,
  generateProgram: generateRunnerProgram,
};

export * from "./types";
export * from "./vdot";
export * from "./tier";
export * from "./onerm";
export * from "./params";
export * from "./interpret";
export * from "./program";
export * from "./exercises";
export * from "./protocols";
export * from "./exerciseGuides";
export { RUNNING_RULES } from "./rules";
