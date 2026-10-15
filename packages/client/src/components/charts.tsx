import { useId, useMemo, useRef, useState } from "react";

/**
 * Small dependency-free SVG charts. Follows the dataviz method: single hue per series in a fixed order, 2px lines, 4.5px markers with
 * a 2px surface ring, hairline solid grid, text in ink tokens (never the series colour), a legend whenever there are two or more series,
 * selective direct labels, hover tooltip, and a table view for every chart.
 */
export interface Pt { x: number; y: number }
export interface Series { name: string; slot: 1 | 2; points: Pt[] }

const W = 640, H = 240, M = { l: 52, r: 70, t: 16, b: 34 };
const COLORS = { 1: "var(--viz-s1)", 2: "var(--viz-s2)" } as const;

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const range = hi - lo || Math.abs(hi) || 1;
  const raw = range / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * pow;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(Math.round(v / step) * step);
  return out;
}
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
export const fmtDayLong = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--viz-ink2)" }}>
      {series.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: COLORS[s.slot] }} />{s.name}
        </span>
      ))}
    </div>
  );
}

function DataTable({ rows, headers }: { rows: Array<Array<string | number>>; headers: string[] }) {
  return (
    <details className="mt-1 text-xs print:hidden" style={{ color: "var(--viz-ink2)" }}>
      <summary className="cursor-pointer">Table view</summary>
      <table className="mt-1 w-full text-left">
        <thead><tr>{headers.map((h) => <th key={h} className="pr-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="pr-3 tabular-nums">{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export function LineChart({ title, subtitle, series, target, format = (v) => String(Math.round(v * 100) / 100), unit = "" }: {
  title: string; subtitle?: string; series: Series[]; target?: { y: number; label: string } | null; format?: (v: number) => string; unit?: string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points);
  const g = useMemo(() => {
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y).concat(target ? [target.y] : []);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (x0 === x1) { x0 -= 3 * 86400000; x1 += 3 * 86400000; }
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pad = (y1 - y0 || Math.abs(y1) || 1) * 0.15;
    y0 -= pad; y1 += pad;
    const ticks = niceTicks(y0, y1);
    y0 = Math.min(y0, ticks[0]); y1 = Math.max(y1, ticks[ticks.length - 1]);
    const sx = (x: number) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
    const sy = (y: number) => M.t + (1 - (y - y0) / (y1 - y0)) * (H - M.t - M.b);
    return { x0, x1, ticks, sx, sy };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(all), target?.y]);

  if (all.length === 0) return null;
  const xsSorted = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
  const pick = xsSorted.length <= 4 ? xsSorted : [xsSorted[0], xsSorted[Math.floor(xsSorted.length / 2)], xsSorted[xsSorted.length - 1]];
  const seenDays = new Set<string>();
  const xTicks = pick.filter((x) => { const k = fmtDay(x); if (seenDays.has(k)) return false; seenDays.add(k); return true; });
  const hx = hover != null ? xsSorted[hover] : null;
  const tipRows = hx != null ? series.map((s) => ({ s, p: s.points.find((p) => p.x === hx) })).filter((r) => r.p) : [];

  const onMove = (e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    xsSorted.forEach((x, i) => { const d = Math.abs(g.sx(x) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  return (
    <figure className="viz break-inside-avoid" aria-labelledby={`${id}-t`}>
      <figcaption className="mb-1">
        <div id={`${id}-t`} className="text-sm font-medium" style={{ color: "var(--viz-ink)" }}>{title}</div>
        {subtitle && <div className="text-xs" style={{ color: "var(--viz-ink2)" }}>{subtitle}</div>}
      </figcaption>
      <Legend series={series} />
      <div ref={box} className="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}. ${series.map((s) => `${s.name}: ${s.points.map((p) => format(p.y)).join(", ")}`).join("; ")}`}>
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={g.sy(t)} y2={g.sy(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={M.l - 8} y={g.sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--viz-muted)">{format(t)}</text>
            </g>
          ))}
          <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--viz-axis)" strokeWidth={1} />
          {xTicks.map((x) => <text key={x} x={g.sx(x)} y={H - M.b + 18} textAnchor="middle" fontSize={11} fill="var(--viz-muted)">{fmtDay(x)}</text>)}
          {target && (
            <g>
              <line x1={M.l} x2={W - M.r} y1={g.sy(target.y)} y2={g.sy(target.y)} stroke="var(--viz-ink2)" strokeWidth={1} />
              <text x={W - M.r + 6} y={g.sy(target.y) + 4} fontSize={11} fill="var(--viz-ink2)">{target.label} {format(target.y)}</text>
            </g>
          )}
          {hx != null && <line x1={g.sx(hx)} x2={g.sx(hx)} y1={M.t} y2={H - M.b} stroke="var(--viz-axis)" strokeWidth={1} />}
          {series.map((s) => {
            const pts = [...s.points].sort((a, b) => a.x - b.x);
            const last = pts[pts.length - 1];
            return (
              <g key={s.name}>
                {pts.length > 1 && <polyline points={pts.map((p) => `${g.sx(p.x)},${g.sy(p.y)}`).join(" ")} fill="none" stroke={COLORS[s.slot]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {pts.map((p) => <circle key={p.x} cx={g.sx(p.x)} cy={g.sy(p.y)} r={4.5} fill={COLORS[s.slot]} stroke="var(--viz-surface)" strokeWidth={2} />)}
                <text x={g.sx(last.x) + 9} y={g.sy(last.y) - (target && Math.abs(g.sy(last.y) - g.sy(target.y)) < 14 ? 10 : -4)} fontSize={12} fontWeight={600} fill="var(--viz-ink)">{format(last.y)}{unit ? ` ${unit}` : ""}</text>
              </g>
            );
          })}
        </svg>
        {hx != null && tipRows.length > 0 && (
          <div className="pointer-events-none absolute z-10 rounded-md border px-2 py-1 text-xs shadow-sm" style={{ left: `${Math.min(70, (g.sx(hx) / W) * 100)}%`, top: 4, background: "var(--viz-surface)", borderColor: "var(--viz-grid)", color: "var(--viz-ink)" }}>
            <div style={{ color: "var(--viz-ink2)" }}>{fmtDayLong(hx)}</div>
            {tipRows.map(({ s, p }) => <div key={s.name} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[s.slot] }} />{s.name}: <b>{format(p!.y)}{unit ? ` ${unit}` : ""}</b></div>)}
          </div>
        )}
      </div>
      <DataTable headers={["Date", ...series.map((s) => s.name)]} rows={xsSorted.map((x) => [fmtDayLong(x), ...series.map((s) => { const p = s.points.find((q) => q.x === x); return p ? format(p.y) : "—"; })])} />
    </figure>
  );
}

export interface Bar { label: string; value: number; note?: string }

/** Single-series column chart (weekly running km). Bars are capped at 24 px with a 4 px rounded top; notes label notable bars. */
export function BarChart({ title, subtitle, bars, unit = "" }: { title: string; subtitle?: string; bars: Bar[]; unit?: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((b) => b.value)) * 1.15 || 1;
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1];
  const slot = (W - M.l - M.r) / bars.length;
  const bw = Math.min(24, slot * 0.6);
  const sy = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  return (
    <figure className="viz break-inside-avoid" aria-labelledby={`${id}-t`}>
      <figcaption className="mb-1">
        <div id={`${id}-t`} className="text-sm font-medium" style={{ color: "var(--viz-ink)" }}>{title}</div>
        {subtitle && <div className="text-xs" style={{ color: "var(--viz-ink2)" }}>{subtitle}</div>}
      </figcaption>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}. ${bars.map((b) => `${b.label}: ${b.value}${unit}`).join(", ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth={1} />
              <text x={M.l - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--viz-muted)">{t.toLocaleString()}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = M.l + slot * (i + 0.5), x = cx - bw / 2, y = sy(b.value), h = sy(0) - y, r = Math.min(4, h);
            const labelled = i === bars.length - 1 || b.note;
            return (
              <g key={b.label} onMouseEnter={() => setHover(i)}>
                <rect x={M.l + slot * i} y={M.t} width={slot} height={H - M.t - M.b} fill="transparent" />
                <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + h} Z`} fill="var(--viz-s1)" />
                {labelled && <text x={cx} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--viz-ink)">{b.value}{b.note ? ` ${b.note}` : ""}</text>}
                {(bars.length <= 8 || i % Math.ceil(bars.length / 6) === 0 || i === bars.length - 1) && <text x={cx} y={H - M.b + 18} textAnchor="middle" fontSize={11} fill="var(--viz-muted)">{b.label}</text>}
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <div className="pointer-events-none absolute z-10 rounded-md border px-2 py-1 text-xs shadow-sm" style={{ left: `${Math.min(70, ((M.l + slot * (hover + 0.5)) / W) * 100)}%`, top: 4, background: "var(--viz-surface)", borderColor: "var(--viz-grid)", color: "var(--viz-ink)" }}>
            <div style={{ color: "var(--viz-ink2)" }}>Week of {bars[hover].label}</div><b>{bars[hover].value}{unit ? ` ${unit}` : ""}</b>{bars[hover].note ? ` (${bars[hover].note})` : ""}
          </div>
        )}
      </div>
      <DataTable headers={["Week starting", unit ? `Value (${unit})` : "Value", "Note"]} rows={bars.map((b) => [b.label, b.value, b.note ?? ""])} />
    </figure>
  );
}
