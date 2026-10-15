# Rule classification and knowledge-file cleanup

The authoritative list is `packages/engine/src/core/rules.ts` and `packages/engine/src/modules/running/rules.ts` (also shown in the app at **Rules**).

"Source-verified" here means: the claim was checked by reading the cited paper's page in `/Runnign`. Book-based items (Daniels, NSCA, HPT) were **not** page-checked.

## Corrections found while checking the knowledge files

| KB claim | Finding | Handling |
| --- | --- | --- |
| High-load training for target speed > 12 km/h; VO2max >= 55 | The paper (Llanos-Lagos 2024, Sports Med 54:895) reports speed and VO2max as **continuous moderators** (beta -0.117, p=0.027; beta -0.040, p=0.020). No 12 km/h or 55 cutoff for high-load. Only the plyometric result is stated as <= 12 km/h. | Speed tilt kept as a labeled *proposed default*; VO2max 55 rule *not applied*. |
| Speed/VO2max moderate performance outcomes | The performance paper (Sports Med 54:1801) found **no** moderator effects on performance (all p > 0.166). | The tilt is described as an economy-based rationale only. |
| AMSSM consensus is Tenforde et al. 2023 | Published 2024 (Br J Sports Med). Definition (pain modifying training >= 7 days or 3 sessions) confirmed. | Citation corrected. |
| Effect sizes (HL -0.469; combined -1.035; plyo -0.210 ns; RE -0.266/-0.307/-0.426) | Confirmed against both abstracts. | Source-verified. |
| IOC REDs Green/Yellow/Orange/Red criteria in KB Block 1.1 | Not verified against the consensus; looks simplified. | **Not automated.** Flags only. |
| DSI bands, squat ratios, IMTP > 35 N/kg, SEBT 4 cm, CMJ 5%, 10% weekly cap | No page-level source found. | Needs verification / proposed default; editable; never gating. |
| Load progression "+2.5-5% when <= 1 RIR" | Ambiguous; usually progress when RIR is higher. | Interpreted as +5% at RIR >= 2, +2.5% at RIR 0-1; labeled default. |
| Secondary-lift loads | Not in any source. | Estimated as ratios of squat 1RM; flagged "confirm in week 1". |

## Second verification pass (2026-10-15, text of the supplied books)

| Item | Result |
| --- | --- |
| Daniels Table 9.1 (FVDOT) | **Matches** the KB for every row it lists; the book has 14 rows, now all used. Rule is source-verified. |
| Daniels points per minute | E .2 (at 66% VDOT), M .4, T .6, I 1.0, R 1.5, FR 2 confirmed. |
| Daniels pace ranges | E 59-74%, M 75-84%, T mid-to-upper 80s, R 105-110%, FR 115-120% confirmed. Easy average is **66%**, so the default E fraction changed from 70% to 66%. |
| "6-second rule" | Confirmed; the book widens it to **7-8 s for the VDOT 50 / 40 categories**, not a single "<40 -> 8 s" cut. Implemented as >=55: 6, 45-54: 7, <45: 8 (software banding). |
| I-pace session limit 8% / 10 km | Confirmed. |
| DSI | Ratio and purpose confirmed (HPT ch. 1). The **0.60 / 0.80 bands are not in the book text**; still unverified. |
| Plyometric contacts | Book: novices 30-50 low-intensity contacts, then 50-80, 80-100; highly trained 120+. The old flat cap of 60 was replaced with tier caps (50 / 80 / 100). |
| Sets and rest | Book: novices 3 or fewer sets, advanced more than 3; 2-5 min rest for strength/power. Implemented as tier caps. |
| 3:1 vs 2:1 | Book: 3:1 is typical, **2:1 for novices**. Novices now get 2:1. |
| Concurrent scheduling | KB said "always run before lifting". The book says leave **>= 6 hours**, avoid hard gym and hard run on the same day, and keep the run easy after heavy lifting. Program notes corrected. |
| Taper | Book: 1-4 weeks, volume down, intensity kept, 40-60% load reduction 8-14 days out, keep frequency. The KB's "stop heavy lifting 4-5 days before" is **not in the books**; kept as an editable default marked needs-verification. |

## Third verification pass (2026-10-15): the remaining unverified rules

Method: the REDs consensus table and figure, and the book/paper text, were read directly (figures rendered to images where the text layer was garbled).

| Item | Result | Status / action |
| --- | --- | --- |
| **IOC REDs CAT2 tiers** | The KB's Green/Yellow/Orange/Red criteria **do not match** the real tool. CAT2 counts indicators (Table 4, Figure 6): Green = 0 primary and at most 1 secondary; Yellow = 0 primary + 2 or more secondary, 1 primary + up to 2 secondary, or 2 primary + up to 1 secondary; Orange = 1 primary + 3 or more secondary, 2 primary + 2 or more secondary, or 3 primary + up to 1 secondary; Red = 3 primary + 2 or more secondary, or 4 or more primary; a "severe primary" counts as 2. KB errors: reduced libido/morning erections are an *unscored potential* indicator; "weight loss over 5%" is not an indicator; BSI risk is "high-risk site (femoral neck, sacrum, pelvis) vs low-risk", not trabecular/cortical; DXA tiers of -1 to -2 / below -2 are not in the tool (primary indicator = Z-score below -1). | Added `running.reds.cat2-reference` (source-verified, display only). **Still not automated**: it needs hormone, DXA, EDE-Q and ECG data the app does not collect, and a physician-led differential diagnosis. DXA flag corrected to below -1. |
| 10% weekly load increase | IOC load consensus (Schwellnus 2016), recommendation 2.iv.b: increments should be under 10%, individualised. | **Now source-verified** (alert only). |
| 80-90% 1RM x 3-6 reps for runners | Developing Endurance Table 6.3: endurance athletes manage more reps at a given %1RM (90% = 6, 85% = 8, 80% = 11); Table 6.15 runner block is 3 x 5 with intensity M-MH-H-M (80-85 / 85-90 / 90-95 / 80-85%). Our 80-87.5% is inside or below the source. | Wording updated; stays a proposed default. |
| **1RM estimate (Epley)** | Epley is not in the supplied texts, and for endurance athletes it overestimates (a 5RM is about 91.7% of 1RM by Table 6.3, not 85.7%). | **Replaced** by the Table 6.3 interpolation (`running.test.1rm-estimate`, source-verified). Alex's 100 kg x 5 squat is now 109 kg, not 117 kg, so loads are about 6.5% lighter. |
| Unload cut 40-50% | Developing Endurance: unload week after 3 weeks; recovery weeks at 50-75% of customary intensity *and* volume. Our 55% of volume with intensity kept sits inside the volume range. | Stays an editable default (exact percentage not in the text). |
| IMTP > 35 N/kg | Essentials Table 14.6: the only norms are male soccer players (33-51 N/kg); 35 is about their 25th percentile. No runner norms. | Reworded as context only; **source-verified** that it is not a runner standard. |
| Squat deficit 1.2x / 1.0x BM | No distance-runner norms in any supplied book. Related: NSCA Program Design recommends about 1.5x BW squat before higher-intensity plyometrics. | Stays **needs verification**. New rule `running.plyo.prerequisites` (source-verified, editable ratio) now holds back drop jumps, hurdle hops and bounding until that base is met (or if no squat test exists). |
| DSI bands 0.60 / 0.80 | Searched all four books: ratio and purpose only; **no bands**. HPT also warns about ratio mathematics. | Stays **needs verification**. |
| Calf-raise asymmetry 10% | NSCA Essentials: side-to-side differences under 10% in strength/functional performance may be acceptable (return-to-sport context); NSCA Program Design: 15% or more may indicate significant injury risk, much debated. | 10% supported; SEBT 4 cm is **not** in the books, so the combined rule stays needs-verification. |
| CMJ fatigue 5% | HPT: use the 3-trial average CMJ height and compare with the athlete's smallest worthwhile change (0.5 x CV%), not a universal 5%. | Method noted; 5% stays a **needs-verification** default. |
| Cadence | Souza: +10% cadence reduces COM excursion, braking impulse and knee energy absorption; about 180 spm is debated (from economy studies). **No 165 spm cutoff.** | The "low cadence < 165" observation was **removed**; cadence is recorded only. Cadence trial now defaults to +10% (**source-verified**). |
| Knee flexion | Souza: about 45 degrees normal; below 40 degrees associated with some patellofemoral pain subgroups. | Observation threshold confirmed. |
| Race-week lifting cut-off (4-5 days) | Not in the books. Developing Endurance marathon taper examples (Tables 8.9-8.10) show one low-volume S&C session on day 1 of race week (about 6 days before), then none. | Program now places one light session early in race week; timing for shorter events is a clinician decision (**proposed default**). |
| Heavy soleus work / "6-8x body weight" | Table 6.15 runner block includes single-leg seated calf raises 3 x 5, so heavy calf work is supported; the force claim and "mandatory for all" are not in the texts. | Wording updated; stays a proposed default. |
| Progression +2.5-5% | Essentials ch. 18: relative load increases of 2.5-10% can be used; 2-for-2 rule is conservative but can promote training to failure. | Allowed range tightened to 2.5-10%; the RIR split stays a software interpretation. |

## Still unverified (after the third pass)

1. Squat deficit ratios for runners, DSI bands, SEBT 4 cm (no source in the supplied texts).
2. CMJ fatigue 5% (method verified, number not).
3. Starting-load ratios for secondary lifts (software estimates; always confirm in week 1).
4. Exact unload percentage and race-week timing for events shorter than a marathon.
5. REDs CAT2 automation (deliberately not built).

## Field-test battery (no force plate): verification notes

| Item | Result |
| --- | --- |
| Squat 3-5RM protocol | NSCA Essentials ch. 18: 3RM/5RM suits nearly all athletes with sound technique, is safer than 1RM for novices, finds the load within 3-5 sets, and 1RM estimates from higher reps are less accurate (tend to overestimate). Load steps (10-20% lower body) and 2-4 min rests taken from its protocol. **Source-verified.** The engine now warns if the test used more than 5 reps. |
| Treadmill gait video | Souza 2016: speed = the symptomatic speed, or long-run pace for a healthy runner (**not race pace** as the knowledge file said); 6-10 min settling; two orthogonal views (side, rear); >=120 Hz phone is adequate; fixed, reproducible camera position; film fatigued if symptoms appear later. **Source-verified.** |
| CMJ height from phone video, broad jump, pogo-hop RSI, calf-raise tempo, SEBT taping, Nordic break angle | No standardised procedure in the supplied texts. Proposed clinic standards, labelled **needs verification**; tracked against the athlete's own baseline, never against a norm. |
| Force plate (IMTP, CMJ force, DSI) | Optional. Without it the engine uses the squat strength ratio, then target speed. |
