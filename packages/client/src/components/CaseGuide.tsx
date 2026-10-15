import { Link } from "react-router-dom";
import { CheckCircle2, Circle, CircleDot, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "assess" | "interpret" | "program" | "progress" | "audit";
interface Step { id: string; title: string; done: boolean; tab?: Tab; what: string[] }

/** Step-by-step guide for the clinician, with the current step worked out from the case data. */
export function CaseGuide({ data, assessment, programRow, goTab }: { data: any; assessment: any; programRow: any | null; goTab: (t: Tab) => void }) {
  const d = assessment.data;
  const hasTests = d.physical?.squatLoadKg != null || d.history?.recentRace != null;
  const interpreted = Boolean(assessment.report);
  const ptDone = Boolean(assessment.pt);
  const programmed = Boolean(programRow);
  const approved = programRow?.status === "approved";
  const invited = Boolean(data.account);
  const logged = (data.sessionLogs ?? []).length > 0;
  const retested = (data.assessments ?? []).length > 1;
  const novice = programRow?.data?.trainingTier === "novice";

  const steps: Step[] = [
    { id: "intake", title: "Intake and screening", done: Boolean(d.profile?.name && d.history?.weeklyKm != null && hasTests), tab: "assess", what: [
      "Fill in profile, goals and training history (recent race, weekly distance, breaks).",
      "Ask the health-screening questions privately and record any pain site. The app only flags these for you; it never clears an athlete.",
      "If a flag is raised, decide with the athlete whether testing and loading should go ahead or wait for medical review.",
    ] },
    { id: "tests", title: "Test day", done: hasTests, tab: "assess", what: [
      "Run the tests in the order on the Test protocols page (video first, jumps, balance, squat 3-5RM, calf raise, Nordic last). Each field has a 'How to run' panel.",
      "Same time of day, same floor, same phone position: you will repeat this at retest.",
      "Fatiguing tests such as a time trial go on a separate day.",
    ] },
    { id: "interpret", title: "Engine interpretation", done: interpreted, tab: "assess", what: [
      "Save the assessment and press 'Save and run engine interpretation'.",
      "Read the findings, the priorities and the missing-data list. Missing tests lower the engine's confidence, they do not stop it.",
    ] },
    { id: "pt", title: "Record your own interpretation", done: ptDone, tab: "interpret", what: [
      "Choose your priorities in order and your strategy before leaning on the engine's answer, then compare.",
      "Look at every disagreement: either you know something the engine cannot see, or the engine caught something you missed.",
    ] },
    { id: "program", title: "Build the program", done: programmed, tab: "program", what: [
      "Choose how many gym sessions per week (1-3), then generate the 8-week program.",
      "Check week 1: the starting loads for secondary lifts are estimates. Edit anything you disagree with.",
    ] },
    { id: "approve", title: "Approve and publish", done: approved, tab: "program", what: [
      "Review the assumptions list and any restrictions the pain site caused.",
      "Approve to publish it to the athlete. If screening flags exist you must record the medical review decision.",
    ] },
    { id: "invite", title: "Give the athlete access", done: invited, what: [
      "Press 'Invite athlete' at the top, send them the one-time link, and they set their own password.",
      "Or skip this and enter their sessions yourself under Progress; you can do both.",
    ] },
    { id: "first", title: "Coach the first session", done: logged, tab: "progress", what: [
      "Do session A together. Use the 'Coach this exercise' notes on each lift, and work to the reps-in-reserve target, not to failure.",
      "Confirm each secondary load gives the target effort, then enter it. The app proposes the next loads; you approve them with 'Apply to next week'.",
      "Gym and hard run at least 6 hours apart, and an easy short run after heavy lifting.",
    ] },
    { id: "retest", title: novice ? "Retest at week 6" : "Retest at week 4", done: retested, tab: "progress", what: [
      "Press 'New reassessment', repeat the same tests the same way, and compare in the Progress tab.",
      "Use the Report page for a printable PDF of baseline, trends and next steps for the athlete.",
    ] },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <details className="rounded-xl border border-sky-200 bg-sky-50/50" open={current >= 0 && current <= 1}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm font-semibold text-sky-900">
        <Compass className="h-4 w-4" /> Guide: what to do next
        <span className="font-normal text-sky-800">{current >= 0 ? `Step ${current + 1} of ${steps.length}: ${steps[current].title}` : "All steps done. Repeat the retest each block."}</span>
      </summary>
      <ol className="space-y-3 px-4 pb-4 text-sm">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3">
            {s.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : i === current ? <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
            <div className={cn("space-y-1", !s.done && i !== current && "text-muted-foreground")}>
              <div className="font-medium">
                {i + 1}. {s.title}{" "}
                {s.tab && !s.done && <button className="ml-1 text-xs font-normal text-primary underline cursor-pointer" onClick={() => goTab(s.tab!)}>go there</button>}
                {s.id === "tests" && <Link to="/protocols" className="ml-2 text-xs font-normal text-primary underline">test protocols</Link>}
              </div>
              {(i === current || s.done === false) && <ul className="ml-4 list-disc text-muted-foreground">{s.what.map((w) => <li key={w}>{w}</li>)}</ul>}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
