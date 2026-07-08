import type { NextRequest } from "next/server";
import { errMsg, isCronAuthorized, jsonError, jsonOk } from "@/lib/cron";
import { notifySlack } from "@/lib/notify";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const sek = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";

// GET /api/cron/notify-digest — Monday-morning Slack digest (schedule runs
// after refresh-pnl so the matview is fresh). No sync-run row: this reads,
// it doesn't ingest.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  if (!process.env.SLACK_WEBHOOK_URL) {
    return jsonOk({ skipped: "no_webhook" });
  }

  try {
    const supabase = createSupabaseAdmin();
    const today = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const monthStart = new Date(today);
    monthStart.setUTCDate(1);
    const isoMonth = monthStart.toISOString().slice(0, 10);

    const [{ data: usage14 }, { data: pnl }, { data: projectRows }, incidents, { data: badRuns }] =
      await Promise.all([
        supabase
          .from("token_usage_daily")
          .select("usage_date, cost_sek, project_id, provider:ai_providers(slug)")
          .gte("usage_date", daysAgo(14)),
        supabase
          .from("mv_project_pnl_monthly")
          .select("project_id, name, revenue_sek, ai_cost_sek, infra_cost_sek, margin_sek")
          .eq("period_month", isoMonth),
        supabase
          .from("projects")
          .select("id, name, monthly_revenue_sek")
          .neq("status", "offboarded"),
        supabase
          .from("incidents")
          .select("ref, title, severity", { count: "exact" })
          .is("resolved_at", null),
        supabase
          .from("integration_sync_runs")
          .select("status, error_message, integration:integrations_credentials(provider_slug)")
          .in("status", ["failed", "rate_limited"])
          .gte("started_at", new Date(Date.now() - 7 * 864e5).toISOString()),
      ]);

    // AI cost: this week vs previous week, per provider.
    const weekCut = daysAgo(7);
    let thisWeek = 0;
    let prevWeek = 0;
    const byProvider = new Map<string, number>();
    const byProject = new Map<string, number>();
    for (const r of usage14 ?? []) {
      const cost = Number(r.cost_sek ?? 0);
      if ((r.usage_date as string) >= weekCut) {
        thisWeek += cost;
        const prov = Array.isArray(r.provider) ? r.provider[0] : r.provider;
        const slug = prov?.slug ?? "övrigt";
        byProvider.set(slug, (byProvider.get(slug) ?? 0) + cost);
        if (r.project_id)
          byProject.set(
            r.project_id as string,
            (byProject.get(r.project_id as string) ?? 0) + cost,
          );
      } else {
        prevWeek += cost;
      }
    }
    const delta = prevWeek > 0 ? ((thisWeek - prevWeek) / prevWeek) * 100 : null;

    const nameById = new Map(
      (projectRows ?? []).map((p) => [p.id as string, p.name as string]),
    );
    const topProjects = [...byProject.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, cost]) => `${nameById.get(id) ?? id}: ${sek(cost)}`);

    // Negative margin this month, with manual-revenue coalesce.
    const negative = (pnl ?? [])
      .map((r) => {
        const invoiced = Number(r.revenue_sek ?? 0);
        const manual = Number(
          (projectRows ?? []).find((p) => p.id === r.project_id)
            ?.monthly_revenue_sek ?? 0,
        );
        const revenue = invoiced > 0 ? invoiced : manual;
        const margin =
          revenue - Number(r.ai_cost_sek ?? 0) - Number(r.infra_cost_sek ?? 0);
        return { name: r.name as string, margin };
      })
      .filter((r) => r.margin < 0)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 5);

    const failedSyncs = (badRuns ?? []).map((r) => {
      const integ = Array.isArray(r.integration) ? r.integration[0] : r.integration;
      return integ?.provider_slug ?? "okänd";
    });
    const failedCounts = new Map<string, number>();
    for (const s of failedSyncs)
      failedCounts.set(s, (failedCounts.get(s) ?? 0) + 1);

    const lines: string[] = [
      `*Veckodigest — Haus AI Operations Hub*`,
      ``,
      `*AI-kostnad senaste 7 dgr:* ${sek(thisWeek)}${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% v/v)` : ""}`,
      ...[...byProvider.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([p, c]) => `  • ${p}: ${sek(c)}`),
    ];
    if (topProjects.length > 0) {
      lines.push(``, `*Toppprojekt (AI-kostnad 7 dgr):*`);
      lines.push(...topProjects.map((t) => `  • ${t}`));
    }
    if (negative.length > 0) {
      lines.push(``, `*Negativ marginal denna månad:*`);
      lines.push(...negative.map((n) => `  • ${n.name}: ${sek(n.margin)}`));
    }
    if ((incidents.count ?? 0) > 0) {
      lines.push(``, `*Öppna incidenter:* ${incidents.count}`);
      lines.push(
        ...(incidents.data ?? [])
          .slice(0, 5)
          .map((i) => `  • ${i.ref} [${i.severity}] ${i.title}`),
      );
    }
    if (failedCounts.size > 0) {
      lines.push(``, `*Misslyckade syncar senaste 7 dgr:*`);
      lines.push(
        ...[...failedCounts.entries()].map(([s, n]) => `  • ${s}: ${n} körningar`),
      );
    }

    await notifySlack(lines.join("\n"));
    return jsonOk({ sent: true });
  } catch (e) {
    return jsonError(errMsg(e));
  }
}
