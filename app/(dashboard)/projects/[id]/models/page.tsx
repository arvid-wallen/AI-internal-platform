import { notFound } from "next/navigation";
import {
  MODELS,
  modelById,
  modelHistoryFor,
  projectById,
} from "@/lib/data";
import { ProjectModelsClient } from "./client";

export default async function ProjectModelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = projectById(id);
  if (!p) notFound();
  const history = modelHistoryFor(p.id);
  return (
    <ProjectModelsClient
      projectId={p.id}
      projectSlug={p.slug}
      activeModelId={p.active_model}
      models={MODELS}
      history={history.map((h) => ({
        ...h,
        model_display: modelById(h.model_id)?.display ?? h.model_id,
      }))}
    />
  );
}
