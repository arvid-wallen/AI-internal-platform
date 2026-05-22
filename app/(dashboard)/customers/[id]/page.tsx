import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  listInvoicesForCustomer,
  listModels,
  listProjectsForCustomer,
} from "@/lib/db";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import { ClassPill, KpiCard, SectionHead, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) notFound();

  const [ps, invs, models] = await Promise.all([
    listProjectsForCustomer(c.id),
    listInvoicesForCustomer(c.id),
    listModels(),
  ]);
  const modelById = new Map(models.map((m) => [m.id, m]));

  const totalRev = ps.reduce((s, p) => s + p.monthly_revenue, 0);
  const totalAi = ps.reduce((s, p) => s + p.ai_cost, 0);
  const totalInfra = ps.reduce((s, p) => s + p.infra_cost, 0);
  const margin = totalRev - totalAi - totalInfra;
  const marginPct = totalRev ? margin / totalRev : 0;

  return (
    <div className="page">
      <div className="detail-head">
        <div className="left">
          <div className={"detail-mark dm-" + c.mark}>{c.init}</div>
          <div>
            <div className="row" style={{ gap: 12, marginBottom: 4 }}>
              <h1 className="title">{c.name}</h1>
              <ClassPill cls={c.cls} />
              <StatusPill status={c.contract} />
            </div>
            <div className="meta">
              <span className="tnum">{c.org_number}</span>
              <span className="sep">·</span>
              <span>AM: {c.am}</span>
              <span className="sep">·</span>
              <span>{ps.length} projekt</span>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="b" type="button">
            <Icons.Ext size={14} />
            Öppna i Fortnox
          </button>
          <button className="b" type="button">
            <Icons.Edit size={14} />
            Redigera
          </button>
        </div>
      </div>

      <div className="stack">
        <div className="kpi-grid">
          <KpiCard icon="Coins" label="MRR" value={fmt.ksek(totalRev)} />
          <KpiCard icon="Brain" label="AI-kostnad" value={fmt.ksek(totalAi)} />
          <KpiCard icon="Server" label="Infra" value={fmt.ksek(totalInfra)} />
          <KpiCard icon="Wallet" label="Marginal" value={fmt.pct(marginPct)} />
        </div>

        <div className="card flush">
          <div style={{ padding: "16px 18px 0" }}>
            <SectionHead
              title="Projekt"
              sub={ps.length + " aktiva engagemang"}
            />
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Projekt</th>
                <th>Status</th>
                <th>Modell</th>
                <th className="num">MRR</th>
                <th className="num">AI/mån</th>
              </tr>
            </thead>
            <tbody>
              {ps.map((p) => {
                const m = modelById.get(p.active_model);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/projects/${p.id}`}
                        style={{ display: "block", textDecoration: "none" }}
                      >
                        <span className="strong">{p.name}</span>
                      </Link>
                    </td>
                    <td>
                      <StatusPill status={p.status} />
                    </td>
                    <td>
                      {m && (
                        <div className="row">
                          <span
                            className={"pdot " + m.provider}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              marginRight: 6,
                            }}
                          ></span>
                          {m.display}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {p.monthly_revenue ? (
                        fmt.ksek(p.monthly_revenue)
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td className="num">{fmt.ksek(p.ai_cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card flush">
          <div style={{ padding: "16px 18px 0" }}>
            <SectionHead title="Fakturor" sub={invs.length + " stycken"} />
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Fortnox-ID</th>
                <th>Datum</th>
                <th>Förfall</th>
                <th className="num">Belopp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => (
                <tr key={i.id} className="no-hover">
                  <td className="tnum">{i.id}</td>
                  <td className="tnum">{i.date}</td>
                  <td className="tnum">{i.due}</td>
                  <td className="num">{fmt.ksek(i.amount)}</td>
                  <td>
                    <StatusPill status={i.status} />
                  </td>
                </tr>
              ))}
              {invs.length === 0 && (
                <tr className="no-hover">
                  <td colSpan={5} className="empty">
                    Inga fakturor synkade ännu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
