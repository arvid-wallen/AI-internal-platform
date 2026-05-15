import Link from "next/link";
import { MODELS, PROJECTS } from "@/lib/data";
import { Icons } from "@/components/icons";
import { ProviderChip, SectionHead } from "@/components/ui";
import { fmt } from "@/lib/format";

export default function ModelsPage() {
  const usageByModel = new Map<string, number>();
  for (const p of PROJECTS) {
    usageByModel.set(
      p.active_model,
      (usageByModel.get(p.active_model) ?? 0) + 1,
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Core</div>
          <h1 className="page-title">Models</h1>
          <p className="page-sub">
            {MODELS.length} modeller registrerade · {MODELS.filter(
              (m) => m.is_current,
            ).length}{" "}
            aktuella.
          </p>
        </div>
        <div className="actions">
          <button className="b primary" type="button">
            <Icons.Plus size={14} />
            Lägg till modell
          </button>
        </div>
      </div>
      <div className="card flush">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead title="Modellkatalog" />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Modell</th>
              <th>Provider</th>
              <th>Status</th>
              <th className="num">Context</th>
              <th className="num">$/Mtok in</th>
              <th className="num">$/Mtok ut</th>
              <th>Släppt</th>
              <th>Projekt</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => (
              <tr key={m.id} className="no-hover">
                <td>
                  <div className="strong">{m.display}</div>
                  <div className="tnum dim" style={{ fontSize: 11.5 }}>
                    {m.id}
                  </div>
                </td>
                <td>
                  <ProviderChip provider={m.provider} />
                </td>
                <td>
                  {m.is_current ? (
                    <span className="pill live">Aktuell</span>
                  ) : (
                    <span className="pill paused">Deprecerad</span>
                  )}
                </td>
                <td className="num">{fmt.tokens(m.ctx)}</td>
                <td className="num tnum">${m.price_in.toFixed(2)}</td>
                <td className="num tnum">${m.price_out.toFixed(2)}</td>
                <td className="tnum">{fmt.date(m.released)}</td>
                <td className="tnum">{usageByModel.get(m.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
