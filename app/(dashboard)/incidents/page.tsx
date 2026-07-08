import Link from "next/link";
import { listIncidents, listProjects } from "@/lib/db";
import { getSessionMember, hasRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SectionHead, StatusPill } from "@/components/ui";
import { NewIncident } from "./NewIncident";
import { ResolveIncident } from "./ResolveIncident";

export const dynamic = "force-dynamic";

// Ongoing incidents with their real uuid — resolveIncident updates by id,
// and the domain Incident.id is the ref string, so query directly.
interface OngoingIncident {
  id: string; // real uuid
  ref: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  summary: string;
  when: string;
  projectSlug: string | null;
  projectName: string | null;
}

async function listOngoingIncidents(): Promise<OngoingIncident[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("incidents")
    .select(
      "id, ref, severity, title, summary, occurred_at, project:projects(slug, name)",
    )
    .is("resolved_at", null)
    .order("occurred_at", { ascending: false });
  return (
    (data ?? []) as unknown as Array<{
      id: string;
      ref: string;
      severity: OngoingIncident["severity"] | null;
      title: string;
      summary: string | null;
      occurred_at: string;
      project?:
        | { slug?: string | null; name?: string | null }
        | Array<{ slug?: string | null; name?: string | null }>
        | null;
    }>
  ).map((r) => {
    const proj = Array.isArray(r.project) ? r.project[0] : r.project;
    return {
      id: r.id,
      ref: r.ref,
      severity: r.severity ?? "low",
      title: r.title,
      summary: r.summary ?? "",
      when: (r.occurred_at ?? "").slice(0, 16).replace("T", " "),
      projectSlug: proj?.slug ?? null,
      projectName: proj?.name ?? null,
    };
  });
}

export default async function IncidentsPage() {
  const [incidents, projects, ongoing, member] = await Promise.all([
    listIncidents(),
    listProjects(),
    listOngoingIncidents(),
    getSessionMember(),
  ]);
  const canEdit = hasRole(member, "editor");
  const projectById = new Map(projects.map((p) => [p.id, p]));
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

      {canEdit && (
        <NewIncident
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}

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
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {ongoing.map((i) => (
                <tr key={i.id} className="no-hover">
                  <td className="tnum">{i.ref}</td>
                  <td className="tnum">{i.when}</td>
                  <td>
                    {i.projectSlug && (
                      <Link href={`/projects/p-${i.projectSlug}`}>
                        {i.projectName}
                      </Link>
                    )}
                  </td>
                  <td>
                    <StatusPill status={i.severity} />
                  </td>
                  <td>
                    <div className="strong">{i.title}</div>
                    <div className="sub">{i.summary}</div>
                  </td>
                  {canEdit && (
                    <td>
                      <ResolveIncident incidentId={i.id} />
                    </td>
                  )}
                </tr>
              ))}
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
