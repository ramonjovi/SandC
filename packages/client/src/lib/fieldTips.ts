/**
 * Short "how to assess" notes shown in a small drop-down under each assessment field, keyed by field path.
 * Video notes follow Souza 2016 (see docs/test-protocols.md); tests marked "proposed" in the protocols are the clinic's own standard.
 */
export const FIELD_TIPS: Record<string, string> = {
  // ---- history
  "history.weeklyKm": "Average running distance per week over the last 6 weeks.",
  "history.longestRunKm": "Longest single run in the last 6 weeks, as a distance. (Recorded for now; not used in calculations.)",
  "history.longestRunMin": "The same longest run, as a time in minutes. Enter whichever the athlete knows, or both.",
  "history.recentRace.distanceM": "Distance in metres of an all-out race or time trial from the last 4 months: 5 km = 5000, 10 km = 10000, half marathon = 21097, marathon = 42195. Use a timed result, not an estimate.",
  "history.recentRace.timeSec": "The finishing time as m:ss or h:mm:ss, for example 38:30. Use the official time.",
  "history.recentRace.daysAgo": "Number of days between that race or trial and today.",
  "history.breakDays": "Only for a real break from running (injury, illness, time off) after that race, when they are not yet back to normal training. Normal rest days = 0. Up to 5 days changes nothing.",
  "history.crossTrainedDuringBreak": "Tick only if they did leg-based cross-training during the break (bike, pool running, elliptical). It only matters when days off is more than 5.",
  "history.strengthTrainingYears": "Years of regular strength training (about 1-2 sessions a week). Under 1 = novice, 1 to 3 = intermediate, over 3 = experienced. Leave blank if unknown: the program then treats them as a novice.",

  // ---- health
  "health.painModifiedTraining": "Tick Yes if running-related pain made them change training (shorter, easier or skipped runs) for 7 days or more, or for 3 sessions in a row. This is the AMSSM injury definition.",
  "health.painSite": "Choose where the pain is. The program removes or swaps exercises that load that area.",
  "health.bsiHistoryCount": "How many bone stress injuries or stress fractures from running they have had, ever. This is only recorded: a doctor judges the risk.",

  // ---- video (treadmill, side and rear views)
  "biomechanics.footStrike": "Side view, slow motion. Find the first frame the foot touches the belt: heel first = rearfoot, whole foot = midfoot, ball first = forefoot. Confirm frame by frame. No pattern is proven to cause injury.",
  "biomechanics.cadenceSpm": "Count one foot (say the right) landing for 60 seconds, then double it. No target is applied; about 180 is only a rough idea.",
  "biomechanics.overstride": "Side view. Freeze the frame where the shoe starts to squash just after landing (loading response). Draw a vertical line up from the outside ankle bone (tape on it helps). If the line is in front of the pelvis, tick Yes.",
  "biomechanics.peakKneeFlexionDeg": "Side view, at mid-stance (foot flat under the body). Measure the angle inside the knee between thigh and shin (tape on hip, knee and ankle helps). A straight leg reads 180, so enter the bend = 180 minus what you measured (133 measured = 47 bend). About 45 degrees of bend is typical; under 40 has been linked to some knee-pain groups.",
  "biomechanics.peakHipExtensionDeg": "Side view, late stance: how far the thigh is behind vertical. Use the Angle from vertical tool in the picture editor on a late-stance frame (foot behind the body, thigh trailing behind the hip) and enter that angle. If the knee is in front of the hip, the thigh is flexed, not extended. Around 10 degrees can be fine for a slow, compact runner, so read it together with their stride.",
  "biomechanics.verticalOscillation": "Side view: how much the hips bounce up and down. Mark low, moderate or high compared with other runners and with this athlete's retest. There is no number.",
  "biomechanics.pelvicDrop": "Rear view, at mid-stance: compare the pelvis on the stance side with the swing side (tape on the two dimples at the back of the pelvis helps). Look at left versus right. Its meaning is debated: treat it as a clue about hip and core strength.",
  "biomechanics.kneeValgus": "Rear view: is there always a gap between the knees through the whole stride (the knee window)? If the gap closes, tick Yes.",
  "biomechanics.crossover": "Rear view: the left and right feet should not overlap or cross the midline when they land. A very narrow base (scissoring) = Yes.",
  "biomechanics.heelWhip": "Rear view, at toe-off: does the sole of the shoe rotate in or out by more than about 5 degrees? This is common in recreational runners and of low importance.",
  "biomechanics.notes": "Write down the camera frame rate, treadmill speed and where any tape was placed, so you can repeat it exactly at retest.",

  // ---- physical tests
  "physical.squatLoadKg": "The load of your 3-5RM: the heaviest weight they lift for 3 to 5 clean reps at your agreed depth. Find it within 3 to 5 sets, resting 2 to 4 minutes between sets.",
  "physical.squatReps": "Reps completed in that set (3 to 5). Avoid more than 5: estimates from higher reps overestimate.",
  "physical.cmjHeightCm": "Average of 3 jumps with hands on hips, from side-on phone video. Count the frames in the air: height (cm) = 122.6 x flight time (s) squared. The calculator below does it for you.",
  "physical.broadJumpM": "Best of 3. Toes behind a line, jump from and land on two feet, and measure from the line to the nearest heel.",
  "physical.rsiFlightMs": "Film 10 pogo hops from the side at ankle height. Pick 3 good hops (skip the first 2) and count the frames in the air, convert to milliseconds (frames / fps x 1000), then average.",
  "physical.rsiContactMs": "From the same video: count the frames the foot is on the ground for those 3 hops, convert to milliseconds and average. The app works out the reactive strength index.",
  "physical.calfRaiseLeftReps": "Single leg, straight knee, fingertips on a wall, 1 second up and 1 second down, until the range drops, the tempo is lost or the knee bends. Count full-range reps. Rest 2 to 3 minutes, then test the other leg.",
  "physical.calfRaiseRightReps": "Same test and the same tempo as the left leg. A difference of more than 10% is flagged.",
  "physical.sebtAsymmetryCm": "Reach with the free foot along three taped lines (forward, back-inside, back-outside), best of 3 per direction, on each leg. Enter the largest left-right difference in cm.",
  "physical.nordicBreakAngleDeg": "Film a slow Nordic lowering from the side. Measure the angle of the body from the floor at the moment control is lost. Use the best of 3 attempts.",
};
