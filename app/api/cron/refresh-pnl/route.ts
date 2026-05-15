import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk } from "@/lib/cron";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Re-materializes mv_project_pnl_monthly. Call after sync-anthropic /
// sync-openai / sync-fortnox finish to refresh dashboards.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.rpc("refresh_pnl_monthly");
    if (error) throw error;
    return jsonOk({ refreshed: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e));
  }
}
