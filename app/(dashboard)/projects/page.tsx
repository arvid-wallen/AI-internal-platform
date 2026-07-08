import { listCustomers, listModels, listProjects } from "@/lib/db";
import { getSessionMember, hasRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ExportButton } from "@/components/ExportButton";
import { ProjectsFilter } from "./filter";
import { NewProject, type ProjectCustomerOption } from "./NewProject";

export const dynamic = "force-dynamic";

// createProject needs real customer uuids; the domain Customer.id is a slug.
async function listCustomerOptions(): Promise<ProjectCustomerOption[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("customers")
    .select("id, name, slug")
    .neq("slug", "unassigned")
    .order("name");
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));
}

export default async function ProjectsPage() {
  const [projects, customers, models, member, customerOptions] =
    await Promise.all([
      listProjects(),
      listCustomers(),
      listModels(),
      getSessionMember(),
      listCustomerOptions(),
    ]);
  const canEdit = hasRole(member, "editor");
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
            {projects.length} projekt ·{" "}
            {projects.filter((p) => p.status === "live").length} live ·{" "}
            {projects.filter((p) => p.status === "building").length} bygger ·{" "}
            {projects.filter((p) => p.status === "discovery").length} discovery ·{" "}
            {projects.filter((p) => p.status === "paused").length} pausad.
          </p>
        </div>
        <div className="actions">
          <ExportButton
            filename="projekt.csv"
            rows={[
              [
                "Projekt",
                "Kund",
                "Status",
                "Intäkt (kr)",
                "AI-kostnad (kr)",
                "Infra (kr)",
                "Ägare",
              ],
              ...rows.map((r) => [
                r.name,
                r.customer_name,
                r.status,
                r.monthly_revenue,
                r.ai_cost,
                r.infra_cost,
                r.owner,
              ]),
            ]}
          />
          {canEdit && <NewProject customers={customerOptions} />}
        </div>
      </div>
      <ProjectsFilter rows={rows} />
    </div>
  );
}
