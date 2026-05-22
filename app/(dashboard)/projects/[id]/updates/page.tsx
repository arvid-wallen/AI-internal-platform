import { notFound } from "next/navigation";
import { getProject, listUpdatesForProject } from "@/lib/db";
import { SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectUpdatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const list = await listUpdatesForProject(p.id);
  return (
    <div className="card">
      <SectionHead title="Updates" sub={`${list.length} händelser`} />
      <div className="timeline">
        {list.map((u, i) => (
          <div key={i} className={"tl-item" + (i > 1 ? " past" : "")}>
            <div className="tl-time">
              {u.when} · {u.actor} · {u.kind}
            </div>
            <div className="tl-title">{u.body}</div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="empty">Inga händelser ännu.</div>
        )}
      </div>
    </div>
  );
}
