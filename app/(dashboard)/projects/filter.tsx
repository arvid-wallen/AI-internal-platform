"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { MarginBar, StatusPill } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { ProviderSlug } from "@/lib/types";

export interface ProjectRow {
  id: string;
  name: string;
  customer_name: string;
  status: string;
  stack: string[];
  owner: string;
  monthly_revenue: number;
  ai_cost: number;
  infra_cost: number;
  model_provider: ProviderSlug | string;
  model_display: string;
}

export function ProjectsFilter({ rows }: { rows: ProjectRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [provider, setProvider] = useState<string>("all");

  const items = useMemo(
    () =>
      rows.filter((p) => {
        if (status !== "all" && p.status !== status) return false;
        if (provider !== "all" && p.model_provider !== provider) return false;
        if (q) {
          const ql = q.toLowerCase();
          if (
            !p.name.toLowerCase().includes(ql) &&
            !p.customer_name.toLowerCase().includes(ql)
          )
            return false;
        }
        return true;
      }),
    [rows, q, status, provider],
  );

  const byStatus = (s: string) => rows.filter((p) => p.status === s).length;

  return (
    <div className="card flush">
      <div className="filterbar">
        <div className="fb-search">
          <Icons.Search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök projekt eller kund"
          />
        </div>
        {(["all", "live", "building", "discovery", "paused"] as const).map(
          (s) => (
            <button
              key={s}
              className={"chip" + (status === s ? " active" : "")}
              onClick={() => setStatus(s)}
              type="button"
            >
              {s === "all" ? "Alla" : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="count">
                {s === "all" ? rows.length : byStatus(s)}
              </span>
            </button>
          ),
        )}
        <div style={{ flex: 1 }}></div>
        <select
          className="chip"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={{ paddingRight: 22 }}
        >
          <option value="all">Alla leverantörer</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="google">Google</option>
        </select>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Projekt</th>
            <th>Status</th>
            <th>Aktiv modell</th>
            <th>Stack</th>
            <th>Ägare</th>
            <th className="num">MRR</th>
            <th className="num">AI/mån</th>
            <th style={{ width: 200 }}>Marginal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const margin =
              p.monthly_revenue - p.ai_cost - p.infra_cost;
            const marginPct = p.monthly_revenue
              ? margin / p.monthly_revenue
              : p.status === "discovery"
                ? 0
                : -1;
            return (
              <tr key={p.id}>
                <td>
                  <Link
                    href={`/projects/${p.id}`}
                    style={{ display: "block", textDecoration: "none" }}
                  >
                    <div className="strong">{p.name}</div>
                    <div className="sub">{p.customer_name}</div>
                  </Link>
                </td>
                <td>
                  <StatusPill status={p.status} />
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="provider-chip" style={{ marginRight: 0 }}>
                      <span className={"pdot " + p.model_provider}></span>
                    </span>
                    <span className="tnum" style={{ fontSize: 12.5 }}>
                      {p.model_display}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                    {p.stack.slice(0, 2).map((s, i) => (
                      <span
                        key={i}
                        className="pill no-dot"
                        style={{
                          padding: "1px 8px",
                          textTransform: "none",
                          letterSpacing: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                    {p.stack.length > 2 && (
                      <span className="dim" style={{ fontSize: 11 }}>
                        +{p.stack.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="tnum" style={{ fontSize: 12.5 }}>
                    {p.owner
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </span>{" "}
                  <span className="dim" style={{ fontSize: 12 }}>
                    {p.owner.split(" ")[0]}
                  </span>
                </td>
                <td className="num">
                  {p.monthly_revenue ? (
                    fmt.ksek(p.monthly_revenue)
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
                <td className="num">{fmt.ksek(p.ai_cost)}</td>
                <td>
                  <MarginBar pct={marginPct} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
