import Link from "next/link";
import {
  getDailyPortfolio,
  getPortfolioTokenTotals,
  getTopProjectsByAICost,
} from "@/lib/db";
import { fmt } from "@/lib/format";
import { KpiCard, SectionHead } from "@/components/ui";
import { StackedBarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const [daily, totals, top] = await Promise.all([
    getDailyPortfolio(60),
    getPortfolioTokenTotals(60),
    getTopProjectsByAICost(10),
  ]);

  const stack = daily.slice(-30).map((d) => ({
    label: fmt.dayShort(d.date),
    parts: {
      anthropic: d.byProvider.anthropic,
      openai: d.byProvider.openai,
      google: d.byProvider.google,
    },
  }));

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Core</div>
          <h1 className="page-title">Token Usage</h1>
          <p className="page-sub">
            Daglig token-användning över hela portföljen — 60 dagar.
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon="Coins"
          label="AI 60d totalt"
          value={fmt.ksek(totals.cost_sek)}
        />
        <KpiCard
          icon="Bolt"
          label="Tokens in"
          value={fmt.tokens(totals.tokens_in)}
        />
        <KpiCard
          icon="Bolt"
          label="Tokens ut"
          value={fmt.tokens(totals.tokens_out)}
        />
        <KpiCard
          icon="Sparkles"
          label="Snitt/dag"
          value={fmt.ksek(totals.cost_sek / Math.max(1, daily.length))}
        />
      </div>

      <div className="card mt-4">
        <SectionHead
          title="Spend per dag · per leverantör"
          sub="Senaste 30 dagar"
        />
        <StackedBarChart
          data={stack}
          height={260}
          format="ksek"
          series={[
            { key: "anthropic", name: "Anthropic", color: "#FFC9A8" },
            { key: "openai", name: "OpenAI", color: "#A9FCAE" },
            { key: "google", name: "Google", color: "#6EC1E4" },
          ]}
        />
      </div>

      <div className="card flush mt-4">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead title="Topp 10 projekt på AI-spend" />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Modell</th>
              <th className="num">AI-kostnad mån</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t) => (
              <tr key={t.project_id}>
                <td>
                  <Link
                    href={`/projects/${t.project_slug}`}
                    className="strong"
                    style={{ display: "block", textDecoration: "none" }}
                  >
                    {t.project_name}
                  </Link>
                </td>
                <td>{t.active_model_display || "—"}</td>
                <td className="num">{fmt.ksek(t.ai_cost)}</td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr className="no-hover">
                <td colSpan={3} className="empty">
                  Ingen token-användning registrerad ännu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
