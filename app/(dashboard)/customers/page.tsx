import { getPortfolio, listCustomers, listProjects } from "@/lib/db";
import { getSessionMember, hasRole } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { ExportButton } from "@/components/ExportButton";
import { CustomersFilter } from "./filter";
import { NewCustomer } from "./NewCustomer";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, projects, portfolio, member] = await Promise.all([
    listCustomers(),
    listProjects(),
    getPortfolio(),
    getSessionMember(),
  ]);
  const canEdit = hasRole(member, "editor");

  const counts = new Map<string, { total: number; live: number }>();
  for (const p of projects) {
    const e = counts.get(p.customer_id) ?? { total: 0, live: 0 };
    e.total += 1;
    if (p.status === "live") e.live += 1;
    counts.set(p.customer_id, e);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Core</div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">
            {customers.length} kunder · {projects.length} engagemang ·{" "}
            {fmt.ksek(portfolio.total_mrr)} MRR portfölj.
          </p>
        </div>
        <div className="actions">
          <ExportButton
            filename="kunder.csv"
            rows={[
              [
                "Kund",
                "Org.nr",
                "Klass",
                "Account Manager",
                "Kontrakt",
                "MRR (kr)",
              ],
              ...customers.map((c) => [
                c.name,
                c.org_number,
                c.cls,
                c.am,
                c.contract,
                c.mrr,
              ]),
            ]}
          />
          {canEdit && <NewCustomer />}
        </div>
      </div>

      <CustomersFilter
        customers={customers.map((c) => {
          const e = counts.get(c.id) ?? { total: 0, live: 0 };
          return {
            id: c.id,
            name: c.name,
            org_number: c.org_number,
            cls: c.cls,
            am: c.am,
            contract: c.contract,
            mrr: c.mrr,
            mark: c.mark,
            init: c.init,
            project_count: e.total,
            live_count: e.live,
          };
        })}
      />
    </div>
  );
}
