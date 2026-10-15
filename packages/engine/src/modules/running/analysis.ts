import type { RunnerAssessment } from "./types";

/** One kind of still image taken from the running / test video, with what to capture and a draft "what this might mean" text. */
export interface AnalysisPhase {
  id: string;
  label: string;
  view: "side" | "rear" | "other";
  /** What frame to capture. */
  capture: string;
  /** Plain-language title for the report. */
  reportTitle: string;
  /** What the clinician reads from the frame. */
  lookFor: string;
  /** The value already entered in the form for this phase (for the report), or null. */
  finding(a: RunnerAssessment): string | null;
  /** Draft interpretation for the report. Always hedged: these are observations, not diagnoses. */
  discussion(a: RunnerAssessment): string;
}

const yn = (v: boolean | null | undefined) => (v == null ? null : v ? "Yes" : "No");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const ANALYSIS_PHASES: AnalysisPhase[] = [
  {
    id: "foot-strike", label: "Foot strike", view: "side", reportTitle: "How your foot lands",
    capture: "Side view, the first frame the foot touches the belt (initial contact).",
    lookFor: "Which part of the foot lands first: heel (rearfoot), whole foot (midfoot) or ball (forefoot).",
    finding: (a) => (a.biomechanics.footStrike ? cap(a.biomechanics.footStrike) + " strike" : null),
    discussion: (a) => {
      const fs = a.biomechanics.footStrike;
      return `${fs ? `You land on your ${fs === "rearfoot" ? "heel first" : fs === "midfoot" ? "midfoot" : "forefoot"}. ` : ""}There is limited evidence that any one landing pattern is more or less likely to cause injury, so this is recorded rather than changed. Where the foot lands in relation to your body (see overstride) tends to matter more than which part touches first.`;
    },
  },
  {
    id: "overstride", label: "Overstride", view: "side", reportTitle: "Where your foot lands in front of you",
    capture: "Side view, the frame where the shoe starts to squash just after landing (loading response), with the line from the ankle bone going straight up.",
    lookFor: "Draw a vertical line up from the outside ankle bone. If it falls in front of the pelvis, the foot is landing ahead of the body.",
    finding: (a) => (a.biomechanics.overstride == null ? null : a.biomechanics.overstride ? "Foot lands ahead of the pelvis" : "Foot lands under the pelvis"),
    discussion: (a) => {
      const o = a.biomechanics.overstride;
      if (o === true) return "The foot lands in front of the body's centre of mass. Research on running mechanics links this to a higher braking force, more load through the knee and more impact, and to more up-and-down bounce. It may relate to knee, shin or hip complaints, but it has not been proven to predict injury, and this single frame does not allow for trunk lean. " + (a.health.painModifiedTraining ? "Because you have had symptoms, a trial of about 10% more steps per minute (using a metronome) is a reasonable thing to try: in studies this reduced braking, bounce and knee loading. " : "You have no symptoms, so we would not change your running form. ") + "We will recheck at your next test.";
      if (o === false) return "The foot lands under the pelvis at this point, which is the alignment we look for. Nothing needs changing here.";
      return "Overstride was not assessed.";
    },
  },
  {
    id: "shin-angle", label: "Shin angle at landing", view: "side", reportTitle: "Angle of your shin at landing",
    capture: "Side view, loading response (shoe starting to squash), showing the knee and ankle.",
    lookFor: "Is the knee behind (angled back), directly above, or in front of the ankle?",
    finding: () => null,
    discussion: () => "A shin angled back at landing is not ideal for runners with impact-related complaints, while a vertical or forward-leaning shin lets the knee bend and spread the impact. This is read together with the other stride measures rather than on its own.",
  },
  {
    id: "knee-flexion", label: "Peak knee flexion", view: "side", reportTitle: "How much your knee bends in stance",
    capture: "Side view, mid-stance (foot flat under the body), with hip, knee and ankle marked.",
    lookFor: "The angle inside the knee between thigh and shin (a straight leg reads 180 degrees). Knee bend = 180 minus that angle, and about 45 degrees of bend is typical. Enter the bend, not the inside angle.",
    finding: (a) => (a.biomechanics.peakKneeFlexionDeg == null ? null : `${a.biomechanics.peakKneeFlexionDeg}° of knee bend`),
    discussion: (a) => {
      const k = a.biomechanics.peakKneeFlexionDeg;
      if (k == null) return "Knee bend was not measured.";
      if (k < 40) return `Your knee bends about ${k}°, a little less than the typical 45°. Less knee bend can mean the leg absorbs impact more stiffly, and under 40° has been seen in some people with knee-cap pain. It may be worth looking at calf, thigh and hip strength and at how the foot lands. This is one observation and not a diagnosis.`;
      return `Your knee bends about ${k}°, close to the typical 45°, so the leg appears to be absorbing impact in the usual way.`;
    },
  },
  {
    id: "hip-extension", label: "Hip extension", view: "side", reportTitle: "How far your leg swings behind you",
    capture: "Side view, late stance (just before the foot leaves the ground).",
    lookFor: "How far the thigh is behind vertical.",
    finding: (a) => (a.biomechanics.peakHipExtensionDeg == null ? null : `${a.biomechanics.peakHipExtensionDeg}° of hip extension`),
    discussion: (a) => `${a.biomechanics.peakHipExtensionDeg != null ? `About ${a.biomechanics.peakHipExtensionDeg}° of hip extension. ` : ""}Reduced hip extension is common in recreational runners and is often linked to tight hip flexors, but the right amount differs from person to person. Around 10° can be fine for a slower, compact runner. It matters more when combined with overstriding or a bouncy stride.`,
  },
  {
    id: "vertical-oscillation", label: "Vertical oscillation", view: "side", reportTitle: "How much your body bounces",
    capture: "Side view: one frame at the highest point of flight and one at the lowest point of stance, with a marker on the pelvis or hip.",
    lookFor: "The height difference of the pelvis marker between those two frames.",
    finding: (a) => (a.biomechanics.verticalOscillation ? `${cap(a.biomechanics.verticalOscillation)} bounce` : null),
    discussion: (a) => {
      const v = a.biomechanics.verticalOscillation;
      if (v === "high") return "More up-and-down movement means the body works harder to travel forward, and in research it goes with a higher knee load, higher impact force and more braking. It can show up in runners who \"bound\" because something else limits their stride (for example reduced hip extension). Taking about 10% more steps per minute reduces it.";
      if (v === "low") return "Little up-and-down movement, which is generally efficient. Nothing needs changing here.";
      if (v === "moderate") return "A moderate amount of bounce. We will keep this as a reference and compare it at your next test.";
      return "Bounce was not assessed.";
    },
  },
  {
    id: "pelvic-drop", label: "Pelvic drop", view: "rear", reportTitle: "How level your hips stay",
    capture: "Rear view, mid-stance, with markers on the two pelvic dimples.",
    lookFor: "Does the pelvis on the swinging side drop below the standing side? Compare left with right.",
    finding: (a) => (a.biomechanics.pelvicDrop ? `${cap(a.biomechanics.pelvicDrop)} pelvic drop` : null),
    discussion: (a) => {
      const d = a.biomechanics.pelvicDrop;
      if (d === "marked") return "The pelvis drops noticeably on one side while you balance on the other leg. This can go with the thigh turning inwards and with weaker hip or core muscles, and strengthening the outside of the hip is the usual response. Its exact importance is debated, so we treat it as a clue to follow up and recheck, not a diagnosis.";
      if (d === "mild") return "A small amount of pelvic drop, which is common. We will recheck it with your next test, and your strength program already includes hip and core work.";
      if (d === "none") return "The pelvis stays level, which is a good sign of hip and core control.";
      return "Pelvic drop was not assessed.";
    },
  },
  {
    id: "knee-window", label: "Knee window", view: "rear", reportTitle: "Do your knees stay apart",
    capture: "Rear view, mid-stance, showing both knees.",
    lookFor: "Is there always a gap between the knees through the stride? If the gap closes, the window is closed.",
    finding: (a) => (a.biomechanics.kneeValgus == null ? null : a.biomechanics.kneeValgus ? "Gap between knees closes" : "Gap between knees stays open"),
    discussion: (a) => {
      const v = a.biomechanics.kneeValgus;
      if (v === true) return "The knees come together during the stride. This pattern (the hip turning in and the knee dropping inwards) has been linked to running injuries. It is easy to spot but harder to change, and building strength in the hip muscles on one leg is the usual starting point.";
      if (v === false) return "The knees stay apart throughout, which is the pattern we look for.";
      return "Knee window was not assessed.";
    },
  },
  {
    id: "crossover", label: "Foot placement width", view: "rear", reportTitle: "Where your feet land side to side",
    capture: "Rear view, two frames showing each foot at landing.",
    lookFor: "The left and right feet should not overlap or cross the midline.",
    finding: (a) => (a.biomechanics.crossover == null ? null : a.biomechanics.crossover ? "Feet land close to or across the midline" : "Feet land with a clear gap"),
    discussion: (a) => {
      const c = a.biomechanics.crossover;
      if (c === true) return "The feet land very close together or cross over (a narrow base). A narrow base has been linked to shin stress injuries, iliotibial band complaints and the hip turning inwards. Running with the feet a little further apart (for example either side of a line on the treadmill) together with hip strength work can help.";
      if (c === false) return "The feet land with a gap between them, which is the pattern we look for.";
      return "Foot placement width was not assessed.";
    },
  },
  {
    id: "heel-eversion", label: "Heel tilt", view: "rear", reportTitle: "How your heel tilts after landing",
    capture: "Rear view with tape on the top and bottom of the heel counter, at landing and about 20 ms later.",
    lookFor: "How far, and how quickly, the heel tilts inwards.",
    finding: () => null,
    discussion: () => "How far and how fast the heel tilts in after landing has been linked to shin stress injuries, knee-cap pain and Achilles problems. Supports or orthotics have not been shown to reliably fix this, so the focus is on strength and overall running load.",
  },
  {
    id: "heel-whip", label: "Heel whip", view: "rear", reportTitle: "How your heel swings as it leaves the ground",
    capture: "Rear view at toe-off.",
    lookFor: "Does the sole of the shoe rotate inwards or outwards by more than about 5 degrees?",
    finding: (a) => yn(a.biomechanics.heelWhip),
    discussion: () => "More than about 5° of rotation is seen in over half of recreational runners, and its importance is not known, so this is noted for completeness only.",
  },
  {
    id: "pogo", label: "Pogo hops", view: "side", reportTitle: "Springiness of your ankles",
    capture: "Side view at ankle height: one frame at landing and one at take-off for a good hop.",
    lookFor: "Count the frames on the ground (contact) and in the air (flight).",
    finding: (a) => (a.physical.rsiFlightMs != null && a.physical.rsiContactMs ? `Flight ${a.physical.rsiFlightMs} ms, contact ${a.physical.rsiContactMs} ms (index ${(a.physical.rsiFlightMs / a.physical.rsiContactMs).toFixed(2)})` : null),
    discussion: () => "A short time on the ground and a long time in the air suggests stiff, springy ankles and Achilles tendons. There are no standard values for runners, so we compare you with your own results over time rather than with other people.",
  },
  {
    id: "cmj", label: "Counter-movement jump", view: "side", reportTitle: "Jump height",
    capture: "Side view, the last frame on the ground at take-off and the first frame of landing.",
    lookFor: "Count the frames in the air.",
    finding: (a) => (a.physical.cmjHeightCm != null ? `${a.physical.cmjHeightCm} cm` : null),
    discussion: () => "Jump height is a simple measure of lower-leg power. It is compared with your own baseline and is not judged against norms. It is also used to spot tiredness on training days.",
  },
  {
    id: "nordic", label: "Nordic hamstring", view: "side", reportTitle: "Hamstring strength while lengthening",
    capture: "Side view at the point where control of the lowering is lost (the break point).",
    lookFor: "The angle of the body from the floor at that moment.",
    finding: (a) => (a.physical.nordicBreakAngleDeg != null ? `${a.physical.nordicBreakAngleDeg}° from the floor` : null),
    discussion: () => "The break-point angle is a rough indicator of how well the hamstrings control lengthening. A lower angle at the break generally means stronger hamstrings. It is tracked against your own earlier results.",
  },
  {
    id: "other", label: "Other", view: "other", reportTitle: "Other observation",
    capture: "Any other frame you want in the report.",
    lookFor: "Describe what the picture shows.",
    finding: () => null,
    discussion: () => "",
  },
];

export const phaseById = (id: string) => ANALYSIS_PHASES.find((p) => p.id === id);
export const ANALYSIS_PHASE_IDS = ANALYSIS_PHASES.map((p) => p.id);
