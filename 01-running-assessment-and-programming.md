# TPC Performance OS: Clinical Assessment & S&C Programming Framework
**System Specification for Middle- and Long-Distance Running (800m through Marathon)**

---

## System Operating Architecture & Boundary Definition

To establish a deterministic, source-traceable second-clinician engine without relying on paid AI APIs, the system operates on a dual-boundary model:
1. **Software Engine Responsibility:** Executes deterministic calculation rules, multi-domain zone mapping, risk matrix evaluation, speed-matched exercise selection algorithms, and periodized volume/intensity calculations based strictly on source-derived evidence and explicit software defaults.
2. **Human Clinician Responsibility:** Performs contextual interpretation, evaluates individual athlete constraints, handles medical differential diagnoses, reviews biomechanical or clinical exceptions, and grants final approval or override on all generated training prescriptions.

---

# PART 1: Safety Screening & Baseline Profile (WHERE ARE WE NOW? - Foundation)

Before prescribing any performance testing or gym-based S&C, the software engine enforces mandatory health and safety gatekeeping rules to identify systemic risks, Relative Energy Deficiency in Sport (REDs), and acute injury red flags.

```
               ┌────────────────────────────────────────────────────────┐
               │              ATHLETE INTAKE & SCREENING                │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │          Mandatory Health & Safety Gatekeeper          │
               │   • Red Flag Medical Screening                        │
               │   • IOC REDs CAT2 Traffic Light Risk Engine            │
               │   • AMSSM Standardized Injury Surveillance Survey      │
               └───────┬────────────────────────────────────────┬───────┘
                       │                                        │
           RED FLAG DETECTED                            NO RED FLAGS
           (Red Light / High Risk)                      (Green/Yellow/Orange)
                       │                                        │
                       ▼                                        ▼
       ┌──────────────────────────────┐         ┌──────────────────────────────┐
       │   HALT PERFORMANCE TESTING   │         │ PROCEED TO BASELINE PROFILE  │
       │ Medical / MD Escalation Mode │         │  • Training & Mileage History│
       └──────────────────────────────┘         │  • Break Adjustments (FVDOT) │
                                                └───────────────┬──────────────┘
                                                                │
                                                                ▼
                                                ┌──────────────────────────────┐
                                                │ PERFORMANCE ASSESSMENT BATT. │
                                                └──────────────────────────────┘
```

---

### Specification Block 1.1: Systemic Safety & REDs Screening Engine

#### 1. Name and Purpose
* **Name:** IOC REDs CAT2 & AMSSM Health Surveillance Screening Engine.
* **Purpose:** Screen for Low Energy Availability (LEA), Relative Energy Deficiency in Sport (REDs), acute cardiovascular or bone stress injury (BSI) red flags, and active musculoskeletal pain prior to athletic load exposure.

#### 2. Required Inputs
* Sex, Age, Menstrual Status (presence/absence of menses \\(>3\\) consecutive months, cycle regularity).
* Male-specific hormonal indicators (frequency of morning erections, libido changes).
* Weight history (unintended weight loss \\(>5\%\\) in past 3 months, rapid weight drop).
* History of Bone Stress Injuries (lifetime count, trabecular vs. cortical sites).
* AMSSM Pain & Training Modification Item: *"In the past 2 weeks, have you experienced musculoskeletal pain related to running/training that caused you to modify your training for at least 7 days or 3 consecutive scheduled sessions?"*.
* DXA Z-Score (lumbar spine / femoral neck) and blood biomarkers (Ferritin, T3, Testosterone, Estrogen) *if available*.

#### 3. Measurement or Prescription Procedure
* Administer structured intake questionnaire incorporating the AMSSM health survey items and IOC REDs CAT2 primary/secondary criteria.
* Evaluate AMSSM Pain item: Binary trigger (`YES` / `NO`). If `YES`, quantify extent of modification (complete rest, volume reduction, cross-training) and anatomical site.
* Compute IOC REDs CAT2 Traffic Light Tier:
  * **Green (Low Risk):** Normal Eumenorrheic / male health, stable weight, DXA Z-score \\(>-1.0\\), no BSI history.
  * **Yellow (Moderate Risk):** Single non-trabecular BSI, minor weight suppression, irregular menses / decreased morning erections, or sub-clinical LEA indicators.
  * **Orange (High Risk):** Amenorrhea \\(>3\\) months, multiple BSIs or single trabecular BSI, DXA Z-score \\(-1.0\\) to \\(-2.0\\), severe weight loss.
  * **Red (Extreme Risk / Medical Halt):** Anorexia nervosa or clinical eating disorder, severe DXA Z-score \\(<-2.0\\), critical cardiac bradycardia/arrhythmia, extreme energy availability deficit.

#### 4. Interpretation or Programming Rule
* **Red Light:** `SYSTEM_HALT`. Prohibit all high-intensity running, maximal strength testing, and explosive plyometrics. Mandatory referral to sports medicine physician and clinical dietitian.
* **Orange Light:** `RESTRICTED_MODE`. Prohibit 1RM strength testing, max time trials, and high-impact plyometrics. Permit low-intensity aerobic running and submaximal, controlled S&C under clinical supervision.
* **Yellow Light:** `CAUTION_MODE`. Permit performance testing and full S&C programming, but restrict weekly running volume increases to \\(<5\%\\) per week and institute bi-weekly body weight and energy availability monitoring.
* **Green Light:** `FULL_CLEARANCE`. Proceed to full baseline performance profile and testing battery.
* **AMSSM Pain Item Trigger (`YES`):** Restrict gym movements loading the affected anatomical site (e.g., no heavy axial squatting during active tibial stress reaction).

#### 5. Expected Training Adaptation
* Mitigation of catastrophic bone stress fractures, hypothalamic-pituitary-gonadal axis suppression, systemic metabolic slowdown, and overtraining syndrome.

#### 6. Outcome to Track
* REDs Risk Tier (Green/Yellow/Orange/Red), AMSSM Pain Severity Score, Bone Mineral Density Z-score, Menstrual/Hormonal Regularity Index.

#### 7. Source Reference
* *IOC Consensus Statement on Relative Energy Deficiency in Sport (Mountjoy et al., 2023 / IOC REDs CAT2)*.
* *AMSSM Runner Health Surveillance Consensus (Tenforde et al., 2023)*.
* *IOC Sport Load and Illness Consensus (Schwellnus et al., 2016)*.

#### 8. Practical Implementation Notes
* `[Software Default]` If DXA or blood biomarkers are unavailable in the intake data, the software engine computes the REDs tier using questionnaire-based secondary criteria (menstrual status, male erection frequency, BSI history, weight loss) and flags `BIOMARKER_DATA_MISSING` in the clinical report.

---

### Specification Block 1.2: Athlete Baseline History & Training Break Profile

#### 1. Name and Purpose
* **Name:** Baseline Training History & FVDOT Break Adjustment Engine.
* **Purpose:** Establish baseline chronic running volume, long run distribution, current racing fitness (VDOT), and calculate detraining adjustments following breaks.

#### 2. Required Inputs
* Average weekly running mileage/kilometers over past 6 weeks.
* Longest single run duration (minutes) and distance (miles/km) over past 6 weeks.
* Recent race results (distance and exact finish time within last 4 months).
* Days away from running training (\\(0\\) to \\(>72\\) days).
* Presence of leg-associated cross-training during break (Binary: `YES` / `NO`).

#### 3. Measurement or Prescription Procedure
* **Long Run Check:** Compare longest single run against weekly volume:
  * For weekly volume \\(<40\text{ miles}\\) (\\(64\text{ km}\\)): Maximum single long run \\(\le 30\%\\) of total weekly mileage.
  * For weekly volume \\(\ge 40\text{ miles}\\) (\\(64\text{ km}\\)): Maximum single long run \\(\le \min(25\%\text{ of weekly mileage}, 150\text{ minutes})\\).
* **FVDOT Detraining Adjustment (Jack Daniels' Model):**
  * Retrieve starting unadjusted VDOT from recent race result.
  * Calculate adjusted fractional VDOT (\\(\text{FVDOT}\\)) based on break duration and cross-training status:

$$\text{FVDOT-1 (No Cross-Training)} = \text{Initial VDOT} \times \text{Multiplier}_1$$
$$\text{FVDOT-2 (With Leg Cross-Training)} = \text{Initial VDOT} \times \text{Multiplier}_2$$

$$\text{FVDOT Adjustments Table (Daniels Table 9.1):}$$

$$\begin{array}{|c|c|c|}
\hline
\textbf{Training Break Duration} & \textbf{FVDOT-1 (No Cross-Training)} & \textbf{FVDOT-2 (With Cross-Training)} \\ \hline
\le 5 \text{ days} & 1.000 & 1.000 \\ \hline
7 \text{ days} & 0.994 & 0.997 \\ \hline
14 \text{ days} & 0.973 & 0.986 \\ \hline
21 \text{ days} & 0.952 & 0.976 \\ \hline
28 \text{ days} & 0.931 & 0.965 \\ \hline
42 \text{ days} (6 \text{ wks}) & 0.889 & 0.944 \\ \hline
56 \text{ days} (8 \text{ wks}) & 0.847 & 0.923 \\ \hline
\ge 72 \text{ days} & 0.800 & 0.900 \\ \hline
\end{array}$$

* **Return-to-Running Ramp Protocol (Daniels Table 9.2):**
  * *Break 1–28 days:* 50% mileage for first half of return period, 75% mileage for second half.
  * *Break \\(>8\\) weeks:* 3 weeks @ 33% load (\\(\le 30\text{ mi/wk}\\)), 3 weeks @ 50% load (\\(\le 40\text{ mi/wk}\\)), 3 weeks @ 70% load (\\(\le 60\text{ mi/wk}\\)), 3 weeks @ 85% load (\\(\le 75\text{ mi/wk}\\)), then 100% load.

#### 4. Interpretation or Programming Rule
* The adjusted FVDOT value must strictly dictate initial training paces for Easy (E), Marathon (M), Threshold (T), Interval (I), and Repetition (R) workouts.
* Do not increase training VDOT faster than once every 3 to 4 weeks, regardless of race performance improvements, to allow structural tissue adaptation.

#### 5. Expected Training Adaptation
* Prevention of rapid overreaching, tendon overload, and structural breakdown during return-to-running phases.

#### 6. Outcome to Track
* Current Training VDOT, Weekly Running Volume, Long Run Volume Percentage, Retrained Mileage Capacity.

#### 7. Source Reference
* *Daniels' Running Formula (4th Edition, Chapters 3, 4, 5, 9)*.

#### 8. Practical Implementation Notes
* `[Software Default]` If an athlete presents with a race time older than 4 months and no recent time trial, the engine enforces a mandatory 5-minute flat time trial or 1-mile time trial to establish baseline VDOT / MAS.

---

# PART 2: Performance Assessment & Diagnostic Battery (WHERE ARE WE NOW? - Tests & Protocols)

---

## 2.1 Cardiorespiratory & Metabolic Testing Protocols

$$\begin{array}{|l|l|l|l|l|}
\hline
\textbf{Assessment} & \textbf{Primary Variable} & \textbf{Measurement Protocol} & \textbf{Interpretation / Zone Mapping} & \textbf{Source Reference} \\ \hline
\textbf{VDOT Profile} & \text{Pseudo-}\dot{V}\text{O}_2\text{max} & \text{Recent race time or 1-mi time trial} & \text{E, M, T, I, R pacing tables (Daniels Table 5.1/5.2)} & \text{Daniels Ch. 5 } \\ \hline
\textbf{MAS Test} & \text{Maximal Aerobic Speed} & \text{5-min field time trial (distance / 300s)} & \text{Severe/Extreme boundary } (\ge 100\% \text{ MAS}) & \text{NSCA Dev End Ch. 8 } \\ \hline
\textbf{Critical Speed} & \text{CS \& Anaerobic Reserve } (W') & \text{3–4 time trials (800m, 1600m, 3200m, 5k)} & \text{Heavy/Severe boundary; CS = slope of dist vs time} & \text{NSCA Dev End Ch. 8 } \\ \hline
\textbf{Lactate Threshold} & \text{LT / } D_{\max} \text{ Speed} & \text{Progressive treadmill stages w/ blood lactate} & \text{Moderate/Heavy boundary; 2.0–4.0 mmol/L} & \text{NSCA Dev End Ch. 2/8 } \\ \hline
\end{array}$$

### Specification Block 2.1: VDOT & 4-Domain Metabolic Pacing Engine

#### 1. Name and Purpose
* **Name:** Daniels VDOT & 4-Domain Metabolic Zone Mapping Engine.
* **Purpose:** Translate discrete running performances into exact individualized training paces across 4 physiological domains (Moderate, Heavy, Severe, Extreme).

#### 2. Required Inputs
* Baseline VDOT (or 5-min MAS time trial distance).

#### 3. Measurement or Prescription Procedure
* **Calculated Training Paces & Point Values (Daniels Formula & NSCA 4-Domain Model):**
  * **Easy Pace (E / Moderate Domain):** \\(59\% \text{ to } 74\% \text{ VDOT}\\) (\\(55\% \text{--} 70\% \text{ HR}_{\max}\\)). Point value: \\(0.2 \text{ pts/min}\\). Pace is \\(2 \text{ to } 3 \text{ min/mile}\\) slower than 1-mile race pace.
  * **Marathon Pace (M / Heavy Domain):** \\(75\% \text{ to } 84\% \text{ VDOT}\\) (\\(70\% \text{--} 80\% \text{ HR}_{\max}\\)). Point value: \\(0.4 \text{ pts/min}\\).
  * **Threshold Pace (T / Heavy Domain):** Mid-to-upper \\(80\% \text{ VDOT}\\) (\\(80\% \text{--} 85\% \text{ HR}_{\max}\\), RPE 5–6). Point value: \\(0.6 \text{ pts/min}\\). Sustainable duration: \\(\sim 60\text{ min}\\).
  * **Interval Pace (I / Severe Domain):** \\(95\% \text{ to } 100\% \text{ VDOT}\\) / \\(100\% \text{ MAS}\\) (\\(85\% \text{--} 100\% \text{ HR}_{\max}\\), RPE 7–8). Point value: \\(1.0 \text{ pt/min}\\). Single work bout limit: \\(\le 5\text{ min}\\). Sustainable duration: \\(\sim 10\text{--}12\text{ min}\\) total.
  * **Repetition Pace (R / Extreme Domain):** \\(105\% \text{ to } 110\% \text{ VDOT}\\) (\\(>100\% \text{ MAS}\\), RPE 9–10). Point value: \\(1.5 \text{ pts/min}\\). Work bout limit: \\(\le 2\text{ min}\\). Work-to-rest ratio: \\(1:2 \text{ or } 1:3\\) full recovery.
  * **Fast Repetition Pace (FR / Extreme Domain):** \\(115\% \text{ to } 120\% \text{ VDOT}\\) (800m race pace). Point value: \\(2.0 \text{ pts/min}\\).

$$\text{Daniels' 6-Second Pacing Rule Calculation:}$$

$$\text{Pace}_{\text{Interval (I)}} = \text{Pace}_{\text{Repetition (R)}} + 6 \text{ to } 8 \text{ sec per } 400\text{m}$$
$$\text{Pace}_{\text{Threshold (T)}} = \text{Pace}_{\text{Interval (I)}} + 6 \text{ to } 8 \text{ sec per } 400\text{m}$$

#### 4. Interpretation or Programming Rule
* **Single Workout Session Limits:**
  * **R-Pace Volume Limit:** \\(\le \min(5\%\text{ of weekly volume}, 5\text{ miles} / 8\text{ km})\\).
  * **I-Pace Volume Limit:** \\(\le \min(8\%\text{ of weekly volume}, 10,000\text{ meters})\\).
  * **T-Pace Volume Limit:** \\(\le 10\%\text{ of weekly volume}\\).
* Do not schedule more than two quality workouts in the Severe or Extreme domains per week.

#### 5. Expected Training Adaptation
* **E Pace:** Capillarization, mitochondrial biogenesis, slow-twitch fiber endurance.
* **T Pace:** Maximum metabolic steady state elevation, improved blood lactate clearance.
* **I Pace:** \\(\dot{V}\text{O}_2\text{max}\\) expansion, cardiac output elevation.
* **R / FR Pace:** Anaerobic capacity expansion, running economy at top speed, neuromuscular recruitment.

#### 6. Outcome to Track
* Race performance times, VDOT score, MAS (\\(m/s\\)), Heart Rate at T-pace, Session Point Total.

#### 7. Source Reference
* *Daniels' Running Formula (Chapters 4, 5)*.
* *NSCA Developing Endurance (Chapter 8, Table 8.1)*.

#### 8. Practical Implementation Notes
* `[Software Default]` In low-VDOT athletes (\\(<40\\)), the 6-second rule expands to an 8-second differential per \\(400\text{m}\\) between zones to account for lower mechanical efficiency.

---

## 2.2 2D Video Gait Kinematics Assessment Engine

Standardized setup requires treadmill acclimation for $6 \text{ to } 10 \text{ minutes}$ at target racing pace before video capture. High-speed camera recording at $\ge 120\text{ Hz}$ (or 240 Hz) in orthogonal Sagittal (Side) and Posterior (Rear) planes.

$$\begin{array}{|l|l|l|l|l|}
\hline
\textbf{Plane & Variable} & \textbf{Phase Assessed} & \textbf{Observation / Metric} & \textbf{Kinematic Risk Indicator / Compensation} & \textbf{Source Reference} \\ \hline
\textbf{Sagittal: Foot Strike} & \text{Initial Contact} & \text{Forefoot, Midfoot, Rearfoot (FFS/MFS/RFS)} & \text{RFS high impact; FFS high Achilles load} & \text{Souza Sec. Side View } \\ \hline
\textbf{Sagittal: Foot Inclination} & \text{Initial Contact} & \text{Angle between shoe sole \& treadmill belt} & \text{High angle increases braking force \& knee moment} & \text{Souza Fig. 3 } \\ \hline
\textbf{Sagittal: Tibia Angle} & \text{Loading Response} & \text{Alignment of shin relative to vertical} & \text{Anterior flexed tibia = higher quad/knee stress} & \text{Souza Fig. 4 } \\ \hline
\textbf{Sagittal: Peak Knee Flexion} & \text{Midstance} & \text{Maximum knee flex angle (~45^\circ target)} & \text{<40^\circ indicates reduced shock absorption} & \text{Souza Fig. 5 } \\ \hline
\textbf{Sagittal: Peak Hip Extension} & \text{Late Stance} & \text{Angle of thigh relative to vertical (~10^\circ)} & \text{Restricted extension causes lumbar lordosis/bounding} & \text{Souza Fig. 6 } \\ \hline
\textbf{Sagittal: Overstriding} & \text{Loading Response} & \text{Vertical malleolus line relative to pelvis} & \text{Line anterior to pelvis = excessive braking force} & \text{Souza Fig. 8 } \\ \hline
\textbf{Sagittal: Vertical COM Excursion} & \text{Float vs Stance} & \text{Pelvic displacement high-to-low frame} & \text{High excursion (bounding) wastes energy} & \text{Souza Fig. 9 } \\ \hline
\textbf{Sagittal: Cadence / Stride Rate} & \text{Continuous} & \text{Steps per minute (target ~180 spm)} & \text{Low cadence (<165 spm) linked to overstriding} & \text{Souza / Daniels } \\ \hline
\textbf{Posterior: Base of Support} & \text{Stance Phase} & \text{Lateral distance between foot contacts} & \text{Cross-over / Scissoring gait (ITBS/tibial stress)} & \text{Souza Fig. 12 } \\ \hline
\textbf{Posterior: Heel Eversion} & \text{Stance Phase} & \text{Calcaneal eversion magnitude \& rate} & \text{Rapid eversion (>20^\circ in 20ms) = excessive pronation} & \text{Souza Fig. 10/11 } \\ \hline
\textbf{Posterior: Heel Whips} & \text{Initial Swing} & \text{Transverse rotation of shoe sole (>5^\circ)} & \text{Medial/Lateral whip = hip rotation imbalance} & \text{Souza Fig. 13 } \\ \hline
\textbf{Posterior: Knee Window} & \text{Midstance} & \text{Space between knees from posterior view} & \text{Closed window = dynamic knee valgus / hip adduction} & \text{Souza Fig. 14 } \\ \hline
\textbf{Posterior: Pelvic Drop} & \text{Midstance} & \text{Contralateral PSIS drop angle} & \text{Excessive drop = gluteus medius weakness} & \text{Souza Fig. 15 } \\ \hline
\end{array}$$

### Specification Block 2.2: 2D Video Gait Analysis & Kinematic Correction Protocol

#### 1. Name and Purpose
* **Name:** 2D Planar Running Biomechanics & Gait Retraining Protocol.
* **Purpose:** Systematically identify planar kinematic abnormalities linked to high ground reaction forces, braking impulse, and overuse injury mechanics.

#### 2. Required Inputs
* High-frame-rate video footage (\\(\ge 120\text{ Hz}\\)) from Sagittal and Posterior views captured after 6–10 minutes treadmill acclimation at target race pace.
* Anatomical marker placements: Greater trochanter, lateral femoral epicondyle, lateral malleolus, PSIS, heel counter.

#### 3. Measurement or Prescription Procedure
* Perform frame-by-frame analysis across key phases: Terminal Swing, Initial Contact, Loading Response, Midstance, Toe-Off.
* **Overstride Test:** Draw a vertical line upward from the lateral malleolus at the frame of Loading Response (shoe deformation). Observe position relative to the pelvis.
* **Cadence Evaluation:** Count right foot contacts over 60 seconds and multiply by 2.

#### 4. Interpretation or Programming Rule
* **Overstride Present (Lateral malleolus line falls anterior to pelvis):** Prescribe Gait Retraining protocol: Increase baseline cadence by \\(+5\% \text{ to } +10\%\\) using an auditory metronome. Cues: *"Pretend you are running over hot glass"* or *"Increase foot contact frequency"*. Expected impact: Reduces peak knee extensor moment, braking impulse, and vertical COM displacement.
* **Scissoring Gait / Cross-over Sign (Feet cross central midline):** Prescribe Step-Width Retraining: Cue athlete to run with feet placed on either side of a treadmill line. Combine with Hip Abductor / Gluteus Medius strengthening.
* **Closed Knee Window / Dynamic Knee Valgus:** Prescribe single-leg hip abductor/external rotator strengthening (split squats, lateral band walks).

#### 5. Expected Training Adaptation
* Reduction in peak vertical ground reaction force, lower braking impulse, enhanced running economy via optimized spring-mass mechanics.

#### 6. Outcome to Track
* Cadence (spm), Malleolus-to-Pelvis Horizontal Distance (\\(cm\\)), Peak Pelvic Drop Angle (\\(^\circ\\)), Heel Eversion Rate (\\(^\circ/ms\\)).

#### 7. Source Reference
* *An Evidence-Based Videotaped Running Biomechanics Analysis (Souza, 2016)*.
* *NSCA Developing Endurance (Chapter 8, Table 8.7)*.

#### 8. Practical Implementation Notes
* `[Software Default]` Kinematic cutoffs do not exist as absolute prospective injury thresholds in the peer-reviewed literature. Therefore, kinematic findings must be interpreted in conjunction with active symptoms; form modifications are not recommended for uninjured, highly economical runners.

---

## 2.3 Neuromuscular, Physical Capacity & Movement Screening Battery

$$\begin{array}{|l|l|l|l|l|}
\hline
\textbf{Test Name} & \textbf{Primary Metric} & \textbf{Testing Hardware / Method} & \textbf{Reference Norms / Target Threshold} & \textbf{Source Reference} \\ \hline
\textbf{Isometric Mid-Thigh Pull (IMTP)} & \text{Peak Force (N, N/kg) \& RFD} & \text{Force plate (1000 Hz) fixed bar} & \text{Peak Force }>35\text{ N/kg}; \text{RFD}_{200ms} >6000\text{ N/s} & \text{NSCA Essentials Ch. 14 } \\ \hline
\textbf{Dynamic Strength Index (DSI)} & \text{CMJ Peak Force / IMTP Peak Force} & \text{Ratio of CMJ Force to IMTP Force} & <0.60 \text{ (Strength Deficit); } >0.80 \text{ (Ballistic Deficit)} & \text{High-Perf Training Ch. 1 } \\ \hline
\textbf{1RM Back Squat} & \text{Maximal Low-Speed Strength} & \text{Barbell 1RM protocol (3–5 max sets)} & >1.5\text{x Body Mass (Male); } >1.2\text{x Body Mass (Female)} & \text{NSCA Essentials Ch. 14 } \\ \hline
\textbf{1RM Power Clean} & \text{Maximal High-Speed Power} & \text{Olympic barbell 1RM catch at thigh} & >1.0\text{x Body Mass (Well-trained cohort)} & \text{NSCA Essentials Ch. 14 } \\ \hline
\textbf{Nordic Hamstring Test} & \text{Eccentric Hamstring Force (N)} & \text{Instrumented Nordic bench or break angle} & >15\text{ N/kg or Break Angle } <30^\circ \text{ from floor} & \text{NSCA Essentials Ch. 14 } \\ \hline
\textbf{SEBT / Y-Balance} & \text{Anterior/PM/PL Reach Distance} & \text{Single-leg balance star layout} & \text{L/R Symmetry } <4\text{ cm difference}; \text{Composite} >95\% & \text{NSCA Essentials Ch. 14 } \\ \hline
\textbf{Balance Error Scoring (BESS)} & \text{Postural Error Count} & \text{3 stances (Firm/Foam surfaces)} & <10 \text{ total errors across 6 conditions} & \text{NSCA Essentials Ch. 14 } \\ \hline
\textbf{Overhead Squat Screen} & \text{AMSC Bilateral Mobility} & \text{Dowel overhead squat evaluation} & \text{Parallel thigh, vertical torso, heels down} & \text{NSCA Essentials Ch. 14 } \\ \hline
\end{array}$$

### Specification Block 2.3: IMTP & Dynamic Strength Index (DSI) Diagnostic Protocol

#### 1. Name and Purpose
* **Name:** Isometric Mid-Thigh Pull (IMTP) & Dynamic Strength Index (DSI) Screening Engine.
* **Purpose:** Quantify multi-joint maximal isometric force capacity, rate of force development (RFD), and determine whether an athlete requires maximal strength, ballistic/plyometric, or concurrent training.

#### 2. Required Inputs
* Dual-axis Force Plate sampling at \\(\ge 1000\text{ Hz}\\).
* Immovable fixed bar rack set to the "second pull" weightlifting position (knee angle \\(120^\circ\text{--}145^\circ\\), hip angle \\(125^\circ\text{--}150^\circ\\)).
* Countermovement Jump (CMJ) Peak Force (\\(N\\)) collected on the same force plate.

#### 3. Measurement or Prescription Procedure
* **Warm-up:** Dynamic mobility followed by submaximal isometric pulls at 50%, 70%, and 90% perceived effort.
* **Testing:** Perform 3 maximal isometric pulls lasting \\(3 \text{ to } 5 \text{ seconds}\\), separated by 2 minutes rest.
* **Trial Validation Criteria:** Discard trial if pre-tension \\(>50\text{ N}\\), countermovement present prior to pull, or force fluctuates \\(>15\%\\) between trials.
* **Calculations:**
  * \\(\text{Peak Force (PF)} = \text{Maximum Force exerted } (N) - \text{Body Weight } (N)\\).
  * \\(\text{RFD}_{200ms} = \frac{\Delta \text{Force}}{\Delta \text{Time} (0.200s)}\\).

$$\text{Dynamic Strength Index (DSI)} = \frac{\text{CMJ Peak Force } (N)}{\text{IMTP Peak Force } (N)}$$

#### 4. Interpretation or Programming Rule
* **DSI \\(< 0.60\\) (Maximal Strength Deficit):** Athlete is incapable of exerting their potential strength during dynamic movements. **Priority:** High-Load Resistance Training (\\(\ge 80\% \text{ 1RM}\\)).
* **DSI \\(0.60 \text{ to } 0.80\\) (Balanced / Concurrent Need):** Athlete possesses balanced force-velocity qualities. **Priority:** Combined / Complex Training (High Load + Plyometrics paired).
* **DSI \\(> 0.80\\) (Ballistic / Power Deficit):** Athlete possesses high isometric strength but cannot rapidly apply force. **Priority:** Plyometric, Reactive Strength & Ballistic Training.

#### 5. Expected Training Adaptation
* Shift in lower-body Force-Velocity curve, increased motor unit recruitment rate, optimized ground reaction force impulse.

#### 6. Outcome to Track
* Absolute IMTP Peak Force (\\(N\\)), Relative Peak Force (\\(N/kg\\)), \\(\text{RFD}_{200ms}\\) (\\(N/s\\)), DSI Ratio.

#### 7. Source Reference
* *NSCA Essentials of Strength Training and Conditioning (Chapter 14)*.
* *High-Performance Training for Sports (2nd Edition, Chapter 1)*.

#### 8. Practical Implementation Notes
* `[Software Default]` If force plates are unavailable, substitute 1RM Back Squat to Body Mass ratio as the surrogate low-speed strength baseline, and Broad Jump distance as the explosive power surrogate.

---

# PART 3: Performance Priority Diagnostic & Decision Logic (WHAT NEEDS IMPROVING?)

```
                             ┌──────────────────────────────────────┐
                             │    DIAGNOSTIC DATA INTEGRATION       │
                             │ (Metabolic, Kinematic, Neuromuscular) │
                             └──────────────────┬───────────────────┘
                                                │
                                                ▼
                             ┌──────────────────────────────────────┐
                             │     S&C SPEED-MATCHING DECISION      │
                             └──────────────────┬───────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐       ┌──────────────────────────────┐
│  RACING / TARGET SPEED       │       │  RACING / TARGET SPEED       │       │       BALANCED / COMPLEX     │
│       > 12.0 km/h            │       │       <= 12.0 km/h           │       │    10.0 to 14.5 km/h         │
│     (or High VO2max)         │       │    (Slower / Ultra Pace)     │       │     (Middle/Long Combo)      │
├──────────────────────────────┤       ├──────────────────────────────┤       ├──────────────────────────────┤
│ HIGH-LOAD STRENGTH PRIORITY  │       │  PLYOMETRIC / SSC PRIORITY   │       │   COMBINED / COMPLEX MODE    │
│ • >=80% 1RM Heavy Lifts      │       │ • Low-Load Jump / Bounds     │       │ • Heavy Lift + Plyo Pair     │
│ • Modulates RE at High Speed │       │ • Modulates RE at Low Speed  │       │ • Max Performance ES (-1.03) │
└──────────────────────────────┘       └──────────────────────────────┘       └──────────────────────────────┘
```

The software engine integrates metabolic, biomechanical, and neuromuscular testing data to automatically generate prioritized clinical targets.

$$\begin{array}{|l|l|l|l|}
\hline
\textbf{Clinical Finding / Deficit} & \textbf{Diagnostic Threshold} & \textbf{Performance Priority Target} & \textbf{S&C Prescription Logic} \\ \hline
\textbf{Speed-Matched RE Need ($>12$ km/h)} & \text{Target pace } >12\text{ km/h or High }\dot{V}\text{O}_2\text{max} & \text{High-Speed Running Economy} & \text{High-Load Resistance Training } (\ge 80\% \text{ 1RM}) \\ \hline
\textbf{Speed-Matched RE Need ($\le 12$ km/h)} & \text{Target pace } \le 12\text{ km/h (Slower/Ultra)} & \text{Low-Speed Running Economy} & \text{Plyometric Training (Light load / Jump bounds)} \\ \hline
\textbf{Max Strength Deficit} & \text{DSI } <0.60 \text{ or 1RM Squat } <1.2\text{x BM} & \text{Motor Unit Recruitment / Force Ceiling} & \text{Heavy Bilateral Compound Lifts (3-6 RM)} \\ \hline
\textbf{Ballistic / Power Deficit} & \text{DSI } >0.80 \text{ or CMJ Height low} & \text{Rate of Force Development (RFD)} & \text{Explosive Plyometrics \& Drop Jumps} \\ \hline
\textbf{Overstriding / High Braking} & \text{Lateral malleolus anterior to pelvis} & \text{Braking Impulse / Joint Kinetics} & \text{Cadence +10\% + Heavy Soleus/Calf Loading} \\ \hline
\textbf{Dynamic Knee Valgus / Drop} & \text{Closed Knee Window / Pelvic Drop} & \text{Frontal/Transverse Kinetic Chain} & \text{Unilateral Glute/Hip Abductor Strength} \\ \hline
\end{array}$$

---

# PART 4: Exercise Prescription, Loading & Progression Matrix (WHAT WILL WE DO?)

---

## 4.1 Master S&C Programming Parameters

\\[\begin{array}{|l|l|l|l|l|l|l|}
\hline
\textbf{Training Method} & \textbf{Intensity / Load} & \textbf{Sets x Reps} & \textbf{Rest Interval} & \textbf{Frequency} & \textbf{Pace Match} & \textbf{Primary Outcome (Effect Size)} \\ \hline
\textbf{High-Load Resistance} & \ge 80\% \text{ 1RM } (\le 6\text{ RM}) & 2\text{--}4 \text{ sets} \times 3\text{--}6 \text{ reps} & 2\text{--}3 \text{ minutes} & 2 \text{ days/wk} & >12\text{ km/h} & \text{Performance ES } -0.469 \text{; RE ES } -0.266 \\ \hline
\textbf{Plyometric Training} & \text{Body Weight / } <40\% \text{ 1RM} & 3\text{--}5 \text{ sets} \times 5\text{--}10 \text{ contacts} & 2\text{--}3 \text{ minutes} & 2 \text{ days/wk} & \le 12\text{ km/h} & \text{RE ES } -0.307 \text{ (Low speeds)} \\ \hline
\textbf{Combined / Complex} & \ge 80\% \text{ 1RM + Body Weight} & 3\text{--}4 \text{ sets} \times (3\text{-}5 \text{ lift} + 5\text{-}8 \text{ jump}) & 3 \text{ minutes} & 2 \text{ days/wk} & 10\text{--}14.5\text{ km/h} & \text{Performance ES } -1.035 \text{; RE ES } -0.426 \\ \hline
\textbf{Submaximal Load (SL)} & 40\%\text{--}79\% \text{ 1RM } (8\text{--}20\text{ RM}) & 2\text{--}3 \text{ sets} \times 12\text{--}20 \text{ reps} & 30\text{--}60 \text{ seconds} & 1\text{--}2 \text{ days/wk} & \text{N/A} & \text{Non-Significant Effect } (p>0.131) \\ \hline
\end{array}\\]

---

## 4.2 S&C Intervention Specification Blocks

### Specification Block 4.1: High-Load Resistance Training Intervention

#### 1. Name and Purpose
* **Name:** High-Load Resistance Training Protocol.
* **Purpose:** Expand maximal lower-body force output, increase motor unit recruitment, and enhance running economy at faster running speeds (\\(>12\text{ km/h}\\)).

#### 2. Required Inputs
* Tested 1RM or estimated 3–6RM for core multi-joint exercises (Barbell Back Squat, Romanian Deadlift, Single-Leg Leg Press).

#### 3. Measurement or Prescription Procedure
* **Exercise Selection:** Barbell Back Squat / Half Squat, Romanian Deadlift / Trap Bar Deadlift, Heavy Calf/Soleus Raise.
* **Prescription Parameters:**
  * **Intensity:** \\(\ge 80\% \text{ 1RM}\\) (or \\(3 \text{ to } 6\text{ RM}\\) load).
  * **Volume:** \\(3 \text{ to } 4 \text{ sets}\\) per exercise, \\(3 \text{ to } 6 \text{ repetitions}\\) per set.
  * **Rest Period:** \\(2 \text{ to } 3 \text{ minutes}\\) full recovery between sets.
  * **Movement Velocity:** Intent to move concentric phase explosively / maximally.
  * **Frequency:** \\(2 \text{ days per week}\\) integrated into concurrent schedule.

#### 4. Interpretation or Programming Rule
* **Meta-Analytic Moderator Rule:** Prescribe High-Load training specifically for runners targeting pacing speeds \\(>12.0\text{ km/h}\\) or possessing a high baseline \\(\dot{V}\text{O}_2\text{max}\\) (\\(\ge 55\text{ ml/kg/min}\\)).
* Do not train to muscular failure on any set; maintain \\(1 \text{ to } 2 \text{ Repetitions in Reserve (RIR)}\\) to prevent residual neuromuscular fatigue interfering with running workouts.

#### 5. Expected Training Adaptation
* Significant moderate improvement in time-trial performance (\\(ES = -0.469, p = 0.029\\)).
* Significant small improvement in running economy (\\(ES = -0.266, p = 0.039\\)).
* **Metabolic Neutrality:** Zero negative impact or alteration to \\(\dot{V}\text{O}_2\text{max}\\), lactate threshold, or body mass (no muscle hypertrophy interference).

#### 6. Outcome to Track
* 1RM Strength progression (\\(kg\\)), Bar Concentric Velocity (\\(m/s\\)), Submaximal RE (\\(ml\text{ O}_2/kg/km\\)).

#### 7. Source Reference
* *Llanos-Lagos et al. (2023 & 2024 Systematic Reviews & Meta-Analyses)*.

#### 8. Practical Implementation Notes
* `[Explicit Source Recommendation]` High-load strength training yields superior running economy gains at high speeds because high-speed running requires high force production in short ground contact times.

---

### Specification Block 4.2: Plyometric & Reactive Strength Training Intervention

#### 1. Name and Purpose
* **Name:** Lower-Limb Plyometric & Stretch-Shortening Cycle (SSC) Protocol.
* **Purpose:** Enhance lower-limb tendon stiffness (Achilles/plantar fascia), shorten ground contact time, and improve running economy at moderate-to-slow speeds (\\(\le 12\text{ km/h}\\)).

#### 2. Required Inputs
* Movement competency clearance (Overhead Squat & BESS balance test clearance).

#### 3. Measurement or Prescription Procedure
* **Exercise Selection:** Alternate Leg Bounding, Double & Single-Leg Hurdle Hops, Drop Jumps (\\(20\text{--}40\text{ cm}\\) box), Jump Rope / Ankle Hopping.
* **Prescription Parameters:**
  * **Intensity:** Body weight or light external load (\\(<40\% \text{ 1RM}\\)).
  * **Volume:** \\(3 \text{ to } 5 \text{ sets}\\) of \\(5 \text{ to } 10 \text{ repetitions}\\) (or \\(30\text{--}60 \text{ foot contacts}\\) per session).
  * **Rest Period:** \\(2 \text{ to } 3 \text{ minutes}\\) complete recovery between sets.
  * **Ground Contact Constraint:** Minimize contact time (\\(<200\text{ ms}\\) focus on rapid elastic recoil).
  * **Frequency:** \\(2 \text{ days per week}\\).

#### 4. Interpretation or Programming Rule
* **Meta-Analytic Speed Rule:** Prescribe Plyometric training specifically for runners targeting pacing speeds \\(\le 12.0\text{ km/h}\\) (e.g., marathon/ultra runners or recreational cohorts).
* Discontinue plyometric set immediately if ground contact time visibly lengthens or jump height decreases by \\(>10\%\\).

#### 5. Expected Training Adaptation
* Significant small improvement in running economy at speeds \\(\le 12\text{ km/h}\\) (\\(ES = -0.307, p = 0.028\\)).
* Increased Achilles tendon strain energy storage and recoil efficiency.

#### 6. Outcome to Track
* Reactive Strength Index (\\(\text{RSI} = \frac{\text{Flight Time}}{\text{Contact Time}}\\)), Ground Contact Time (\\(ms\\)), Jump Height (\\(cm\\)).

#### 7. Source Reference
* *Llanos-Lagos et al. (2023 & 2024 Meta-Analyses)*.

#### 8. Practical Implementation Notes
* `[Explicit Source Recommendation]` At low running speeds, compliant Achilles tendons efficiently store and release strain energy. Plyometrics optimize this passive recoil mechanism, whereas at high speeds heavy strength training is required to stiffen the system.

---

### Specification Block 4.3: Combined / Complex Training Intervention

#### 1. Name and Purpose
* **Name:** Complex Contrast Resistance & Plyometric Protocol.
* **Purpose:** Elicit maximal global improvements in distance running time-trial performance and running economy by addressing both force and velocity spectrums in a single program.

#### 2. Required Inputs
* Baseline maximal strength testing (1RM Squat or IMTP) and plyometric competency clearance.

#### 3. Measurement or Prescription Procedure
* **Exercise Sequence (Complex Contrast Pairing):**
  * **High-Load Exercise:** Heavy Barbell Squat (3–5 reps @ 85% 1RM).
  * **Rest:** \\(2\text{--}3\text{ minutes}\\) (Post-Activation Performance Enhancement window).
  * **Plyometric Exercise:** Drop Jump / Hurdle Hops (5–6 contacts @ Body Weight).
  * **Rest:** \\(3\text{ minutes}\\) before repeating pair.
* **Volume & Frequency:** \\(3 \text{ to } 4 \text{ complex sets}\\) per pairing, \\(2 \text{ sessions per week}\\) for \\(8 \text{ to } 12 \text{ weeks}\\).

#### 4. Interpretation or Programming Rule
* Prescribe Combined training as the default gold-standard intervention for competitive runners seeking absolute maximum performance enhancement across mixed pace demands (\\(10.0\text{--}14.5\text{ km/h}\\)).

#### 5. Expected Training Adaptation
* **Statistically Largest Performance Improvement:** Large beneficial effect on overall running time-trial performance (\\(ES = -1.035, p = 0.036\\)), significantly outperforming single-method training.
* Significant moderate enhancement in running economy (\\(ES = -0.426, p = 0.018\\)).

#### 6. Outcome to Track
* Time-Trial Finish Time (\\(sec\\)), Submaximal Running Economy (\\(ml\text{ O}_2/kg/min\\)), DSI Ratio.

#### 7. Source Reference
* *Llanos-Lagos et al. (2023 & 2024 Meta-Analyses)*.
* *Li et al. (2019 / PeerJ)*.

#### 8. Practical Implementation Notes
* `[Explicit Source Recommendation]` Combined training creates multi-level neuromuscular overload, enhancing motor unit synchronization and musculotendinous stiffness simultaneously.

---

### Specification Block 4.4: Unilateral Strength & Kinetic Chain Robustness Protocol

#### 1. Name and Purpose
* **Name:** Unilateral Lower-Limb & Trunk Robustness Protocol.
* **Purpose:** Correct left/right bilateral force asymmetries, strengthen the calf-soleus complex, stabilize pelvic drop, and enhance trunk bracing capacity.

#### 2. Required Inputs
* Movement Screen findings (SEBT reach asymmetry, Pelvic Drop, Knee Valgus).

#### 3. Measurement or Prescription Procedure
* **Exercise Battery:**
  * **Unilateral Quad/Glute:** Bulgarian Split Squats / Single-Leg Step-Ups (\\(3 \text{ sets} \times 6\text{--}8 \text{ reps/leg}\\) with dumbbells).
  * **Calf-Soleus Complex:** Seated Soleus Calf Raise (\\(3 \text{ sets} \times 8\text{--}10 \text{ reps}\\) heavy) & Standing Gastrocnemius Raise.
  * **Eccentric Hamstring:** Nordic Hamstring Lowering (\\(3 \text{ sets} \times 5 \text{ reps}\\)).
  * **Trunk/Pelvic Core Bracing:** Front Support Core Bracing & Anti-Rotation Pallof Press.
* **Frequency:** Integrated into non-running quality days 2 times per week.

#### 4. Interpretation or Programming Rule
* If SEBT reach asymmetry \\(>4\text{ cm}\\) on a single limb, initiate unilateral loading on the weaker limb with \\(+1\\) extra set until symmetry is restored.

#### 5. Expected Training Adaptation
* Eradication of unilateral capacity deficits, reduction in Achilles tendon and plantar fascia overload, stabilized frontal plane pelvic alignment.

#### 6. Outcome to Track
* SEBT Asymmetry Distance (\\(cm\\)), Nordic Hamstring Eccentric Force (\\(N\\)), Single-Leg Calf Raise Repetition Max.

#### 7. Source Reference
* *NSCA Essentials of Strength Training and Conditioning (Chapters 14, 16)*.
* *High-Performance Training for Sports (Chapter 1)*.

#### 8. Practical Implementation Notes
* `[Software Default]` High-load soleus training is mandatory for all distance runners due to soleus force demands reaching 6–8x body weight during stance phase.

---

# PART 5: Periodization, Milestone Tracking & Tapering Framework (WHERE ARE WE GOING? & ARE WE PROGRESSING?)

---

## 5.1 Periodization Models & Macrocycle Structure

To balance concurrent running and strength conditioning without inducing interference effects, the software engine structures periodization across three primary phases using a **3:1 Summated Microcycle Model** (3 weeks loading, 1 week unloading).

\\[\begin{array}{|l|l|l|l|l|}
\hline
\textbf{Macrocycle Phase} & \textbf{Duration} & \textbf{Running Focus / TID} & \textbf{Gym S&C Method Focus} & \textbf{S&C Loading Scheme} \\ \hline
\textbf{Accumulation Phase} & \text{Weeks 1–6} & \text{Base Aerobic / Moderate (80/15/5 Pyramidal)} & \text{Maximal Strength (High Load) + Robustness} & 3\text{--}4 \text{ sets} \times 5\text{--}6 \text{ reps @ } 80\%\text{--}85\% \text{ 1RM} \\ \hline
\textbf{Transmutation Phase} & \text{Weeks 7–12} & \text{Threshold \& Interval (Heavy/Severe Domains)} & \text{Combined / Complex Contrast Training} & 3 \text{ sets} \times (3\text{-}4 \text{ Heavy } + 5 \text{ Plyo}) \\ \hline
\textbf{Realization Phase} & \text{Weeks 13–16} & \text{Race Specificity / Tapering} & \text{Power Maintenance \& Explosive S&C} & 2 \text{ sets} \times 3 \text{ reps @ } 85\% \text{ 1RM (50\% Vol Cut)} \\ \hline
\end{array}\\]

```
                ┌────────────────────────────────────────────────────────┐
                │          3:1 SUMMATED MICROCYCLE STRUCTURE             │
                └───────────────────────────┬────────────────────────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         ▼                                  ▼                                  ▼
┌─────────────────┐                ┌─────────────────┐                ┌─────────────────┐
│     WEEK 1      │                │     WEEK 2      │                │     WEEK 3      │
│  Baseline Load  │  ────────────► │   Step-Up Load  │  ────────────► │    Peak Load    │
│  (100% Target)  │                │  (105% Target)  │                │  (110% Target)  │
└─────────────────┘                └─────────────────┘                └────────┬────────┘
                                                                               │
                                                                               ▼
                                                                      ┌─────────────────┐
                                                                      │     WEEK 4      │
                                                                      │  Unload / Reset │
                                                                      │ (50-60% Volume) │
                                                                      └─────────────────┘
```

---

### Specification Block 5.1: Block Periodization & Concurrent Scheduling Engine

#### 1. Name and Purpose
* **Name:** Block Periodization & Concurrent Scheduling Module.
* **Purpose:** Systematically sequence strength and endurance training blocks while eliminating interference effects on high-quality running sessions.

#### 2. Required Inputs
* Target competition date, running workout schedule (Quality days Q1, Q2, Q3).

#### 3. Measurement or Prescription Procedure
* **Concurrent Intra-Day Scheduling Rules:**
  * **Rule 1 (Inter-Session Gap):** Separate high-quality running workouts (I/R pace intervals) and heavy S&C sessions by \\(\ge 6\text{ hours}\\) whenever possible.
  * **Rule 2 (Session Order):** Perform running quality workouts *before* gym-based strength training on the same day. Never perform heavy lower-body squatting immediately prior to a key threshold or interval run.
  * **Rule 3 (Hard-Day / Easy-Day Consolidation):** Consolidate heavy S&C onto running quality days ("keep hard days hard"), allowing non-Q running days to remain pure easy recovery days.

#### 4. Interpretation or Programming Rule
* **Unloading Week Rule (Week 4 of every 3:1 cycle):** Reduce total S&C volume (number of sets) by \\(40\%\text{--}50\%\\), while maintaining intensity (\\(\ge 80\% \text{ 1RM}\\)) to preserve neural adaptations while dissipating fatigue.

#### 5. Expected Training Adaptation
* Continuous positive adaptation without cellular signal interference (\\(mTORC1\\) vs. \\(AMPK\\) signaling balance), preventing overtraining syndrome.

#### 6. Outcome to Track
* Acute-to-Chronic Workload Ratio (ACWR), CMJ Jump Height Restoration (\\(cm\\)), Subjective Muscle Soreness Score.

#### 7. Source Reference
* *NSCA's Guide to Program Design (Chapters 1, 2)*.
* *NSCA Developing Endurance (Chapter 8, Table 8.8)*.

#### 8. Practical Implementation Notes
* `[Explicit Source Recommendation]` Training frequency of 2 S&C days per week during prep phases and 1 S&C day per week during competition phases is optimal for maintaining strength gains without impairing running volume.

---

### Specification Block 5.2: Peaking & Tapering S&C Protocol

#### 1. Name and Purpose
* **Name:** Pre-Competition S&C Tapering Protocol.
* **Purpose:** Dissipate accumulated neuromuscular fatigue prior to key competition while maintaining maximum force and power production.

#### 2. Required Inputs
* Competition date (Weeks out: T-3, T-2, T-1).

#### 3. Measurement or Prescription Procedure
* **Taper Execution Protocol (3 Weeks Out):**
  * **Week T-3:** Reduce S&C set volume by \\(30\%\\). Maintain intensity (\\(\ge 85\% \text{ 1RM}\\)).
  * **Week T-2:** Reduce S&C set volume by \\(50\%\\). Maintain load (\\(\ge 85\% \text{ 1RM}\\)), perform only 2 sets of 2–3 reps.
  * **Week T-1 (Race Week):** Eliminate all heavy resistance training and plyometrics \\(\ge 4 \text{ to } 5\text{ days}\\) prior to race day. Permit light mobility and bodyweight dynamic priming only.

#### 4. Interpretation or Programming Rule
* **Volume Reduction, Intensity Preservation:** Never reduce lifting intensity (weight on bar) during a taper; reducing intensity causes loss of neural drive. Always reduce total volume (sets \\(\times\\) reps).

#### 5. Expected Training Adaptation
* Supercompensation of muscle glycogen, full restoration of rate of force development, peak competitive performance.

#### 6. Outcome to Track
* CMJ Peak Power (\\(W\\)), Resting Heart Rate, Race Time Performance (\\(sec\\)).

#### 7. Source Reference
* *NSCA Developing Endurance (Chapter 8)*.
* *High-Performance Training for Sports (Chapter 1)*.

#### 8. Practical Implementation Notes
* `[Software Default]` Combine the S&C taper with Daniels' exponential running volume taper (reducing weekly mileage down to 60% and 40% peak volume over final 2 weeks).

---

## 5.3 Progress Monitoring & Load Adjustment Engine (ARE WE PROGRESSING?)

\\[\begin{array}{|l|l|l|l|}
\hline
\textbf{Monitoring Level} & \textbf{Tracking Metric} & \textbf{Threshold / Rule Trigger} & \textbf{Automated Engine Action} \\ \hline
\textbf{Session-Level} & \text{CMJ Average Height (3 trials)} & >5\% \text{ drop below baseline} & \text{Reduce gym sets by 50\% or cancel plyos for session} \\ \hline
\textbf{Session-Level} & \text{Bar Concentric Velocity} & >10\% \text{ velocity loss in set} & \text{Terminate set immediately (prevents extreme failure)} \\ \hline
\textbf{Weekly Level} & \text{Weekly Volume Progression} & >10\% \text{ increase in mileage} & \text{Flag } \text{VOL\_WARNING}\text{; cap volume increase at 10\%} \\ \hline
\textbf{Weekly Level} & \text{Daniels Point Accumulation} & \text{Exceeds weekly point target} & \text{Enforce mandatory 2-day Easy (E) recovery block} \\ \hline
\textbf{Periodic (3–4 Wks)} & \text{Submax HR at T-Pace} & \ge 3\text{ bpm drop at same pace} & \text{Advance VDOT by +1 unit; recalculate pacing matrix} \\ \hline
\textbf{Periodic (3–4 Wks)} & \text{1RM / IMTP Strength Test} & \ge 5\% \text{ increase in Peak Force} & \text{Recalculate S&C loads (\%1RM) for next block} \\ \hline
\end{array}\\]

### Specification Block 5.3: Automated Progression & Unloading Decision Logic

#### 1. Name and Purpose
* **Name:** Deterministic Load Adjustment & Progression Engine.
* **Purpose:** Provide automated, source-derived rules for advancing, maintaining, or unloading running and gym-based training loads.

#### 2. Required Inputs
* Weekly running mileage, weekly Daniels point totals, pre-session CMJ height, submaximal Heart Rate during T-pace runs, 3-4 week re-test strength figures.

#### 3. Measurement or Prescription Procedure
* **Rule 1: VDOT Advancement Rule (Running Progression):**
  * Evaluate submaximal HR and recent race/time-trial data every 3 to 4 weeks.
  * If the athlete completes all quality workouts successfully and demonstrates lower submaximal HR (\\(\ge 3\text{ bpm}\\) lower at same T-pace) OR races faster, advance VDOT by \\(+1 \text{ unit}\\).
  * *Constraint:* Do not advance VDOT faster than once every 3 weeks.
* **Rule 2: S&C Load Advancement Rule (Gym Progression):**
  * When an athlete completes all prescribed sets and reps at \\(\ge 80\% \text{ 1RM}\\) with \\(\le 1 \text{ RIR}\\) on the final set, increase bar weight by \\(+2.5\% \text{ to } +5\%\\) for the subsequent microcycle.
* **Rule 3: Acute Fatigue & Injury Unloading Trigger:**
  * If pre-session CMJ height drops \\(>5\%\\) below baseline OR AMSSM Pain survey triggers `YES`: Execute immediate \\(1\text{-week Unloading Block}\\) (50% S&C volume reduction, eliminate Severe/Extreme domain running).

#### 4. Interpretation or Programming Rule
* **The 10% Weekly Volume Cap:** Never allow weekly running mileage to increase by \\(>10\%\\) over the preceding week's volume.

#### 5. Expected Training Adaptation
* Systematic, non-linear performance progression while mitigating overtraining, fatigue accumulation, and overuse tissue failure.

#### 6. Outcome to Track
* Rate of VDOT Progression, 1RM Strength Change (\\(kg\\)), Injury Incidence Rate, CMJ Fatigue Delta.

#### 7. Source Reference
* *Daniels' Running Formula (Chapters 4, 5, 9)*.
* *High-Performance Training for Sports (Chapter 1)*.
* *IOC Sport Load and Illness Consensus (Schwellnus et al., 2016)*.

#### 8. Practical Implementation Notes
* `[Software Default]` If an athlete experiences a missed workout block due to non-injury life stress, hold VDOT static for 2 additional microcycles before evaluating progression.

---

# PART 6: Knowledge Gaps, Software Defaults & Deterministic Execution Roadmap

---

## 6.1 Summary of Software Defaults vs. Explicit Evidence

\\[\begin{array}{|l|l|l|}
\hline
\textbf{Clinical Domain} & \textbf{Explicit Source Recommendation} & \textbf{Proposed Software Default (Gap-Filling)} \\ \hline
\textbf{REDs Screening Data} & \text{Requires DXA Z-Score, T3, Ferritin, Bloods } & \text{Default to questionnaire secondary criteria if bloods unavailable} \\ \hline
\textbf{Force Plate Hardware} & \text{IMTP \& CMJ force plates sampled at } 1000\text{ Hz } & \text{Substitute 1RM Squat/BM ratio \& Broad Jump if force plate missing} \\ \hline
\textbf{6-Second Pacing Rule} & \text{6 sec/400m gap between R, I, and T paces } & \text{Expand to 8 sec/400m gap for low-VDOT } (<40) \text{ runners } \\ \hline
\textbf{Gait Kinematic Cutoffs} & \text{No absolute prospective injury cutoffs exist } & \text{Use relative change + active pain; no form changes in healthy runners } \\ \hline
\textbf{Soleus Loading} & \text{Heavy soleus raises noted in lifting protocols } & \text{Mandatory inclusion of heavy seated calf raises for all distance runners} \\ \hline
\end{array}\\]

---

## 6.2 Deterministic Execution Roadmap for Claude Code Web Application

```
  STEP 1: Implement Health Gatekeeper Module
  ├── Encode AMSSM 2-week pain survey & REDs CAT2 traffic light matrix
  └── Output: Clearance Status (Green/Yellow/Orange/Red)

  STEP 2: Build Baseline & Metabolic Pacing Engine
  ├── Encode Daniels VDOT lookup tables & FVDOT detraining formulas (Table 9.1)
  └── Output: Exact E, M, T, I, R pacing matrix & weekly point targets

  STEP 3: Implement 2D Gait & Physical Capacity Diagnostic Module
  ├── Encode 2D kinematic evaluation logic (Overstride vertical malleolus check)
  ├── Compute DSI ratio (CMJ Peak Force / IMTP Peak Force)
  └── Output: Performance Priority Profile (Max Strength vs. Ballistic vs. Combined)

  STEP 4: Build Speed-Matched S&C Prescription Matrix
  ├── Apply speed-matching moderator rules (>12 km/h -> High Load; <=12 km/h -> Plyo)
  ├── Generate 3:1 Summated Microcycle exercise sets, reps, loads (%1RM), rest
  └── Output: Editable, periodized gym-based S&C program

  STEP 5: Integrate Monitoring & Progression Engine
  ├── Encode 10% volume cap, CMJ >5% fatigue trigger, & VDOT +1 advancement logic
  └── Output: Weekly load adjustments and re-testing alerts
```

---

🏋️ **Next Steps & System Ready:** This framework provides all deterministic decision logic, zone formulas, pacing rules, and exercise specification matrices required to construct the TPC Performance OS second-clinician engine without paid AI APIs.

When you are ready, we can proceed to generating the precise JSON data structures or tabular schema for Claude Code implementation!