import {
  DAILY_PORTFOLIO,
  DAILY_USAGE,
  PROJECTS,
  modelById,
} from "@/lib/data";
import { fmt } from "@/lib/format";
import { KpiCard, SectionHead } from "@/components/ui";
import { StackedBarChart } from "@/components/charts";

export default function TokensPage() {
  const totalCost = DAILY_USAGE.reduce((s, u) => s + u.cost_sek, 0);
  const totalIn = DAILY_USAGE.reduce((s, u) => s + u.tokens_in, 0);
  const totalOut = DAILY_USAGE.reduce((s, u) => s + u.tokens_out, 0);

  const stack = DAILY_PORTFOLIO.slice(-30).map((d) => ({
    label: fmt.dayShort(d.date),
    parts: {
      anthropic: d.byProvider.anthropic,
      openai: d.byProvider.openai,
      google: d.byProvider.google,
    },
  }));

  // top 10 projects by 60d cost
  const byProject = new Map<string, number>();
  for (const u of DAILY_USAGE) {
    byProject.set(u.project_id, (byProject.get(u.project_id) ?? 0) + u.cost_sek);
  }
  const topProjects = [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

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
          value={fmt.ksek(totalCost)}
        />
        <KpiCard icon="Bolt" label="Tokens in" value={fmt.tokens(totalIn)} />
        <KpiCard
          icon="Bolt"
          label="Tokens ut"
          value={fmt.tokens(totalOut)}
        />
        <KpiCard
          icon="Sparkles"
          label="Snitt/dag"
          value={fmt.ksek(totalCost / Math.max(1, DAILY_PORTFOLIO.length))}
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
          <SectionHead title="Topp 10 projekt på AI-spend (60d)" />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Modell</th>
              <th className="num">60d kostnad</th>
            </tr>
          </thead>
          <tbody>
            {topProjects.map(([pid, cost]) => {
              const p = PROJECTS.find((x) => x.id === pid);
              const m = p ? modelById(p.active_model) : undefined;
              return (
                <tr key={pid} className="no-hover">
                  <td className="strong">{p?.name ?? pid}</td>
                  <td>{m?.display ?? "—"}</td>
                  <td className="num">{fmt.ksek(cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
