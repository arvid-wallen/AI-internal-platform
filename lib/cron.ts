// Shared helpers for cron route handlers.
// All cron endpoints are gated by Bearer CRON_SECRET (settable in Vercel env).
// Vercel sends `Authorization: Bearer $CRON_SECRET` on cron invocations when
// the env var is set. The x-vercel-cron header is NOT trusted — it is not
// stripped from inbound external requests and is therefore spoofable.
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "./supabase/server";
import { notifySlack } from "./notify";

export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const presented = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${expected}`);
  return presented.length === wanted.length && timingSafeEqual(presented, wanted);
}

export interface SyncRunStarted {
  id: string;
  startedAt: Date;
}

export async function startSyncRun(
  integrationSlug: string,
): Promise<SyncRunStarted | null> {
  try {
    const supabase = createSupabaseAdmin();
    const { data: integ } = await supabase
      .from("integrations_credentials")
      .select("id")
      .eq("provider_slug", integrationSlug)
      .maybeSingle();
    const { data, error } = await supabase
      .from("integration_sync_runs")
      .insert({
        integration_id: integ?.id ?? null,
        started_at: new Date().toISOString(),
        status: "ok",
      })
      .select("id, started_at")
      .single();
    if (error || !data) return null;
    return { id: data.id, startedAt: new Date(data.started_at) };
  } catch {
    return null;
  }
}

export async function finishSyncRun(
  runId: string | null,
  status: "ok" | "partial" | "failed" | "rate_limited",
  opts: { records?: number; cost_usd?: number; error?: string } = {},
): Promise<void> {
  if (!runId) return;
  try {
    const supabase = createSupabaseAdmin();
    await supabase
      .from("integration_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        records_ingested: opts.records ?? null,
        cost_usd: opts.cost_usd ?? null,
        error_message: opts.error ?? null,
      })
      .eq("id", runId);

    // One central alert hook covers every cron. "partial" is deliberately
    // silent — unconfigured integrations (google/vercel) finish partial daily
    // and would drown the channel.
    if (status === "failed" || status === "rate_limited") {
      const { data: run } = await supabase
        .from("integration_sync_runs")
        .select("integration:integrations_credentials(provider_slug)")
        .eq("id", runId)
        .maybeSingle();
      const integ = Array.isArray(run?.integration)
        ? run?.integration[0]
        : run?.integration;
      const slug = integ?.provider_slug ?? "okänd integration";
      await notifySlack(
        `:warning: Sync *${slug}* ${status === "rate_limited" ? "rate-limited" : "misslyckades"}: ${opts.error ?? "okänt fel"}`,
      );
    }
  } catch {
    // Best-effort logging only.
  }
}

export function jsonError(message: string, status = 500) {
  return Response.json({ ok: false, error: message }, { status });
}

export function jsonOk(payload: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...payload });
}

// Serialize anything thrown into a useful string. Plain objects (e.g. Supabase
// PostgrestError) would otherwise stringify to "[object Object]".
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
