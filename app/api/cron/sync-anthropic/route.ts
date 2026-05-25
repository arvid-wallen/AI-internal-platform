import type { NextRequest } from "next/server";
import {
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
  finishSyncRun,
  errMsg,
} from "@/lib/cron";
import {
  fetchCostReport,
  fetchMessagesUsage,
  type AnthropicUsageBucket,
} from "@/lib/integrations/anthropic";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Pulls Anthropic cost (per workspace/day) from the cost report and token
// counts (per workspace/model/day) from the messages usage report, then
// allocates each workspace/day cost across its models by token share.
// Idempotent via delete-then-insert over the provider + date window.
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

    const costBuckets = await fetchCostReport({
      starting_at: startingAt.toISOString(),
      ending_at: endingAt.toISOString(),
      bucket_width: "1d",
      group_by: ["workspace_id"],
    });

    // Messages usage gives model + token counts; best-effort (schema/plan may
    // not expose it). Fall back to cost-only (model_id null) on failure.
    let usageBuckets: AnthropicUsageBucket[] = [];
    try {
      usageBuckets = await fetchMessagesUsage({
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
        bucket_width: "1d",
        group_by: ["workspace_id", "model"],
      });
    } catch {
      usageBuckets = [];
    }

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
    const providerId = anthropicProvider?.id ?? null;
    const { data: models } = await supabase
      .from("ai_models")
      .select("id, model_id");
    let modelMap = new Map<string, string>(
      (models ?? []).map((m) => [m.model_id, m.id]),
    );
    const { data: fx } = await supabase
      .from("fx_rates")
      .select("usd_sek")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const usdSek = fx?.usd_sek ?? 10.78;

    const wsKey = (ws: string | null, date: string) => `${ws ?? "_"}|${date}`;

    // Cost per workspace/day.
    const costByWs = new Map<string, number>();
    let totalCostUsd = 0;
    for (const bucket of costBuckets) {
      const date = bucket.starting_at.slice(0, 10);
      for (const r of bucket.results) {
        const k = wsKey(r.workspace_id, date);
        costByWs.set(k, (costByWs.get(k) ?? 0) + Number(r.amount ?? 0));
        totalCostUsd += Number(r.amount ?? 0);
      }
    }

    // Token usage per workspace/model/day.
    interface ModelUsage {
      model: string | null;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
    }
    const usageByWs = new Map<string, ModelUsage[]>();
    for (const bucket of usageBuckets) {
      const date = bucket.starting_at.slice(0, 10);
      for (const r of bucket.results) {
        const k = wsKey(r.workspace_id, date);
        const list = usageByWs.get(k) ?? [];
        list.push({
          model: r.model ?? null,
          input_tokens:
            Number(r.uncached_input_tokens ?? 0) +
            Number(r.cache_creation_input_tokens ?? 0),
          output_tokens: Number(r.output_tokens ?? 0),
          cache_read_tokens: Number(r.cache_read_input_tokens ?? 0),
          cache_write_tokens: Number(r.cache_creation_input_tokens ?? 0),
        });
        usageByWs.set(k, list);
      }
    }

    // Upsert unknown Anthropic models from the usage report.
    if (providerId) {
      const unknown = [
        ...new Set(
          [...usageByWs.values()]
            .flat()
            .map((u) => u.model)
            .filter((m): m is string => !!m && !modelMap.has(m)),
        ),
      ];
      if (unknown.length > 0) {
        await supabase.from("ai_models").upsert(
          unknown.map((m) => ({
            provider_id: providerId,
            model_id: m,
            display_name: m,
            is_current: true,
          })),
          { onConflict: "provider_id,model_id", ignoreDuplicates: true },
        );
        const { data: m2 } = await supabase
          .from("ai_models")
          .select("id, model_id");
        modelMap = new Map((m2 ?? []).map((m) => [m.model_id, m.id]));
      }
    }

    // Build rows: allocate each workspace/day cost across its models by tokens.
    const rows: Array<Record<string, unknown>> = [];
    const allKeys = new Set([...costByWs.keys(), ...usageByWs.keys()]);
    for (const key of allKeys) {
      const sep = key.lastIndexOf("|");
      const ws = key.slice(0, sep);
      const date = key.slice(sep + 1);
      const workspaceId = ws === "_" ? null : ws;
      const project_id = workspaceId
        ? workspaceMap[workspaceId] ?? null
        : null;
      const wsCost = costByWs.get(key) ?? 0;
      const usages = usageByWs.get(key) ?? [];
      const totalTokens = usages.reduce(
        (s, u) => s + u.input_tokens + u.output_tokens,
        0,
      );

      if (usages.length === 0) {
        // Cost without a model breakdown — keep cost, no model.
        rows.push({
          project_id,
          model_id: null,
          provider_id: providerId,
          usage_date: date,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          request_count: null,
          cost_usd: Number(wsCost.toFixed(6)),
          cost_sek: Number((wsCost * usdSek).toFixed(2)),
          source_workspace_id: workspaceId,
          raw: { workspace_id: workspaceId, cost_only: true },
          ingested_at: new Date().toISOString(),
        });
        continue;
      }

      for (const u of usages) {
        const rowTokens = u.input_tokens + u.output_tokens;
        const cost_usd =
          totalTokens > 0
            ? wsCost * (rowTokens / totalTokens)
            : wsCost / usages.length;
        rows.push({
          project_id,
          model_id: u.model ? modelMap.get(u.model) ?? null : null,
          provider_id: providerId,
          usage_date: date,
          input_tokens: u.input_tokens,
          output_tokens: u.output_tokens,
          cache_read_tokens: u.cache_read_tokens,
          cache_write_tokens: u.cache_write_tokens,
          request_count: null,
          cost_usd: Number(cost_usd.toFixed(6)),
          cost_sek: Number((cost_usd * usdSek).toFixed(2)),
          source_workspace_id: workspaceId,
          raw: { workspace_id: workspaceId, model: u.model },
          ingested_at: new Date().toISOString(),
        });
      }
    }

    // Idempotent replace of the window for this provider.
    if (providerId) {
      await supabase
        .from("token_usage_daily")
        .delete()
        .eq("provider_id", providerId)
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
    return jsonOk({
      costBuckets: costBuckets.length,
      usageBuckets: usageBuckets.length,
      records: rows.length,
    });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
