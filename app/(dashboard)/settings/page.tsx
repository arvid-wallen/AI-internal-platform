import { listIntegrations, listSyncRuns, listTeam } from "@/lib/db";
import { getMappingData } from "@/lib/actions/workspace-map";
import { getSessionMember, hasRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Icons } from "@/components/icons";
import { Pill, SectionHead, StatusPill } from "@/components/ui";
import { FortnoxConnect } from "./FortnoxConnect";
import { WorkspaceMapping } from "./WorkspaceMapping";
import {
  ProjectCustomerMapping,
  type CustomerOption,
  type UnassignedProject,
} from "./ProjectCustomerMapping";

export const dynamic = "force-dynamic";

// Fortnox connection state. integrations_credentials is admin-only by RLS,
// so non-admins simply read null here — the card then shows a neutral text.
async function getFortnoxStatus() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("integrations_credentials")
    .select("access_token, token_expires_at, last_synced_at")
    .eq("provider_slug", "fortnox")
    .maybeSingle();
  return {
    connected: !!data?.access_token,
    tokenExpiresAt: (data?.token_expires_at as string | null) ?? null,
    lastSyncedAt: (data?.last_synced_at as string | null) ?? null,
  };
}

// Projects still owned by the placeholder customer + all real customers.
// Needs real uuids (assignProjectCustomers updates by id), so query directly.
async function getUnassignedProjects(): Promise<{
  projects: UnassignedProject[];
  customers: CustomerOption[];
}> {
  const supabase = await createSupabaseServer();
  const [{ data: projects }, { data: customers }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, slug, customer:customers!inner(slug)")
      .eq("customer.slug", "unassigned")
      .order("name"),
    supabase
      .from("customers")
      .select("id, name, slug")
      .neq("slug", "unassigned")
      .order("name"),
  ]);
  return {
    projects: (projects ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      slug: p.slug as string,
    })),
    customers: (customers ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
    })),
  };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ fortnox?: string; reason?: string }>;
}) {
  const [
    integrations,
    syncRuns,
    team,
    mapping,
    member,
    fortnox,
    unassigned,
    params,
  ] = await Promise.all([
    listIntegrations(),
    listSyncRuns(),
    listTeam(),
    getMappingData(),
    getSessionMember(),
    getFortnoxStatus(),
    getUnassignedProjects(),
    searchParams,
  ]);
  const isAdmin = hasRole(member, "admin");
  const canEdit = hasRole(member, "editor");
  const fortnoxQuery =
    params.fortnox === "connected" || params.fortnox === "error"
      ? params.fortnox
      : null;

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Admin</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Integrationer, team och konfiguration för Operations Hub.
          </p>
        </div>
      </div>

      <div className="grid-12">
        <div className="stack">
          {canEdit && (
            <ProjectCustomerMapping
              projects={unassigned.projects}
              customers={unassigned.customers}
            />
          )}
          <FortnoxConnect
            isAdmin={isAdmin}
            connected={fortnox.connected}
            tokenExpiresAt={fortnox.tokenExpiresAt}
            lastSyncedAt={fortnox.lastSyncedAt}
            queryStatus={fortnoxQuery}
            queryReason={params.reason ?? null}
          />
          <div className="card">
            <SectionHead
              title="Integrationer"
              sub={`${integrations.length} konfigurerade · dagliga syncs via Vercel Cron`}
            />
            <div className="set-list">
              {integrations.map((it) => (
                <div key={it.id} className="set-row">
                  <div className="ic-wrap">
                    <Icons.Server size={16} />
                  </div>
                  <div className="info">
                    <div className="name">{it.name}</div>
                    <div className="desc">{it.desc}</div>
                  </div>
                  <div className="right">
                    <StatusPill status={it.status} />
                    <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                      sync {it.last_sync}
                    </div>
                  </div>
                </div>
              ))}
              {integrations.length === 0 && (
                <div className="empty" style={{ padding: 14 }}>
                  Inga integrationer konfigurerade.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <SectionHead title="Senaste sync runs" />
            <table className="tbl">
              <thead>
                <tr>
                  <th>När</th>
                  <th>Integration</th>
                  <th>Status</th>
                  <th className="num">Rader</th>
                  <th className="num">Took</th>
                </tr>
              </thead>
              <tbody>
                {syncRuns.map((r) => (
                  <tr key={r.id} className="no-hover">
                    <td className="tnum">{r.at}</td>
                    <td>{r.integration}</td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td className="num">{r.records}</td>
                    <td className="tnum num">{r.took}</td>
                  </tr>
                ))}
                {syncRuns.length === 0 && (
                  <tr className="no-hover">
                    <td colSpan={5} className="empty">
                      Inga sync runs ännu.
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
              title="Team"
              sub={`${team.length} medlemmar · @haus.se`}
            />
            <div className="set-list">
              {team.map((u) => (
                <div key={u.id} className="set-row">
                  <div className={`avatar lg ${u.color}`}>{u.initials}</div>
                  <div className="info">
                    <div className="name">{u.name}</div>
                    <div className="desc">{u.email}</div>
                  </div>
                  <div className="right">
                    <Pill
                      kind={u.role === "admin" ? "live" : u.role === "editor" ? "sent" : "paused"}
                    >
                      {u.role}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mapping.configured && isAdmin && (
            <>
              <WorkspaceMapping
                provider="anthropic"
                label="Anthropic workspace-mappning"
                idLabel="workspace_id"
                projects={mapping.projects}
                initialMap={mapping.anthropicMap}
              />
              <WorkspaceMapping
                provider="openai"
                label="OpenAI project-mappning"
                idLabel="project_id"
                projects={mapping.projects}
                initialMap={mapping.openaiMap}
              />
              <WorkspaceMapping
                provider="sentry"
                label="Sentry project-mappning"
                idLabel="sentry project slug"
                projects={mapping.projects}
                initialMap={mapping.sentryMap}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
