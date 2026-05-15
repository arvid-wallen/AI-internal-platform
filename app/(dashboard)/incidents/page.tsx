import Link from "next/link";
import { INCIDENTS, projectById } from "@/lib/data";
import { Pill, SectionHead, StatusPill } from "@/components/ui";

export default function IncidentsPage() {
  const ongoing = INCIDENTS.filter((i) => !i.resolved);
  const resolved = INCIDENTS.filter((i) => i.resolved);

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
                const p = projectById(i.project_id);
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
                      <Pill kind={i.severity === "high" ? "critical" : i.severity === "medium" ? "warn" : "ok"}>
                        {i.severity}
                      </Pill>
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
              const p = projectById(i.project_id);
              return (
                <tr key={i.id} className="no-hover">
                  <td className="tnum">{i.id}</td>
                  <td className="tnum">{i.when}</td>
                  <td>
                    {p && <Link href={`/projects/${p.id}`}>{p.name}</Link>}
                  </td>
                  <td>
                    <StatusPill status="paid" />
                  </td>
                  <td>{i.title}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
