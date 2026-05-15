import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";
import { fetchCostReport } from "@/lib/integrations/anthropic";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/sync-anthropic
// Pulls yesterday's cost report from Anthropic Admin API, attributes rows to
// projects via integrations_credentials.metadata.workspace_map (workspace_id → project_id),
// upserts into token_usage_daily.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("anthropic");

  try {
    if (!process.env.ANTHROPIC_ADMIN_KEY) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "ANTHROPIC_ADMIN_KEY not set — cron is a no-op until env is configured",
      });
      return jsonOk({ skipped: "no_admin_key" });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    const buckets = await fetchCostReport({
      starting_at: yesterday.toISOString(),
      ending_at: today.toISOString(),
      bucket_width: "1d",
      group_by: ["workspace_id", "model"],
    });

    // Resolve workspace_id → project_id from integrations_credentials.metadata.
    const supabase = createSupabaseAdmin();
    const { data: cred } = await supabase
      .from("integrations_credentials")
      .select("metadata")
      .eq("provider_slug", "anthropic")
      .maybeSingle();
    const workspaceMap =
      (cred?.metadata as { workspace_map?: Record<string, string> } | null)
        ?.workspace_map ?? {};

    const { data: anthropicProvider } = await supabase
      .from("ai_providers")
      .select("id")
      .eq("slug", "anthropic")
      .maybeSingle();
    const { data: models } = await supabase.from("ai_models").select("id, model_id");
    const modelMap = new Map<string, string>(
      (models ?? []).map((m) => [m.model_id, m.id]),
    );

    // Look up most recent USD/SEK rate.
    const { data: fx } = await supabase
      .from("fx_rates")
      .select("usd_sek")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const usdSek = fx?.usd_sek ?? 10.78;

    const rows: Array<Record<string, unknown>> = [];
    let totalRecords = 0;
    let totalCostUsd = 0;
    for (const bucket of buckets) {
      const usageDate = bucket.starting_at.slice(0, 10);
      for (const r of bucket.results) {
        const project_id = r.workspace_id ? workspaceMap[r.workspace_id] ?? null : null;
        const model_id = modelMap.get(r.model) ?? null;
        const input_tokens =
          r.uncached_input_tokens + r.cache_creation_input_tokens;
        rows.push({
          project_id,
          model_id,
          provider_id: anthropicProvider?.id ?? null,
          usage_date: usageDate,
          input_tokens,
          output_tokens: r.output_tokens,
          cache_read_tokens: r.cache_read_input_tokens,
          cache_write_tokens: r.cache_creation_input_tokens,
          request_count: null,
          cost_usd: r.amount,
          cost_sek: Number((r.amount * usdSek).toFixed(2)),
          source_workspace_id: r.workspace_id,
          raw: r,
          ingested_at: new Date().toISOString(),
        });
        totalRecords += 1;
        totalCostUsd += r.amount;
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("token_usage_daily")
        .upsert(rows, {
          onConflict: "project_id,model_id,usage_date,source_workspace_id",
        });
      if (error) throw error;
    }

    await finishSyncRun(run?.id ?? null, "ok", {
      records: totalRecords,
      cost_usd: totalCostUsd,
    });
    return jsonOk({ buckets: buckets.length, records: totalRecords });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncRun(run?.id ?? null, "failed", { error: msg });
    return jsonError(msg);
  }
}
