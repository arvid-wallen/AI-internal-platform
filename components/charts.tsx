"use client";

// Pure-SVG chart primitives. Format functions live inside (not passed as props)
// to keep server→client boundary serializable.
import React, { useState, useRef, useEffect } from "react";
import { fmt } from "@/lib/format";

export type FormatKey = "ksek" | "sek" | "tokens" | "pct" | "usd" | "raw";

const FORMATTERS: Record<FormatKey, (v: number) => string> = {
  ksek: fmt.ksek,
  sek: (v) => fmt.sek(v),
  tokens: fmt.tokens,
  pct: fmt.pct,
  usd: fmt.usd,
  raw: (v) => String(Math.round(v)),
};

const formatVal = (v: number, key: FormatKey | undefined): string =>
  key ? FORMATTERS[key](v) : String(v);

interface Tooltip {
  x: number;
  y: number;
  k?: string;
  v: string;
}

function ChartTooltip({ tt }: { tt: Tooltip | null }) {
  if (!tt) return null;
  return (
    <div className="tt" style={{ left: tt.x, top: tt.y }}>
      {tt.k ? <span className="tt-k">{tt.k}</span> : null}
      {tt.v}
    </div>
  );
}

export function Sparkline({
  data,
  color = "var(--c-ink)",
  fill = "var(--c-paper-2)",
  height = 36,
}: {
  data: number[];
  color?: string;
  fill?: string;
  height?: number;
}) {
  if (!data || data.length === 0)
    return <svg height={height} width="100%" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 36;
  const step = w / (data.length - 1 || 1);
  let path = "";
  let area = "";
  data.forEach((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    path += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    if (i === 0) area += "M" + x + "," + h + " L" + x + "," + y + " ";
    else area += "L" + x + "," + y + " ";
  });
  area += "L" + w + "," + h + " Z";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      style={{ display: "block" }}
    >
      <path d={area} fill={fill} opacity="0.55" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export interface LineDatum {
  label: string;
  v: number;
}

export function LineChart({
  data,
  height = 220,
  color = "var(--c-ink)",
  fill = true,
  format = "raw" as FormatKey,
}: {
  data: LineDatum[];
  height?: number;
  color?: string;
  fill?: boolean;
  format?: FormatKey;
}) {
  const [tt, setTt] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data?.length) return <div className="empty">Ingen data.</div>;

  const padding = { l: 44, r: 12, t: 12, b: 26 };
  const h = height;
  const max = (Math.max(...data.map((d) => d.v)) || 1) * 1.1;
  const min = 0;
  const innerW = w - padding.l - padding.r;
  const innerH = h - padding.t - padding.b;
  const step = innerW / Math.max(1, data.length - 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => max * p);

  let pathD = "";
  let areaD = "";
  data.forEach((d, i) => {
    const x = padding.l + i * step;
    const y =
      padding.t + (1 - (d.v - min) / (max - min || 1)) * innerH;
    pathD += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    if (i === 0)
      areaD += "M" + x + "," + (padding.t + innerH) + " L" + x + "," + y + " ";
    else areaD += "L" + x + "," + y + " ";
  });
  areaD += "L" + (padding.l + innerW) + "," + (padding.t + innerH) + " Z";
  const tickEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ height }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        {ticks.map((t, i) => {
          const y = padding.t + (1 - i / 4) * innerH;
          return (
            <g key={i}>
              <line
                x1={padding.l}
                x2={w - padding.r}
                y1={y}
                y2={y}
                stroke="var(--c-line-soft)"
                strokeDasharray={i === 0 ? "0" : "2 3"}
              />
              <text
                x={padding.l - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--c-ink-3)"
              >
                {formatVal(t, format)}
              </text>
            </g>
          );
        })}
        {fill && <path d={areaD} fill={color} opacity="0.08" />}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.75" />
        {data.map((d, i) => {
          const x = padding.l + i * step;
          const y =
            padding.t + (1 - (d.v - min) / (max - min || 1)) * innerH;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="2.5" fill={color} opacity="0.7" />
              {i % tickEvery === 0 && (
                <text
                  x={x}
                  y={h - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--c-ink-3)"
                >
                  {d.label}
                </text>
              )}
              <rect
                x={x - step / 2}
                y={padding.t}
                width={step}
                height={innerH}
                fill="transparent"
                onMouseEnter={(e) => {
                  const rect = wrapRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTt({
                    x: e.clientX - rect.left,
                    y,
                    k: d.label,
                    v: formatVal(d.v, format),
                  });
                }}
                onMouseLeave={() => setTt(null)}
              />
            </g>
          );
        })}
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

export interface StackedDatum {
  label: string;
  parts: Record<string, number>;
}

export interface StackedSeries {
  key: string;
  name: string;
  color: string;
}

export function StackedBarChart({
  data,
  series,
  height = 220,
  format = "raw" as FormatKey,
}: {
  data: StackedDatum[];
  series: StackedSeries[];
  height?: number;
  format?: FormatKey;
}) {
  const [tt, setTt] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data?.length) return <div className="empty">Ingen data.</div>;

  const padding = { l: 44, r: 12, t: 12, b: 26 };
  const innerW = w - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;
  const totals = data.map((d) =>
    series.reduce((s, sr) => s + (d.parts[sr.key] || 0), 0),
  );
  const max = (Math.max(...totals) || 1) * 1.1;
  const barSlot = innerW / data.length;
  const barW = Math.min(28, barSlot * 0.62);
  const tickEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padding.t + (1 - p) * innerH;
          return (
            <g key={i}>
              <line
                x1={padding.l}
                x2={w - padding.r}
                y1={y}
                y2={y}
                stroke="var(--c-line-soft)"
                strokeDasharray={i === 0 ? "0" : "2 3"}
              />
              <text
                x={padding.l - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--c-ink-3)"
              >
                {formatVal(max * p, format)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padding.l + i * barSlot + barSlot / 2;
          let y = padding.t + innerH;
          return (
            <g key={i}>
              {series.map((sr) => {
                const val = d.parts[sr.key] || 0;
                const partH = (val / max) * innerH;
                y -= partH;
                return (
                  <rect
                    key={sr.key}
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={partH}
                    fill={sr.color}
                    onMouseEnter={(e) => {
                      const rect = wrapRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setTt({
                        x: e.clientX - rect.left,
                        y: y + 8,
                        k: d.label + " · " + sr.name,
                        v: formatVal(val, format),
                      });
                    }}
                    onMouseLeave={() => setTt(null)}
                  />
                );
              })}
              {i % tickEvery === 0 && (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--c-ink-3)"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

export function BarChart({
  data,
  height = 220,
  color = "var(--c-ink)",
  format = "raw" as FormatKey,
}: {
  data: LineDatum[];
  height?: number;
  color?: string;
  format?: FormatKey;
}) {
  const [tt, setTt] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data?.length) return <div className="empty">Ingen data.</div>;
  const padding = { l: 44, r: 12, t: 12, b: 26 };
  const innerW = w - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;
  const max = (Math.max(...data.map((d) => d.v)) || 1) * 1.1;
  const barSlot = innerW / data.length;
  const barW = Math.min(28, barSlot * 0.62);
  const tickEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padding.t + (1 - p) * innerH;
          return (
            <g key={i}>
              <line
                x1={padding.l}
                x2={w - padding.r}
                y1={y}
                y2={y}
                stroke="var(--c-line-soft)"
                strokeDasharray={i === 0 ? "0" : "2 3"}
              />
              <text
                x={padding.l - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--c-ink-3)"
              >
                {formatVal(max * p, format)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padding.l + i * barSlot + barSlot / 2;
          const partH = (d.v / max) * innerH;
          const y = padding.t + innerH - partH;
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={partH}
                fill={color}
                onMouseEnter={(e) => {
                  const rect = wrapRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTt({
                    x: e.clientX - rect.left,
                    y: y + 8,
                    k: d.label,
                    v: formatVal(d.v, format),
                  });
                }}
                onMouseLeave={() => setTt(null)}
              />
              {i % tickEvery === 0 && (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--c-ink-3)"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

export interface ScatterDatum {
  label: string;
  short?: string;
  x: number;
  y: number;
  size?: number;
  color: string;
}

export function ScatterChart({
  data,
  height = 360,
  xLabel = "",
  yLabel = "",
  xFormat = "raw" as FormatKey,
  yFormat = "raw" as FormatKey,
  xRange = [-1, 1] as [number, number],
}: {
  data: ScatterDatum[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xFormat?: FormatKey;
  yFormat?: FormatKey;
  xRange?: [number, number];
}) {
  const [tt, setTt] = useState<Tooltip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const padding = { l: 56, r: 16, t: 16, b: 36 };
  const innerW = w - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;

  const xMin = xRange[0];
  const xMax = xRange[1];
  const yMin = 0;
  const yMax = Math.max(...data.map((d) => d.y)) * 1.15 || 1;

  const x = (v: number) =>
    padding.l + ((v - xMin) / (xMax - xMin)) * innerW;
  const y = (v: number) =>
    padding.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const sizeBase = 6;
  const sizeMax = 24;
  const maxSize = Math.max(...data.map((d) => d.size || 1)) || 1;

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}>
        <rect
          x={x(0)}
          y={padding.t}
          width={innerW - (x(0) - padding.l)}
          height={innerH}
          fill="var(--c-mint-soft)"
          opacity="0.35"
        />
        <rect
          x={padding.l}
          y={padding.t}
          width={x(0) - padding.l}
          height={innerH}
          fill="var(--c-tomato-soft)"
          opacity="0.30"
        />
        <line
          x1={x(0)}
          x2={x(0)}
          y1={padding.t}
          y2={padding.t + innerH}
          stroke="var(--c-ink)"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const yy = padding.t + (1 - p) * innerH;
          return (
            <g key={i}>
              <line
                x1={padding.l}
                x2={w - padding.r}
                y1={yy}
                y2={yy}
                stroke="var(--c-line-soft)"
                strokeDasharray={i === 0 ? "0" : "2 3"}
              />
              <text
                x={padding.l - 6}
                y={yy + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--c-ink-3)"
              >
                {formatVal(yMax * p, yFormat)}
              </text>
            </g>
          );
        })}
        {[-0.5, -0.25, 0, 0.25, 0.5, 0.75].map((p, i) => {
          if (p < xMin || p > xMax) return null;
          const xx = x(p);
          return (
            <g key={i}>
              <text
                x={xx}
                y={height - 16}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--c-ink-3)"
              >
                {formatVal(p, xFormat)}
              </text>
            </g>
          );
        })}
        <text
          x={padding.l + innerW / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize="10"
          fontFamily="var(--font-mono)"
          fill="var(--c-ink-3)"
          letterSpacing="0.1em"
        >
          {xLabel}
        </text>
        <text
          x={14}
          y={padding.t + innerH / 2}
          textAnchor="middle"
          fontSize="10"
          fontFamily="var(--font-mono)"
          fill="var(--c-ink-3)"
          letterSpacing="0.1em"
          transform={`rotate(-90 14 ${padding.t + innerH / 2})`}
        >
          {yLabel}
        </text>
        {data.map((d, i) => {
          const r =
            sizeBase +
            Math.sqrt((d.size || 0) / maxSize) * (sizeMax - sizeBase);
          return (
            <g key={i}>
              <circle
                cx={x(d.x)}
                cy={y(d.y)}
                r={r}
                fill={d.color}
                opacity="0.75"
                stroke="var(--c-ink)"
                strokeWidth="1"
                onMouseEnter={(e) => {
                  const rect = wrapRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTt({
                    x: e.clientX - rect.left,
                    y: y(d.y),
                    k: d.label,
                    v: `${formatVal(d.x, xFormat)} · ${formatVal(d.y, yFormat)}`,
                  });
                }}
                onMouseLeave={() => setTt(null)}
              />
              {r > 12 && d.short && (
                <text
                  x={x(d.x)}
                  y={y(d.y) + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fill="var(--c-ink)"
                >
                  {d.short}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export function Donut({
  data,
  size = 140,
  thickness = 22,
}: {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - thickness / 2 - 2;
  const c = size / 2;
  let acc = 0;
  return (
    <svg width={size} height={size}>
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--c-paper-2)"
        strokeWidth={thickness}
      />
      {data.map((d, i) => {
        const len = d.value / total;
        const dash = len * 2 * Math.PI * r;
        const gap = 2 * Math.PI * r - dash;
        const off = -acc * 2 * Math.PI * r;
        acc += len;
        return (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={off}
            transform={`rotate(-90 ${c} ${c})`}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}

export interface HeatmapRow {
  label: string;
  cells: { d: string; value: number }[];
}

export function Heatmap({
  rows,
  max,
  color = "mint",
}: {
  rows: HeatmapRow[];
  max: number;
  color?: "mint" | "tomato";
}) {
  const colorRamp: Record<string, string[]> = {
    mint: ["#F2F0EB", "#DCF8DE", "#A9FCAE", "#5BC76A", "#0F3A1A"],
    tomato: ["#F2F0EB", "#F9D4D4", "#EC5F5F", "#A82E2E", "#5A1917"],
  };
  const ramp = colorRamp[color] ?? colorRamp.mint;

  const colorAt = (v: number) => {
    const ratio = max > 0 ? Math.min(1, v / max) : 0;
    if (ratio === 0) return ramp[0];
    const idx = Math.min(4, Math.floor(ratio * 4) + 1);
    return ramp[idx];
  };

  if (!rows?.length) return <div className="empty">Ingen data.</div>;
  const cols = rows[0].cells.length;

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 14 }}
    >
      <div></div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 2,
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--c-ink-3)",
        }}
      >
        {rows[0].cells.map((c, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            {i % 7 === 0 ? fmt.dayShort(c.d) : ""}
          </div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <React.Fragment key={ri}>
          <div
            style={{
              fontSize: 12,
              color: "var(--c-ink-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.label}
          </div>
          <div
            className="heat-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {r.cells.map((c, ci) => (
              <div
                key={ci}
                className="heat-cell"
                style={{
                  background: colorAt(c.value),
                  aspectRatio: "1 / 1",
                  minHeight: 10,
                }}
                title={`${fmt.date(c.d)} — ${fmt.ksek(c.value)}`}
              />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
