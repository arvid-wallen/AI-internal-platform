import type { NextRequest } from "next/server";
import { isCronAuthorized, jsonError, jsonOk, startSyncRun, finishSyncRun } from "@/lib/cron";

export const runtime = "nodejs";
export const maxDuration = 300;

// STUB — Google Cloud Billing → BigQuery export pattern.
// Real impl: query the BigQuery billing export with WHERE
// service.description LIKE '%Vertex AI%' AND labels.haus_project IS NOT NULL,
// group by (labels.haus_project, usage_start_time, service).
// Then attribute via projects.slug = labels.haus_project.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("google");
  await finishSyncRun(run?.id ?? null, "failed", {
    error: "Not implemented — requires BigQuery client + GOOGLE_APPLICATION_CREDENTIALS",
  });
  return jsonOk({ stub: true });
}
