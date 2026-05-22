import { listGlobalNotes } from "@/lib/db";
import { Pill, SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  const global = await listGlobalNotes();
  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Admin</div>
          <h1 className="page-title">Wiki &amp; Ideas</h1>
          <p className="page-sub">
            Process, idéer och delade anteckningar för hela Haus AI-teamet.
          </p>
        </div>
      </div>
      <div className="stack">
        {global.map((n) => (
          <div key={n.id} className="card">
            <SectionHead
              title={n.title}
              sub={`${n.when} · ${n.author}`}
              actions={
                <Pill kind="ok" dot={false}>
                  {n.tag}
                </Pill>
              }
            />
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{n.body}</div>
          </div>
        ))}
        {global.length === 0 && (
          <div className="empty card">Inga delade anteckningar ännu.</div>
        )}
      </div>
    </div>
  );
}
