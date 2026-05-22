import { listCustomers, listModels, listProjects } from "@/lib/db";
import { fmt } from "@/lib/format";
import { MarginBar, SectionHead } from "@/components/ui";
import { ScatterChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [projects, customers, models] = await Promise.all([
    listProjects(),
    listCustomers(),
    listModels(),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const modelById = new Map(models.map((m) => [m.id, m]));

  // Risk matrix: x = margin %, y = monthly spend (ai + infra)
  const data = projects
    .filter((p) => p.monthly_revenue > 0)
    .map((p) => {
      const margin = p.monthly_revenue - p.ai_cost - p.infra_cost;
      const marginPct = p.monthly_revenue ? margin / p.monthly_revenue : 0;
      const spend = p.ai_cost + p.infra_cost;
      const m = modelById.get(p.active_model);
      const colorByProv: Record<string, string> = {
        anthropic: "#FFC9A8",
        openai: "#A9FCAE",
        google: "#6EC1E4",
      };
      return {
        label: p.name,
        short: p.name
          .split(" ")
          .slice(0, 1)
          .join("")
          .slice(0, 3)
          .toUpperCase(),
        x: marginPct,
        y: spend,
        size: spend,
        color: colorByProv[m?.provider ?? "anthropic"] ?? "#A3A39A",
      };
    });

  const rows = [...projects]
    .map((p) => {
      const margin = p.monthly_revenue - p.ai_cost - p.infra_cost;
      const marginPct = p.monthly_revenue ? margin / p.monthly_revenue : -1;
      return { p, margin, marginPct };
    })
    .sort((a, b) => a.marginPct - b.marginPct);

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Reports &amp; Risk</h1>
          <p className="page-sub">
            P&amp;L per projekt och en riskmatris för marginal vs spend.
          </p>
        </div>
      </div>

      <div className="card">
        <SectionHead
          title="Risk matrix · margin % vs månadsspend"
          sub="Storlek = total kostnad. Grön zon = positiv marginal."
        />
        <ScatterChart
          data={data}
          xLabel="Marginal %"
          yLabel="SEK / mån"
          xFormat="pct"
          yFormat="ksek"
        />
      </div>

      <div className="card flush mt-4">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead title="P&L per projekt" />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Kund</th>
              <th className="num">Intäkt</th>
              <th className="num">AI</th>
              <th className="num">Infra</th>
              <th className="num">Marginal</th>
              <th style={{ width: 200 }}>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, margin, marginPct }) => {
              const c = customerById.get(p.customer_id);
              return (
                <tr key={p.id} className="no-hover">
                  <td className="strong">{p.name}</td>
                  <td>{c?.name}</td>
                  <td className="num">{fmt.ksek(p.monthly_revenue)}</td>
                  <td className="num">{fmt.ksek(p.ai_cost)}</td>
                  <td className="num">{fmt.ksek(p.infra_cost)}</td>
                  <td className="num">{fmt.ksek(margin)}</td>
                  <td>
                    <MarginBar pct={marginPct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
