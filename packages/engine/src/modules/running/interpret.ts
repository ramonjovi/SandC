import type { EngineReport, Finding, Priority, SafetyFlag, SiteRestriction, Strategy } from "../../core/types";
import { epley1RM, round1, round2 } from "../../core/util";
import { SITE_EXCLUSIONS } from "./exercises";
import type { RunnerAssessment } from "./types";
import type { Params } from "../../core/params";
import { defaultParams } from "./params";
import { trainingTier } from "./tier";
import { breakMultiplier, fmtPace, fmtTime, paceZones, predictTimeSec, vdotFromRace } from "./vdot";

export const ENGINE_VERSION = "0.1.0";

export const PRIORITY_DEFS: Array<{ key: string; label: string }> = [
  { key: "max_strength", label: "Maximal lower-body strength" },
  { key: "power_rfd", label: "Rate of force development / reactive power" },
  { key: "calf_soleus", label: "Calf-soleus and Achilles capacity" },
  { key: "unilateral_symmetry", label: "Side-to-side symmetry" },
  { key: "hip_stability", label: "Hip / pelvic control (frontal plane)" },
  { key: "posterior_chain", label: "Hamstring / posterior-chain capacity" },
  { key: "gait_mechanics", label: "Running mechanics (symptomatic overstride)" },
];
const LABEL = Object.fromEntries(PRIORITY_DEFS.map((p) => [p.key, p.label]));

export interface Metrics {
  [k: string]: number | string | null;
}

/** Numeric metrics from an assessment. Used for interpretation, objectives, and reassessment progress. */
export function computeMetrics(a: RunnerAssessment): Metrics {
  const { profile: pr, physical: ph, history: h, goals: g, biomechanics: b } = a;
  const m: Metrics = {};

  let vdot: number | null = null;
  if (h.recentRace && h.recentRace.timeSec > 0) {
    vdot = vdotFromRace(h.recentRace.distanceM, h.recentRace.timeSec);
  }
  m.vdotRaw = vdot != null ? round1(vdot) : null;
  let vdotAdj = vdot;
  if (vdot != null && h.breakDays > 5) vdotAdj = vdot * breakMultiplier(h.breakDays, h.crossTrainedDuringBreak);
  m.vdot = vdotAdj != null ? round1(vdotAdj) : null;
  m.goalPredictedTimeSec = vdotAdj != null && g.targetDistanceM > 0 ? Math.round(predictTimeSec(vdotAdj, g.targetDistanceM)) : null;

  let targetSpeedKmh: number | null = null;
  if (g.targetTimeSec && g.targetDistanceM) targetSpeedKmh = (g.targetDistanceM / 1000) / (g.targetTimeSec / 3600);
  else if (h.recentRace) targetSpeedKmh = (h.recentRace.distanceM / 1000) / (h.recentRace.timeSec / 3600);
  m.targetSpeedKmh = targetSpeedKmh != null ? round1(targetSpeedKmh) : null;

  const squat1RM = ph.squatLoadKg != null && ph.squatReps ? epley1RM(ph.squatLoadKg, ph.squatReps) : null;
  m.squat1RM = squat1RM != null ? round1(squat1RM) : null;
  m.squatRel = squat1RM != null && pr.bodyMassKg ? round2(squat1RM / pr.bodyMassKg) : null;
  m.imtpPeakN = ph.imtpPeakForceN;
  m.imtpRel = ph.imtpPeakForceN != null && pr.bodyMassKg ? round1(ph.imtpPeakForceN / pr.bodyMassKg) : null;
  m.dsi = ph.cmjPeakForceN != null && ph.imtpPeakForceN ? round2(ph.cmjPeakForceN / ph.imtpPeakForceN) : null;
  m.cmjHeightCm = ph.cmjHeightCm;
  m.broadJumpM = ph.broadJumpM;
  m.sebtAsymmetryCm = ph.sebtAsymmetryCm;
  const l = ph.calfRaiseLeftReps, r = ph.calfRaiseRightReps;
  m.calfRaiseAvg = l != null && r != null ? round1((l + r) / 2) : l ?? r ?? null;
  m.calfRaiseAsymPct = l != null && r != null && Math.max(l, r) > 0 ? round1((Math.abs(l - r) / Math.max(l, r)) * 100) : null;
  m.rsi = ph.rsiFlightMs != null && ph.rsiContactMs ? round2(ph.rsiFlightMs / ph.rsiContactMs) : null;
  m.nordicBreakAngleDeg = ph.nordicBreakAngleDeg ?? null;
  m.cadenceSpm = b.cadenceSpm;
  m.trainingTier = trainingTier(h.strengthTrainingYears);
  return m;
}

export function interpretRunner(a: RunnerAssessment, params: Params = defaultParams): EngineReport {
  const m = computeMetrics(a);
  const { health: hs, biomechanics: b, history: h, physical: ph, profile: pr } = a;
  const findings: Finding[] = [];
  const safetyFlags: SafetyFlag[] = [];
  const restrictions: SiteRestriction[] = [];
  const missing: string[] = [];
  const used = new Set<string>(["core.screening.no-auto-clearance"]);
  const pri: Array<Priority & { score: number }> = [];
  const addPri = (key: string, score: number, rationale: string, ruleIds: string[]) => {
    ruleIds.forEach((r) => used.add(r));
    pri.push({ key, label: LABEL[key], rank: 0, rationale, ruleIds, score });
  };

  /* ---- screening: surface, never classify ---- */
  const hi = (id: string, text: string) => safetyFlags.push({ id, text: `${text} Clinician review required; the engine does not classify REDs risk or grant clearance.`, highStakes: true, ruleIds: ["running.screen.flags", "core.screening.no-auto-clearance"] });
  if (hs.eatingDisorderConcern) hi("eating-disorder", "Eating-disorder concern recorded.");
  if (hs.cardiacSymptoms) hi("cardiac", "Cardiac symptoms recorded.");
  if (hs.amenorrheaOver3Months) hi("amenorrhea", "Absent menses for more than 3 months reported.");
  else if (hs.menstrualIrregularity) hi("menstrual", "Menstrual irregularity reported.");
  if (hs.lowMorningErectionsOrLibido) hi("male-hormonal", "Reduced morning erections / libido reported.");
  if (hs.unintendedWeightLossOver5Pct) hi("weight-loss", "Unintended weight loss over 5% reported.");
  if (hs.bsiHistoryCount > 0) hi("bsi-history", `Bone stress injury history recorded (${hs.bsiHistoryCount}).`);
  if (hs.dxaZScore != null && hs.dxaZScore <= -1) hi("dxa", `DXA Z-score ${hs.dxaZScore} entered.`);
  if (hs.dxaZScore == null) missing.push("DXA / blood biomarkers not entered (optional; engine does not need them, but REDs review may).");
  safetyFlags.forEach((f) => f.ruleIds.forEach((r) => used.add(r)));

  if (hs.painModifiedTraining && hs.painSite !== "none") {
    const ex = SITE_EXCLUSIONS[hs.painSite];
    restrictions.push({ site: hs.painSite, text: ex.text });
    safetyFlags.push({ id: "amssm-pain", text: `AMSSM injury criterion met (pain modified training for >=7 days or 3 sessions) at: ${hs.painSite}. ${ex.text}`, highStakes: false, ruleIds: ["running.screen.amssm", "running.screen.site-restrictions"] });
    used.add("running.screen.amssm"); used.add("running.screen.site-restrictions");
  } else if (hs.painModifiedTraining) {
    restrictions.push({ site: "other", text: SITE_EXCLUSIONS.other.text });
    safetyFlags.push({ id: "amssm-pain", text: "AMSSM injury criterion met but no site recorded; plyometrics removed until a site is entered.", highStakes: false, ruleIds: ["running.screen.amssm"] });
    used.add("running.screen.amssm");
  }

  /* ---- baseline performance ---- */
  if (m.vdot != null) {
    const z = paceZones(m.vdot as number, params);
    used.add("running.vdot.formula"); used.add("running.vdot.paces");
    findings.push({
      id: "vdot", domain: "Running performance", severity: "info",
      text: `Current VDOT ${m.vdot}${h.breakDays > 5 ? ` (adjusted from ${m.vdotRaw} for a ${h.breakDays}-day break)` : ""}. Training paces: Easy ${fmtPace(z.E)}, Marathon ${fmtPace(z.M)}, Threshold ${fmtPace(z.T)}, Interval ${fmtPace(z.I)}, Repetition ${fmtPace(z.R)}.`,
      data: { vdot: m.vdot as number },
      ruleIds: ["running.vdot.formula", "running.vdot.paces"],
    });
    if (h.breakDays > 5) { used.add("running.vdot.break-adjustment"); findings[findings.length - 1].ruleIds.push("running.vdot.break-adjustment"); }
    if (m.goalPredictedTimeSec != null && a.goals.targetTimeSec) {
      const gap = a.goals.targetTimeSec - (m.goalPredictedTimeSec as number);
      findings.push({
        id: "goal-gap", domain: "Running performance", severity: gap < -30 ? "attention" : "info",
        text: `Goal ${fmtTime(a.goals.targetTimeSec)} vs. current predicted ${fmtTime(m.goalPredictedTimeSec as number)} for the target distance (${gap < 0 ? "goal is faster than current fitness predicts" : "goal is within current predicted fitness"}). Strength work does not change VO2max; the running plan must close any fitness gap.`,
        ruleIds: ["running.vdot.formula", "running.strength.metabolic-neutral"],
      });
      used.add("running.strength.metabolic-neutral");
    }
  } else missing.push("No recent race / time trial: current VDOT unknown. Consider a time trial to set paces.");
  if (h.recentRace && h.recentRace.daysAgo > 120) missing.push("Most recent race is older than 4 months; consider a time trial.");

  if (m.targetSpeedKmh == null) missing.push("Target speed unknown (no goal time or race): speed-based emphasis not applied.");

  /* ---- strength / power ---- */
  const male = pr.sex === "male";
  const deficitRel = params.get("running.strength.squat-ratio", male ? "deficitMale" : "deficitFemale");
  const dsiLo = params.get("running.dsi", "strengthDeficitBelow"), dsiHi = params.get("running.dsi", "powerDeficitAbove");
  const sebtFlag = params.get("running.symmetry", "sebtCm"), calfFlag = params.get("running.symmetry", "calfPct");
  const switchKmh = params.get("running.strategy.speed-tilt", "switchSpeedKmh");
  const squatRel = m.squatRel as number | null;
  const dsi = m.dsi as number | null;
  if (m.squat1RM == null) missing.push("Squat test not entered: loads cannot be calculated (program will carry blank loads to establish in week 1).");
  if (squatRel != null) {
    const low = squatRel < deficitRel;
    findings.push({ id: "squat-rel", domain: "Physical capacity", severity: low ? "priority" : "info", text: `Estimated squat 1RM ${m.squat1RM} kg = ${squatRel}x body mass (reference values are editable defaults: deficit below ${deficitRel}x).`, data: { squatRel }, ruleIds: ["running.strength.squat-ratio"] });
    used.add("running.strength.squat-ratio");
    if (low) addPri("max_strength", 100, `Squat strength ${squatRel}x body mass is below the working reference of ${deficitRel}x. Heavy strength work is the priority.`, ["running.strength.squat-ratio", "running.strength.high-load"]);
  }
  if (m.imtpRel != null) {
    findings.push({ id: "imtp", domain: "Physical capacity", severity: "info", text: `IMTP peak force ${m.imtpPeakN} N (${m.imtpRel} N/kg). Reference only; no runner-specific norms were supplied.`, data: { imtpRel: m.imtpRel as number }, ruleIds: ["running.imtp.reference"] });
    used.add("running.imtp.reference");
  }
  let dsiState: "strength" | "power" | "balanced" | null = null;
  if (dsi != null) {
    dsiState = dsi < dsiLo ? "strength" : dsi > dsiHi ? "power" : "balanced";
    findings.push({ id: "dsi", domain: "Physical capacity", severity: dsiState === "balanced" ? "info" : "priority", text: `Dynamic Strength Index ${dsi} (${dsiState === "strength" ? `below ${dsiLo}: maximal-strength deficit pattern` : dsiState === "power" ? `above ${dsiHi}: ballistic/power deficit pattern` : `${dsiLo}-${dsiHi}: balanced`}).`, data: { dsi }, ruleIds: ["running.dsi"] });
    used.add("running.dsi");
    if (dsiState === "strength") addPri("max_strength", 95, `DSI ${dsi} < ${dsiLo} suggests force output is limited by maximal strength.`, ["running.dsi", "running.strength.high-load"]);
    if (dsiState === "power") addPri("power_rfd", 95, `DSI ${dsi} > ${dsiHi} suggests strength is available but not expressed quickly.`, ["running.dsi", "running.strength.plyometric"]);
  } else {
    const fieldTests = [m.cmjHeightCm, m.broadJumpM, m.rsi].filter((v) => v != null).length;
    missing.push(`DSI unavailable (it needs a force plate and is optional). Strength-vs-power emphasis uses the squat strength ratio, then target running speed. ${fieldTests ? "Field power tests are tracked for change only (no validated runner cutoffs)." : "Enter CMJ height, broad jump or pogo-hop RSI so power can be tracked."}`);
  }
  if (ph.squatReps != null && ph.squatReps > 5) {
    findings.push({ id: "squat-reps", domain: "Physical capacity", severity: "attention", text: `The squat test used ${ph.squatReps} reps. Estimating 1RM from higher reps is less accurate and tends to overestimate, so starting loads may be too high: retest with a 3-5RM or confirm loads in week 1.`, ruleIds: ["running.test.squat-protocol"] });
    used.add("running.test.squat-protocol");
  }
  // Field power tests: tracked for change, never judged against a cutoff.
  const fieldNotes: string[] = [];
  if (m.cmjHeightCm != null) fieldNotes.push(`CMJ height ${m.cmjHeightCm} cm`);
  if (m.broadJumpM != null) fieldNotes.push(`broad jump ${m.broadJumpM} m`);
  if (m.rsi != null) fieldNotes.push(`pogo-hop RSI ${m.rsi} (flight ${ph.rsiFlightMs} ms / contact ${ph.rsiContactMs} ms)`);
  if (ph.nordicBreakAngleDeg != null) fieldNotes.push(`Nordic break angle ${ph.nordicBreakAngleDeg} deg from floor`);
  if (fieldNotes.length) {
    findings.push({ id: "field-tests", domain: "Physical capacity", severity: "info", text: `Field tests recorded: ${fieldNotes.join("; ")}. These are baselines to track change; there are no validated runner cutoffs, so they are not used to judge the athlete.`, ruleIds: ["running.field-tests.tracking"] });
    used.add("running.field-tests.tracking");
  }

  // Calf-soleus: universal software default
  used.add("running.program.soleus");
  const calfLow = m.calfRaiseAsymPct != null && (m.calfRaiseAsymPct as number) > calfFlag;
  addPri("calf_soleus", calfLow ? 70 : 30, calfLow ? `Calf raise asymmetry ${m.calfRaiseAsymPct}% (default flag >${calfFlag}%).` : "Default for all distance runners: heavy soleus loading (software default; calf/Achilles load is high in stance).", ["running.program.soleus"]);

  // Symmetry
  const sebt = m.sebtAsymmetryCm as number | null;
  const asym = (sebt != null && sebt > sebtFlag) || calfLow;
  if (sebt != null) {
    findings.push({ id: "sebt", domain: "Movement", severity: sebt > sebtFlag ? "attention" : "info", text: `SEBT/Y-Balance asymmetry ${sebt} cm (default flag >${sebtFlag} cm).`, data: { sebt }, ruleIds: ["running.symmetry"] });
    used.add("running.symmetry");
  }
  if (m.calfRaiseAsymPct != null) {
    findings.push({ id: "calf-asym", domain: "Physical capacity", severity: calfLow ? "attention" : "info", text: `Single-leg calf raise L ${ph.calfRaiseLeftReps} / R ${ph.calfRaiseRightReps} reps (${m.calfRaiseAsymPct}% difference).`, data: { calfRaiseAsymPct: m.calfRaiseAsymPct as number }, ruleIds: ["running.symmetry"] });
    used.add("running.symmetry");
  }
  if (asym) addPri("unilateral_symmetry", 75, "Side-to-side difference exceeds the default flag; add an extra set on the weaker side.", ["running.symmetry"]);

  /* ---- biomechanics: observations only ---- */
  used.add("running.gait.observation");
  const symptomatic = hs.painModifiedTraining;
  const obs: string[] = [];
  if (b.overstride) obs.push("overstriding");
  if (b.pelvicDrop === "marked") obs.push("marked pelvic drop");
  if (b.kneeValgus) obs.push("dynamic knee valgus");
  if (b.crossover) obs.push("crossover gait");
  if (b.verticalOscillation === "high") obs.push("high vertical oscillation");
  if (b.cadenceSpm != null && b.cadenceSpm < 165) obs.push(`low cadence (${b.cadenceSpm} spm)`);
  if (b.peakKneeFlexionDeg != null && b.peakKneeFlexionDeg < 40) obs.push(`reduced midstance knee flexion (${b.peakKneeFlexionDeg} deg)`);
  if (obs.length) {
    findings.push({ id: "gait", domain: "Biomechanics (2D video)", severity: "attention", text: `Observed: ${obs.join(", ")}. These are observations; no validated injury cutoffs exist.`, ruleIds: ["running.gait.observation"] });
  } else if (b.overstride === false || b.cadenceSpm != null) {
    findings.push({ id: "gait", domain: "Biomechanics (2D video)", severity: "info", text: "No notable gait observations recorded.", ruleIds: ["running.gait.observation"] });
  } else missing.push("No video observations entered.");

  if (b.pelvicDrop === "marked" || b.kneeValgus || b.crossover) {
    addPri("hip_stability", 80, "Frontal-plane control observation (pelvic drop / knee valgus / crossover): unilateral hip and glute strength is the usual response.", ["running.gait.observation"]);
  }
  if (b.overstride) {
    if (symptomatic) {
      addPri("gait_mechanics", 85, "Overstriding observed in a symptomatic runner: consider a +5-10% cadence trial with a metronome alongside strength work.", ["running.gait.cadence", "running.gait.observation"]);
      used.add("running.gait.cadence");
    } else {
      findings.push({ id: "gait-noop", domain: "Biomechanics (2D video)", severity: "info", text: "Overstriding observed but the runner is asymptomatic: no form change suggested (software default).", ruleIds: ["running.gait.observation"] });
    }
  }
  if (ph.nordicForceN != null) {
    findings.push({ id: "nordic", domain: "Physical capacity", severity: "info", text: `Nordic eccentric force ${ph.nordicForceN} N (${round1(ph.nordicForceN / pr.bodyMassKg)} N/kg). Tracked for change; no verified cutoff applied.`, ruleIds: [] });
  }
  const tier = trainingTier(h.strengthTrainingYears);
  used.add("running.strength.training-age"); used.add("running.plyo.contacts");
  if (h.strengthTrainingYears == null) {
    missing.push("Strength-training experience not entered: treated as novice (3 sets or fewer, low-level plyometrics only).");
  }
  if (tier === "novice") {
    findings.push({ id: "training-tier", domain: "Training history", severity: "attention", text: "Novice strength-training experience (< 1 year): the program uses 3 sets or fewer, a 2:1 build-to-recover cycle, lower starting intensities and low-level plyometrics only (30-50 contacts).", ruleIds: ["running.strength.training-age", "running.plyo.contacts", "core.periodization.2to1"] });
    used.add("core.periodization.2to1");
    addPri("posterior_chain", 40, "Build technique and posterior-chain capacity before heavy loads.", ["running.strength.training-age"]);
  } else {
    findings.push({ id: "training-tier", domain: "Training history", severity: "info", text: `${tier === "experienced" ? "Experienced" : "Intermediate"} strength-training background: up to 4 sets and plyometrics up to ${tier === "experienced" ? "100" : "80"} contacts per session.`, ruleIds: ["running.strength.training-age", "running.plyo.contacts"] });
  }

  /* ---- strategy ---- */
  used.add("running.strength.combined");
  const speed = m.targetSpeedKmh as number | null;
  let emphasis: Strategy["emphasis"] = "balanced";
  let why = "No clear strength or power deficit: combined heavy + plyometric training is the default because it gave the largest effects in the meta-analyses.";
  const rules = ["running.strength.combined"];
  const strengthDef = pri.some((p) => p.key === "max_strength");
  const powerDef = pri.some((p) => p.key === "power_rfd");
  if (strengthDef && !powerDef) {
    emphasis = "strength"; why = "A maximal-strength deficit was found, so the block opens heavy-dominant; plyometrics are kept at low volume. A measured deficit outranks any speed-based tilt.";
    rules.push("running.strength.high-load");
  } else if (powerDef && !strengthDef) {
    emphasis = "power"; why = "A power/RFD deficit pattern was found, so reactive work is emphasised, with heavy lifts retained because plyometrics alone did not significantly improve performance.";
    rules.push("running.strength.plyometric");
  } else if (!strengthDef && !powerDef && speed != null) {
    used.add("running.strategy.speed-tilt");
    rules.push("running.strategy.speed-tilt");
    if (speed <= switchKmh) { emphasis = "power"; why = `Target speed ${speed} km/h is <= ${switchKmh} km/h, where plyometrics improved economy; strength lifts are retained. No measured deficit overrides this (speed tilt is a software default).`; rules.push("running.strength.plyometric"); }
    else { emphasis = "strength"; why = `Target speed ${speed} km/h is above ${switchKmh} km/h, where high-load benefit on economy was larger; plyometrics are retained at moderate volume (speed tilt is a software default).`; rules.push("running.strength.speed-direction"); }
  }
  rules.forEach((r) => used.add(r));
  used.add("running.strength.not-supported"); used.add("running.strength.metabolic-neutral");
  const strategy: Strategy = {
    key: emphasis === "strength" ? "high_load" : emphasis === "power" ? "plyometric" : "combined",
    emphasis, rationale: why, ruleIds: rules,
  };

  pri.sort((x, y) => y.score - x.score);
  const priorities: Priority[] = pri.map((p, i) => ({ key: p.key, label: p.label, rank: i + 1, rationale: p.rationale, ruleIds: p.ruleIds }));

  return {
    moduleId: "running", engineVersion: ENGINE_VERSION, generatedAt: new Date().toISOString(),
    metrics: m, findings, priorities, strategy, safetyFlags, restrictions, missingData: missing, rulesUsed: [...used], paramOverrides: params.overrides(),
  };
}
