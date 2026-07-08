import type { NextRequest } from "next/server";
import {
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
  finishSyncRun,
  errMsg,
} from "@/lib/cron";
import { readGoogleConfig, fetchVertexBilling } from "@/lib/integrations/google";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { FX_MISSING_ERROR, fxStaleWarning, getLatestUsdSek } from "@/lib/fx";

export const runtime = "nodejs";
export const maxDuration = 300;

// Google Cloud Billing → Vertex AI / Gemini spend per Hub project, read from
// the BigQuery billing export and attributed via the `haus_project` label
// (= projects.slug). Writes token_usage_daily (cost only, no token counts).
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("google");

  try {
    const cfg = readGoogleConfig();
    if (!cfg) {
      await finishSyncRun(run?.id ?? null, "partial", {
        error:
          "Not configured — set GOOGLE_CREDENTIALS_JSON + GOOGLE_BILLING_TABLE and label resources with haus_project",
      });
      return jsonOk({ skipped: "not_configured" });
    }

    const sp = request.nextUrl.searchParams;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(today.getUTCDate() - 2);
    const from = sp.get("from") ?? defaultFrom.toISOString().slice(0, 10);
    const to = sp.get("to") ?? today.toISOString().slice(0, 10);

    const billing = await fetchVertexBilling(cfg, from, to);

    const supabase = createSupabaseAdmin();
    const { data: googleProvider } = await supabase
      .from("ai_providers")
      .select("id")
      .eq("slug", "google")
      .maybeSingle();
    const providerId = googleProvider?.id ?? null;
    const { data: projectRows } = await supabase
      .from("projects")
      .select("id, slug");
    const projectBySlug = new Map<string, string>(
      (projectRows ?? []).map((p) => [p.slug, p.id]),
    );
    const fx = await getLatestUsdSek(supabase);
    if (!fx) {
      await finishSyncRun(run?.id ?? null, "failed", { error: FX_MISSING_ERROR });
      return jsonError(FX_MISSING_ERROR);
    }
    const usdSek = fx.usdSek;

    const rows = billing.map((b) => ({
      project_id: projectBySlug.get(b.haus_project) ?? null,
      model_id: null,
      provider_id: providerId,
      usage_date: b.usage_date,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      request_count: null,
      cost_usd: Number(b.cost_usd.toFixed(6)),
      cost_sek: Number((b.cost_usd * usdSek).toFixed(2)),
      source_workspace_id: b.haus_project,
      raw: b as unknown as Record<string, unknown>,
      ingested_at: new Date().toISOString(),
    }));

    if (providerId) {
      await supabase
        .from("token_usage_daily")
        .delete()
        .eq("provider_id", providerId)
        .gte("usage_date", from)
        .lt("usage_date", to);
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("token_usage_daily").insert(rows);
      if (error) throw error;
    }

    await finishSyncRun(run?.id ?? null, fx.stale ? "partial" : "ok", {
      records: rows.length,
      error: fx.stale ? fxStaleWarning(fx.date) : undefined,
    });
    return jsonOk({ records: rows.length });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
