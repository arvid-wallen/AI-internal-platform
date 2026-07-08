import Link from "next/link";
import {
  getDailyPortfolio,
  getPortfolio,
  getRecentUpdates,
  getTopProjectsByAICost,
  listInvoices,
  listProjects,
  listSyncRuns,
} from "@/lib/db";

// Always server-render — portfolio totals + token usage are stale within
// minutes of every cron sync.
export const dynamic = "force-dynamic";
import { getSessionMember } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import { KpiCard, MarginBar, ProviderChip, SectionHead } from "@/components/ui";
import { StackedBarChart } from "@/components/charts";

interface AttentionCard {
  kind: "critical" | "warn" | "info";
  icon: keyof typeof Icons;
  title: string;
  desc: string;
  meta: string[];
  href: string;
}

export default async function DashboardPage() {
  const [
    portfolio,
    daily,
    topByCost,
    updates,
    invoices,
    syncRuns,
    projects,
    member,
  ] = await Promise.all([
    getPortfolio(),
    getDailyPortfolio(60),
    getTopProjectsByAICost(6),
    getRecentUpdates(6),
    listInvoices(),
    listSyncRuns(12),
    listProjects(),
    getSessionMember(),
  ]);

  const last30 = daily.slice(-30);
  const prev30 = daily.slice(-60, -30);
  const last30Cost = last30.map((d) => d.cost_sek);
  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  const costThis = sum(last30Cost);
  const costPrev = sum(prev30.map((d) => d.cost_sek));
  const costDelta = costPrev ? (costThis - costPrev) / costPrev : 0;

  const stack = daily.slice(-14).map((d) => ({
    label: fmt.dayShort(d.date),
    parts: {
      anthropic: d.byProvider.anthropic,
      openai: d.byProvider.openai,
      google: d.byProvider.google,
    },
  }));

  // Derive "needs attention" from real signals (priority order).
  const attention: AttentionCard[] = [];
  for (const p of topByCost) {
    const margin = p.monthly_revenue - p.ai_cost - p.infra_cost;
    if (p.monthly_revenue > 0 && margin < 0)
      attention.push({
        kind: "critical",
        icon: "Alert",
        title: `${p.project_name} — negativ marginal`,
        desc: `AI-kostnad ${fmt.ksek(p.ai_cost)} överstiger intäkt ${fmt.ksek(p.monthly_revenue)}.`,
        meta: [p.customer_name].filter(Boolean),
        href: `/projects/${p.project_id}`,
      });
  }
  for (const inv of invoices) {
    if (inv.status === "overdue")
      attention.push({
        kind: "critical",
        icon: "Receipt",
        title: `Faktura ${inv.id} förfallen`,
        desc: `${fmt.ksek(inv.amount)} · förfaller ${inv.due}`,
        meta: [inv.customer_id].filter(Boolean),
        href: "/billing",
      });
  }
  for (const r of syncRuns) {
    if (r.status === "fail")
      attention.push({
        kind: "warn",
        icon: "Server",
        title: `${r.integration}-sync misslyckades`,
        desc: r.err ?? "Okänt fel vid senaste sync.",
        meta: [r.at].filter(Boolean),
        href: "/settings",
      });
  }
  for (const p of projects) {
    if (p.status === "paused")
      attention.push({
        kind: "info",
        icon: "Pause",
        title: `${p.name} pausad`,
        desc: "Pausat projekt — beslut kan behövas.",
        meta: [p.customer_id].filter(Boolean),
        href: `/projects/${p.id}`,
      });
  }
  const needs = attention.slice(0, 5);

  const now = new Date();
  const tz = "Europe/Stockholm";
  const hour = Number(
    new Intl.DateTimeFormat("sv-SE", { hour: "numeric", hour12: false, timeZone: tz }).format(now),
  );
  const greeting = hour < 10 ? "God morgon" : hour < 18 ? "God dag" : "God kväll";
  const dateStr = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(now);

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Operations · {dateStr}</div>
          <h1 className="page-title">
            {greeting}, <em>{member?.name.split(" ")[0] ?? "kollega"}.</em>
          </h1>
          <p className="page-sub">
            {portfolio.project_count} projekt över {portfolio.customer_count} kunder.
            {needs.length > 0
              ? ` ${needs.length} ${needs.length === 1 ? "sak behöver" : "saker behöver"} uppmärksamhet idag.`
              : " Inget kräver uppmärksamhet just nu."}
          </p>
        </div>
        <div className="actions">
          <Link className="b ghost" href="/settings">
            <Icons.Refresh size={14} />
            Sync-status
          </Link>
          <Link className="b primary" href="/projects">
            <Icons.Plus size={14} />
            Nytt projekt
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon="Coins"
          label="Portfolio MRR"
          value={fmt.ksek(portfolio.total_mrr)}
          hint="denna månad"
        />
        <KpiCard
          icon="Brain"
          label="AI-kostnad denna mån"
          value={fmt.ksek(portfolio.ai_cost)}
          delta={fmt.pct(costDelta)}
          deltaDir={costDelta > 0 ? "down" : "up"}
          hint="vs föregående 30 d"
          spark={last30Cost}
        />
        <KpiCard
          icon="Server"
          label="Infrastruktur"
          value={fmt.ksek(portfolio.infra_cost)}
          hint="denna månad"
        />
        <KpiCard
          icon="Wallet"
          label="Portfolio-marginal"
          value={fmt.pct(portfolio.margin_pct)}
          delta={fmt.ksek(portfolio.margin)}
          deltaDir={portfolio.margin >= 0 ? "up" : "down"}
          hint="netto SEK/mån"
        />
      </div>

      <div className="grid-12 mt-4">
        <div className="stack">
          <div className="card">
            <SectionHead
              title="AI-kostnad senaste 14 dagar"
              sub="Stack per leverantör. Klicka för portfolio explorer."
              actions={
                <>
                  <button className="b sm" type="button">
                    <Icons.Filter size={12} />
                    Filtrera
                  </button>
                  <Link className="b sm" href="/tokens">
                    <Icons.Ext size={12} />
                    Öppna
                  </Link>
                </>
              }
            />
            <StackedBarChart
              data={stack}
              height={240}
              format="ksek"
              series={[
                { key: "anthropic", name: "Anthropic", color: "#FFC9A8" },
                { key: "openai", name: "OpenAI", color: "#A9FCAE" },
                { key: "google", name: "Google", color: "#6EC1E4" },
              ]}
            />
            <div className="chart-legend">
              <span className="lg">
                <span className="sw" style={{ background: "#FFC9A8" }}></span>{" "}
                Anthropic
              </span>
              <span className="lg">
                <span className="sw" style={{ background: "#A9FCAE" }}></span>{" "}
                OpenAI
              </span>
              <span className="lg">
                <span className="sw" style={{ background: "#6EC1E4" }}></span>{" "}
                Google Gemini
              </span>
            </div>
          </div>

          <div className="card flush">
            <div style={{ padding: "16px 18px 0" }}>
              <SectionHead
                title="Topp 6 projekt på AI-spend"
                sub="Denna månad. Marginal = intäkt − AI − infra."
                actions={
                  <Link className="b sm" href="/projects">
                    <Icons.Ext size={12} />
                    Alla projekt
                  </Link>
                }
              />
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th>Aktiv modell</th>
                  <th className="num">Intäkt</th>
                  <th className="num">AI-kostnad</th>
                  <th style={{ width: 220 }}>Marginal</th>
                </tr>
              </thead>
              <tbody>
                {topByCost.map((p) => {
                  const margin = p.monthly_revenue - p.ai_cost - p.infra_cost;
                  const marginPct = p.monthly_revenue
                    ? margin / p.monthly_revenue
                    : -1;
                  return (
                    <tr key={p.project_id}>
                      <td>
                        <Link
                          href={`/projects/${p.project_id}`}
                          style={{ display: "block", textDecoration: "none" }}
                        >
                          <div className="strong">{p.project_name}</div>
                          <div className="sub">{p.customer_name}</div>
                        </Link>
                      </td>
                      <td>
                        <div>
                          <ProviderChip provider={p.active_model_provider} />
                        </div>
                        <div className="sub">{p.active_model_display}</div>
                      </td>
                      <td className="num">{fmt.ksek(p.monthly_revenue)}</td>
                      <td className="num">{fmt.ksek(p.ai_cost)}</td>
                      <td>
                        <MarginBar pct={marginPct} />
                      </td>
                    </tr>
                  );
                })}
                {topByCost.length === 0 && (
                  <tr className="no-hover">
                    <td colSpan={5} className="empty">
                      Ingen AI-användning attribuerad till projekt ännu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <SectionHead
              title="Needs attention"
              sub={`${needs.length} ${needs.length === 1 ? "sak" : "saker"}`}
              actions={
                <button className="icon-btn" type="button">
                  <Icons.More size={14} />
                </button>
              }
            />
            <div className="stack" style={{ gap: 10 }}>
              {needs.map((n, i) => {
                const Icn = Icons[n.icon];
                return (
                  <Link
                    key={i}
                    href={n.href}
                    className={"na-card " + n.kind}
                    style={{ textDecoration: "none" }}
                  >
                    <span className="ic">
                      <Icn size={16} />
                    </span>
                    <div className="body">
                      <div className="ttl">{n.title}</div>
                      <div className="desc">{n.desc}</div>
                      <div className="meta">
                        {n.meta.map((m, j) => (
                          <span key={j}>{m}</span>
                        ))}
                      </div>
                    </div>
                    <span className="arrow">
                      <Icons.ChevR size={14} />
                    </span>
                  </Link>
                );
              })}
              {needs.length === 0 && (
                <div className="empty" style={{ padding: 14 }}>
                  Inget kräver uppmärksamhet just nu.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <SectionHead title="Senaste aktivitet" />
            <div className="timeline" style={{ marginTop: 4 }}>
              {updates.map((u, i) => (
                <div key={i} className={"tl-item" + (i > 2 ? " past" : "")}>
                  <div className="tl-time">
                    {u.when} · {u.actor}
                  </div>
                  <div className="tl-title">{u.project_name}</div>
                  <div className="tl-desc">{u.body}</div>
                </div>
              ))}
              {updates.length === 0 && (
                <div className="empty" style={{ padding: 14 }}>
                  Ingen aktivitet ännu.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
