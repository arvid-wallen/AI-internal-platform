import type { NextRequest } from "next/server";
import {
  errMsg,
  finishSyncRun,
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
} from "@/lib/cron";
import {
  ensureFreshAccessToken,
  FortnoxRateLimitError,
} from "@/lib/integrations/fortnox";
import { syncFortnoxCustomers } from "@/lib/integrations/fortnox-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/sync-fortnox-customers
// Manual-trigger-only since the combined /api/cron/sync-fortnox took over the
// nightly schedule (this route is no longer in vercel.json). Kept for ad-hoc
// customer-register refreshes without a full invoice pass.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("fortnox");

  try {
    const accessToken = await ensureFreshAccessToken();
    if (!accessToken) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "No Fortnox tokens — connect at /api/auth/fortnox/start first",
      });
      return jsonOk({ skipped: "not_connected" });
    }

    const { customers } = await syncFortnoxCustomers(accessToken);
    await finishSyncRun(run?.id ?? null, "ok", { records: customers });
    return jsonOk({ customers });
  } catch (e) {
    const status = e instanceof FortnoxRateLimitError ? "rate_limited" : "failed";
    await finishSyncRun(run?.id ?? null, status, { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
