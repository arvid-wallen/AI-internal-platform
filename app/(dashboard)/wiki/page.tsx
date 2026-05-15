import { NOTES } from "@/lib/data";
import { Pill, SectionHead } from "@/components/ui";

export default function WikiPage() {
  const global = NOTES.filter((n) => n.parent === "global");
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
      </div>
    </div>
  );
}
