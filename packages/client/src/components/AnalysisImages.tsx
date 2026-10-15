import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { running } from "@tpc/engine";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from "./ui";
import { Annotator } from "./Annotator";
import { api, useApi } from "@/lib/api";

const PHASES = running.ANALYSIS_PHASES;

/** Frames taken from the video, grouped by phase, each with a measurement and a discussion that can go in the PDF report. */
export function AnalysisImages({ assessment, data }: { assessment: any; data: any }) {
  const { data: images, reload } = useApi<any[]>(`/assessments/${assessment.id}/images`);
  const athleteId = assessment.athleteId;
  const consent = useApi<any>(`/athletes/${athleteId}/consent`);
  const [pick, setPick] = useState<{ phase: string; file: File } | null>(null);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string>("");

  // Optional consent item for pictures/video (only meaningful for a signed in-app form)
  const items: any[] | undefined = consent.data?.history?.[0]?.snapshot?.items;
  const agreed = items ? items.some((i) => (i.id === "images" || i.id === "video") && i.agreed) : null;

  async function upload(phase: string, dataUrl: string, measure: string) {
    setErr("");
    const p = PHASES.find((x) => x.id === phase)!;
    // An angle tool gives the angle INSIDE the knee (straight leg = 180). Knee bend = 180 - that angle.
    if (phase === "knee-flexion") {
      const m = /Angle ([\d.]+)°/.exec(measure);
      if (m) measure = `${measure} (knee bend about ${Math.round((180 - Number(m[1])) * 10) / 10}°)`;
    }
    try {
      await api(`/assessments/${assessment.id}/images`, { method: "POST", body: { phase, dataUrl, measure, caption: p.label, discussion: p.discussion(data) } });
      setPick(null); reload();
    } catch (e) { setErr((e as Error).message); setPick(null); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video frames for the report</CardTitle>
        <CardDescription>
          Take a screenshot of the frame from your phone video (or save the still), add it here under the right phase, and draw a line or measure an angle on it.
          Only signed-in clinicians can see the pictures. They appear in the athlete's PDF only if you tick "Running analysis" on the report page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {agreed === false && <Alert tone="warn">The signed consent form does not show that this athlete agreed to pictures or video. Check with them before saving frames.</Alert>}
        {err && <Alert tone="danger">{err}</Alert>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && target.current) setPick({ phase: target.current, file: f }); e.target.value = ""; }} />
        <div className="grid gap-3 lg:grid-cols-2">
          {PHASES.map((p) => {
            const mine = (images ?? []).filter((i) => i.phase === p.id);
            return (
              <div key={p.id} className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{p.label}</b><Badge variant="outline">{p.view === "other" ? "any view" : `${p.view} view`}</Badge>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => { target.current = p.id; input.current?.click(); }}><Camera className="h-3.5 w-3.5" /> Add picture</Button>
                </div>
                <p className="text-xs text-muted-foreground"><b>Capture:</b> {p.capture} <b>Look for:</b> {p.lookFor}</p>
                {p.id === "vertical-oscillation" && <OscillationCalc />}
                {mine.map((im) => <ImageRow key={im.id} im={im} phase={p} data={data} onChanged={reload} />)}
              </div>
            );
          })}
        </div>
      </CardContent>
      {pick && <Annotator file={pick.file} onCancel={() => setPick(null)} onDone={(url, measure) => upload(pick.phase, url, measure)} />}
    </Card>
  );
}

function ImageRow({ im, phase, data, onChanged }: { im: any; phase: (typeof PHASES)[number]; data: any; onChanged: () => void }) {
  const [caption, setCaption] = useState(im.caption);
  const [measure, setMeasure] = useState(im.measure);
  const [discussion, setDiscussion] = useState(im.discussion);
  const [saved, setSaved] = useState(true);
  const mark = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSaved(false); };
  async function save() { await api(`/images/${im.id}`, { method: "PUT", body: { caption, measure, discussion } }); setSaved(true); onChanged(); }
  async function remove() { if (confirm("Delete this picture?")) { await api(`/images/${im.id}`, { method: "DELETE" }); onChanged(); } }
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2">
      <img src={`/api/images/${im.id}/file`} alt={caption || phase.label} className="max-h-56 w-auto rounded border bg-white" />
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label>Caption</Label><Input value={caption} onChange={(e) => mark(setCaption)(e.target.value)} /></div>
        <div><Label>Measurement (shown in the report)</Label><Input value={measure} onChange={(e) => mark(setMeasure)(e.target.value)} placeholder="e.g. Angle 44°" /></div>
      </div>
      <div>
        <Label>What this might mean (printed in the report: edit freely)</Label>
        <Textarea className="min-h-24" value={discussion} onChange={(e) => mark(setDiscussion)(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saved} onClick={save}>{saved ? "Saved" : "Save changes"}</Button>
        <Button size="sm" variant="outline" onClick={() => mark(setDiscussion)(phase.discussion(data))}>Use suggested text from the form</Button>
        <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}

/**
 * Vertical oscillation = how much the pelvis marker rises and falls: height at the highest point of flight minus height at the lowest point of stance.
 * In cm when the picture has a scale; in pixels it is given as a share of the higher height (no scale needed, valid only with the same camera position at retest).
 */
function OscillationCalc() {
  const [unit, setUnit] = useState<"cm" | "px">("cm");
  const [hi, setHi] = useState("");
  const [lo, setLo] = useState("");
  const a = Number(hi), b = Number(lo);
  const ok = hi !== "" && lo !== "" && Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0;
  const diff = ok ? Math.round(Math.abs(a - b) * 10) / 10 : null;
  const pct = ok ? Math.round((Math.abs(a - b) / Math.max(a, b)) * 1000) / 10 : null;
  const result = diff == null ? "" : unit === "cm" ? `${diff} cm` : `about ${pct}% of hip height`;
  const text = diff == null ? "" : unit === "cm"
    ? `Vertical oscillation ${diff} cm (pelvis ${a} cm at highest flight, ${b} cm at lowest stance)`
    : `Vertical oscillation about ${pct}% of hip height (${diff} px of ${Math.max(a, b)} px; same camera position needed at retest)`;
  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-2 text-xs">
      <p>
        <b>Measuring the bounce:</b> add one picture at the <b>highest point of flight</b> and one at the <b>lowest point of stance</b>, from the same camera position.
        In the picture editor, use <b>Vertical gap</b> from a fixed horizontal reference (for example the top of the treadmill belt) up to the pelvis or hip marker.
        With a scale set, the editor reads in cm. Without one it reads in pixels: choose pixels below and the bounce is shown as a percentage of hip height.
        There is no accepted normal value, so compare with the athlete's own retest.
      </p>
      <div className="flex gap-3">
        <label className="flex items-center gap-1"><input type="radio" checked={unit === "cm"} onChange={() => setUnit("cm")} /> Heights in cm</label>
        <label className="flex items-center gap-1"><input type="radio" checked={unit === "px"} onChange={() => setUnit("px")} /> Heights in pixels (no scale)</label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label>Height at highest point of flight ({unit})</Label><Input type="number" step="0.1" value={hi} onChange={(e) => setHi(e.target.value)} /></div>
        <div><Label>Height at lowest point of stance ({unit})</Label><Input type="number" step="0.1" value={lo} onChange={(e) => setLo(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <span className="pb-2 text-sm">{diff != null ? <b>{result} bounce</b> : "Enter both heights"}</span>
          {diff != null && <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(text)}>Copy for Measurement box</Button>}
        </div>
      </div>
    </div>
  );
}
