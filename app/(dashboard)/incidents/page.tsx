import Link from "next/link";
import { listIncidents, listProjects } from "@/lib/db";
import { SectionHead, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const [incidents, projects] = await Promise.all([
    listIncidents(),
    listProjects(),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const ongoing = incidents.filter((i) => !i.resolved);
  const resolved = incidents.filter((i) => i.resolved);

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Core</div>
          <h1 className="page-title">Incidents</h1>
          <p className="page-sub">
            {ongoing.length} pågående · {resolved.length} lösta senaste 30 dagarna.
          </p>
        </div>
      </div>

      {ongoing.length > 0 && (
        <div className="card flush mb-2">
          <div style={{ padding: "16px 18px 0" }}>
            <SectionHead title="Pågående" count={ongoing.length} />
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>När</th>
                <th>Projekt</th>
                <th>Severity</th>
                <th>Beskrivning</th>
              </tr>
            </thead>
            <tbody>
              {ongoing.map((i) => {
                const p = projectById.get(i.project_id);
                return (
                  <tr key={i.id} className="no-hover">
                    <td className="tnum">{i.id}</td>
                    <td className="tnum">{i.when}</td>
                    <td>
                      {p && (
                        <Link href={`/projects/${p.id}`}>{p.name}</Link>
                      )}
                    </td>
                    <td>
                      <StatusPill status={i.severity} />
                    </td>
                    <td>
                      <div className="strong">{i.title}</div>
                      <div className="sub">{i.summary}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card flush">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead title="Lösta" count={resolved.length} />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>När</th>
              <th>Projekt</th>
              <th>Severity</th>
              <th>Titel</th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((i) => {
              const p = projectById.get(i.project_id);
              return (
                <tr key={i.id} className="no-hover">
                  <td className="tnum">{i.id}</td>
                  <td className="tnum">{i.when}</td>
                  <td>
                    {p && <Link href={`/projects/${p.id}`}>{p.name}</Link>}
                  </td>
                  <td>
                    <StatusPill status={i.severity} />
                  </td>
                  <td>{i.title}</td>
                </tr>
              );
            })}
            {resolved.length === 0 && (
              <tr className="no-hover">
                <td colSpan={5} className="empty">
                  Inga incidenter registrerade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
