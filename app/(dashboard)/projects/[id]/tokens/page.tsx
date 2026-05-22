import { notFound } from "next/navigation";
import { getProject, listDailyUsageForProject, listModels } from "@/lib/db";
import { fmt } from "@/lib/format";
import { KpiCard, SectionHead } from "@/components/ui";
import { LineChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ProjectTokensPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const [usage, models] = await Promise.all([
    listDailyUsageForProject(p.id),
    listModels(),
  ]);
  const modelById = new Map(models.map((m) => [m.id, m]));
  const lineCost = usage
    .slice(-30)
    .map((u) => ({ label: fmt.dayShort(u.date), v: u.cost_sek }));
  const lineToks = usage
    .slice(-30)
    .map((u) => ({
      label: fmt.dayShort(u.date),
      v: u.tokens_in + u.tokens_out,
    }));
  const totalCost = usage.reduce((s, u) => s + u.cost_sek, 0);
  const totalIn = usage.reduce((s, u) => s + u.tokens_in, 0);
  const totalOut = usage.reduce((s, u) => s + u.tokens_out, 0);

  return (
    <div className="stack">
      <div className="kpi-grid">
        <KpiCard icon="Coins" label="AI 60d totalt" value={fmt.ksek(totalCost)} />
        <KpiCard icon="Bolt" label="Tokens in 60d" value={fmt.tokens(totalIn)} />
        <KpiCard icon="Bolt" label="Tokens ut 60d" value={fmt.tokens(totalOut)} />
        <KpiCard
          icon="Sparkles"
          label="Snitt/dag"
          value={fmt.ksek(totalCost / Math.max(1, usage.length))}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <SectionHead
            title="Kostnad per dag"
            sub="Senaste 30 dgr · SEK"
          />
          <LineChart data={lineCost} format="ksek" />
        </div>
        <div className="card">
          <SectionHead title="Tokens per dag" sub="In + ut" />
          <LineChart
            data={lineToks}
            format="tokens"
            color="var(--c-sky-ink)"
          />
        </div>
      </div>

      <div className="card flush">
        <div style={{ padding: "16px 18px 0" }}>
          <SectionHead
            title="Råa dagsrader"
            sub="token_usage_daily — senaste 14 dgr"
          />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Modell</th>
              <th className="num">Tokens in</th>
              <th className="num">Tokens ut</th>
              <th className="num">Kostnad USD</th>
              <th className="num">Kostnad SEK</th>
              <th>Source workspace</th>
            </tr>
          </thead>
          <tbody>
            {usage
              .slice(-14)
              .reverse()
              .map((u, i) => {
                const mo = modelById.get(u.model_id);
                return (
                  <tr key={i} className="no-hover">
                    <td className="tnum">{u.date}</td>
                    <td>
                      <div className="row">
                        {mo && (
                          <>
                            <span
                              className={"pdot " + mo.provider}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                marginRight: 6,
                              }}
                            ></span>
                            {mo.display}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="num">{fmt.tokens(u.tokens_in)}</td>
                    <td className="num">{fmt.tokens(u.tokens_out)}</td>
                    <td className="num">{fmt.usd(u.cost_usd)}</td>
                    <td className="num strong">{fmt.ksek(u.cost_sek)}</td>
                    <td
                      className="tnum dim"
                      style={{ fontSize: 11.5 }}
                    >
                      ws_{p.slug.slice(0, 6)}_{mo?.provider.slice(0, 3) ?? ""}
                    </td>
                  </tr>
                );
              })}
            {usage.length === 0 && (
              <tr className="no-hover">
                <td colSpan={7} className="empty">
                  Ingen token-användning registrerad ännu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
