import type { Rule } from "../../core/types";

/**
 * Running-module rules with honest classification.
 * "source_verified" = checked by reading the cited PDF page in this repo's knowledge base.
 * Everything else is an editable default or needs verification.
 */
export const RUNNING_RULES: Rule[] = [
  {
    id: "running.strength.combined",
    title: "Combined strength methods give the largest performance gain",
    status: "source_verified",
    source: "Llanos-Lagos et al. 2024, Sports Med 54:1801 (abstract); Llanos-Lagos et al. 2024, Sports Med 54:895 (abstract)",
    statement:
      "Combined training (two or more methods) improved running performance (ES -1.035, p=0.036) and running economy (ES -0.426, p=0.018, at 10.00-14.45 km/h).",
    verification: "Effect sizes read directly from both abstracts. Certainty of evidence: very low to moderate (performance) / low (RE, combined).",
  },
  {
    id: "running.strength.high-load",
    title: "High-load training (>=80% 1RM) improves performance and economy",
    status: "source_verified",
    source: "Llanos-Lagos et al. 2024 (both papers, abstracts)",
    statement: "High-load strength training: performance ES -0.469 (p=0.029); running economy ES -0.266 (p=0.039).",
    verification: "Read directly from abstracts.",
  },
  {
    id: "running.strength.plyometric",
    title: "Plyometrics improve economy at lower speeds; not significant alone for performance",
    status: "source_verified",
    source: "Llanos-Lagos et al. 2024 (both papers, abstracts)",
    statement:
      "Plyometric training improved running economy at speeds <=12 km/h (ES -0.307, p=0.028) but had no significant effect on performance alone (ES -0.210, p=0.064). Heavy work should therefore be retained even when plyometrics are emphasised.",
    verification: "Read directly from abstracts.",
  },
  {
    id: "running.strength.not-supported",
    title: "Submaximal-load and isometric training are not supported for economy",
    status: "source_verified",
    source: "Llanos-Lagos et al. 2024, Sports Med 54:895 (abstract)",
    statement: "No improvement in running economy after submaximal-load or isometric training (all p>0.131). Not prescribed.",
    verification: "Read directly from abstract.",
  },
  {
    id: "running.strength.metabolic-neutral",
    title: "Strength training is metabolically neutral",
    status: "source_verified",
    source: "Llanos-Lagos et al. 2024, Sports Med 54:1801 (abstract)",
    statement: "No method changed VO2max, vVO2max, MMSS or sprint capacity (all p>0.072). Gains are neuromuscular/mechanical.",
    verification: "Read directly from abstract.",
  },
  {
    id: "running.strength.speed-direction",
    title: "High-load benefit on economy rises with running speed and VO2max",
    status: "source_verified",
    source: "Llanos-Lagos et al. 2024, Sports Med 54:895 (abstract)",
    statement:
      "Running speed (beta -0.117, p=0.027) and VO2max (beta -0.040, p=0.020) modulated the high-load effect on economy: bigger gains at higher speed / higher VO2max. These are continuous moderators, not cutoffs.",
    verification:
      "Read directly from abstract. NOTE: the knowledge files present '>12 km/h' and 'VO2max >=55' as hard cutoffs for high-load; the paper does not. Only the plyometric <=12 km/h cut is stated. The performance paper found no moderator effects on performance outcomes (p>0.166).",
  },
  {
    id: "running.strategy.speed-tilt",
    title: "Speed-based emphasis tilt (<=12 vs >12 km/h)",
    status: "proposed_default",
    source: "Software interpretation of running.strength.speed-direction and running.strength.plyometric",
    statement:
      "When no clear strength or power deficit exists, tilt emphasis toward plyometric at target speeds <=12 km/h and toward strength above 12 km/h. A measured deficit always outranks this tilt. Applies to economy only; performance moderators were not significant.",
    verification: "12 km/h comes from the plyometric result; using it as the switch point for high-load is a software default.",
    defaults: { switchSpeedKmh: 12 },
  },
  {
    id: "running.strategy.vo2max-55",
    title: "VO2max >=55 ml/kg/min as high-load criterion",
    status: "needs_verification",
    source: "Knowledge file 01, Block 4.1",
    statement: "Not used by the engine. The source paper reports VO2max as a continuous moderator with no 55 cutoff.",
    verification: "No source for the value found in the supplied papers. Retained here for transparency; not applied.",
  },
  {
    id: "running.screen.amssm",
    title: "AMSSM injury definition",
    status: "source_verified",
    source: "Tenforde et al. 2024, Br J Sports Med (AMSSM Delphi consensus), key points",
    statement:
      "Injury = musculoskeletal pain related to running that caused modified training for 7 days or three consecutive training sessions.",
    verification: "Read directly from key points. The KB cites this as 2023; the publication is 2024.",
  },
  {
    id: "running.screen.site-restrictions",
    title: "Exercises loading a painful site are removed or substituted",
    status: "proposed_default",
    source: "Knowledge file 01, Block 1.1 (example: no heavy axial squat during tibial stress reaction)",
    statement: "When the AMSSM item is positive, exercises tagged as loading the affected site are excluded or substituted; the clinician reviews every substitution.",
    verification: "Site-to-tag mapping is a conservative software default.",
  },
  {
    id: "running.screen.flags",
    title: "Health screening flags are surfaced, not classified",
    status: "proposed_default",
    source: "IOC REDs CAT2 (Mountjoy 2023) is the framework; the engine does not implement its scoring",
    statement:
      "Menstrual, hormonal, weight, BSI, eating-disorder, cardiac and DXA entries raise review flags. The engine does not assign a REDs tier or clearance.",
    verification: "The KB's Green/Yellow/Orange/Red criteria were NOT verified against the consensus and are intentionally not automated.",
  },
  {
    id: "running.dsi",
    title: "Dynamic Strength Index bands",
    status: "needs_verification",
    source: "Knowledge file 01, Block 2.3 (HPT Ch.1 attribution)",
    statement: "DSI = CMJ peak force / IMTP peak force. <0.60 suggests strength deficit; >0.80 suggests ballistic/power deficit.",
    verification: "Bands and the exact force definitions (net vs gross) not verified against the cited chapter. Editable.",
    defaults: { strengthDeficitBelow: 0.6, powerDeficitAbove: 0.8 },
  },
  {
    id: "running.strength.squat-ratio",
    title: "Relative squat strength reference",
    status: "needs_verification",
    source: "Knowledge file 01, Block 2.3 (NSCA Essentials Ch.14 attribution)",
    statement: "Reference: >1.5x body mass (male), >1.2x (female). Below ~1.2x (male) / ~1.0x (female) treated as a strength priority.",
    verification:
      "KB uses 1.2x as a deficit trigger in one table and as a female target in another. Deficit values here are software defaults, shown as editable.",
    defaults: { deficitMale: 1.2, deficitFemale: 1.0, targetMale: 1.5, targetFemale: 1.2 },
  },
  {
    id: "running.imtp.reference",
    title: "IMTP reference values",
    status: "needs_verification",
    source: "Knowledge file 01, Block 2.3",
    statement: "Reference only: peak force >35 N/kg. Displayed as context, never used to gate decisions.",
    verification: "Not verified; the KB inventory itself lists runner-specific force-plate norms as a missing evidence category.",
  },
  {
    id: "running.symmetry",
    title: "Asymmetry flags (SEBT > 4 cm, calf raise > 10%)",
    status: "needs_verification",
    source: "Knowledge file 01, Block 4.4 (SEBT 4 cm); 10% calf asymmetry is a software default",
    statement: "Flag side-to-side differences and add one extra set on the weaker limb.",
    verification: "Cutoffs not verified.",
    defaults: { sebtCm: 4, calfPct: 10 },
  },
  {
    id: "running.gait.observation",
    title: "Gait findings are observations, not injury predictors",
    status: "source_verified",
    source: "Souza 2016 (EBP for Biomechanical Analysis); KB inventory section 2.2 and 5.1",
    statement:
      "No prospectively validated kinematic cutoffs predict injury. Findings are reported as observations; form change is suggested only with symptoms.",
    verification: "Stated in the KB inventory; consistent with the source's limitations. Not page-checked.",
  },
  {
    id: "running.gait.cadence",
    title: "Cadence +5-10% for overstriding with symptoms",
    status: "proposed_default",
    source: "Souza 2016 / KB Block 2.2",
    statement: "If overstriding is observed AND the runner is symptomatic, suggest raising cadence by 5-10% with a metronome.",
    verification: "Magnitude from KB; not page-checked.",
    defaults: { cadenceIncreasePct: 7.5 },
  },
  {
    id: "running.vdot.formula",
    title: "VDOT from race performance (Daniels-Gilbert)",
    status: "source_verified",
    source: "Daniels' Running Formula, 4th ed. (oxygen cost and %VO2max-sustained equations)",
    statement: "VDOT = VO2 at race velocity divided by the fraction of VO2max sustainable for the race duration.",
    verification: "Standard published equations; unit test checks a 20:00 5 km gives about 49.8.",
  },
  {
    id: "running.vdot.paces",
    title: "Training pace fractions of VDOT",
    status: "proposed_default",
    source: "Daniels' Running Formula; KB Block 2.1",
    statement: "E 70%, M 80%, T 86%, I 97.5% of VDOT; R = I pace minus 6 s/400 m (8 s when VDOT < 40).",
    verification: "KB gives ranges (E 59-74%, M 75-84%, I 95-100%); the point values chosen here are defaults and are editable.",
    defaults: { E: 0.7, M: 0.8, T: 0.86, I: 0.975 },
  },
  {
    id: "running.vdot.break-adjustment",
    title: "Detraining adjustment after a break",
    status: "needs_verification",
    source: "Knowledge file 01, Block 1.2 (Daniels Table 9.1 transcription)",
    statement: "Multiply VDOT by the break multiplier (with or without cross-training), interpolated between table rows.",
    verification: "Table values transcribed by the KB; not checked against the book page.",
  },
  {
    id: "running.program.structure",
    title: "Eight-week structure: Accumulation (wk1-4), Transmutation (wk5-8), unload wk4 and wk8",
    status: "proposed_default",
    source: "KB Part 5.1 (NSCA Program Design; Developing Endurance)",
    statement:
      "Weeks 1-4 emphasise maximal strength and robustness; weeks 5-8 use complex/contrast pairs. Intensity 80-87.5% 1RM; unload weeks cut sets ~45% and keep intensity.",
    verification: "Block periodization is source-attributed; the week-by-week percentages are a software default, editable per exercise.",
    defaults: { unloadVolumeCut: 0.45 },
  },
  {
    id: "running.program.soleus",
    title: "Heavy soleus loading for every distance runner",
    status: "proposed_default",
    source: "Knowledge file 01 Block 4.4 (software default flagged by the KB itself)",
    statement: "Include heavy seated soleus raises unless the calf/Achilles site is painful.",
    verification: "Marked a software default in the KB.",
  },
  {
    id: "running.program.starting-loads",
    title: "Starting loads for secondary lifts",
    status: "needs_verification",
    source: null,
    statement:
      "Secondary lift loads are estimated as a ratio of the athlete's squat 1RM. They are starting estimates only; confirm in week 1 and edit.",
    verification: "Ratios are software guesses, not from a source. Clinician must verify each load.",
  },
];
