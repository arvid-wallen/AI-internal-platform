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

export const runtime = "nodejs";
export const maxDuration = 120;

// Links Hub projects to their Vercel project (by git repo) and stores the
// Vercel project id in projects.hosting_external_id. Per-project spend is not
// exposed by the Vercel REST API (only the dashboard/usage export), so cost
// ingestion is marked partial until that source is wired.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("vercel");
  try {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error: "VERCEL_TOKEN not set",
      });
      return jsonOk({ skipped: "no_token" });
    }
    const teamId = process.env.VERCEL_TEAM_ID;
    const headers = { Authorization: `Bearer ${token}` };

    // List all Vercel projects (paginated).
    interface VercelProject {
      id: string;
      name: string;
      link?: { type?: string; org?: string; repo?: string };
    }
    const projects: VercelProject[] = [];
    let until: number | undefined;
    for (;;) {
      const url = new URL("https://api.vercel.com/v9/projects");
      url.searchParams.set("limit", "100");
      if (teamId) url.searchParams.set("teamId", teamId);
      if (until) url.searchParams.set("until", String(until));
      const res = await fetch(url.toString(), { headers });
      if (!res.ok)
        throw new Error(`Vercel /projects ${res.status}: ${await res.text()}`);
      const body = (await res.json()) as {
        projects: VercelProject[];
        pagination?: { next?: number | null };
      };
      projects.push(...body.projects);
      const next = body.pagination?.next;
      if (!next) break;
      until = next;
    }

    // repo "org/name" -> vercel project id
    const byRepo = new Map<string, string>();
    for (const vp of projects) {
      if (vp.link?.repo && vp.link?.org)
        byRepo.set(`${vp.link.org}/${vp.link.repo}`.toLowerCase(), vp.id);
    }

    const supabase = createSupabaseAdmin();
    const { data: hubProjects } = await supabase
      .from("projects")
      .select("id, github_repo_url, hosting_external_id");

    let linked = 0;
    for (const p of hubProjects ?? []) {
      if (p.hosting_external_id || !p.github_repo_url) continue;
      const repo = (p.github_repo_url as string)
        .replace(/^https?:\/\/github\.com\//, "")
        .replace(/\.git$/, "")
        .toLowerCase();
      const vercelId = byRepo.get(repo);
      if (!vercelId) continue;
      await supabase
        .from("projects")
        .update({ hosting_external_id: vercelId, hosting_provider: "Vercel" })
        .eq("id", p.id);
      linked += 1;
    }

    // Connectivity + linking succeeded, but spend isn't available via the API.
    await finishSyncRun(run?.id ?? null, "partial", {
      records: linked,
      error:
        "Linked projects only — per-project Vercel spend requires the usage export",
    });
    return jsonOk({ vercelProjects: projects.length, linked });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
