import { listCustomers, listProjects } from "@/lib/db";
import { Icons } from "@/components/icons";
import { CustomersFilter } from "./filter";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, projects] = await Promise.all([
    listCustomers(),
    listProjects(),
  ]);

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
            9 kunder · 17 aktiva engagemang · 1,965M kr MRR portfölj.
          </p>
        </div>
        <div className="actions">
          <button className="b" type="button">
            <Icons.Download size={14} />
            Export CSV
          </button>
          <button className="b primary" type="button">
            <Icons.Plus size={14} />
            Ny kund
          </button>
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
