import { notFound } from "next/navigation";
import { getProject } from "@/lib/db";
import { getSessionMember, hasRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  DependenciesClient,
  type DependencyRow,
} from "./DependenciesClient";

export const dynamic = "force-dynamic";

// listDependenciesForProject drops the row uuid, which deleteDependency
// needs — query directly instead.
async function listDependencyRows(slug: string): Promise<DependencyRow[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("dependencies")
    .select(
      "id, name, vendor, type, monthly_cost_sek, is_critical, project:projects!inner(slug)",
    )
    .eq("project.slug", slug)
    .order("name");
  return (
    (data ?? []) as unknown as Array<{
      id: string;
      name: string;
      vendor: string | null;
      type: string | null;
      monthly_cost_sek: number | null;
      is_critical: boolean;
    }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    vendor: r.vendor ?? "",
    category: r.type ?? "other",
    monthly_sek: Number(r.monthly_cost_sek ?? 0),
    critical: r.is_critical,
  }));
}

export default async function ProjectDepsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const [deps, member] = await Promise.all([
    listDependencyRows(p.slug),
    getSessionMember(),
  ]);
  const canEdit = hasRole(member, "editor");

  return (
    <div className="stack">
      <DependenciesClient projectId={p.id} deps={deps} canEdit={canEdit} />
    </div>
  );
}
