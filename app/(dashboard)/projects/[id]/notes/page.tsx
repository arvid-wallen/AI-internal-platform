import { notFound } from "next/navigation";
import { NOTES, projectById } from "@/lib/data";
import { Icons } from "@/components/icons";
import { Pill } from "@/components/ui";

export default async function ProjectNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = projectById(id);
  if (!p) notFound();
  const list = NOTES.filter((n) => n.parent === p.id);
  return (
    <div className="stack">
      <div className="card">
        <div className="row gap-2">
          <input className="inp" placeholder="Skriv en anteckning…" />
          <button className="b primary" type="button">
            <Icons.Plus size={12} />
            Spara
          </button>
        </div>
      </div>
      {list.map((n) => (
        <div key={n.id} className="card">
          <div className="row between">
            <div className="strong">{n.title}</div>
            <div
              className="dim"
              style={{
                fontSize: 11.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {n.when} · {n.author}
            </div>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>
            {n.body}
          </div>
          <div className="mt-3">
            <Pill kind="ok" dot={false}>
              {n.tag}
            </Pill>
          </div>
        </div>
      ))}
      {list.length === 0 && (
        <div className="empty card">Inga anteckningar — skriv den första.</div>
      )}
    </div>
  );
}
