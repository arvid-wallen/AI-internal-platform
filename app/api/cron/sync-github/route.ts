import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// Reads basic repo metadata for each project with a github_repo_url and
// writes last_commit_sha/last_commit_at/open_prs into projects (when columns
// are added in a follow-up migration). Currently logs as an info-only sync.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("github");
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "GITHUB_TOKEN not set",
      });
      return jsonOk({ skipped: "no_token" });
    }

    const supabase = createSupabaseAdmin();
    const { data: projects } = await supabase
      .from("projects")
      .select("id, github_repo_url")
      .not("github_repo_url", "is", null);

    let touched = 0;
    for (const p of projects ?? []) {
      const url = p.github_repo_url as string;
      const slug = url.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
      const res = await fetch(`https://api.github.com/repos/${slug}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (res.ok) touched += 1;
      // TODO: persist {pushed_at, default_branch, open_issues_count} once we add columns.
    }

    await finishSyncRun(run?.id ?? null, "ok", { records: touched });
    return jsonOk({ touched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncRun(run?.id ?? null, "failed", { error: msg });
    return jsonError(msg);
  }
}
