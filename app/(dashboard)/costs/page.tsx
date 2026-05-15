import {
  DEPENDENCIES,
  PROJECTS,
  computePortfolio,
  projectById,
} from "@/lib/data";
import { fmt } from "@/lib/format";
import { KpiCard, SectionHead } from "@/components/ui";

export default function CostsPage() {
  const portfolio = computePortfolio();
  const byVendor = new Map<string, number>();
  for (const d of DEPENDENCIES) {
    byVendor.set(d.vendor, (byVendor.get(d.vendor) ?? 0) + d.monthly_sek);
  }
  const vendorRows = [...byVendor.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([vendor, cost]) => ({ vendor, cost }));

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Costs</h1>
          <p className="page-sub">
            Sammanställning av infrastruktur- och leverantörskostnader.
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon="Brain"
          label="AI-kostnad"
          value={fmt.ksek(portfolio.ai_cost)}
        />
        <KpiCard
          icon="Server"
          label="Infrastruktur"
          value={fmt.ksek(portfolio.infra_cost)}
        />
        <KpiCard
          icon="Wallet"
          label="Total kostnad"
          value={fmt.ksek(portfolio.ai_cost + portfolio.infra_cost)}
        />
        <KpiCard
          icon="Coins"
          label="Margin SEK"
          value={fmt.ksek(portfolio.margin)}
        />
      </div>

      <div className="card flush mt-4">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead title="Per leverantör" />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Leverantör</th>
              <th className="num">SEK/mån</th>
              <th>Andel</th>
            </tr>
          </thead>
          <tbody>
            {vendorRows.map((r) => {
              const total = vendorRows.reduce((s, x) => s + x.cost, 0);
              const pct = total ? (r.cost / total) * 100 : 0;
              return (
                <tr key={r.vendor} className="no-hover">
                  <td className="strong">{r.vendor}</td>
                  <td className="num">{fmt.ksek(r.cost)}</td>
                  <td className="tnum dim">{pct.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
