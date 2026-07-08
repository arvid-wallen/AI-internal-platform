import { listGlobalNotes } from "@/lib/db";
import { getSessionMember, hasRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { NoteForm } from "@/components/NoteForm";
import { Pill, SectionHead } from "@/components/ui";
import { PinToggle } from "./PinToggle";

export const dynamic = "force-dynamic";

// The domain Note lacks the pinned flag; fetch id → pinned separately.
async function getPinnedMap(): Promise<Map<string, boolean>> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("notes")
    .select("id, pinned")
    .eq("parent_type", "global");
  return new Map(
    (data ?? []).map((r) => [r.id as string, !!r.pinned]),
  );
}

export default async function WikiPage() {
  const [global, member, pinnedById] = await Promise.all([
    listGlobalNotes(),
    getSessionMember(),
    getPinnedMap(),
  ]);
  const canEdit = hasRole(member, "editor");
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
        {canEdit && <NoteForm parentType="global" parentId={null} />}
        {global.map((n) => (
          <div key={n.id} className="card">
            <SectionHead
              title={n.title}
              sub={`${n.when} · ${n.author}`}
              actions={
                <>
                  {pinnedById.get(n.id) && (
                    <Pill kind="sent" dot={false}>
                      Fäst
                    </Pill>
                  )}
                  <Pill kind="ok" dot={false}>
                    {n.tag}
                  </Pill>
                  {canEdit && (
                    <PinToggle
                      noteId={n.id}
                      pinned={pinnedById.get(n.id) ?? false}
                    />
                  )}
                </>
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
