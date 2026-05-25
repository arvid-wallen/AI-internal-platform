import type { NextRequest } from "next/server";
import {
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
  finishSyncRun,
  errMsg,
} from "@/lib/cron";
import { fetchCostReport } from "@/lib/integrations/anthropic";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Pulls Anthropic cost report (per workspace per day) and writes
// token_usage_daily. The Admin cost report only groups by workspace_id /
// description, so we attribute the model from each project's currently-active
// model. Idempotent via delete-then-insert over the provider + date window.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("anthropic");

  try {
    if (!process.env.ANTHROPIC_ADMIN_KEY) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "ANTHROPIC_ADMIN_KEY not set",
      });
      return jsonOk({ skipped: "no_admin_key" });
    }

    const sp = request.nextUrl.searchParams;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(today.getUTCDate() - 1);
    const startingAt = sp.get("from")
      ? new Date(`${sp.get("from")}T00:00:00.000Z`)
      : defaultFrom;
    const endingAt = sp.get("to")
      ? new Date(`${sp.get("to")}T00:00:00.000Z`)
      : today;
    const fromStr = startingAt.toISOString().slice(0, 10);
    const toStr = endingAt.toISOString().slice(0, 10);

    const buckets = await fetchCostReport({
      starting_at: startingAt.toISOString(),
      ending_at: endingAt.toISOString(),
      bucket_width: "1d",
      group_by: ["workspace_id"],
    });

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

    // project_id -> active model uuid (1 active model per project)
    const { data: activeModels } = await supabase
      .from("project_models")
      .select("project_id, model_id")
      .eq("is_active", true)
      .is("effective_to", null);
    const activeModelByProject = new Map<string, string>(
      (activeModels ?? []).map((m) => [m.project_id, m.model_id]),
    );

    const { data: fx } = await supabase
      .from("fx_rates")
      .select("usd_sek")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const usdSek = fx?.usd_sek ?? 10.78;

    const rows: Array<Record<string, unknown>> = [];
    let totalCostUsd = 0;
    for (const bucket of buckets) {
      const usageDate = bucket.starting_at.slice(0, 10);
      for (const r of bucket.results) {
        const project_id = r.workspace_id
          ? workspaceMap[r.workspace_id] ?? null
          : null;
        const model_id = project_id
          ? activeModelByProject.get(project_id) ?? null
          : null;
        const input_tokens =
          (r.uncached_input_tokens ?? 0) + (r.cache_creation_input_tokens ?? 0);
        rows.push({
          project_id,
          model_id,
          provider_id: anthropicProvider?.id ?? null,
          usage_date: usageDate,
          input_tokens,
          output_tokens: r.output_tokens ?? 0,
          cache_read_tokens: r.cache_read_input_tokens ?? 0,
          cache_write_tokens: r.cache_creation_input_tokens ?? 0,
          request_count: null,
          cost_usd: r.amount ?? 0,
          cost_sek: Number(((r.amount ?? 0) * usdSek).toFixed(2)),
          source_workspace_id: r.workspace_id,
          raw: r,
          ingested_at: new Date().toISOString(),
        });
        totalCostUsd += r.amount ?? 0;
      }
    }

    // Idempotent replace of the window for this provider.
    if (anthropicProvider?.id) {
      await supabase
        .from("token_usage_daily")
        .delete()
        .eq("provider_id", anthropicProvider.id)
        .gte("usage_date", fromStr)
        .lt("usage_date", toStr);
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("token_usage_daily").insert(rows);
      if (error) throw error;
    }

    await finishSyncRun(run?.id ?? null, "ok", {
      records: rows.length,
      cost_usd: totalCostUsd,
    });
    return jsonOk({ buckets: buckets.length, records: rows.length });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
