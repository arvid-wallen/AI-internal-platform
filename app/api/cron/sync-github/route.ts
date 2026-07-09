import type { NextRequest } from "next/server";
import {
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
  finishSyncRun,
  errMsg,
} from "@/lib/cron";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getIntegrationKey } from "@/lib/integrations/keys";

export const runtime = "nodejs";
export const maxDuration = 120;

// Reads repo metadata for each project with a github_repo_url and persists
// last commit sha/date, default branch and open issue/PR count.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("github");
  try {
    const token = await getIntegrationKey("github");
    if (!token) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error:
          "Ingen GitHub-nyckel — lägg in den under Settings → API-nycklar",
      });
      return jsonOk({ skipped: "no_token" });
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };

    const supabase = createSupabaseAdmin();
    const { data: projects } = await supabase
      .from("projects")
      .select("id, github_repo_url")
      .not("github_repo_url", "is", null);

    let touched = 0;
    for (const p of projects ?? []) {
      const url = p.github_repo_url as string;
      const slug = url
        .replace(/^https?:\/\/github\.com\//, "")
        .replace(/\.git$/, "");
      const repoRes = await fetch(`https://api.github.com/repos/${slug}`, {
        headers,
      });
      if (!repoRes.ok) continue;
      const repo = (await repoRes.json()) as {
        default_branch?: string;
        pushed_at?: string;
        open_issues_count?: number;
      };

      let sha: string | null = null;
      const comRes = await fetch(
        `https://api.github.com/repos/${slug}/commits?per_page=1`,
        { headers },
      );
      if (comRes.ok) {
        const arr = (await comRes.json()) as Array<{ sha?: string }>;
        sha = arr?.[0]?.sha ?? null;
      }

      await supabase
        .from("projects")
        .update({
          github_last_commit_sha: sha,
          github_last_commit_at: repo.pushed_at ?? null,
          github_default_branch: repo.default_branch ?? null,
          github_open_prs: repo.open_issues_count ?? null,
        })
        .eq("id", p.id);
      touched += 1;
    }

    await finishSyncRun(run?.id ?? null, "ok", { records: touched });
    return jsonOk({ touched });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
