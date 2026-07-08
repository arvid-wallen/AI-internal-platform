import { notFound } from "next/navigation";
import {
  getProject,
  listModels,
  listModelSwitchesForProject,
} from "@/lib/db";
import { getSessionMember, hasRole } from "@/lib/auth";
import { ProjectModelsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ProjectModelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const [models, history, member] = await Promise.all([
    listModels(),
    listModelSwitchesForProject(p.id),
    getSessionMember(),
  ]);
  const modelById = new Map(models.map((m) => [m.id, m]));
  return (
    <ProjectModelsClient
      projectId={p.id}
      projectSlug={p.slug}
      activeModelId={p.active_model}
      models={models}
      canEdit={hasRole(member, "editor")}
      canRotate={hasRole(member, "admin")}
      history={history.map((h) => ({
        ...h,
        model_display: modelById.get(h.model_id)?.display ?? h.model_id,
      }))}
    />
  );
}
