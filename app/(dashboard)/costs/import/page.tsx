import { getImportContext } from "@/lib/actions/card-costs";
import { ImportClient } from "./ImportClient";
import { ManualCostForm } from "./ManualCostForm";

export const dynamic = "force-dynamic";

export default async function CostImportPage() {
  const ctx = await getImportContext();

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Finance</div>
          <h1 className="page-title">Importera kortkostnader</h1>
          <p className="page-sub">
            Ladda upp månadens kort-CSV, granska klassningen och spara
            mjukvarukostnaderna.
          </p>
        </div>
      </div>

      {!ctx.configured ? (
        <div className="card">
          <div className="empty" style={{ padding: 16 }}>
            Supabase måste vara konfigurerat för import.
          </div>
        </div>
      ) : (
        <div className="stack">
          <ImportClient projects={ctx.projects} />
          <ManualCostForm projects={ctx.projects} />
        </div>
      )}
    </div>
  );
}
