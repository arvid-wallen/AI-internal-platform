import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Refreshes USD→SEK and EUR→SEK from Riksbanken (free, no auth).
// Series: SEKUSDPMI (USD), SEKEURPMI (EUR).
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("riksbanken");

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const since = new Date(today);
    since.setUTCDate(today.getUTCDate() - 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const series = [
      { id: "SEKUSDPMI", key: "usd_sek" as const },
      { id: "SEKEURPMI", key: "eur_sek" as const },
    ];

    const byDate = new Map<string, { usd_sek?: number; eur_sek?: number }>();
    for (const s of series) {
      const url = `https://api.riksbank.se/swea/v1/Observations/${s.id}/${fmt(since)}/${fmt(today)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Riksbanken ${s.id} ${res.status}`);
      const obs = (await res.json()) as Array<{ date: string; value: number }>;
      for (const o of obs) {
        const row = byDate.get(o.date) ?? {};
        row[s.key] = o.value;
        byDate.set(o.date, row);
      }
    }

    const supabase = createSupabaseAdmin();
    const rows = [...byDate.entries()].map(([date, v]) => ({
      date,
      usd_sek: v.usd_sek ?? null,
      eur_sek: v.eur_sek ?? null,
      source: "riksbanken",
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("fx_rates").upsert(rows, {
        onConflict: "date",
      });
      if (error) throw error;
    }

    await finishSyncRun(run?.id ?? null, "ok", { records: rows.length });
    return jsonOk({ days: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncRun(run?.id ?? null, "failed", { error: msg });
    return jsonError(msg);
  }
}
