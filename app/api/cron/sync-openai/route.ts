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
  fetchCompletionsUsage,
  fetchEmbeddingsUsage,
  fetchCosts,
  openAiAdminKeys,
} from "@/lib/integrations/openai";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { FX_MISSING_ERROR, fxStaleWarning, getLatestUsdSek } from "@/lib/fx";

export const runtime = "nodejs";
export const maxDuration = 300;

// Pulls usage + cost across ALL configured OpenAI orgs (Nimo legacy + Haus AI).
// OpenAI project ids (proj_...) are globally unique so cross-org rows are
// distinct. Idempotent via delete-then-insert over the provider + date window.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("openai");

  try {
    const keys = openAiAdminKeys();
    if (keys.length === 0) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "No OpenAI admin key set (OPENAI_ADMIN_KEY / OPENAI_ADMIN_KEY_HAUS)",
      });
      return jsonOk({ skipped: "no_admin_key" });
    }

    const sp = request.nextUrl.searchParams;
    const now = Math.floor(Date.now() / 1000);
    const startOfToday = now - (now % 86400);
    const startTime = sp.get("from")
      ? Math.floor(new Date(`${sp.get("from")}T00:00:00.000Z`).getTime() / 1000)
      : startOfToday - 86400;
    const endTime = sp.get("to")
      ? Math.floor(new Date(`${sp.get("to")}T00:00:00.000Z`).getTime() / 1000)
      : startOfToday;
    const fromStr = new Date(startTime * 1000).toISOString().slice(0, 10);
    const toStr = new Date(endTime * 1000).toISOString().slice(0, 10);

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
    const providerId = openaiProvider?.id ?? null;
    const { data: models } = await supabase
      .from("ai_models")
      .select("id, model_id");
    let modelMap = new Map<string, string>(
      (models ?? []).map((m) => [m.model_id, m.id]),
    );
    const fx = await getLatestUsdSek(supabase);
    if (!fx) {
      await finishSyncRun(run?.id ?? null, "failed", { error: FX_MISSING_ERROR });
      return jsonError(FX_MISSING_ERROR);
    }
    const usdSek = fx.usdSek;

    // 1) Gather usage (completions + embeddings) and cost across all orgs,
    //    aggregating usage to one row per (project, model, day).
    interface UsageRow {
      date: string;
      project_id: string | null;
      model: string | null;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      request_count: number;
      raw: unknown;
    }
    const agg = new Map<string, UsageRow>();
    const costByKey = new Map<string, number>(); // `${project_id}|${date}` -> usd
    let totalCostUsd = 0;

    for (const apiKey of keys) {
      const [completions, embeddings, costs] = await Promise.all([
        fetchCompletionsUsage({
          start_time: startTime,
          end_time: endTime,
          group_by: ["project_id", "model"],
          apiKey,
        }),
        fetchEmbeddingsUsage({
          start_time: startTime,
          end_time: endTime,
          group_by: ["project_id", "model"],
          apiKey,
        }).catch(() => []),
        fetchCosts({
          start_time: startTime,
          end_time: endTime,
          group_by: ["project_id", "line_item"],
          apiKey,
        }),
      ]);

      for (const bucket of costs) {
        const d = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
        for (const c of bucket.results) {
          const k = `${c.project_id ?? "_"}|${d}`;
          costByKey.set(k, (costByKey.get(k) ?? 0) + Number(c.amount.value));
          totalCostUsd += Number(c.amount.value);
        }
      }

      for (const bucket of [...completions, ...embeddings]) {
        const d = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
        for (const r of bucket.results) {
          const key = `${r.project_id ?? "_"}|${r.model ?? "_"}|${d}`;
          const ex = agg.get(key);
          if (ex) {
            ex.input_tokens += Number(r.input_tokens ?? 0);
            ex.output_tokens += Number(r.output_tokens ?? 0);
            ex.cache_read_tokens += Number(r.input_cached_tokens ?? 0);
            ex.request_count += Number(r.num_model_requests ?? 0);
          } else {
            agg.set(key, {
              date: d,
              project_id: r.project_id,
              model: r.model,
              input_tokens: Number(r.input_tokens ?? 0),
              output_tokens: Number(r.output_tokens ?? 0),
              cache_read_tokens: Number(r.input_cached_tokens ?? 0),
              request_count: Number(r.num_model_requests ?? 0),
              raw: r,
            });
          }
        }
      }
    }
    const usageRows = [...agg.values()];

    // 2) Upsert any model strings we don't yet know (real, version-suffixed
    //    names like gpt-4o-mini-2024-07-18), then rebuild the map.
    if (providerId) {
      const unknown = [
        ...new Set(
          usageRows
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

    // 3) Allocate each project/day cost across its model rows by token share
    //    (OpenAI reports cost per project/line_item, not per model).
    const tokensByKey = new Map<string, number>();
    const countByKey = new Map<string, number>();
    for (const u of usageRows) {
      const k = `${u.project_id ?? "_"}|${u.date}`;
      tokensByKey.set(
        k,
        (tokensByKey.get(k) ?? 0) + u.input_tokens + u.output_tokens,
      );
      countByKey.set(k, (countByKey.get(k) ?? 0) + 1);
    }

    const rows = usageRows.map((u) => {
      const k = `${u.project_id ?? "_"}|${u.date}`;
      const projCost = costByKey.get(k) ?? 0;
      const totTokens = tokensByKey.get(k) ?? 0;
      const rowTokens = u.input_tokens + u.output_tokens;
      const cost_usd =
        totTokens > 0
          ? projCost * (rowTokens / totTokens)
          : projCost / (countByKey.get(k) ?? 1);
      return {
        project_id: u.project_id ? projectMap[u.project_id] ?? null : null,
        model_id: u.model ? modelMap.get(u.model) ?? null : null,
        provider_id: providerId,
        usage_date: u.date,
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_read_tokens: u.cache_read_tokens,
        cache_write_tokens: 0,
        request_count: u.request_count,
        cost_usd: Number(cost_usd.toFixed(6)),
        cost_sek: Number((cost_usd * usdSek).toFixed(2)),
        source_workspace_id: u.project_id,
        raw: u.raw as Record<string, unknown>,
        ingested_at: new Date().toISOString(),
      };
    });

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

    await finishSyncRun(run?.id ?? null, fx.stale ? "partial" : "ok", {
      records: rows.length,
      cost_usd: totalCostUsd,
      error: fx.stale ? fxStaleWarning(fx.date) : undefined,
    });
    return jsonOk({ orgs: keys.length, records: rows.length });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
