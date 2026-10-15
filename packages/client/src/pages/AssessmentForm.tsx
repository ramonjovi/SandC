import { Fragment, useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui";
import { HowTo } from "@/components/HowTo";
import { FIELD_TIPS } from "@/lib/fieldTips";
import { api } from "@/lib/api";
import { formatTime, parseTime } from "@/lib/utils";

type Kind = "num" | "text" | "area" | "bool" | "tri" | "select" | "time" | "date";
interface FieldDef { path: string; label: string; kind: Kind; options?: Array<[string, string]>; unit?: string; wide?: boolean; /** protocol id: shows a how-to panel above this field */ howto?: string }

const SECTIONS: Array<{ title: string; hint?: string; collapsed?: boolean; fields: FieldDef[] }> = [
  { title: "Profile", fields: [
    { path: "profile.name", label: "Name", kind: "text" },
    { path: "profile.sex", label: "Sex", kind: "select", options: [["male", "Male"], ["female", "Female"], ["other", "Other"]] },
    { path: "profile.age", label: "Age", kind: "num" },
    { path: "profile.bodyMassKg", label: "Body mass", kind: "num", unit: "kg" },
    { path: "profile.heightCm", label: "Height", kind: "num", unit: "cm" },
  ] },
  { title: "Consent and privacy", hint: "Do this before collecting any health information. Give the athlete the privacy notice and consent form (docs/consent-and-privacy.md), keep the signed copy, then record it here.", fields: [
    { path: "consent.given", label: "Privacy notice given and the athlete agreed (signed form kept)", kind: "bool", wide: true },
    { path: "consent.date", label: "Date of consent", kind: "date" },
    { path: "consent.notes", label: "Notes (for example parent/guardian signed, limits the athlete set)", kind: "area", wide: true },
  ] },
  { title: "Goals", fields: [
    { path: "goals.event", label: "Event", kind: "text" },
    { path: "goals.targetDistanceM", label: "Distance", kind: "num", unit: "m" },
    { path: "goals.targetTimeSec", label: "Goal time", kind: "time" },
    { path: "goals.raceDate", label: "Race date", kind: "date" },
    { path: "goals.narrative", label: "Goals in the athlete's words", kind: "area", wide: true },
  ] },
  { title: "Training history", hint: "Where we are: current running.", fields: [
    { path: "history.weeklyKm", label: "Weekly volume (last 6 wk)", kind: "num", unit: "km" },
    { path: "history.longestRunKm", label: "Longest run", kind: "num", unit: "km" },
    { path: "history.longestRunMin", label: "Longest run", kind: "num", unit: "min" },
    { howto: "time-trial", path: "history.recentRace.distanceM", label: "Recent race distance", kind: "num", unit: "m" },
    { path: "history.recentRace.timeSec", label: "Recent race time", kind: "time" },
    { path: "history.recentRace.daysAgo", label: "Days since race", kind: "num" },
    { path: "history.breakDays", label: "Days off running", kind: "num" },
    { path: "history.crossTrainedDuringBreak", label: "Leg cross-training during break", kind: "bool" },
    { path: "history.strengthTrainingYears", label: "Strength-training experience", kind: "num", unit: "yrs" },
  ] },
  { title: "Health screening (record only)", hint: "The engine surfaces these for clinician review. It does not classify REDs risk or clear anyone.", fields: [
    { path: "health.painModifiedTraining", label: "Pain modified training for >= 7 days or 3 sessions (AMSSM)", kind: "bool", wide: true },
    { path: "health.painSite", label: "Pain site", kind: "select", options: ["none", "tibia", "foot", "achilles", "calf", "knee", "hip", "hamstring", "lumbar", "other"].map((s) => [s, s] as [string, string]) },
    { path: "health.menstrualIrregularity", label: "Menstrual irregularity", kind: "bool" },
    { path: "health.amenorrheaOver3Months", label: "No menses > 3 months", kind: "bool" },
    { path: "health.lowMorningErectionsOrLibido", label: "Reduced morning erections / libido", kind: "bool" },
    { path: "health.unintendedWeightLossOver5Pct", label: "Unintended weight loss > 5%", kind: "bool" },
    { path: "health.bsiHistoryCount", label: "Bone stress injuries (lifetime)", kind: "num" },
    { path: "health.eatingDisorderConcern", label: "Eating-disorder concern", kind: "bool" },
    { path: "health.cardiacSymptoms", label: "Cardiac symptoms", kind: "bool" },
    { path: "health.dxaZScore", label: "DXA Z-score (if available)", kind: "num" },
    { path: "health.notes", label: "Notes", kind: "area", wide: true },
  ] },
  { title: "Running video observations (2D)", hint: "Observations only: no validated injury cutoffs exist. Treadmill at the symptomatic speed (or long-run pace), 6-10 min settling, side and rear views: see Test protocols.", fields: [
    { howto: "gait-treadmill", path: "biomechanics.footStrike", label: "Foot strike", kind: "select", options: [["", "—"], ["rearfoot", "Rearfoot"], ["midfoot", "Midfoot"], ["forefoot", "Forefoot"]] },
    { path: "biomechanics.cadenceSpm", label: "Cadence", kind: "num", unit: "spm" },
    { path: "biomechanics.overstride", label: "Overstride (malleolus ahead of pelvis)", kind: "tri" },
    { path: "biomechanics.peakKneeFlexionDeg", label: "Peak knee flexion (midstance)", kind: "num", unit: "deg" },
    { path: "biomechanics.peakHipExtensionDeg", label: "Peak hip extension", kind: "num", unit: "deg" },
    { path: "biomechanics.verticalOscillation", label: "Vertical oscillation", kind: "select", options: [["", "—"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"]] },
    { path: "biomechanics.pelvicDrop", label: "Pelvic drop", kind: "select", options: [["", "—"], ["none", "None"], ["mild", "Mild"], ["marked", "Marked"]] },
    { path: "biomechanics.kneeValgus", label: "Dynamic knee valgus / closed knee window", kind: "tri" },
    { path: "biomechanics.crossover", label: "Crossover gait", kind: "tri" },
    { path: "biomechanics.heelWhip", label: "Heel whip", kind: "tri" },
    { path: "biomechanics.notes", label: "Notes", kind: "area", wide: true },
  ] },
  { title: "Physical testing (treadmill, barbell, rack, phone)", hint: "How to run each test: see Test protocols. Keep every test identical at retest. Power tests are tracked for change, not judged against norms.", fields: [
    { howto: "squat-rm", path: "physical.squatLoadKg", label: "Squat 3-5RM load", kind: "num", unit: "kg" },
    { path: "physical.squatReps", label: "Squat test reps (5 or fewer)", kind: "num" },
    { howto: "cmj-video", path: "physical.cmjHeightCm", label: "CMJ height (avg of 3, from video)", kind: "num", unit: "cm" },
    { howto: "broad-jump", path: "physical.broadJumpM", label: "Standing broad jump (best of 3)", kind: "num", unit: "m" },
    { howto: "rsi-pogo", path: "physical.rsiFlightMs", label: "Pogo hops: average flight time", kind: "num", unit: "ms" },
    { path: "physical.rsiContactMs", label: "Pogo hops: average contact time", kind: "num", unit: "ms" },
    { howto: "calf-raise", path: "physical.calfRaiseLeftReps", label: "Single-leg calf raise, left", kind: "num", unit: "reps" },
    { path: "physical.calfRaiseRightReps", label: "Single-leg calf raise, right", kind: "num", unit: "reps" },
    { howto: "sebt", path: "physical.sebtAsymmetryCm", label: "SEBT / Y-balance largest L-R difference", kind: "num", unit: "cm" },
    { howto: "nordic-video", path: "physical.nordicBreakAngleDeg", label: "Nordic break angle (from video)", kind: "num", unit: "deg from floor" },
    { path: "physical.notes", label: "Notes", kind: "area", wide: true },
  ] },
  { title: "Optional: force plate tests", collapsed: true, hint: "Leave blank if no force plate. Needed only for the Dynamic Strength Index.", fields: [
    { howto: "force-plate-optional", path: "physical.imtpPeakForceN", label: "IMTP peak force", kind: "num", unit: "N" },
    { path: "physical.cmjPeakForceN", label: "CMJ peak force", kind: "num", unit: "N" },
    { path: "physical.nordicForceN", label: "Nordic eccentric force", kind: "num", unit: "N" },
  ] },
];

const getP = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
function setP(o: any, p: string, v: unknown) {
  const out = structuredClone(o);
  const ks = p.split(".");
  let cur = out;
  ks.slice(0, -1).forEach((k) => { if (cur[k] == null) cur[k] = {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
  return out;
}
/** recentRace must be all-or-nothing: collapse to null when the race distance or time is missing. */
function normalise(d: any) {
  const r = d.history?.recentRace;
  if (r && !(r.distanceM > 0 && r.timeSec > 0)) d.history.recentRace = null;
  else if (r && r.daysAgo == null) r.daysAgo = 0;
  return d;
}

export function AssessmentForm({ assessment, onSaved, onInterpreted }: { assessment: any; onSaved: () => void; onInterpreted: () => void }) {
  const [data, setData] = useState<any>(assessment.data);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setData(assessment.data); setMsg(null); }, [assessment.id]);

  const set = (path: string, v: unknown) => setData((d: any) => setP(d, path, v));

  async function save(thenInterpret: boolean) {
    setBusy(true); setMsg(null);
    try {
      await api(`/assessments/${assessment.id}`, { method: "PUT", body: { data: normalise(structuredClone(data)) } });
      if (thenInterpret) { await api(`/assessments/${assessment.id}/interpret`, { method: "POST" }); onInterpreted(); }
      else { setMsg({ tone: "ok", text: "Saved." }); onSaved(); }
    } catch (e) { setMsg({ tone: "danger", text: (e as Error).message }); } finally { setBusy(false); }
  }

  function control(f: FieldDef) {
    const v = getP(data, f.path);
    switch (f.kind) {
      case "num":
        return <Input type="number" inputMode="decimal" step="any" value={v ?? ""} onChange={(e) => set(f.path, e.target.value === "" ? null : Number(e.target.value))} />;
      case "text":
        return <Input value={v ?? ""} onChange={(e) => set(f.path, e.target.value)} />;
      case "area":
        return <Textarea value={v ?? ""} onChange={(e) => set(f.path, e.target.value)} />;
      case "date":
        return <Input type="date" value={v ?? ""} onChange={(e) => set(f.path, e.target.value || null)} />;
      case "time":
        return <TimeInput value={v} onChange={(n) => set(f.path, n)} />;
      case "bool":
        return <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={Boolean(v)} onChange={(e) => set(f.path, e.target.checked)} /> Yes</label>;
      case "tri":
        return <Select value={v == null ? "" : String(v)} onChange={(e) => set(f.path, e.target.value === "" ? null : e.target.value === "true")}><option value="">Not assessed</option><option value="true">Yes</option><option value="false">No</option></Select>;
      case "select":
        return <Select value={v ?? ""} onChange={(e) => set(f.path, e.target.value === "" ? null : e.target.value)}>{f.options!.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}</Select>;
    }
  }

  return (
    <div className="space-y-4">
      {assessment.kind === "reassessment" && <Alert>Reassessment: update the values that were retested, then save.</Alert>}
      {SECTIONS.map((s) => {
        const body = (
          <>
            <CardHeader><CardTitle>{s.title}</CardTitle>{s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}</CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.fields.map((f) => (
                <Fragment key={f.path}>
                  {f.howto && <HowTo id={f.howto} />}
                  <div className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
                    <Label>{f.label}{f.unit ? ` (${f.unit})` : ""}</Label>
                    {control(f)}
                    {FIELD_TIPS[f.path] && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-primary">How to assess</summary>
                        <p className="mt-1 rounded-md bg-muted/70 p-2 leading-relaxed text-muted-foreground">{FIELD_TIPS[f.path]}</p>
                      </details>
                    )}
                  </div>
                </Fragment>
              ))}
              {s.title.startsWith("Physical testing") && <Calculators data={data} />}
            </CardContent>
          </>
        );
        return s.collapsed
          ? <details key={s.title} className="rounded-xl border bg-card"><summary className="cursor-pointer p-4 text-sm font-semibold sm:p-5">{s.title}</summary>{body}</details>
          : <Card key={s.title}>{body}</Card>;
      })}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button variant="outline" disabled={busy} onClick={() => save(false)}>Save</Button>
        <Button disabled={busy} onClick={() => save(true)}>Save and run engine interpretation</Button>
      </div>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: number | null | undefined; onChange: (n: number | null) => void }) {
  const [txt, setTxt] = useState(formatTime(value));
  useEffect(() => { setTxt(formatTime(value)); }, [value]);
  return <Input placeholder="m:ss or h:mm:ss" value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => onChange(parseTime(txt))} />;
}

/** Small calculators for the phone-video tests. They only show numbers; the clinician types the result into the fields above. */
function Calculators({ data }: { data: any }) {
  const [frames, setFrames] = useState("");
  const [fps, setFps] = useState("240");
  const flight = frames && fps ? Number(frames) / Number(fps) : null;
  const height = flight != null && Number.isFinite(flight) ? Math.round(122.6 * flight * flight * 10) / 10 : null;
  const f = data.physical?.rsiFlightMs, c = data.physical?.rsiContactMs;
  const rsi = f != null && c ? Math.round((f / c) * 100) / 100 : null;
  return (
    <div className="space-y-3 rounded-lg bg-muted/50 p-3 text-sm sm:col-span-2 lg:col-span-3">
      <div className="font-medium">Calculators</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label>Jump: frames in the air</Label><Input type="number" value={frames} onChange={(e) => setFrames(e.target.value)} /></div>
        <div><Label>Video frame rate (fps)</Label><Input type="number" value={fps} onChange={(e) => setFps(e.target.value)} /></div>
        <div className="flex items-end"><span>{height != null ? <>Flight {Math.round((flight as number) * 1000)} ms, <b>height {height} cm</b></> : "Enter frames to get height"}</span></div>
      </div>
      <div>Pogo-hop RSI (flight ÷ contact): <b>{rsi ?? "enter both times above"}</b></div>
    </div>
  );
}
