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
