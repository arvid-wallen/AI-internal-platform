import { notFound } from "next/navigation";
import { depsFor, projectById } from "@/lib/data";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import { Pill, SectionHead } from "@/components/ui";

export default async function ProjectDepsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = projectById(id);
  if (!p) notFound();
  const deps = depsFor(p.id);
  const total = deps.reduce((s, d) => s + d.monthly_sek, 0);

  return (
    <div className="stack">
      <div className="card flush">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead
            title="Externa beroenden"
            sub={`${deps.length} system · ${fmt.ksek(total)}/mån totalt`}
            actions={
              <button className="b sm primary" type="button">
                <Icons.Plus size={12} />
                Nytt beroende
              </button>
            }
          />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tjänst</th>
              <th>Vendor</th>
              <th>Kategori</th>
              <th>Kritisk</th>
              <th className="num">SEK/mån</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deps.map((d) => (
              <tr key={d.name} className="no-hover">
                <td className="strong">{d.name}</td>
                <td>{d.vendor}</td>
                <td className="tnum dim" style={{ fontSize: 12 }}>
                  {d.category}
                </td>
                <td>
                  {d.critical ? (
                    <Pill kind="critical">Ja</Pill>
                  ) : (
                    <span className="dim">nej</span>
                  )}
                </td>
                <td className="num">{fmt.ksek(d.monthly_sek)}</td>
                <td>
                  <button className="icon-btn" type="button">
                    <Icons.More size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {deps.length === 0 && (
              <tr className="no-hover">
                <td colSpan={6} className="empty">
                  Inga registrerade beroenden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
