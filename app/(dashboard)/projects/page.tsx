import { PROJECTS, customerById, modelById } from "@/lib/data";
import { Icons } from "@/components/icons";
import { ProjectsFilter } from "./filter";

export default function ProjectsPage() {
  const rows = PROJECTS.map((p) => {
    const c = customerById(p.customer_id);
    const m = modelById(p.active_model);
    return {
      id: p.id,
      name: p.name,
      customer_name: c?.name ?? "",
      status: p.status,
      stack: p.stack,
      owner: p.owner,
      monthly_revenue: p.monthly_revenue,
      ai_cost: p.ai_cost,
      infra_cost: p.infra_cost,
      model_provider: m?.provider ?? "anthropic",
      model_display: m?.display ?? "",
    };
  });

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Core</div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">
            17 projekt · 12 live · 2 bygger · 2 discovery · 1 pausad.
          </p>
        </div>
        <div className="actions">
          <button className="b" type="button">
            <Icons.Download size={14} />
            Export CSV
          </button>
          <button className="b primary" type="button">
            <Icons.Plus size={14} />
            Nytt projekt
          </button>
        </div>
      </div>
      <ProjectsFilter rows={rows} />
    </div>
  );
}
