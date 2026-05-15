// Shared presentational components — used across all pages.
import type { ReactNode } from "react";
import { Icons, type IconName } from "./icons";
import { PROVIDERS } from "@/lib/data";
import type { ProviderSlug } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Sparkline } from "./charts";

export function Pill({
  kind,
  children,
  dot = true,
}: {
  kind: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={"pill " + kind + (dot ? "" : " no-dot")}>{children}</span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  building: "Bygger",
  paused: "Pausad",
  discovery: "Discovery",
  offboarded: "Offboardad",
  draft: "Utkast",
  sent: "Skickad",
  paid: "Betald",
  overdue: "Förfallen",
  ok: "OK",
  warn: "Varning",
  fail: "Fel",
  critical: "Kritisk",
};

export function StatusPill({ status }: { status: string }) {
  return <Pill kind={status}>{STATUS_LABELS[status] ?? status}</Pill>;
}

export function ClassPill({ cls }: { cls: "A" | "B" | "C" }) {
  return <span className={"classpill " + cls}>{cls}</span>;
}

export function ProviderChip({
  provider,
  showLabel = true,
}: {
  provider: ProviderSlug;
  showLabel?: boolean;
}) {
  const p = PROVIDERS.find((x) => x.slug === provider);
  if (!p) return null;
  return (
    <span className="provider-chip">
      <span className={"pdot " + provider}></span>
      {showLabel && p.name}
    </span>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  unit,
  delta,
  deltaDir,
  hint,
  spark,
}: {
  icon?: IconName;
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaDir?: "up" | "down";
  hint?: string;
  spark?: number[];
}) {
  const Icn = icon ? Icons[icon] : null;
  return (
    <div className="kpi">
      <div className="kpi-head">
        <div className="kpi-icon">{Icn ? <Icn size={15} /> : null}</div>
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {(delta != null || hint) && (
        <div className={"kpi-delta " + (deltaDir ?? "")}>
          {delta != null && (
            <>
              {deltaDir === "up" ? (
                <Icons.Up size={11} />
              ) : deltaDir === "down" ? (
                <Icons.Down size={11} />
              ) : null}
              <span className="ch">{delta}</span>
            </>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
      {spark && spark.length > 0 && (
        <div className="kpi-spark">
          <Sparkline data={spark} />
        </div>
      )}
    </div>
  );
}

export function SectionHead({
  title,
  sub,
  actions,
  count,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  count?: number | string;
}) {
  return (
    <div className="card-head">
      <div>
        <h3 className="card-title">
          {title}
          {count != null && (
            <span
              className="dim"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                marginLeft: 8,
                letterSpacing: "0.1em",
              }}
            >
              {count}
            </span>
          )}
        </h3>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}

export function MarginBar({ pct }: { pct: number }) {
  const p = Math.max(-0.5, Math.min(1, pct));
  const positive = p >= 0;
  const fillColor = positive ? "var(--c-mint)" : "var(--c-tomato)";
  const w = Math.abs(p) * 100;
  return (
    <div className="mbar">
      <div className="track">
        <div
          className="fill"
          style={{
            width: Math.min(100, w) + "%",
            background: fillColor,
            ...(positive
              ? { left: 0 }
              : { right: 0, left: "auto" as const }),
          }}
        ></div>
      </div>
      <span
        className="pct"
        style={{
          color: positive ? "var(--c-mint-ink)" : "var(--c-tomato-ink)",
        }}
      >
        {fmt.pct(pct)}
      </span>
    </div>
  );
}
