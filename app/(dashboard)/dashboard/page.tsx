import Link from "next/link";
import {
  computePortfolio,
  DAILY_PORTFOLIO,
  PROJECTS,
  UPDATES,
  customerById,
  modelById,
  projectById,
} from "@/lib/data";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import {
  KpiCard,
  MarginBar,
  ProviderChip,
  SectionHead,
} from "@/components/ui";
import { StackedBarChart } from "@/components/charts";

interface AttentionCard {
  kind: "critical" | "warn" | "info";
  icon: keyof typeof Icons;
  title: string;
  desc: string;
  meta: string[];
  href: string;
}

const NEEDS_ATTENTION: AttentionCard[] = [
  {
    kind: "critical",
    icon: "Alert",
    title: "Klarna Dispute Triage — kostnadsspike 4.2×",
    desc:
      "Opus 4.7-rollout har driftat AI-kostnaden från 38k → 162k kr/mån. Marginalen är nu negativ.",
    meta: ["p-klarna-dispute", "Updated 09:12"],
    href: "/projects/p-klarna-dispute",
  },
  {
    kind: "critical",
    icon: "Receipt",
    title: "Faktura F-2603-097 är förfallen",
    desc:
      "Klarna · Dispute Triage · april. 12 dagar över förfallodatum.",
    meta: ["Klarna · 240 000 kr", "Förfall 2026-04-30"],
    href: "/billing",
  },
  {
    kind: "warn",
    icon: "Server",
    title: "Google Cloud Billing — 2 workspaces saknar label",
    desc:
      "Vertex AI-kostnader för 2 SKU:er går inte att attributera till ett projekt.",
    meta: ["google sync · 04:33"],
    href: "/settings",
  },
  {
    kind: "warn",
    icon: "Pause",
    title: "Northvolt QA Assistant pausad i 28 dagar",
    desc:
      "Ingen aktivitet sedan offboarding-diskussion 17 apr. Beslut behövs.",
    meta: ["p-nv-qa"],
    href: "/projects/p-nv-qa",
  },
  {
    kind: "info",
    icon: "Sparkles",
    title: "Föreslagen besparing — Klarna Dispute",
    desc:
      "Byt Opus 4.7 → Sonnet 4.5 + reasoning_effort=high. Estimerad besparing 108 000 kr/mån.",
    meta: ["AI suggestion · 09:14"],
    href: "/projects/p-klarna-dispute",
  },
];

export default function DashboardPage() {
  const portfolio = computePortfolio();

  const last30 = DAILY_PORTFOLIO.slice(-30);
  const prev30 = DAILY_PORTFOLIO.slice(-60, -30);
  const last30Cost = last30.map((d) => d.cost_sek);
  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  const costThis = sum(last30Cost);
  const costPrev = sum(prev30.map((d) => d.cost_sek));
  const costDelta = costPrev ? (costThis - costPrev) / costPrev : 0;

  const topByCost = [...PROJECTS]
    .sort((a, b) => b.ai_cost - a.ai_cost)
    .slice(0, 6);

  const stack = DAILY_PORTFOLIO.slice(-14).map((d) => ({
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
          <div className="page-eyebrow">Operations · måndag 15 maj 2026</div>
          <h1 className="page-title">
            God morgon, <em>Arvid.</em>
          </h1>
          <p className="page-sub">
            17 projekt över 9 kunder. 5 saker behöver uppmärksamhet idag.
          </p>
        </div>
        <div className="actions">
          <button className="b ghost" type="button">
            <Icons.Refresh size={14} />
            Sync now
          </button>
          <button className="b primary" type="button">
            <Icons.Plus size={14} />
            Nytt projekt
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon="Coins"
          label="Portfolio MRR"
          value={fmt.ksek(portfolio.total_mrr)}
          delta="+12,4%"
          deltaDir="up"
          hint="vs april"
          spark={last30Cost.map(
            (_, i) => portfolio.total_mrr * (0.85 + (i / 30) * 0.18),
          )}
        />
        <KpiCard
          icon="Brain"
          label="AI-kostnad denna mån"
          value={fmt.ksek(portfolio.ai_cost)}
          delta={fmt.pct(costDelta)}
          deltaDir={costDelta > 0 ? "down" : "up"}
          hint="vs april"
          spark={last30Cost}
        />
        <KpiCard
          icon="Server"
          label="Infrastruktur"
          value={fmt.ksek(portfolio.infra_cost)}
          delta="+3,1%"
          deltaDir="down"
          hint="vs april"
          spark={last30Cost.map((c, i) => c * 0.16 + Math.sin(i / 3) * 200)}
        />
        <KpiCard
          icon="Wallet"
          label="Portfolio-marginal"
          value={fmt.pct(portfolio.margin_pct)}
          delta={fmt.ksek(portfolio.margin)}
          deltaDir="up"
          hint="netto SEK/mån"
          spark={last30Cost.map(
            (c) => portfolio.total_mrr - c - portfolio.infra_cost,
          )}
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
                  const c = customerById(p.customer_id);
                  const m = modelById(p.active_model);
                  const margin =
                    p.monthly_revenue - p.ai_cost - p.infra_cost;
                  const marginPct = p.monthly_revenue
                    ? margin / p.monthly_revenue
                    : -1;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link
                          href={`/projects/${p.id}`}
                          style={{ display: "block", textDecoration: "none" }}
                        >
                          <div className="strong">{p.name}</div>
                          <div className="sub">{c?.name}</div>
                        </Link>
                      </td>
                      <td>
                        {m && (
                          <>
                            <div>
                              <ProviderChip provider={m.provider} />
                            </div>
                            <div className="sub">{m.display}</div>
                          </>
                        )}
                      </td>
                      <td className="num">{fmt.ksek(p.monthly_revenue)}</td>
                      <td className="num">{fmt.ksek(p.ai_cost)}</td>
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

        <div className="stack">
          <div className="card">
            <SectionHead
              title="Needs attention"
              sub="5 saker"
              actions={
                <button className="icon-btn" type="button">
                  <Icons.More size={14} />
                </button>
              }
            />
            <div className="stack" style={{ gap: 10 }}>
              {NEEDS_ATTENTION.map((n, i) => {
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
            </div>
          </div>

          <div className="card">
            <SectionHead title="Senaste aktivitet" />
            <div className="timeline" style={{ marginTop: 4 }}>
              {UPDATES.slice(0, 6).map((u, i) => {
                const p = projectById(u.project);
                return (
                  <div
                    key={i}
                    className={"tl-item" + (i > 2 ? " past" : "")}
                  >
                    <div className="tl-time">
                      {u.when} · {u.actor}
                    </div>
                    <div className="tl-title">{p?.name ?? "—"}</div>
                    <div className="tl-desc">{u.body}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
