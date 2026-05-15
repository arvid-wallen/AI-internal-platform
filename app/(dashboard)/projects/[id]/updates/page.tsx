import { notFound } from "next/navigation";
import { UPDATES, projectById } from "@/lib/data";
import { SectionHead } from "@/components/ui";

export default async function ProjectUpdatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = projectById(id);
  if (!p) notFound();
  const list = UPDATES.filter((u) => u.project === p.id);
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
