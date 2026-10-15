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
| Daniels FVDOT table, pace %VDOT | Transcribed in KB, not page-checked. | Needs verification / proposed default. |

## Still to verify (suggested order)

1. REDs CAT2 primary/secondary criteria (before any REDs support is considered).
2. Daniels Table 9.1 and pace percentages.
3. DSI definitions (net vs gross force) and bands.
4. NSCA/HPT sources for the 80-90% x 3-6 prescription, taper percentages, unload cut.
