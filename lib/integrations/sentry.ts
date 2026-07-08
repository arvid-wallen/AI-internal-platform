// Sentry REST client — mirrors unresolved issues into the incidents table.
// Docs: https://docs.sentry.io/api/
// Auth: org auth token (SENTRY_AUTH_TOKEN) with org:read + project:read +
// event:read. Haus org lives in the EU region (de.sentry.io).

export interface SentryIssue {
  id: string; // numeric issue id, stable — used for idempotent upserts
  shortId: string; // e.g. HAUS-CRM-12 — used as incident ref
  title: string;
  culprit: string | null;
  level: string; // fatal | error | warning | info | debug
  status: string; // unresolved | resolved | ignored
  count: string; // event count (Sentry returns it as a string)
  userCount: number;
  firstSeen: string; // ISO
  lastSeen: string;
  permalink: string;
  project?: { slug?: string } | null;
}

export interface SentryProject {
  id: string;
  slug: string;
  name: string;
}

export function sentryConfig(): {
  token: string;
  org: string;
  baseUrl: string;
} | null {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  if (!token || !org) return null;
  const baseUrl = (
    process.env.SENTRY_REGION_URL ?? "https://de.sentry.io"
  ).replace(/\/$/, "");
  return { token, org, baseUrl };
}

async function sentryFetch(url: string, token: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Sentry ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res;
}

export async function listSentryProjects(cfg: {
  token: string;
  org: string;
  baseUrl: string;
}): Promise<SentryProject[]> {
  const res = await sentryFetch(
    `${cfg.baseUrl}/api/0/organizations/${cfg.org}/projects/`,
    cfg.token,
  );
  const body = (await res.json()) as Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  return body.map((p) => ({ id: p.id, slug: p.slug, name: p.name }));
}

// All unresolved issues for one project, following Link-header cursors
// (capped at 5 pages ≈ 500 issues per project — far above agency scale).
export async function listUnresolvedIssues(
  cfg: { token: string; org: string; baseUrl: string },
  projectSlug: string,
): Promise<SentryIssue[]> {
  const out: SentryIssue[] = [];
  let url: string | null =
    `${cfg.baseUrl}/api/0/projects/${cfg.org}/${projectSlug}/issues/?query=${encodeURIComponent("is:unresolved")}&limit=100`;
  for (let page = 0; url && page < 5; page++) {
    const res = await sentryFetch(url, cfg.token);
    const body = (await res.json()) as SentryIssue[];
    out.push(...body);
    url = nextCursorUrl(res.headers.get("link"));
  }
  return out;
}

// Sentry paginates via RFC-5988 Link headers with results="true|false".
export function nextCursorUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    if (!part.includes('rel="next"')) continue;
    if (!part.includes('results="true"')) return null;
    const m = /<([^>]+)>/.exec(part);
    return m ? m[1] : null;
  }
  return null;
}

// Sentry level (+ blast radius) → incident severity. Matches the incidents
// table check constraint (low/medium/high/critical).
export function mapSentrySeverity(
  issue: Pick<SentryIssue, "level" | "count" | "userCount">,
): "low" | "medium" | "high" | "critical" {
  const level = (issue.level ?? "").toLowerCase();
  if (level === "fatal") return "critical";
  if (level === "error") {
    const events = Number(issue.count ?? 0);
    const users = Number(issue.userCount ?? 0);
    return users >= 10 || events >= 100 ? "high" : "medium";
  }
  return "low";
}
