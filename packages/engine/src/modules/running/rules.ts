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
    paramMeta: { switchSpeedKmh: { label: "Target speed that switches emphasis", min: 6, max: 20, step: 0.5, unit: "km/h" } },
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
    verification:
      "Checked against the IOC REDs CAT2 (Mountjoy 2023, Table 4 and Figure 6): the KB's Green/Yellow/Orange/Red criteria do NOT match the real tool (see running.reds.cat2-reference). The screening questions here are prompts only: e.g. reduced libido/morning erections are an unscored 'potential' indicator, 'weight loss over 5%' is not a CAT2 indicator, and the tool needs hormone, DXA, EDE-Q and ECG data this app does not collect. DXA is flagged at Z-score below -1 (the CAT2 primary-indicator cut). Intentionally not automated.",
  },
  {
    id: "running.screen.bone-stress",
    title: "Bone-stress screen raises a review flag and removes impact and heavy axial loading",
    status: "needs_verification",
    source: "NSCA Developing Endurance (a stress fracture is an overuse injury; foot or shin pain that does not dissipate as mileage rises may be one, and X-rays often miss it: bone scan or MRI); IOC REDs consensus (bone stress injury is a CAT2 indicator). The specific screen items are clinical convention.",
    statement: "Focal bone tenderness, pain on a single-leg hop, night pain or pain on walking raises a high-stakes review flag and applies the painful-site exercise restrictions until a clinician reviews it. The engine never diagnoses a bone stress injury and never clears an athlete.",
    verification: "The books support the concept and the need for imaging, not the individual screen items or any cut-off. Items and wording are a proposed clinical convention for the clinician to confirm.",
  },
  {
    id: "running.exam.record",
    title: "Symptom pattern and left/right exam are recorded and compared, not scored",
    status: "proposed_default",
    source: "Souza 2016 (video analysis should complement the history and a thorough physical examination; side-to-side differences are informative); High-Performance Training for Sports ch. 27 (compare with the other side; pain is a poor indicator of repair; limb tests within 10% of the contralateral side).",
    statement: "Single-leg stance, ankle dorsiflexion, first-toe extension, Trendelenburg, single-leg squat quality and palpation are stored per side and shown as left-versus-right differences. A positive Trendelenburg or a poor single-leg squat adds hip/pelvic control as a priority. No numeric cut-off is applied to any of these.",
    verification: "No validated runner cut-offs for these tests exist in the supplied sources, so none are applied; positives are clinician judgements.",
  },
  {
    id: "running.reds.cat2-reference",
    title: "IOC REDs CAT2 tiers (reference only, not applied)",
    status: "source_verified",
    source: "Mountjoy et al. 2023, IOC consensus on REDs (Br J Sports Med 57:1073), Table 4 and Figure 6",
    statement:
      "CAT2 counts indicators. Green: 0 primary and at most 1 secondary. Yellow: 0 primary + 2 or more secondary; or 1 primary + up to 2 secondary; or 2 primary + up to 1 secondary. Orange: 1 primary + 3 or more secondary; or 2 primary + 2 or more secondary; or 3 primary + up to 1 secondary. Red: 3 primary + 2 or more secondary, or 4 or more primary. A 'severe primary' indicator (12 or more missed cycles; clinically low testosterone) counts as 2. Primary indicators include 3-11 missed cycles from FHA, subclinically low testosterone or T3, 1 high-risk (femoral neck, sacrum, pelvis) or 2 low-risk BSI in 2 years, BMD Z-score below -1, and a high EDE-Q or diagnosed eating disorder. Serious medical findings (e.g. very low BMI, severe bradycardia, ECG abnormality) need immediate medical attention.",
    verification:
      "Read from the paper's table and figure on 2026-10-15. Shown for clinician reference. The engine does NOT compute a tier: the tool is for a physician-led team, needs data the app does not collect, and every indicator needs a non-LEA differential diagnosis.",
  },
  {
    id: "running.dsi",
    title: "Dynamic Strength Index bands",
    status: "needs_verification",
    source: "High-Performance Training for Sports ch. 1 (ratio only); bands from knowledge file 01",
    statement: "DSI = CMJ peak force / IMTP peak force, used to decide whether an athlete needs ballistic, concurrent or maximal-strength emphasis. Software bands: <0.60 strength deficit; >0.80 power deficit.",
    verification: "The ratio and its purpose are confirmed in High-Performance Training for Sports ch. 1. Searching all four supplied books found no 0.60 / 0.80 bands; they remain unverified editable defaults. The book also warns that ratios have mathematical limitations.",
    defaults: { strengthDeficitBelow: 0.6, powerDeficitAbove: 0.8 },
    paramMeta: {
      strengthDeficitBelow: { label: "DSI below this = strength deficit", min: 0.3, max: 0.9, step: 0.05, unit: "ratio" },
      powerDeficitAbove: { label: "DSI above this = power deficit", min: 0.5, max: 1.2, step: 0.05, unit: "ratio" },
    },
  },
  {
    id: "running.strength.squat-ratio",
    title: "Relative squat strength reference",
    status: "needs_verification",
    source: "Knowledge file 01, Block 2.3; NSCA Essentials ch. 14 (Table 14.4 sport norms)",
    statement: "Below about 1.2x body mass (male) / 1.0x (female) the squat is treated as a strength priority.",
    verification:
      "No distance-runner squat norms exist in the supplied texts (Table 14.4 covers team and power sports; the only related guidance is NSCA Program Design's 1.5x body-weight squat before higher-intensity plyometrics, see running.plyo.prerequisites). The deficit values are software defaults.",
    defaults: { deficitMale: 1.2, deficitFemale: 1.0 },
    paramMeta: {
      deficitMale: { label: "Squat 1RM / body mass below this = strength priority (male)", min: 0.5, max: 2, step: 0.05, unit: "x BM" },
      deficitFemale: { label: "Squat 1RM / body mass below this = strength priority (female/other)", min: 0.4, max: 1.8, step: 0.05, unit: "x BM" },
    },
  },
  {
    id: "running.imtp.reference",
    title: "IMTP reference values",
    status: "source_verified",
    source: "NSCA Essentials of Strength Training and Conditioning, Table 14.6",
    statement: "The only IMTP norms in the supplied texts are for male senior/junior soccer players (relative peak force about 33-51 N/kg across percentiles; 25th-percentile regional seniors about 35 N/kg). There are no runner norms; values are shown as context only and never gate a decision.",
    verification: "Table read on 2026-10-15. The knowledge file's '>35 N/kg' is a soccer-derived value, not a runner standard.",
  },
  {
    id: "running.symmetry",
    title: "Asymmetry flags (calf raise >10%, hip abduction >10%, SEBT >4 cm)",
    status: "needs_verification",
    source: "NSCA Essentials (side-to-side differences under 10% in strength and functional performance may be considered acceptable); NSCA Guide to Program Design ch. 2 (bilateral strength deficits of 15% or more may indicate significant injury risk); knowledge file 01 (SEBT 4 cm)",
    statement: "Flag side-to-side differences and add one extra set on the weaker limb.",
    verification: "The 10% figure is supported by NSCA Essentials (return-to-sport context, applied here to the calf raise test). NSCA Program Design cites 15% as a higher-risk deficit but notes much debate. The SEBT 4 cm cut is NOT in the books (they give normative tables only) and stays unverified, which keeps this rule at needs-verification.",
    defaults: { sebtCm: 4, calfPct: 10, hipPct: 10 },
    paramMeta: {
      hipPct: { label: "Hip-abduction (dynamometer) asymmetry flag", min: 3, max: 30, step: 1, unit: "%" },
      sebtCm: { label: "SEBT / Y-balance asymmetry flag", min: 1, max: 10, step: 0.5, unit: "cm" },
      calfPct: { label: "Calf-raise asymmetry flag", min: 3, max: 30, step: 1, unit: "%" },
    },
  },
  {
    id: "running.gait.observation",
    title: "Gait findings are observations, not injury predictors",
    status: "source_verified",
    source: "Souza 2016 (EBP for Biomechanical Analysis); KB inventory section 2.2 and 5.1",
    statement:
      "No prospectively validated kinematic cutoffs predict injury. Findings are reported as observations; form change is suggested only with symptoms. Normal peak knee flexion in stance is about 45 degrees, and less than 40 degrees has been associated with certain patellofemoral pain subgroups. Pelvic drop may be a surrogate for hip or core weakness and its clinical significance has been questioned. Cadence is recorded with no target: about 180 steps per minute is debated and rests on economy rather than injury studies.",
    verification:
      "Read in Souza 2016 on 2026-10-15. The knowledge file's 'cadence below 165 spm = overstriding' is NOT in the source and has been removed; cadence is now a recorded variable only.",
  },
  {
    id: "running.gait.cadence",
    title: "Cadence +10% trial for overstriding with symptoms",
    status: "source_verified",
    source: "Souza 2016, An Evidence-Based Videotaped Running Biomechanics Analysis",
    statement: "Increasing cadence by 10% reduced centre-of-mass vertical excursion, braking impulse and knee energy absorption and lowered peak hip adduction and its moments. The app suggests a cadence trial only when overstriding is seen AND the runner is symptomatic.",
    verification: "The 10% effect is stated in the paper. Using it as a treatment suggestion for symptomatic overstriders is clinical judgement; the clinician decides. Values below 10% are allowed but untested in the source.",
    defaults: { cadenceIncreasePct: 10 },
    paramMeta: { cadenceIncreasePct: { label: "Cadence increase target", min: 5, max: 10, step: 0.5, unit: "%" } },
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
    source: "Daniels' Running Formula 4th ed., ch. 4",
    statement: "E 66% (book: easy runs span 59-74% of VDOT, average 66%), M 80% (book: 75-84%), T 86% (book: mid-to-upper 80s), I 97.5%. R = I pace minus the pacing gap.",
    verification: "Ranges for E, M, T and R (105-110%) are in the book. The single point values chosen inside those ranges are software defaults and are editable.",
    defaults: { E: 0.66, M: 0.8, T: 0.86, I: 0.975 },
    paramMeta: {
      E: { label: "Easy pace, fraction of VDOT (book range 0.59-0.74)", min: 0.59, max: 0.74, step: 0.01, unit: "fraction" },
      M: { label: "Marathon pace (book range 0.75-0.84)", min: 0.75, max: 0.84, step: 0.01, unit: "fraction" },
      T: { label: "Threshold pace (book: mid-to-upper 80s)", min: 0.8, max: 0.9, step: 0.01, unit: "fraction" },
      I: { label: "Interval pace", min: 0.9, max: 1, step: 0.005, unit: "fraction" },
    },
  },
  {
    id: "running.vdot.six-second",
    title: "Six-second pacing rule (R, I, T paces)",
    status: "source_verified",
    source: "Daniels' Running Formula 4th ed., ch. 4",
    statement: "I pace is about 6 s per 400 m slower than R, and T about 6 s slower than I; the gap widens to 7-8 s for runners in the VDOT 50 and 40 categories.",
    verification: "Quoted rule checked in the book. The VDOT bands used (>=55: 6 s, 45-54: 7 s, <45: 8 s) are a software reading of 'the 50 or 40 VDOT categories'.",
    defaults: { gapHigh: 6, gapMid: 7, gapLow: 8 },
    paramMeta: {
      gapHigh: { label: "R-to-I gap, VDOT 55 and above", min: 4, max: 10, step: 0.5, unit: "s/400 m" },
      gapMid: { label: "R-to-I gap, VDOT 45-54", min: 4, max: 10, step: 0.5, unit: "s/400 m" },
      gapLow: { label: "R-to-I gap, VDOT below 45", min: 4, max: 12, step: 0.5, unit: "s/400 m" },
    },
  },
  {
    id: "running.vdot.break-adjustment",
    title: "Detraining adjustment after a break",
    status: "source_verified",
    source: "Daniels' Running Formula, 4th ed., Table 9.1",
    statement: "Multiply VDOT by the break multiplier (FVDOT-1 without leg cross-training, FVDOT-2 with it); no loss up to 5 days, about 20% (10% with cross-training) after 72+ days. Values between table rows are interpolated.",
    verification: "Full table checked against the book text on 2026-10-15 and matches the knowledge file. Interpolation between rows is a software choice.",
  },
  {
    id: "running.program.structure",
    title: "Eight-week structure: Accumulation (wk1-4), Transmutation (wk5-8), unload wk4 and wk8",
    status: "proposed_default",
    source: "KB Part 5.1 (NSCA Program Design; Developing Endurance)",
    statement:
      "Weeks 1-4 emphasise maximal strength and robustness; weeks 5-8 use complex/contrast pairs. Intensity 80-87.5% 1RM; unload weeks cut sets ~45% and keep intensity.",
    verification:
      "Developing Endurance Table 6.3 shows endurance athletes can do more reps at a given %1RM (90% = 6, 85% = 8, 80% = 11), and Table 6.4 / 6.15 give a runner's strength block with intensity bands M (80-85%), MH (85-90%), H (90-95%). Our 80-87.5% stays inside or below those bands (novices lower), so it is conservative relative to the source. Week-by-week percentages are software defaults.",
  },
  {
    id: "running.program.soleus",
    title: "Heavy soleus loading for every distance runner",
    status: "proposed_default",
    source: "Knowledge file 01 Block 4.4 (software default flagged by the KB itself)",
    statement: "Include heavy seated soleus raises unless the calf/Achilles site is painful.",
    verification:
      "Developing Endurance Table 6.15 (a runner's basic strength block) includes single-leg seated calf raises at 3 sets x 5 reps, so heavy calf work for runners is source-supported. Making it 'mandatory' for everyone, and the KB claim that soleus force reaches 6-8x body weight, are not in the supplied texts.",
  },
  {
    id: "running.program.starting-loads",
    title: "Starting loads for secondary lifts",
    status: "needs_verification",
    source: null,
    statement:
      "Secondary lift loads are estimated as a ratio of the athlete's squat 1RM. They are starting estimates only; confirm in week 1 and edit.",
    verification: "Ratios are software guesses, not from a source (searched all four books). Clinician must verify each load.",
  },
  {
    id: "running.plyo.contacts",
    title: "Plyometric volume by experience",
    status: "source_verified",
    source: "NSCA Developing Endurance 2nd ed., ch. 8 (plyometrics)",
    statement:
      "Runners new to plyometrics start with 30-50 foot contacts per session of low-intensity work (skips, short hops, drills) 2-3 times per week, progress to 50-80 and then 80-100; highly trained runners with several years of resistance training may exceed 120.",
    verification: "Read in the book text. Tier mapping used here: novice <=50, intermediate <=80, experienced <=100 contacts per session.",
    defaults: { novice: 50, intermediate: 80, experienced: 100 },
    paramMeta: {
      novice: { label: "Max contacts per session, novice", min: 20, max: 60, step: 5, unit: "contacts" },
      intermediate: { label: "Max contacts per session, intermediate", min: 40, max: 100, step: 5, unit: "contacts" },
      experienced: { label: "Max contacts per session, experienced", min: 60, max: 140, step: 5, unit: "contacts" },
    },
  },
  {
    id: "running.strength.training-age",
    title: "Sets and rest scale with training status",
    status: "source_verified",
    source: "NSCA Developing Endurance 2nd ed., ch. 6",
    statement: "Novices make gains with 3 or fewer sets per exercise; advanced athletes generally need more than 3. Strength/power work uses 2-5 minute rests; fewer sets are used in the competitive phase.",
    verification: "Read in the book text. Tier thresholds (<1 y novice, 1-3 y intermediate, 3+ y experienced) and the lower novice intensities (70-80% 1RM) are software defaults.",
    defaults: { noviceMaxSets: 3, advancedMaxSets: 4 },
    paramMeta: {
      noviceMaxSets: { label: "Max sets per exercise, novice", min: 1, max: 4, step: 1, unit: "sets" },
      advancedMaxSets: { label: "Max sets per exercise, intermediate/experienced", min: 2, max: 6, step: 1, unit: "sets" },
    },
  },
  {
    id: "running.concurrent.scheduling",
    title: "Separate gym and hard running sessions",
    status: "source_verified",
    source: "NSCA Developing Endurance 2nd ed., ch. 6",
    statement:
      "Allow at least 6 hours between resistance and endurance sessions; avoid high-volume, high-intensity versions of both on the same day; after heavy lifting keep the run low-volume and low-intensity.",
    verification: "Read in the book text. Replaces the knowledge file's 'always run before lifting' rule, which the book does not state.",
  },
  {
    id: "running.program.frequency",
    title: "Gym sessions per week: 1 or 2 supported, 3 is an add-on",
    status: "proposed_default",
    source: "NSCA Developing Endurance 2nd ed., ch. 6 (sample runner blocks: 2 resistance days falling to 1 in later phases); knowledge file 01 Block 5.1",
    statement: "The clinician chooses 1, 2 (default) or 3 sessions per week. Two sessions (squat day, hinge day) follows the books' runner examples; one session keeps both heavy lifts and trims accessories; the third session is light (calves, hips, low-level reactive work) with no heavy lifts.",
    verification: "1-2 resistance days for runners is in the book examples; a third day is not described, so it is a software add-on kept light on purpose.",
  },
  {
    id: "running.taper.window",
    title: "Taper length and size",
    status: "source_verified",
    source: "NSCA Developing Endurance 2nd ed., ch. 3 and 6",
    statement: "Tapers last 1-4 weeks; volume falls while intensity is maintained, with a 40-60% load reduction 8-14 days before the event; keep training frequency rather than dropping sessions.",
    verification: "Read in the book text. Program taper (about 40% set cut, then a light race-week session) is a software application of that range.",
    defaults: { taperSetCut: 0.4, raceWeekSetCut: 0.5 },
    paramMeta: {
      taperSetCut: { label: "Set reduction in the taper week", min: 0.2, max: 0.6, step: 0.05, unit: "fraction" },
      raceWeekSetCut: { label: "Set reduction in race week", min: 0.3, max: 0.8, step: 0.05, unit: "fraction" },
    },
  },
  {
    id: "running.taper.race-week",
    title: "Race week: one light gym session early in the week",
    status: "proposed_default",
    source: "NSCA Developing Endurance 2nd ed., ch. 8 (Tables 8.9-8.10, marathon taper examples); knowledge file 01 Block 5.2",
    statement: "In the final marathon week the books' examples schedule a single low-volume S&C session on day 1 (about 6 days before the race) and none afterwards. The app does the same: one light session early in race week, no plyometrics, no eccentric hamstring work.",
    verification: "The knowledge file's '4-5 days before' is not in the books; the book example is about 6 days for a marathon. Shorter events are not specified, so the timing is an editable clinician decision.",
  },
  {
    id: "running.test.1rm-estimate",
    title: "1RM estimate from a 3-5RM uses the endurance-athlete load-to-repetition table",
    status: "source_verified",
    source: "NSCA Developing Endurance 2nd ed., Table 6.3 (adapted from Thibaudeau 2006)",
    statement: "Endurance athletes can do more repetitions at a given %1RM than other athletes: 100% = 1, 95% = 3, 90% = 6, 85% = 8, 80% = 11, 75% = 14, 70% = 16, 65% = 19. The app converts a tested load and rep count to a 1RM by interpolating this table (a 5RM is about 91.7% of 1RM).",
    verification: "Table read (image) on 2026-10-15. This replaces the Epley formula, which is not in the supplied texts and would overestimate a runner's 1RM by roughly 7% from a 5RM. Between table points the app interpolates linearly; beyond 19 reps it stops extrapolating (conservative).",
  },
  {
    id: "running.plyo.prerequisites",
    title: "Reactive plyometrics need a strength base",
    status: "source_verified",
    source: "NSCA's Guide to Program Design, ch. 5 (plyometrics); NSCA Developing Endurance 2nd ed., ch. 8",
    statement: "It has been recommended that athletes be able to squat about 1.5 times body weight before starting a plyometric program; low-intensity drills (skips, hops, jumps) can be done safely without a minimum, but depth (drop) jumps should not be attempted by beginners. The app holds back drop jumps, hurdle hops and bounding until the squat reaches the set ratio, and keeps low-level drills only.",
    verification: "Read in the book text. The book says 'e.g., 1.5 times body weight', so the ratio is a recommendation, editable here. If no squat test is entered the app cannot confirm the base and keeps low-level plyometrics only.",
    defaults: { squatRatio: 1.5 },
    paramMeta: { squatRatio: { label: "Squat 1RM / body mass needed before reactive plyometrics", min: 1, max: 2, step: 0.1, unit: "x BM" } },
  },
  {
    id: "running.test.squat-protocol",
    title: "Squat testing: 3-5RM, within 3-5 sets",
    status: "source_verified",
    source: "NSCA Essentials of Strength Training and Conditioning, ch. 18",
    statement:
      "A 3RM or 5RM test (then estimating the 1RM) suits nearly all athletes with sound technique and is safer than a 1RM for novices; 1RM prediction becomes less accurate, and tends to overestimate, as reps rise; testing should find the target load within 3-5 sets.",
    verification: "Read in the book text. The engine warns when a squat test used more than 5 reps.",
  },
  {
    id: "running.field-tests.tracking",
    title: "Field power tests are tracked for change",
    status: "proposed_default",
    source: "Software design; knowledge file 01 lists the broad jump as the no-force-plate substitute",
    statement:
      "Without a force plate, power is tracked with CMJ height from video, broad jump and pogo-hop RSI. No validated runner cutoffs exist in the supplied texts, so these are compared with the athlete's own baseline, never against a norm. Objective targets below are editable.",
    verification: "Targets are software defaults. CMJ-from-video and pogo RSI procedures are standard practice but not described in the supplied texts.",
    defaults: { cmjPct: 5, rsiPct: 10, broadJumpPct: 3 },
    paramMeta: {
      cmjPct: { label: "CMJ height target increase", min: 1, max: 20, step: 1, unit: "%" },
      rsiPct: { label: "Pogo-hop RSI target increase", min: 1, max: 30, step: 1, unit: "%" },
      broadJumpPct: { label: "Broad jump target increase", min: 1, max: 15, step: 1, unit: "%" },
    },
  },
];
