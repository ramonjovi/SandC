import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

type Pt = { x: number; y: number };
type Shape =
  | { t: "line"; a: Pt; b: Pt }
  | { t: "arrow"; a: Pt; b: Pt }
  | { t: "angle"; a: Pt; v: Pt; c: Pt }
  | { t: "vang"; a: Pt; b: Pt }
  | { t: "scale"; a: Pt; b: Pt; cm: number }
  | { t: "dist"; a: Pt; b: Pt }
  | { t: "hgap"; a: Pt; b: Pt }
  | { t: "vgap"; a: Pt; b: Pt }
  | { t: "circle"; c: Pt; r: number }
  | { t: "pen"; pts: Pt[] }
  | { t: "text"; p: Pt; text: string }
  | { t: "plumb"; x: number }
  | { t: "hline"; y: number };
type Op = Shape & { color: string };
type Tool = "none" | "level" | "scale" | "plumb" | "hline" | "vang" | "angle" | "dist" | "hgap" | "vgap" | "line" | "arrow" | "circle" | "pen" | "text";

const MAX_SIDE = 1400;
const COLORS = [["#eb6834", "Orange"], ["#e11d48", "Red"], ["#2a78d6", "Blue"], ["#16a34a", "Green"], ["#ffffff", "White"], ["#111111", "Black"]] as const;
const TOOLS: Array<{ id: Tool; label: string; need: number; hint: string; group: "set" | "measure" | "mark" }> = [
  { id: "level", label: "Level picture", need: 2, group: "set", hint: "Do this first. Click the top, then the bottom of something truly vertical in the picture (door frame, window edge, plumb line). The picture rotates to make it vertical" },
  { id: "scale", label: "Set scale", need: 2, group: "set", hint: "Click both ends of something of known length that is at the same distance from the camera as the runner (a ruler or taped marks on the treadmill side), then type its length in cm" },
  { id: "plumb", label: "Vertical line", need: 1, group: "measure", hint: "Click once: a vertical reference line through that point" },
  { id: "hline", label: "Horizontal line", need: 1, group: "measure", hint: "Click once: a true horizontal reference line through that point (needs the picture levelled)" },
  { id: "vang", label: "Angle from vertical", need: 2, group: "measure", hint: "Click the top point (for example the hip), then the other end (for example the knee)" },
  { id: "angle", label: "Angle", need: 3, group: "measure", hint: "Click the first arm end, the joint, then the second arm end" },
  { id: "dist", label: "Length", need: 2, group: "measure", hint: "Click 2 points: the straight-line distance" },
  { id: "hgap", label: "Horizontal gap", need: 2, group: "measure", hint: "Click 2 points: only the sideways distance (for example ankle ahead of the hip)" },
  { id: "vgap", label: "Vertical gap", need: 2, group: "measure", hint: "Click 2 points: only the up-and-down distance (for example pelvis height in two frames)" },
  { id: "line", label: "Line", need: 2, group: "mark", hint: "Click 2 points" },
  { id: "arrow", label: "Arrow", need: 2, group: "mark", hint: "Click the tail, then the point" },
  { id: "circle", label: "Circle", need: 2, group: "mark", hint: "Click the centre, then the edge" },
  { id: "pen", label: "Pen", need: 0, group: "mark", hint: "Press and drag to draw freehand" },
  { id: "text", label: "Text", need: 1, group: "mark", hint: "Click where the label goes" },
];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const r1 = (n: number) => Math.round(n * 10) / 10;
const angleDeg = (a: Pt, v: Pt, c: Pt) => {
  const a1 = Math.atan2(a.y - v.y, a.x - v.x), a2 = Math.atan2(c.y - v.y, c.x - v.x);
  let d = Math.abs(a1 - a2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return r1(d);
};
/** Angle between the line a-b and true vertical, in degrees (0 = straight up and down). */
export const fromVertical = (a: Pt, b: Pt) => r1(Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * (180 / Math.PI));

/** Pixels per centimetre from the most recent scale reference, or null if none has been set. */
export function pxPerCm(ops: Array<{ t: string; a?: Pt; b?: Pt; cm?: number }>): number | null {
  for (let i = ops.length - 1; i >= 0; i--) {
    const o = ops[i];
    if (o.t === "scale" && o.a && o.b && o.cm) return dist(o.a, o.b) / o.cm;
  }
  return null;
}
export const formatLength = (px: number, scale: number | null) => (scale ? `${r1(px / scale)} cm` : `${Math.round(px)} px (no scale)`);

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

function draw(c: HTMLCanvasElement, img: HTMLImageElement, rot: number, ops: Op[], pending: Pt[], live: Pt[] | null, color: string) {
  const g = c.getContext("2d")!;
  const scale = pxPerCm(ops);
  g.fillStyle = "#222"; g.fillRect(0, 0, c.width, c.height);
  g.save(); g.translate(c.width / 2, c.height / 2); g.rotate(rot); g.drawImage(img, -c.width / 2, -c.height / 2, c.width, c.height); g.restore();
  const lw = Math.max(2, c.width / 400);
  const fontPx = Math.round(c.width / 38);
  g.lineCap = "round"; g.lineJoin = "round"; g.font = `bold ${fontPx}px sans-serif`;
  const dot = (p: Pt, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, lw * 1.8, 0, Math.PI * 2); g.fill(); };
  const label = (text: string, p: Pt, col: string) => {
    g.lineWidth = lw * 3; g.strokeStyle = col === "#ffffff" ? "#111111" : "#ffffff"; g.strokeText(text, p.x, p.y);
    g.fillStyle = col; g.fillText(text, p.x, p.y);
  };
  const seg = (a: Pt, b: Pt, col: string, dashed = false) => {
    g.strokeStyle = col; g.lineWidth = lw; if (dashed) g.setLineDash([lw * 4, lw * 3]);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
  };
  for (const o of ops) {
    g.lineWidth = lw; g.strokeStyle = o.color; g.fillStyle = o.color;
    if (o.t === "line") { seg(o.a, o.b, o.color); dot(o.a, o.color); dot(o.b, o.color); }
    else if (o.t === "arrow") {
      seg(o.a, o.b, o.color);
      const ang = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x), h = lw * 6;
      g.beginPath(); g.moveTo(o.b.x, o.b.y);
      g.lineTo(o.b.x - h * Math.cos(ang - 0.45), o.b.y - h * Math.sin(ang - 0.45)); g.lineTo(o.b.x - h * Math.cos(ang + 0.45), o.b.y - h * Math.sin(ang + 0.45)); g.closePath(); g.fill();
    } else if (o.t === "angle") {
      g.beginPath(); g.moveTo(o.a.x, o.a.y); g.lineTo(o.v.x, o.v.y); g.lineTo(o.c.x, o.c.y); g.stroke();
      dot(o.a, o.color); dot(o.v, o.color); dot(o.c, o.color);
      label(`${angleDeg(o.a, o.v, o.c)}°`, { x: o.v.x + 12, y: o.v.y - 12 }, o.color);
    } else if (o.t === "vang") {
      const reach = Math.max(dist(o.a, o.b), 60);
      seg({ x: o.a.x, y: o.a.y - reach * 0.4 }, { x: o.a.x, y: o.a.y + reach * 1.1 }, o.color, true);
      seg(o.a, o.b, o.color); dot(o.a, o.color); dot(o.b, o.color);
      label(`${fromVertical(o.a, o.b)}° from vertical`, { x: Math.max(o.a.x, o.b.x) + 12, y: (o.a.y + o.b.y) / 2 }, o.color);
    } else if (o.t === "scale") {
      seg(o.a, o.b, o.color); dot(o.a, o.color); dot(o.b, o.color);
      label(`scale ${o.cm} cm`, { x: Math.max(o.a.x, o.b.x) + 12, y: (o.a.y + o.b.y) / 2 }, o.color);
    } else if (o.t === "dist") {
      seg(o.a, o.b, o.color); dot(o.a, o.color); dot(o.b, o.color);
      label(formatLength(dist(o.a, o.b), scale), { x: (o.a.x + o.b.x) / 2 + 10, y: (o.a.y + o.b.y) / 2 - 10 }, o.color);
    } else if (o.t === "hgap") {
      const corner = { x: o.b.x, y: o.a.y };
      seg(o.a, o.b, o.color, true); seg(o.a, corner, o.color); seg(corner, o.b, o.color, true); dot(o.a, o.color); dot(o.b, o.color);
      label(`${formatLength(Math.abs(o.b.x - o.a.x), scale)} across`, { x: Math.min(o.a.x, o.b.x), y: o.a.y - 10 }, o.color);
    } else if (o.t === "vgap") {
      const corner = { x: o.a.x, y: o.b.y };
      seg(o.a, o.b, o.color, true); seg(o.a, corner, o.color); seg(corner, o.b, o.color, true); dot(o.a, o.color); dot(o.b, o.color);
      label(`${formatLength(Math.abs(o.b.y - o.a.y), scale)} high`, { x: o.a.x + 12, y: (o.a.y + o.b.y) / 2 }, o.color);
    } else if (o.t === "circle") { g.beginPath(); g.arc(o.c.x, o.c.y, o.r, 0, Math.PI * 2); g.stroke(); }
    else if (o.t === "pen") { if (o.pts.length > 1) { g.beginPath(); g.moveTo(o.pts[0].x, o.pts[0].y); o.pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.stroke(); } }
    else if (o.t === "text") label(o.text, o.p, o.color);
    else if (o.t === "plumb") seg({ x: o.x, y: 0 }, { x: o.x, y: c.height }, o.color, true);
    else if (o.t === "hline") seg({ x: 0, y: o.y }, { x: c.width, y: o.y }, o.color, true);
  }
  if (live && live.length > 1) { g.lineWidth = lw; g.strokeStyle = color; g.beginPath(); g.moveTo(live[0].x, live[0].y); live.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.stroke(); }
  pending.forEach((p) => dot(p, color));
}

/** Pick a frame, level it, set a scale, then measure (angles, angle from vertical, lengths, horizontal and vertical gaps) and mark it up. Nothing leaves the browser until you press Save. */
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
  const [rot, setRot] = useState(0);
  const [note, setNote] = useState("");

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

  useEffect(() => { if (ready) draw(canvas.current!, img.current!, rot, ops, pending, live, color); }, [ready, rot, ops, pending, live, color]);

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
    if (tool === "hline") return add({ t: "hline", y: p.y });
    if (tool === "text") {
      const text = window.prompt("Label text (for example: 6 cm ahead, hip, heel strike)");
      if (text && text.trim()) add({ t: "text", p, text: text.trim().slice(0, 40) });
      return;
    }
    const next = [...pending, p];
    if (tool === "level" && next.length === 2) {
      if (ops.length) { setNote("Level the picture before drawing: press Clear first, then level."); setPending([]); return; }
      let [a, b] = next;
      if (b.y < a.y) [a, b] = [b, a];
      if (Math.abs(b.y - a.y) < 20) { setNote("Pick two points further apart, one above the other."); setPending([]); return; }
      const phi = Math.atan2(b.x - a.x, b.y - a.y);
      setRot((r) => r + phi); setPending([]); setNote(`Picture levelled by ${r1(Math.abs(phi) * (180 / Math.PI))}°.`);
      return;
    }
    if (tool === "scale" && next.length === 2) {
      const len = dist(next[0], next[1]);
      if (len < 20) { setNote("Pick two points further apart."); setPending([]); return; }
      const cm = Number(String(window.prompt("Real length between the two points, in centimetres (for example 100 for a 1 m ruler)") ?? "").replace(",", "."));
      if (!Number.isFinite(cm) || cm <= 0) { setNote("No scale set: type a length in centimetres."); setPending([]); return; }
      add({ t: "scale", a: next[0], b: next[1], cm }); setNote(`Scale set: ${cm} cm = ${Math.round(len)} px. Measurements now show centimetres.`);
      return;
    }
    if (tool === "line" && next.length === 2) add({ t: "line", a: next[0], b: next[1] });
    else if (tool === "arrow" && next.length === 2) add({ t: "arrow", a: next[0], b: next[1] });
    else if (tool === "vang" && next.length === 2) add({ t: "vang", a: next[0], b: next[1] });
    else if (tool === "dist" && next.length === 2) add({ t: "dist", a: next[0], b: next[1] });
    else if (tool === "hgap" && next.length === 2) add({ t: "hgap", a: next[0], b: next[1] });
    else if (tool === "vgap" && next.length === 2) add({ t: "vgap", a: next[0], b: next[1] });
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

  const scale = pxPerCm(ops);
  const parts: string[] = [];
  const angles = ops.filter((o): o is Extract<Op, { t: "angle" }> => o.t === "angle").map((o) => `${angleDeg(o.a, o.v, o.c)}°`);
  if (angles.length) parts.push(`Angle ${angles.join(", ")}`);
  for (const o of ops) {
    if (o.t === "vang") parts.push(`${fromVertical(o.a, o.b)}° from vertical`);
    else if (o.t === "dist") parts.push(`Length ${formatLength(dist(o.a, o.b), scale)}`);
    else if (o.t === "hgap") parts.push(`Horizontal gap ${formatLength(Math.abs(o.b.x - o.a.x), scale)}`);
    else if (o.t === "vgap") parts.push(`Vertical gap ${formatLength(Math.abs(o.b.y - o.a.y), scale)}`);
  }
  const measure = parts.join("; ");
  const spec = TOOLS.find((t) => t.id === tool);
  const hint = spec ? `${spec.hint}${spec.need > 1 ? ` (${pending.length}/${spec.need})` : ""}` : "Choose a tool, or save the picture as it is.";
  const groups: Array<[string, "set" | "measure" | "mark"]> = [["Set up", "set"], ["Measure", "measure"], ["Mark", "mark"]];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-hidden rounded-xl bg-white p-3 sm:p-4">
        <div className="space-y-1.5">
          {groups.map(([name, g]) => (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-14 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{name}</span>
              {TOOLS.filter((t) => t.group === g).map((t) => (
                <Button key={t.id} size="sm" variant={tool === t.id ? "default" : "outline"} onClick={() => { setTool(t.id); setPending([]); setNote(""); }}>{t.label}</Button>
              ))}
            </div>
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
          {rot !== 0 && <Button size="sm" variant="ghost" onClick={() => { setRot(0); setNote("Level reset."); }}>Reset level</Button>}
          <span className="text-xs text-muted-foreground">{note || hint}</span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button size="sm" disabled={!ready} onClick={() => onDone(exportJpeg(canvas.current!), measure)}>Save picture</Button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30">
          {!ready && <div className="p-6 text-sm text-muted-foreground">Loading picture...</div>}
          <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            className="mx-auto block max-h-[70vh] w-auto max-w-full touch-none" style={{ cursor: tool === "none" ? "default" : "crosshair" }} />
        </div>
        <div className="text-sm">
          {scale ? <span className="mr-3 text-xs text-muted-foreground">Scale set: 1 cm = {r1(scale)} px.</span>
            : ops.some((o) => ["dist", "hgap", "vgap"].includes(o.t)) && <span className="mr-3 text-xs text-amber-800">No scale set, so lengths are in pixels. Use Set scale on something of known length.</span>}
          {measure && <><b>Measured:</b> {measure} <span className="text-xs text-muted-foreground">(saved with the picture)</span></>}
        </div>
      </div>
    </div>
  );
}
