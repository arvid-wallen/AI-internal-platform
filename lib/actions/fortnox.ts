"use server";

import { revalidatePath } from "next/cache";
import { getSessionMember, hasRole } from "@/lib/auth";

export interface TriggerSyncResult {
  ok: boolean;
  message?: string;
}

// Kicks the combined Fortnox cron (customers + invoices + P&L refresh) from
// the settings UI. Reuses the cron route so the run lands in the existing
// integration_sync_runs log.
export async function triggerFortnoxSync(): Promise<TriggerSyncResult> {
  const member = await getSessionMember();
  if (!member) return { ok: false, message: "Inte inloggad." };
  if (!hasRole(member, "admin")) {
    return { ok: false, message: "Endast administratörer kan trigga sync." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!baseUrl || !secret) {
    return {
      ok: false,
      message: "NEXT_PUBLIC_APP_URL eller CRON_SECRET saknas i miljön.",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/sync-fortnox`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      invoices?: number;
      customers?: number;
      skipped?: string;
    };
    if (!res.ok || body.ok === false) {
      return { ok: false, message: body.error ?? `Sync svarade ${res.status}` };
    }
    revalidatePath("/settings");
    if (body.skipped === "not_connected") {
      return { ok: false, message: "Fortnox är inte ansluten ännu." };
    }
    return {
      ok: true,
      message: `Synkade ${body.customers ?? 0} kunder och ${body.invoices ?? 0} fakturor.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Sync misslyckades.",
    };
  }
}
