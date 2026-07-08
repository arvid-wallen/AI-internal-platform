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
import {
  syncFortnoxCustomers,
  syncFortnoxInvoices,
} from "@/lib/integrations/fortnox-sync";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/sync-fortnox
// Combined nightly Fortnox sync: refreshes the OAuth token once, mirrors the
// customer register (invoices need fortnox_customer_id), then pulls invoices
// — backfill from FORTNOX_BACKFILL_FROM on first run, lastmodified cursor
// afterwards — and finally refreshes the P&L materialized view.
// Running both steps in one process eliminates the refresh-token rotation
// race the two separate crons had.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("fortnox");

  try {
    const accessToken = await ensureFreshAccessToken();
    if (!accessToken) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error:
          "No Fortnox tokens stored — connect at /api/auth/fortnox/start first",
      });
      return jsonOk({ skipped: "not_connected" });
    }

    const { customers } = await syncFortnoxCustomers(accessToken);
    const { invoices, mode, rateWarnings, writeErrors } =
      await syncFortnoxInvoices(accessToken);

    // Revenue data changed — re-materialize the P&L view.
    const supabase = createSupabaseAdmin();
    await supabase.rpc("refresh_pnl_monthly");

    if (writeErrors > 0) {
      await finishSyncRun(run?.id ?? null, "failed", {
        records: invoices,
        error: `${writeErrors} fakturor kunde inte skrivas till databasen — cursorn hölls kvar, nästa körning försöker igen`,
      });
    } else if (rateWarnings > 0) {
      await finishSyncRun(run?.id ?? null, "partial", {
        records: invoices,
        error: `${rateWarnings} fakturor utan valutakurs — SEK-belopp saknas; fixa fx_rates så reparerar nästa körning (cursorn hölls kvar)`,
      });
    } else {
      await finishSyncRun(run?.id ?? null, "ok", { records: invoices });
    }
    return jsonOk({ customers, invoices, mode, rateWarnings, writeErrors });
  } catch (e) {
    const status = e instanceof FortnoxRateLimitError ? "rate_limited" : "failed";
    await finishSyncRun(run?.id ?? null, status, { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
