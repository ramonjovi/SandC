import { Dumbbell } from "lucide-react";
import type { ExerciseGuide } from "@tpc/engine";

/** Coaching notes for one exercise. `audience` switches the heading wording; the content is the same. */
export function ExerciseHowTo({ guide, audience }: { guide?: ExerciseGuide; audience: "clinician" | "athlete" }) {
  if (!guide) return null;
  const clin = audience === "clinician";
  return (
    <details className="rounded-lg border border-violet-200 bg-violet-50/50 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-1.5 font-medium text-violet-900">
        <Dumbbell className="h-3.5 w-3.5" /> {clin ? "Coach this exercise" : "How to do it"}
      </summary>
      <div className="space-y-2 px-3 pb-3 pt-1">
        <div><b>Set up</b><ul className="ml-5 list-disc">{guide.setup.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><b>Do it</b><ol className="ml-5 list-decimal space-y-0.5">{guide.steps.map((x) => <li key={x}>{x}</li>)}</ol></div>
        <div><b>{clin ? "Cues to say" : "Think"}:</b> {guide.cues.join(" · ")}</div>
        <div><b>{clin ? "Watch for" : "Avoid"}:</b> {guide.errors.join("; ")}</div>
        <div className="grid gap-1 sm:grid-cols-2"><div><b>Easier:</b> {guide.easier}</div><div><b>Harder:</b> {guide.harder}</div></div>
        <div className="text-amber-900"><b>Stop if:</b> {guide.stopIf}</div>
        {clin && <div className="text-xs text-muted-foreground">Standard-technique teaching notes for TPC (not quoted from a supplied source). Adjust to how you coach it.</div>}
      </div>
    </details>
  );
}
