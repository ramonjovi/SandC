import { CORE_RULES } from "../../core/rules";
import { makeParams, type Params, type RuleOverrides } from "../../core/params";
import { RUNNING_RULES } from "./rules";

export const RUNNING_ALL_RULES = [...CORE_RULES, ...RUNNING_RULES];
export const defaultParams: Params = makeParams(RUNNING_ALL_RULES);
export const runningParams = (overrides?: RuleOverrides): Params => (overrides ? makeParams(RUNNING_ALL_RULES, overrides) : defaultParams);
