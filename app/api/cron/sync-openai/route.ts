import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";
import { fetchCompletionsUsage, fetchCosts } from "@/lib/integrations/openai";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("openai");

  try {
    if (!process.env.OPENAI_ADMIN_KEY) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "OPENAI_ADMIN_KEY not set",
      });
      return jsonOk({ skipped: "no_admin_key" });
    }

    const now = Math.floor(Date.now() / 1000);
    const startOfToday = now - (now % 86400);
    const startOfYesterday = startOfToday - 86400;

    const [usage, costs] = await Promise.all([
      fetchCompletionsUsage({
        start_time: startOfYesterday,
        end_time: startOfToday,
        group_by: ["project_id", "model"],
      }),
      fetchCosts({
        start_time: startOfYesterday,
        end_time: startOfToday,
        group_by: ["project_id", "line_item"],
      }),
    ]);

    const supabase = createSupabaseAdmin();
    const { data: cred } = await supabase
      .from("integrations_credentials")
      .select("metadata")
      .eq("provider_slug", "openai")
      .maybeSingle();
    const projectMap =
      (cred?.metadata as { project_map?: Record<string, string> } | null)
        ?.project_map ?? {};
    const { data: openaiProvider } = await supabase
      .from("ai_providers")
      .select("id")
      .eq("slug", "openai")
      .maybeSingle();
    const { data: models } = await supabase.from("ai_models").select("id, model_id");
    const modelMap = new Map<string, string>(
      (models ?? []).map((m) => [m.model_id, m.id]),
    );
    const { data: fx } = await supabase
      .from("fx_rates")
      .select("usd_sek")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const usdSek = fx?.usd_sek ?? 10.78;

    // Build cost lookup keyed by (project_id, day).
    const costByKey = new Map<string, number>();
    for (const bucket of costs) {
      const usageDate = new Date(bucket.start_time * 1000)
        .toISOString()
        .slice(0, 10);
      for (const c of bucket.results) {
        const k = `${c.project_id ?? "_"}|${usageDate}`;
        costByKey.set(k, (costByKey.get(k) ?? 0) + c.amount.value);
      }
    }

    const rows: Array<Record<string, unknown>> = [];
    let totalRecords = 0;
    let totalCostUsd = 0;
    for (const bucket of usage) {
      const usageDate = new Date(bucket.start_time * 1000)
        .toISOString()
        .slice(0, 10);
      for (const r of bucket.results) {
        const hubProjectId = r.project_id ? projectMap[r.project_id] ?? null : null;
        const model_id = r.model ? modelMap.get(r.model) ?? null : null;
        const cost_usd = costByKey.get(`${r.project_id ?? "_"}|${usageDate}`) ?? 0;
        rows.push({
          project_id: hubProjectId,
          model_id,
          provider_id: openaiProvider?.id ?? null,
          usage_date: usageDate,
          input_tokens: r.input_tokens,
          output_tokens: r.output_tokens,
          cache_read_tokens: r.input_cached_tokens,
          cache_write_tokens: 0,
          request_count: r.num_model_requests,
          cost_usd,
          cost_sek: Number((cost_usd * usdSek).toFixed(2)),
          source_workspace_id: r.project_id,
          raw: r,
          ingested_at: new Date().toISOString(),
        });
        totalRecords += 1;
        totalCostUsd += cost_usd;
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
    return jsonOk({ records: totalRecords });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncRun(run?.id ?? null, "failed", { error: msg });
    return jsonError(msg);
  }
}
