import Link from "next/link";
import { getPortfolio, getSoftwareCosts } from "@/lib/db";
import { fmt } from "@/lib/format";
import { KpiCard, SectionHead } from "@/components/ui";
import { Icons } from "@/components/icons";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  hosting: "Hosting",
  database: "Databas",
  storage: "Lagring",
  cdn: "CDN",
  third_party_api: "SaaS / API",
  domain: "Domän",
  other: "Övrigt",
};

export default async function CostsPage() {
  const [portfolio, software] = await Promise.all([
    getPortfolio(),
    getSoftwareCosts(),
  ]);
  const total = software.by_vendor.reduce((s, x) => s + x.amount_sek, 0);
  const monthLabel = fmt.date(software.month);

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Costs</h1>
          <p className="page-sub">
            Sammanställning av infrastruktur- och mjukvarukostnader.
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
          label="Mjukvara / SaaS"
          value={fmt.ksek(software.total_sek)}
          hint={monthLabel}
        />
        <KpiCard
          icon="Wallet"
          label="Total kostnad"
          value={fmt.ksek(portfolio.ai_cost + software.total_sek)}
        />
        <KpiCard
          icon="Coins"
          label="Margin SEK"
          value={fmt.ksek(portfolio.margin)}
        />
      </div>

      <div className="card flush mt-4">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead
            title="Per leverantör"
            sub={`Mjukvarukostnader för ${monthLabel}`}
            actions={
              <Link className="b sm" href="/costs/import">
                <Icons.Upload size={12} />
                Importera kortfil
              </Link>
            }
          />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Leverantör</th>
              <th>Kategori</th>
              <th className="num">SEK/mån</th>
              <th>Andel</th>
            </tr>
          </thead>
          <tbody>
            {software.by_vendor.map((r) => {
              const pct = total ? (r.amount_sek / total) * 100 : 0;
              return (
                <tr key={r.vendor} className="no-hover">
                  <td className="strong">{r.vendor}</td>
                  <td className="dim">
                    {r.cost_category
                      ? CATEGORY_LABELS[r.cost_category] ?? r.cost_category
                      : "—"}
                  </td>
                  <td className="num">{fmt.ksek(r.amount_sek)}</td>
                  <td className="tnum dim">{pct.toFixed(0)}%</td>
                </tr>
              );
            })}
            {software.by_vendor.length === 0 && (
              <tr className="no-hover">
                <td colSpan={4} className="empty">
                  Inga registrerade mjukvarukostnader. Importera kortfilen för
                  att komma igång.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
