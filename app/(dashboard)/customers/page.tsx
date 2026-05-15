import Link from "next/link";
import { CUSTOMERS, projectsByCustomer } from "@/lib/data";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import { ClassPill, StatusPill } from "@/components/ui";
import { CustomersFilter } from "./filter";

export default function CustomersPage() {
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
        customers={CUSTOMERS.map((c) => {
          const ps = projectsByCustomer(c.id);
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
            project_count: ps.length,
            live_count: ps.filter((p) => p.status === "live").length,
          };
        })}
      />
    </div>
  );
}
