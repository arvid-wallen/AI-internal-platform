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
  listSentryProjects,
  listUnresolvedIssues,
  mapSentrySeverity,
  sentryConfig,
  type SentryIssue,
} from "@/lib/integrations/sentry";
import { notifySlack } from "@/lib/notify";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/cron/sync-sentry — hourly. Mirrors unresolved Sentry issues into
// incidents (idempotent on sentry_issue_id): creates new rows, reopens
// regressions, and auto-resolves incidents whose Sentry issue is no longer
// unresolved (resolved/ignored/archived in Sentry). Manually created
// incidents (sentry_issue_id null) are never touched.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("sentry");

  try {
    const cfg = sentryConfig();
    if (!cfg) {
      await finishSyncRun(run?.id ?? null, "partial", {
        error: "Not configured — set SENTRY_AUTH_TOKEN + SENTRY_ORG",
      });
      return jsonOk({ skipped: "not_configured" });
    }

    const supabase = createSupabaseAdmin();

    // Sentry project slug → Hub project uuid (set on the settings page).
    const { data: cred } = await supabase
      .from("integrations_credentials")
      .select("metadata")
      .eq("provider_slug", "sentry")
      .maybeSingle();
    const meta = (cred?.metadata as Record<string, unknown> | null) ?? {};
    const projectMap =
      (meta.sentry_project_map as Record<string, string> | undefined) ?? {};

    const sentryProjects = await listSentryProjects(cfg);
    const issues: Array<{ issue: SentryIssue; projectSlug: string }> = [];
    for (const sp of sentryProjects) {
      const list = await listUnresolvedIssues(cfg, sp.slug);
      for (const issue of list) issues.push({ issue, projectSlug: sp.slug });
    }

    // Existing Sentry-mirrored incidents.
    const { data: existingRows } = await supabase
      .from("incidents")
      .select("id, sentry_issue_id, resolved_at, severity")
      .not("sentry_issue_id", "is", null);
    const existingBySentryId = new Map(
      (existingRows ?? []).map((r) => [r.sentry_issue_id as string, r]),
    );

    let upserted = 0;
    let created = 0;
    let writeErrors = 0;
    const newSevere: string[] = [];
    const unresolvedIds = new Set<string>();

    for (const { issue, projectSlug } of issues) {
      unresolvedIds.add(issue.id);
      const severity = mapSentrySeverity(issue);
      const existing = existingBySentryId.get(issue.id);
      const summaryParts = [
        issue.culprit,
        `${issue.count} events · ${issue.userCount} användare`,
      ].filter(Boolean);

      const { error } = await supabase.from("incidents").upsert(
        {
          sentry_issue_id: issue.id,
          ref: issue.shortId,
          title: issue.title.slice(0, 300),
          severity,
          project_id: projectMap[projectSlug] ?? null,
          summary: summaryParts.join("\n"),
          occurred_at: issue.firstSeen,
          external_url: issue.permalink,
          // Reopen on regression: the issue is unresolved in Sentry again.
          resolved_at: null,
        },
        { onConflict: "sentry_issue_id" },
      );
      if (error) {
        console.error(`[sentry] upsert ${issue.shortId} failed:`, error.message);
        writeErrors += 1;
        continue;
      }
      upserted += 1;
      if (!existing) {
        created += 1;
        if (severity === "high" || severity === "critical") {
          newSevere.push(
            `${issue.shortId} [${severity}] ${issue.title.slice(0, 120)}`,
          );
        }
      }
    }

    // Auto-resolve: open mirrored incidents whose issue is no longer
    // unresolved in Sentry. Only when the fetch itself succeeded cleanly —
    // a partial fetch must not mass-resolve real incidents.
    let autoResolved = 0;
    if (writeErrors === 0) {
      const toResolve = (existingRows ?? []).filter(
        (r) =>
          r.resolved_at === null && !unresolvedIds.has(r.sentry_issue_id as string),
      );
      for (const r of toResolve) {
        const { error } = await supabase
          .from("incidents")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", r.id);
        if (error) writeErrors += 1;
        else autoResolved += 1;
      }
    }

    if (newSevere.length > 0) {
      await notifySlack(
        `:rotating_light: ${newSevere.length} nya allvarliga incidenter från Sentry:\n` +
          newSevere.map((s) => `  • ${s}`).join("\n"),
      );
    }

    if (writeErrors > 0) {
      await finishSyncRun(run?.id ?? null, "partial", {
        records: upserted,
        error: `${writeErrors} incidenter kunde inte skrivas`,
      });
    } else {
      await finishSyncRun(run?.id ?? null, "ok", { records: upserted });
    }
    return jsonOk({
      projects: sentryProjects.length,
      unresolved: issues.length,
      upserted,
      created,
      autoResolved,
      writeErrors,
    });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
