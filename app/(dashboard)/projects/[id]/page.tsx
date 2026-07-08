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
import { getSessionMember, hasRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
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
import { EditProject } from "./EditProject";

export const dynamic = "force-dynamic";

// Raw project row + customer list for the edit form and GitHub-status card.
// The domain object (getProject) lacks real uuids and the github_* columns.
async function getEditData(slug: string) {
  const supabase = await createSupabaseServer();
  const [{ data: row }, { data: customers }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "name, status, customer_id, monthly_revenue_sek, monthly_infra_budget_sek, github_repo_url, github_last_commit_at, github_open_prs, hosting_provider",
      )
      .eq("slug", slug)
      .maybeSingle(),
    supabase.from("customers").select("id, name").order("name"),
  ]);
  return {
    row: row as {
      name: string;
      status: "discovery" | "building" | "live" | "paused" | "offboarded";
      customer_id: string;
      monthly_revenue_sek: number | null;
      monthly_infra_budget_sek: number | null;
      github_repo_url: string | null;
      github_last_commit_at: string | null;
      github_open_prs: number | null;
      hosting_provider: string | null;
    } | null,
    customers: (customers ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
    })),
  };
}

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getProject(id);
  if (!p) notFound();
  const [c, m, usage, deps, updates, member, editData] = await Promise.all([
    getCustomer(p.customer_id),
    p.active_model ? getModel(p.active_model) : Promise.resolve(null),
    listDailyUsageForProject(p.id),
    listDependenciesForProject(p.id),
    listUpdatesForProject(p.id),
    getSessionMember(),
    getEditData(p.slug),
  ]);
  const canEdit = hasRole(member, "editor");
  const { row } = editData;
  const hasGithubData =
    row != null &&
    (row.github_repo_url != null ||
      row.github_last_commit_at != null ||
      row.github_open_prs != null);
  const last14 = usage.slice(-14);
  const sum14 = last14.reduce((s, u) => s + u.cost_sek, 0);
  const margin = p.monthly_revenue - p.ai_cost - p.infra_cost;
  const marginPct = p.monthly_revenue ? margin / p.monthly_revenue : 0;

  const chart = usage
    .slice(-30)
    .map((u) => ({ label: fmt.dayShort(u.date), v: u.cost_sek }));

  return (
    <div className="stack">
      {canEdit && row && (
        <EditProject
          projectId={p.id}
          defaultOpen={sp.edit === "1"}
          customers={editData.customers}
          current={{
            name: row.name,
            status: row.status,
            customer_id: row.customer_id,
            monthly_revenue_sek:
              row.monthly_revenue_sek != null
                ? Number(row.monthly_revenue_sek)
                : null,
            monthly_infra_budget_sek:
              row.monthly_infra_budget_sek != null
                ? Number(row.monthly_infra_budget_sek)
                : null,
            github_repo_url: row.github_repo_url,
          }}
        />
      )}
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
                    <span key={i} className="stack-pill">
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
                <ProviderChip provider={m.provider} showLabel={false} />
                <div className="flex-1">
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

          {hasGithubData && (
            <div className="card">
              <SectionHead title="GitHub &amp; hosting" />
              <dl className="def-list" style={{ marginTop: 4 }}>
                <dt>Senaste commit</dt>
                <dd className="tnum">
                  {row.github_last_commit_at ? (
                    new Date(row.github_last_commit_at).toLocaleString(
                      "sv-SE",
                      { dateStyle: "medium", timeStyle: "short" },
                    )
                  ) : (
                    <span className="dim">—</span>
                  )}
                </dd>
                <dt>Öppna PRs</dt>
                <dd className="tnum">
                  {row.github_open_prs ?? <span className="dim">—</span>}
                </dd>
                <dt>Repo</dt>
                <dd>
                  {row.github_repo_url ? (
                    <a
                      href={row.github_repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="tnum"
                    >
                      {row.github_repo_url.replace(
                        /^https?:\/\/github\.com\//,
                        "",
                      )}
                    </a>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </dd>
                <dt>Hosting</dt>
                <dd>
                  {row.hosting_provider ?? <span className="dim">—</span>}
                </dd>
              </dl>
            </div>
          )}

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
