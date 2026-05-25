import type { NextRequest } from "next/server";
import {
  finishSyncRun,
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
  errMsg,
} from "@/lib/cron";
import { ensureFreshAccessToken, listCustomers } from "@/lib/integrations/fortnox";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Mirrors the Fortnox customer register into public.customers, keyed on
// fortnox_customer_id. This is the source of truth for the customer master
// list (the dashboard's customers/projects derive from it + provider data).
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

    const customers = await listCustomers(accessToken);
    const supabase = createSupabaseAdmin();

    const slugify = (name: string, fallback: string) => {
      const s = name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 50);
      return s || fallback;
    };

    let upserted = 0;
    for (const c of customers) {
      const payload = {
        name: c.Name,
        org_number: c.OrganisationNumber || null,
        fortnox_customer_id: c.CustomerNumber,
        contract_status: c.Active === false ? "paused" : "live",
      };

      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("fortnox_customer_id", c.CustomerNumber)
        .maybeSingle();

      if (existing) {
        await supabase.from("customers").update(payload).eq("id", existing.id);
        upserted += 1;
        continue;
      }

      // New customer: ensure a unique slug.
      const base = slugify(c.Name, `kund-${c.CustomerNumber}`);
      const { data: clash } = await supabase
        .from("customers")
        .select("id")
        .eq("slug", base)
        .maybeSingle();
      const slug = clash ? `${base}-${c.CustomerNumber}`.slice(0, 60) : base;

      const { error } = await supabase
        .from("customers")
        .insert({ slug, ...payload });
      // org_number is unique; on a rare clash, retry without it.
      if (error) {
        await supabase
          .from("customers")
          .insert({ slug, ...payload, org_number: null });
      }
      upserted += 1;
    }

    await finishSyncRun(run?.id ?? null, "ok", { records: upserted });
    return jsonOk({ customers: upserted });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
