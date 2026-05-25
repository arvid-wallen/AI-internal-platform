import { listIntegrations, listSyncRuns, listTeam } from "@/lib/db";
import { getMappingData } from "@/lib/actions/workspace-map";
import { Icons } from "@/components/icons";
import { Pill, SectionHead, StatusPill } from "@/components/ui";
import { WorkspaceMapping } from "./WorkspaceMapping";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [integrations, syncRuns, team, mapping] = await Promise.all([
    listIntegrations(),
    listSyncRuns(),
    listTeam(),
    getMappingData(),
  ]);

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

          {mapping.configured && (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
