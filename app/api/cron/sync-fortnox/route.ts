import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 300;

// STUB — Fortnox OAuth2 sync.
// Real impl steps:
//   1. Read refresh_token from integrations_credentials.refresh_token_secret_id (via Vault).
//   2. POST https://apps.fortnox.se/oauth-v1/token with grant_type=refresh_token → new access_token.
//   3. GET /3/invoices?fromdate=YYYY-MM-DD, paginate, upsert into public.invoices.
//   4. Split into invoice_lines by ArticleCode → projects via article_code_map.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("fortnox");
  await finishSyncRun(run?.id ?? null, "failed", {
    error: "Not implemented — FORTNOX_CLIENT_ID/SECRET + refresh_token in Vault required",
  });
  return jsonOk({ stub: true });
}
