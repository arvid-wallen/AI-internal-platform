import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  getModel,
  getProject,
  listDailyUsageForProject,
  listDependenciesForProject,
  listUpdatesForProject,
} from "@/lib/db";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import {
  KpiCard,
  Pill,
  ProviderChip,
  SectionHead,
  StatusPill,
} from "@/components/ui";
import { LineChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const [c, m, usage, deps, updates] = await Promise.all([
    getCustomer(p.customer_id),
    p.active_model ? getModel(p.active_model) : Promise.resolve(null),
    listDailyUsageForProject(p.id),
    listDependenciesForProject(p.id),
    listUpdatesForProject(p.id),
  ]);
  const last14 = usage.slice(-14);
  const sum14 = last14.reduce((s, u) => s + u.cost_sek, 0);
  const margin = p.monthly_revenue - p.ai_cost - p.infra_cost;
  const marginPct = p.monthly_revenue ? margin / p.monthly_revenue : 0;

  const chart = usage
    .slice(-30)
    .map((u) => ({ label: fmt.dayShort(u.date), v: u.cost_sek }));

  return (
    <div className="stack">
      <div className="kpi-grid">
        <KpiCard
          icon="Coins"
          label="Månadsintäkt"
          value={p.monthly_revenue ? fmt.ksek(p.monthly_revenue) : "—"}
          hint={p.monthly_revenue ? "Återkommande" : "Ingen intäkt ännu"}
        />
        <KpiCard
          icon="Brain"
          label="AI-kostnad mån"
          value={fmt.ksek(p.ai_cost)}
          delta={fmt.ksek(sum14)}
          deltaDir="up"
          hint="senaste 14 dgr"
        />
        <KpiCard
          icon="Server"
          label="Infrastruktur"
          value={fmt.ksek(p.infra_cost)}
          hint={p.hosting}
        />
        <KpiCard
          icon="Wallet"
          label="Marginal"
          value={fmt.pct(marginPct)}
          delta={fmt.ksek(margin)}
          deltaDir={margin > 0 ? "up" : "down"}
          hint="SEK/mån netto"
        />
      </div>

      <div className="grid-12">
        <div className="stack">
          <div className="card">
            <SectionHead
              title="AI-kostnad senaste 30 dagar"
              sub={`Aktiv modell: ${m?.display ?? "—"}`}
              actions={
                <Link className="b sm" href={`/projects/${p.id}/tokens`}>
                  <Icons.Ext size={12} />
                  Tokens-vy
                </Link>
              }
            />
            <LineChart data={chart} format="ksek" />
          </div>

          <div className="card">
            <SectionHead title="Snabbfakta" />
            <dl className="def-list" style={{ marginTop: 4 }}>
              <dt>Kund</dt>
              <dd>
                {c && <Link href={`/customers/${c.id}`}>{c.name}</Link>}
              </dd>
              <dt>Status</dt>
              <dd>
                <StatusPill status={p.status} />
              </dd>
              <dt>Slug</dt>
              <dd className="tnum">{p.slug}</dd>
              <dt>Aktiv modell</dt>
              <dd>
                {m && (
                  <>
                    <span className="tnum">{m.id}</span> ·{" "}
                    <ProviderChip provider={m.provider} />
                  </>
                )}
              </dd>
              <dt>Repo</dt>
              <dd className="tnum">
                {p.repo ?? <span className="dim">—</span>}
              </dd>
              <dt>Hosting</dt>
              <dd>{p.hosting}</dd>
              <dt>Tech stack</dt>
              <dd>
                <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                  {p.stack.map((s, i) => (
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
                </div>
              </dd>
              <dt>Ägare</dt>
              <dd>{p.owner}</dd>
              <dt>Go-live</dt>
              <dd>
                {p.go_live ? (
                  fmt.date(p.go_live)
                ) : (
                  <span className="dim">Inte ännu</span>
                )}
              </dd>
            </dl>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <SectionHead title="Aktiv modell" />
            {m && (
              <div className="mp-current">
                <span
                  className={"pdot " + m.provider}
                  style={{ width: 12, height: 12, borderRadius: 4 }}
                ></span>
                <div style={{ flex: 1 }}>
                  <div className="name">{m.display}</div>
                  <div
                    className="dim"
                    style={{
                      fontSize: 11.5,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ${m.price_in.toFixed(2)}/Mtok in · $
                    {m.price_out.toFixed(2)}/Mtok ut
                  </div>
                </div>
                <Link
                  className="b sm primary"
                  href={`/projects/${p.id}/models`}
                >
                  Byt
                </Link>
              </div>
            )}
            <div
              className="dim mt-3"
              style={{ fontSize: 12, lineHeight: 1.5 }}
            >
              Kundprojektet hämtar denna config via{" "}
              <span className="tnum">/api/projects/{p.slug}/config</span>.
              SWR-cache 60s, lokal fallback 1h.
            </div>
          </div>

          <div className="card">
            <SectionHead
              title="Beroenden"
              sub={deps.length + " system"}
              actions={
                <Link
                  className="b sm"
                  href={`/projects/${p.id}/dependencies`}
                >
                  <Icons.Ext size={12} />
                  Visa alla
                </Link>
              }
            />
            {deps.slice(0, 4).map((d) => (
              <div
                key={d.name}
                className="row between"
                style={{
                  padding: "6px 0",
                  borderBottom: "var(--bd-hairline)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13 }}>{d.name}</div>
                  <div className="dim" style={{ fontSize: 11.5 }}>
                    {d.vendor} · {d.category}
                  </div>
                </div>
                <div className="right">
                  <div className="tnum" style={{ fontSize: 13 }}>
                    {fmt.ksek(d.monthly_sek)}
                  </div>
                  {d.critical && (
                    <Pill kind="critical" dot={false}>
                      Kritisk
                    </Pill>
                  )}
                </div>
              </div>
            ))}
            {deps.length === 0 && (
              <div className="empty" style={{ padding: 14 }}>
                Inga registrerade beroenden.
              </div>
            )}
          </div>

          <div className="card">
            <SectionHead title="Senaste händelser" />
            <div className="timeline">
              {updates.slice(0, 5).map((u, i) => (
                <div
                  key={i}
                  className={"tl-item" + (i > 1 ? " past" : "")}
                >
                  <div className="tl-time">
                    {u.when} · {u.actor}
                  </div>
                  <div className="tl-title">{u.body}</div>
                </div>
              ))}
              {updates.length === 0 && (
                <div className="empty" style={{ padding: 6 }}>
                  Inga händelser ännu.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
