// Latest FX rate with staleness signal. Replaces the hardcoded `?? 10.78`
// fallback that silently converted at a stale constant when refresh-fx broke.
import type { createSupabaseAdmin } from "@/lib/supabase/server";

export interface LatestFx {
  usdSek: number;
  date: string; // YYYY-MM-DD
  stale: boolean; // older than 5 days — refresh-fx has stopped working
}

export function isFxStale(dateIso: string, now: Date = new Date()): boolean {
  const age = now.getTime() - Date.parse(dateIso);
  return !Number.isFinite(age) || age > 5 * 24 * 3600 * 1000;
}

export async function getLatestUsdSek(
  supabase: ReturnType<typeof createSupabaseAdmin>,
): Promise<LatestFx | null> {
  const { data } = await supabase
    .from("fx_rates")
    .select("date, usd_sek")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.usd_sek) return null;
  return {
    usdSek: Number(data.usd_sek),
    date: data.date as string,
    stale: isFxStale(data.date as string),
  };
}

export const FX_MISSING_ERROR =
  "Ingen FX-kurs i fx_rates — kör refresh-fx först.";

export function fxStaleWarning(date: string): string {
  return `FX-kursen är från ${date} — refresh-fx verkar ha slutat fungera.`;
}
