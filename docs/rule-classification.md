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

## Still to verify (suggested order)

1. IOC REDs CAT2 primary/secondary criteria (before any REDs support is considered).
2. DSI bands; squat strength ratios (NSCA Essentials); SEBT 4 cm; calf-asymmetry 10%.
3. NSCA/HPT source for the 80-90% x 3-6 prescription and the unload cut (40-50%).
4. Race-week lifting cut-off (4-5 days).
