import { listCustomers, listModels, listProjects } from "@/lib/db";
import { Icons } from "@/components/icons";
import { ProjectsFilter } from "./filter";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, customers, models] = await Promise.all([
    listProjects(),
    listCustomers(),
    listModels(),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const modelById = new Map(models.map((m) => [m.id, m]));

  const rows = projects.map((p) => {
    const c = customerById.get(p.customer_id);
    const m = modelById.get(p.active_model);
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
