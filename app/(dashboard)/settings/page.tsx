import { INTEGRATIONS, SYNC_RUNS, TEAM } from "@/lib/data";
import { Icons } from "@/components/icons";
import { Pill, SectionHead, StatusPill } from "@/components/ui";

export default function SettingsPage() {
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
              sub={`${INTEGRATIONS.length} konfigurerade · dagliga syncs via Vercel Cron`}
            />
            <div className="set-list">
              {INTEGRATIONS.map((it) => (
                <div key={it.id} className="set-row">
                  <div className="ic-wrap">
                    <Icons.Server size={16} />
                  </div>
                  <div className="info">
                    <div className="name">{it.name}</div>
                    <div className="desc">{it.desc}</div>
                  </div>
                  <div className="right">
                    <Pill
                      kind={
                        it.status === "ok"
                          ? "ok"
                          : it.status === "warn"
                            ? "warn"
                            : "fail"
                      }
                    >
                      {it.status}
                    </Pill>
                    <div
                      className="dim"
                      style={{ fontSize: 11, marginTop: 4 }}
                    >
                      sync {it.last_sync}
                    </div>
                  </div>
                </div>
              ))}
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
                {SYNC_RUNS.map((r) => (
                  <tr key={r.id} className="no-hover">
                    <td className="tnum">{r.at}</td>
                    <td>{r.integration}</td>
                    <td>
                      <Pill
                        kind={
                          r.status === "ok"
                            ? "ok"
                            : r.status === "warn"
                              ? "warn"
                              : "fail"
                        }
                      >
                        {r.status}
                      </Pill>
                    </td>
                    <td className="num">{r.records}</td>
                    <td className="tnum num">{r.took}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <SectionHead
              title="Team"
              sub={`${TEAM.length} medlemmar · @haus.se`}
            />
            <div className="set-list">
              {TEAM.map((u) => (
                <div key={u.id} className="set-row">
                  <div
                    className={"avatar"}
                    style={{
                      background: `var(--c-${u.color})`,
                      color: `var(--c-${u.color}-ink)`,
                      width: 32,
                      height: 32,
                      fontSize: 12,
                    }}
                  >
                    {u.initials}
                  </div>
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
        </div>
      </div>
    </div>
  );
}
