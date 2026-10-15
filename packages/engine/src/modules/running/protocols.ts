import type { RuleStatus, TestProtocol } from "../../core/types";

const p = (x: Omit<TestProtocol, "status"> & { status: RuleStatus }): TestProtocol => x;

/**
 * Field-test battery for a clinic WITHOUT a force plate: treadmill, barbell + rack, phone.
 * "source_verified" = the procedure was read in the supplied texts; otherwise it is a proposed standard that the clinic should
 * keep identical between baseline and retest (these tests are tracked for change, not judged against norms).
 */
export const RUNNING_PROTOCOLS: TestProtocol[] = [
  p({
    id: "squat-rm",
    name: "Back squat 3-5RM",
    purpose: "Maximal lower-body strength. Sets every starting load in the program (estimated 1RM) and flags a strength deficit.",
    equipment: ["Barbell, plates and squat rack", "Safety bars or spotters", "Stopwatch"],
    setup: [
      "Use a 3RM or 5RM, not a 1RM, for novices, anyone untrained, injured or new to the squat: it is the safer option and suitable for nearly all athletes who show proper technique.",
      "Agree one squat depth (for example thighs parallel) and use exactly the same standard at every retest.",
    ],
    steps: [
      "Warm up with a light load that easily allows 5-10 reps. Rest 1 minute.",
      "Add 10-20% and do 3-5 reps. Rest 2 minutes.",
      "Add 10-20% again for a conservative, near-maximal set of 2-3 reps. Rest 2-4 minutes.",
      "Increase the load another 10-20% and attempt the target reps (3 or 5). If successful, rest 2-4 minutes and add 5-10%; if not, reduce slightly and retry.",
      "Aim to find the 3RM/5RM within 3-5 testing sets so fatigue does not distort the result.",
    ],
    records: "Squat test load (kg) and reps (keep reps at 5 or fewer). The app estimates 1RM from these.",
    safety: "Stop the test on pain or loss of technique. Estimating 1RM from higher reps is less accurate and tends to overestimate, so avoid sets above 5 reps.",
    usedFor: "Starting loads; strength priority (squat ÷ body mass); objective: estimated 1RM.",
    source: "NSCA Essentials of Strength Training and Conditioning, ch. 18 (1RM testing protocol and xRM testing)",
    status: "source_verified",
    note: "The load steps and rests are from the NSCA protocol, written for lower-body lifts; the depth standard is the clinic's choice.",
  }),
  p({
    id: "cmj-video",
    name: "Countermovement jump height (phone video)",
    purpose: "Tracks lower-limb power change over time and gives the baseline for the pre-session fatigue check.",
    equipment: ["Phone with slow-motion (120-240 frames per second)", "Tripod or a fixed stand", "Flat, firm floor"],
    setup: [
      "Film from the side with the phone at about knee height, fixed, so take-off and landing are both visible.",
      "Hands on hips throughout so arm swing does not change the result.",
    ],
    steps: [
      "Warm up with a few submaximal jumps.",
      "Do a quick dip and jump as high as possible, landing on the same spot with legs straight.",
      "Do 3 jumps with 30-60 seconds between them.",
      "On the video, count the frames from the last frame with feet off the ground to the first frame of landing. Flight time = frames ÷ frame rate.",
      "Jump height (cm) = 122.6 × flight time (s)² (that is 100 × g × t² ÷ 8). Use the app's calculator, then average the 3 jumps.",
    ],
    records: "CMJ height (cm), average of 3 jumps.",
    safety: "Skip if there is pain in the foot, ankle, Achilles, calf or tibia (the same restriction used for plyometrics).",
    usedFor: "Baseline for the >5% fatigue rule; tracked for change. No validated runner cutoffs, so it is never used to judge the athlete.",
    source: null,
    status: "needs_verification",
    note: "The jump-height formula is standard flight-time physics. Frame-counting from phone video is less exact than a jump mat or force plate: use the same phone, frame rate and counting method every time.",
  }),
  p({
    id: "broad-jump",
    name: "Standing broad jump",
    purpose: "Simple horizontal power measure that needs no technology.",
    equipment: ["Tape measure", "Firm, non-slip floor", "Tape or line for take-off"],
    setup: ["Toes behind the take-off line, feet about hip width."],
    steps: [
      "Swing the arms back, dip, and jump forward as far as possible, landing on two feet and holding the landing.",
      "Measure from the take-off line to the nearest heel on landing.",
      "Do 3 jumps with 1-2 minutes between them and record the best.",
    ],
    records: "Best broad jump (metres).",
    safety: "Skip if there is pain in the foot, ankle, Achilles, calf or tibia.",
    usedFor: "Tracked for change only.",
    source: "Knowledge file 01 lists the broad jump as the explosive-power substitute when no force plate is available.",
    status: "needs_verification",
  }),
  p({
    id: "rsi-pogo",
    name: "Reactive strength: pogo hops (RSI from phone video)",
    purpose: "How stiff and springy the ankle and Achilles are in fast ground contacts. The reactive strength index (RSI) is flight time ÷ contact time.",
    equipment: ["Phone with slow-motion at 240 fps if possible (120 minimum)", "Tripod", "Firm floor"],
    setup: [
      "Film from the side at ankle height with the whole foot and floor visible.",
      "Cue: stiff ankles, minimal knee bend, quiet landings, bounce as fast as possible.",
    ],
    steps: [
      "Warm up with a few easy hops.",
      "Do 10 continuous pogo hops (ignore the first 2).",
      "On the video, for the 3 best-looking hops, count frames: contact (foot lands to foot leaves) and flight (foot leaves to next landing). Convert to milliseconds using the frame rate.",
      "Average the 3 contact times and the 3 flight times.",
    ],
    records: "Average flight time (ms) and contact time (ms). The app calculates RSI.",
    safety: "Do not test with pain at the foot, ankle, Achilles, calf or tibia. For a novice this low-level hop is fine; do not substitute drop jumps.",
    usedFor: "Tracked for change; objective: RSI.",
    source: null,
    status: "needs_verification",
    note: "No supplied text gives a standardised runner procedure or cutoffs. Keep hop count, surface, footwear and frame rate identical at retest.",
  }),
  p({
    id: "calf-raise",
    name: "Single-leg calf raise to fatigue",
    purpose: "Calf-soleus endurance capacity and left-right difference.",
    equipment: ["Step or flat floor", "Wall or rail for fingertip balance", "Metronome or phone timer"],
    setup: ["Straight knee, fingertip support only, full range from lowest heel to highest rise."],
    steps: [
      "Set a steady tempo of 1 second up and 1 second down.",
      "Test one leg until the range drops noticeably, the tempo is lost or the knee bends. Count full-range reps.",
      "Rest 2-3 minutes, then test the other leg.",
    ],
    records: "Reps for the left and right leg.",
    safety: "Stop on Achilles or calf pain.",
    usedFor: "Symmetry flag (default over 10% difference), extra set on the weaker side, objective: average reps.",
    source: null,
    status: "needs_verification",
    note: "Tempo and stopping rule are the clinic's standard, not from a supplied text. Keep them identical at every retest.",
  }),
  p({
    id: "sebt",
    name: "Star excursion / Y-balance reach (floor tape)",
    purpose: "Single-leg dynamic balance and side-to-side difference.",
    equipment: ["Floor tape and tape measure"],
    setup: ["Tape three lines from a centre point: anterior, posteromedial and posterolateral."],
    steps: [
      "Stand on one leg on the centre. Reach the other foot as far as possible along a line, touch lightly and return without losing balance.",
      "Do 3 practice reps per direction, then 3 recorded reps per direction. Record the best reach in cm.",
      "Repeat on the other leg. Work out the left-right difference for each direction.",
    ],
    records: "The largest left-right difference across the three directions (cm).",
    safety: "Stop if balance or pain limits the test.",
    usedFor: "Symmetry flag (default over 4 cm).",
    source: "Knowledge file 01, Block 2.3 (NSCA Essentials ch. 14 attribution)",
    status: "needs_verification",
  }),
  p({
    id: "nordic-video",
    name: "Nordic hamstring lowering (break angle from video)",
    purpose: "Eccentric hamstring capacity without a force device.",
    equipment: ["Padded surface", "Partner or strap to anchor the ankles", "Phone at 120+ fps"],
    setup: ["Kneel with ankles anchored, body straight from knees to head, hands ready in front."],
    steps: [
      "Lower the body as slowly as possible, keeping the hips extended.",
      "Film from the side. The break point is where the athlete can no longer control the descent and falls forward.",
      "Measure the body angle from the floor at the break point on the video. Use the best of 3 attempts.",
    ],
    records: "Break angle (degrees from the floor).",
    safety: "Do not test with hamstring pain. Expect soreness: schedule away from key runs.",
    usedFor: "Tracked for change only (no cutoff applied).",
    source: "Knowledge file 01, Block 2.3 mentions video break-point angle as the alternative to force.",
    status: "needs_verification",
  }),
  p({
    id: "gait-treadmill",
    name: "Treadmill running video (2D gait)",
    purpose: "Observe running mechanics and any link to symptoms. Observations only: no validated injury cutoffs exist.",
    equipment: ["Treadmill", "Phone (120+ fps), tripod", "Optional skin markers (greater trochanter, knee, ankle, heel)"],
    setup: [
      "Set the treadmill speed to the speed at which the runner feels symptoms. For a healthy runner use their long-run pace.",
      "Film two views at right angles: from the side and from behind. Fix the camera position and angle so the setup is reproducible.",
      "Zoomed-in views of the foot and ankle help; keep the same positions at retest.",
    ],
    steps: [
      "Let the runner run at the test speed for 6-10 minutes to settle into treadmill running before filming.",
      "Film at least 30 seconds from each view. If symptoms only appear after some minutes, also film once the runner is fatigued.",
      "Review frame by frame: foot strike, overstride, knee flexion, hip extension, vertical oscillation, pelvic drop, knee valgus, crossover, heel whip. Count cadence over 60 seconds.",
    ],
    records: "Video observations and cadence in the app's video section.",
    safety: "Stop if symptoms rise. Use the treadmill safety clip.",
    usedFor: "Observations; a symptomatic overstride triggers a cadence trial suggestion.",
    source: "Souza 2016, An Evidence-Based Videotaped Running Biomechanics Analysis (setup, acclimation, views, frame rate)",
    status: "source_verified",
    note: "Corrects the knowledge file, which said to film at race pace: the paper says symptomatic speed, or long-run pace for a symptom-free runner.",
  }),
  p({
    id: "time-trial",
    name: "Recent race or time trial (VDOT)",
    purpose: "Current running fitness, which sets training paces and the goal comparison.",
    equipment: ["Track, road or treadmill", "Stopwatch"],
    setup: ["Use a race or maximal effort within the last 4 months. A treadmill trial is acceptable if the same treadmill and settings are used every time."],
    steps: ["Warm up, run the distance at the best sustainable effort, and record distance and finishing time."],
    records: "Distance (m), time, and days since the effort.",
    safety: "Not for athletes under medical review for the screening flags.",
    usedFor: "VDOT, training paces and the race-goal objective.",
    source: "Daniels' Running Formula 4th ed. (VDOT from race performance)",
    status: "source_verified",
  }),
  p({
    id: "force-plate-optional",
    name: "Optional: IMTP and CMJ peak force (force plate)",
    purpose: "Enables the Dynamic Strength Index (CMJ force ÷ IMTP force).",
    equipment: ["Force plate (not available at TPC)", "Fixed bar rack"],
    setup: ["Only if a plate becomes available."],
    steps: ["Follow the plate manufacturer's IMTP and CMJ protocol."],
    records: "IMTP peak force (N) and CMJ peak force (N).",
    safety: "Maximal effort test: not for athletes under medical review.",
    usedFor: "DSI. Leave blank when no plate is available: the engine then uses squat strength and target speed.",
    source: "High-Performance Training for Sports, ch. 1 (ratio only)",
    status: "needs_verification",
  }),
];

/** Which tests to repeat at a reassessment, from what was measured at baseline. */
export function retestList(physical: {
  squatLoadKg: number | null; cmjHeightCm: number | null; broadJumpM: number | null; rsiFlightMs?: number | null; rsiContactMs?: number | null;
  calfRaiseLeftReps: number | null; calfRaiseRightReps: number | null; sebtAsymmetryCm: number | null; nordicBreakAngleDeg?: number | null; hipAbductionLeftKg?: number | null; hipAbductionRightKg?: number | null;
  imtpPeakForceN: number | null; cmjPeakForceN: number | null; nordicForceN: number | null;
}): string[] {
  const out: string[] = [];
  if (physical.squatLoadKg != null) out.push("Squat 3-5RM");
  if (physical.cmjHeightCm != null) out.push("CMJ height");
  if (physical.broadJumpM != null) out.push("Broad jump");
  if (physical.rsiFlightMs != null && physical.rsiContactMs != null) out.push("Pogo-hop RSI");
  if (physical.calfRaiseLeftReps != null || physical.calfRaiseRightReps != null) out.push("Single-leg calf raise");
  if (physical.sebtAsymmetryCm != null) out.push("SEBT / Y-balance");
  if (physical.hipAbductionLeftKg != null || physical.hipAbductionRightKg != null) out.push("Hip abduction (dynamometer)");
  if (physical.nordicBreakAngleDeg != null || physical.nordicForceN != null) out.push("Nordic");
  if (physical.imtpPeakForceN != null && physical.cmjPeakForceN != null) out.push("IMTP and CMJ force");
  return out;
}
