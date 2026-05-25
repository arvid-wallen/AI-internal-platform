import { notFound } from "next/navigation";
import { getProject, listDependenciesForProject } from "@/lib/db";
import { fmt } from "@/lib/format";
import { MarginBar, Pill, SectionHead } from "@/components/ui";
import { Donut } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ProjectCostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const deps = await listDependenciesForProject(p.id);
  const depsTotal = deps.reduce((s, d) => s + d.monthly_sek, 0);

  const breakdown = [
    { name: "AI-kostnad", value: p.ai_cost, color: "#FFC9A8" },
    { name: "Infra (deps)", value: depsTotal, color: "#6EC1E4" },
    {
      name: "Övrigt",
      value: Math.max(0, p.infra_cost - depsTotal),
      color: "#D9C9ED",
    },
  ].filter((b) => b.value > 0);
  const total = breakdown.reduce((s, b) => s + b.value, 0);

  return (
    <div className="grid-12">
      <div className="stack">
        <div className="card">
          <SectionHead
            title="Månadens kostnadsfördelning"
            sub={`Total ${fmt.ksek(p.ai_cost + p.infra_cost)} / mån`}
          />
          <div className="row gap-4 mt-3">
            <Donut data={breakdown} />
            <div className="flex-1">
              {breakdown.map((b, i) => (
                <div
                  key={i}
                  className="row between"
                  style={{
                    padding: "8px 0",
                    borderBottom: "var(--bd-hairline)",
                  }}
                >
                  <div className="row gap-2">
                    <span className="swatch" style={{ background: b.color }}></span>
                    <span style={{ fontSize: 13 }}>{b.name}</span>
                  </div>
                  <div className="right">
                    <div className="tnum strong">{fmt.ksek(b.value)}</div>
                    <div className="dim tnum" style={{ fontSize: 11 }}>
                      {total ? ((b.value / total) * 100).toFixed(0) : 0}%
                    </div>
                  </div>
                </div>
              ))}
              {breakdown.length === 0 && (
                <div className="empty" style={{ padding: 14 }}>
                  Ingen kostnad registrerad ännu.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card flush">
          <div style={{ padding: "16px 18px 0" }}>
            <SectionHead
              title="Beroenden"
              sub={`${deps.length} system · ${fmt.ksek(depsTotal)}/mån`}
            />
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Tjänst</th>
                <th>Vendor</th>
                <th>Kategori</th>
                <th>Kritisk</th>
                <th className="num">SEK/mån</th>
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => (
                <tr key={d.name} className="no-hover">
                  <td className="strong">{d.name}</td>
                  <td>{d.vendor}</td>
                  <td className="tnum dim" style={{ fontSize: 12 }}>
                    {d.category}
                  </td>
                  <td>
                    {d.critical ? (
                      <Pill kind="critical">Ja</Pill>
                    ) : (
                      <span className="dim">nej</span>
                    )}
                  </td>
                  <td className="num">{fmt.ksek(d.monthly_sek)}</td>
                </tr>
              ))}
              {deps.length === 0 && (
                <tr className="no-hover">
                  <td colSpan={5} className="empty">
                    Inga registrerade beroenden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <SectionHead title="P&L denna månad" />
          <dl className="def-list" style={{ rowGap: 12 }}>
            <dt>Intäkt</dt>
            <dd
              className="tnum strong"
              style={{ color: "var(--c-mint-ink)" }}
            >
              + {fmt.ksek(p.monthly_revenue)}
            </dd>
            <dt>AI-kostnad</dt>
            <dd className="tnum">− {fmt.ksek(p.ai_cost)}</dd>
            <dt>Infra</dt>
            <dd className="tnum">− {fmt.ksek(p.infra_cost)}</dd>
            <dt
              style={{ paddingTop: 8, borderTop: "var(--bd-hairline)" }}
            >
              Marginal
            </dt>
            <dd
              className="tnum strong"
              style={{ paddingTop: 8, borderTop: "var(--bd-hairline)" }}
            >
              {fmt.ksek(p.monthly_revenue - p.ai_cost - p.infra_cost)}
            </dd>
            <dt>Marginal %</dt>
            <dd>
              <MarginBar
                pct={
                  p.monthly_revenue
                    ? (p.monthly_revenue - p.ai_cost - p.infra_cost) /
                      p.monthly_revenue
                    : 0
                }
              />
            </dd>
          </dl>
        </div>
        <div className="card">
          <SectionHead title="Källor" />
          <div
            className="dim"
            style={{ fontSize: 12.5, lineHeight: 1.55 }}
          >
            Intäkt mappas från Fortnox via artikelkod{" "}
            <span className="tnum">
              AI-{p.customer_id.toUpperCase()}-
              {p.slug.split("-").slice(-1)[0].toUpperCase()}
            </span>
            . AI-kostnad summeras dagligen från{" "}
            <span className="tnum">token_usage_daily</span>. Infra läses från
            registrerade beroenden + costs_monthly CSV.
          </div>
        </div>
      </div>
    </div>
  );
}
