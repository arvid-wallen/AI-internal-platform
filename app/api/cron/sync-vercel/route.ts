import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 120;

// STUB — Vercel bandwidth/usage per project.
// Real impl: GET https://api.vercel.com/v1/usage/{teamId}?from=...&to=... and
// map projectId → projects.hosting_external_id, upsert costs_monthly.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("vercel");
  await finishSyncRun(run?.id ?? null, "failed", {
    error: "Not implemented — VERCEL_TOKEN + team_id required",
  });
  return jsonOk({ stub: true });
}
