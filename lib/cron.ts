// Shared helpers for cron route handlers.
// All cron endpoints are gated by Bearer CRON_SECRET (settable in Vercel env).
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "./supabase/server";

export function isCronAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const expected = process.env.CRON_SECRET;
  if (vercelCronHeader === "1") return true;          // Vercel-internal cron
  if (!expected) return false;
  return auth === `Bearer ${expected}`;
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
