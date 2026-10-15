import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

type Pt = { x: number; y: number };
type Shape =
  | { t: "line"; a: Pt; b: Pt }
  | { t: "arrow"; a: Pt; b: Pt }
  | { t: "angle"; a: Pt; v: Pt; c: Pt }
  | { t: "circle"; c: Pt; r: number }
  | { t: "pen"; pts: Pt[] }
  | { t: "text"; p: Pt; text: string }
  | { t: "plumb"; x: number };
type Op = Shape & { color: string };
type Tool = "none" | "line" | "arrow" | "angle" | "circle" | "pen" | "text" | "plumb";

const MAX_SIDE = 1400;
const COLORS = [["#eb6834", "Orange"], ["#e11d48", "Red"], ["#2a78d6", "Blue"], ["#16a34a", "Green"], ["#ffffff", "White"], ["#111111", "Black"]] as const;
const TOOLS: Array<{ id: Tool; label: string; need: number; hint: string }> = [
  { id: "line", label: "Line", need: 2, hint: "Click 2 points" },
  { id: "arrow", label: "Arrow", need: 2, hint: "Click the tail, then the point" },
  { id: "angle", label: "Angle", need: 3, hint: "Click the first arm end, the joint, then the second arm end" },
  { id: "circle", label: "Circle", need: 2, hint: "Click the centre, then the edge" },
  { id: "pen", label: "Pen", need: 0, hint: "Press and drag to draw freehand" },
  { id: "text", label: "Text", need: 1, hint: "Click where the label goes" },
  { id: "plumb", label: "Vertical line", need: 1, hint: "Click once: a vertical reference line through that point" },
];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
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

function draw(c: HTMLCanvasElement, img: HTMLImageElement, ops: Op[], pending: Pt[], live: Pt[] | null, color: string) {
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, c.width, c.height);
  const lw = Math.max(2, c.width / 400);
  const fontPx = Math.round(c.width / 38);
  g.lineCap = "round"; g.lineJoin = "round"; g.font = `bold ${fontPx}px sans-serif`;
  const dot = (p: Pt, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, lw * 1.8, 0, Math.PI * 2); g.fill(); };
  const label = (text: string, p: Pt, col: string) => {
    g.lineWidth = lw * 3; g.strokeStyle = col === "#ffffff" ? "#111111" : "#ffffff"; g.strokeText(text, p.x, p.y);
    g.fillStyle = col; g.fillText(text, p.x, p.y);
  };
  for (const o of ops) {
    g.lineWidth = lw; g.strokeStyle = o.color; g.fillStyle = o.color;
    if (o.t === "line") { g.beginPath(); g.moveTo(o.a.x, o.a.y); g.lineTo(o.b.x, o.b.y); g.stroke(); dot(o.a, o.color); dot(o.b, o.color); }
    else if (o.t === "arrow") {
      g.beginPath(); g.moveTo(o.a.x, o.a.y); g.lineTo(o.b.x, o.b.y); g.stroke();
      const ang = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x), h = lw * 6;
      g.beginPath(); g.moveTo(o.b.x, o.b.y);
      g.lineTo(o.b.x - h * Math.cos(ang - 0.45), o.b.y - h * Math.sin(ang - 0.45)); g.lineTo(o.b.x - h * Math.cos(ang + 0.45), o.b.y - h * Math.sin(ang + 0.45)); g.closePath(); g.fill();
    } else if (o.t === "angle") {
      g.beginPath(); g.moveTo(o.a.x, o.a.y); g.lineTo(o.v.x, o.v.y); g.lineTo(o.c.x, o.c.y); g.stroke();
      dot(o.a, o.color); dot(o.v, o.color); dot(o.c, o.color);
      label(`${angleDeg(o.a, o.v, o.c)}°`, { x: o.v.x + 12, y: o.v.y - 12 }, o.color);
    } else if (o.t === "circle") { g.beginPath(); g.arc(o.c.x, o.c.y, o.r, 0, Math.PI * 2); g.stroke(); }
    else if (o.t === "pen") { if (o.pts.length > 1) { g.beginPath(); g.moveTo(o.pts[0].x, o.pts[0].y); o.pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.stroke(); } }
    else if (o.t === "text") label(o.text, o.p, o.color);
    else if (o.t === "plumb") { g.setLineDash([lw * 4, lw * 3]); g.beginPath(); g.moveTo(o.x, 0); g.lineTo(o.x, c.height); g.stroke(); g.setLineDash([]); }
  }
  if (live && live.length > 1) { g.lineWidth = lw; g.strokeStyle = color; g.beginPath(); g.moveTo(live[0].x, live[0].y); live.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.stroke(); }
  pending.forEach((p) => dot(p, color));
}

/** Pick a frame, mark it up (lines, arrows, angles, circles, freehand, labels, a vertical reference line), then save. Nothing leaves the browser until you press Save. */
export function Annotator({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (dataUrl: string, measure: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const penRef = useRef<Pt[] | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState<string>(COLORS[0][0]);
  const [ops, setOps] = useState<Op[]>([]);
  const [pending, setPending] = useState<Pt[]>([]);
  const [live, setLive] = useState<Pt[] | null>(null);

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

  useEffect(() => { if (ready) draw(canvas.current!, img.current!, ops, pending, live, color); }, [ready, ops, pending, live, color]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Pt | null => {
    const c = canvas.current!, r = c.getBoundingClientRect();
    if (!r.width || !r.height) return null; // picture not laid out yet
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const add = (s: Shape) => { setOps((o) => [...o, { ...s, color } as Op]); setPending([]); };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "none") return;
    const p = point(e);
    if (!p) return;
    if (tool === "pen") { penRef.current = [p]; setLive([p]); e.currentTarget.setPointerCapture?.(e.pointerId); return; }
    if (tool === "plumb") return add({ t: "plumb", x: p.x });
    if (tool === "text") {
      const text = window.prompt("Label text (for example: 6 cm ahead, hip, heel strike)");
      if (text && text.trim()) add({ t: "text", p, text: text.trim().slice(0, 40) });
      return;
    }
    const next = [...pending, p];
    if (tool === "line" && next.length === 2) add({ t: "line", a: next[0], b: next[1] });
    else if (tool === "arrow" && next.length === 2) add({ t: "arrow", a: next[0], b: next[1] });
    else if (tool === "circle" && next.length === 2) add({ t: "circle", c: next[0], r: dist(next[0], next[1]) });
    else if (tool === "angle" && next.length === 3) add({ t: "angle", a: next[0], v: next[1], c: next[2] });
    else setPending(next);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!penRef.current) return;
    const p = point(e);
    if (p) { penRef.current = [...penRef.current, p]; setLive(penRef.current); }
  }
  function up() {
    if (penRef.current && penRef.current.length > 1) add({ t: "pen", pts: penRef.current });
    penRef.current = null; setLive(null);
  }

  const angles = ops.filter((o): o is Extract<Op, { t: "angle" }> => o.t === "angle").map((o) => `${angleDeg(o.a, o.v, o.c)}°`);
  const spec = TOOLS.find((t) => t.id === tool);
  const hint = spec ? `${spec.hint}${spec.need > 1 ? ` (${pending.length}/${spec.need})` : ""}` : "Choose a tool, or save the picture as it is.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-xl bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {TOOLS.map((t) => (
            <Button key={t.id} size="sm" variant={tool === t.id ? "default" : "outline"} onClick={() => { setTool(t.id); setPending([]); }}>{t.label}</Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1" role="group" aria-label="Colour">
            {COLORS.map(([c, name]) => (
              <button key={c} type="button" title={name} aria-label={name} onClick={() => setColor(c)}
                className={cn("h-6 w-6 rounded-full border-2 cursor-pointer", color === c ? "border-primary ring-2 ring-primary/40" : "border-gray-300")} style={{ background: c }} />
            ))}
          </span>
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
          <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            className="mx-auto block max-h-[70vh] w-auto max-w-full touch-none" style={{ cursor: tool === "none" ? "default" : "crosshair" }} />
        </div>
        {angles.length > 0 && <div className="text-sm"><b>Measured:</b> {angles.join(", ")} (saved with the picture; this is the angle between the lines you drew)</div>}
      </div>
    </div>
  );
}
