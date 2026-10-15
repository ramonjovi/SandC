import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

type Pt = { x: number; y: number };
type Op = { t: "line"; a: Pt; b: Pt } | { t: "angle"; a: Pt; v: Pt; c: Pt };
const MAX_SIDE = 1400;

const angleDeg = (a: Pt, v: Pt, c: Pt) => {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x), a2 = Math.atan2(c.y - v.y, c.x - v.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return Math.round(d * 10) / 10;
};

/** Shrinks a picture to a JPEG small enough to store (tries lower quality, then smaller size). */
export function exportJpeg(src: HTMLCanvasElement, limitBytes = 1_800_000): string {
  let canvas = src;
  for (const [q, scale] of [[0.85, 1], [0.7, 1], [0.6, 0.8], [0.5, 0.65]] as const) {
    if (scale !== 1) {
      canvas = document.createElement("canvas");
      canvas.width = Math.round(src.width * scale); canvas.height = Math.round(src.height * scale);
      canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
    }
    const url = canvas.toDataURL("image/jpeg", q);
    if ((url.length * 3) / 4 <= limitBytes) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}

/** Pick a frame, optionally draw lines and measure angles on it, then save. Everything stays in the browser until you press Save. */
export function Annotator({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (dataUrl: string, measure: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<"none" | "line" | "angle">("none");
  const [ops, setOps] = useState<Op[]>([]);
  const [pending, setPending] = useState<Pt[]>([]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
      const c = canvas.current!;
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      img.current = im; setReady(true);
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!ready) return;
    const c = canvas.current!, g = c.getContext("2d")!;
    g.drawImage(img.current!, 0, 0, c.width, c.height);
    const lw = Math.max(2, c.width / 400);
    g.lineWidth = lw; g.strokeStyle = "#eb6834"; g.fillStyle = "#eb6834"; g.font = `bold ${Math.round(c.width / 38)}px sans-serif`;
    const dot = (p: Pt) => { g.beginPath(); g.arc(p.x, p.y, lw * 1.8, 0, Math.PI * 2); g.fill(); };
    for (const o of ops) {
      if (o.t === "line") { g.beginPath(); g.moveTo(o.a.x, o.a.y); g.lineTo(o.b.x, o.b.y); g.stroke(); dot(o.a); dot(o.b); }
      else {
        g.beginPath(); g.moveTo(o.a.x, o.a.y); g.lineTo(o.v.x, o.v.y); g.lineTo(o.c.x, o.c.y); g.stroke(); dot(o.a); dot(o.v); dot(o.c);
        const label = `${angleDeg(o.a, o.v, o.c)}°`;
        g.lineWidth = lw * 3; g.strokeStyle = "#ffffff"; g.strokeText(label, o.v.x + 12, o.v.y - 12);
        g.lineWidth = lw; g.strokeStyle = "#eb6834"; g.fillText(label, o.v.x + 12, o.v.y - 12);
      }
    }
    pending.forEach(dot);
  }, [ready, ops, pending]);

  function click(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "none") return;
    const c = canvas.current!, r = c.getBoundingClientRect();
    if (!r.width || !r.height) return; // picture not laid out yet
    const p = { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
    const next = [...pending, p];
    if (tool === "line" && next.length === 2) { setOps([...ops, { t: "line", a: next[0], b: next[1] }]); setPending([]); }
    else if (tool === "angle" && next.length === 3) { setOps([...ops, { t: "angle", a: next[0], v: next[1], c: next[2] }]); setPending([]); }
    else setPending(next);
  }

  const angles = ops.filter((o): o is Extract<Op, { t: "angle" }> => o.t === "angle").map((o) => `${angleDeg(o.a, o.v, o.c)}°`);
  const hint = tool === "line" ? `Click 2 points for a line (${pending.length}/2)` : tool === "angle" ? `Click 3 points: first arm, the joint, second arm (${pending.length}/3)` : "Choose a tool, or save the picture as it is.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-xl bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={tool === "line" ? "default" : "outline"} onClick={() => { setTool("line"); setPending([]); }}>Line</Button>
          <Button size="sm" variant={tool === "angle" ? "default" : "outline"} onClick={() => { setTool("angle"); setPending([]); }}>Angle</Button>
          <Button size="sm" variant="ghost" disabled={!ops.length && !pending.length} onClick={() => { if (pending.length) setPending([]); else setOps(ops.slice(0, -1)); }}>Undo</Button>
          <Button size="sm" variant="ghost" disabled={!ops.length} onClick={() => { setOps([]); setPending([]); }}>Clear</Button>
          <span className="text-xs text-muted-foreground">{hint}</span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button size="sm" disabled={!ready} onClick={() => onDone(exportJpeg(canvas.current!), angles.length ? `Angle ${angles.join(", ")}` : "")}>Save picture</Button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30">
          {!ready && <div className="p-6 text-sm text-muted-foreground">Loading picture...</div>}
          <canvas ref={canvas} onPointerDown={click} className="mx-auto block max-h-[70vh] w-auto max-w-full touch-none" style={{ cursor: tool === "none" ? "default" : "crosshair" }} />
        </div>
        {angles.length > 0 && <div className="text-sm"><b>Measured:</b> {angles.join(", ")} (saved with the picture)</div>}
      </div>
    </div>
  );
}
