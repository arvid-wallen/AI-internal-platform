import {
  CUSTOMERS,
  INVOICES,
  computePortfolio,
  customerById,
  projectById,
} from "@/lib/data";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import { KpiCard, SectionHead, StatusPill } from "@/components/ui";

export default function BillingPage() {
  const portfolio = computePortfolio();
  const paid = INVOICES.filter((i) => i.status === "paid").reduce(
    (s, i) => s + i.amount,
    0,
  );
  const sent = INVOICES.filter((i) => i.status === "sent").reduce(
    (s, i) => s + i.amount,
    0,
  );
  const overdue = INVOICES.filter((i) => i.status === "overdue").reduce(
    (s, i) => s + i.amount,
    0,
  );

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Billing &amp; Revenue</h1>
          <p className="page-sub">
            Fortnox-spegling · {INVOICES.length} fakturor synkade.
          </p>
        </div>
        <div className="actions">
          <button className="b" type="button">
            <Icons.Ext size={14} />
            Öppna Fortnox
          </button>
          <button className="b primary" type="button">
            <Icons.Refresh size={14} />
            Sync nu
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon="Coins"
          label="MRR portfölj"
          value={fmt.ksek(portfolio.total_mrr)}
        />
        <KpiCard icon="Check" label="Betalt denna mån" value={fmt.ksek(paid)} />
        <KpiCard
          icon="Activity"
          label="Skickat denna mån"
          value={fmt.ksek(sent)}
        />
        <KpiCard
          icon="Alert"
          label="Förfallet"
          value={fmt.ksek(overdue)}
          hint={overdue > 0 ? "behöver påminnelse" : "rent"}
        />
      </div>

      <div className="card flush mt-4">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead title="Fakturor" count={INVOICES.length} />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Fortnox-ID</th>
              <th>Kund</th>
              <th>Projekt</th>
              <th>Datum</th>
              <th>Förfall</th>
              <th className="num">Belopp</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((i) => {
              const c = customerById(i.customer_id);
              const p = projectById(i.project_id);
              return (
                <tr key={i.id} className="no-hover">
                  <td className="tnum">{i.id}</td>
                  <td>{c?.name}</td>
                  <td>{p?.name}</td>
                  <td className="tnum">{i.date}</td>
                  <td className="tnum">{i.due}</td>
                  <td className="num">{fmt.ksek(i.amount)}</td>
                  <td>
                    <StatusPill status={i.status} />
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
