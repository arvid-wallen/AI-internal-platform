// Anthropic Admin API client — workspace usage & cost reports.
// Docs: https://docs.claude.com/en/api/admin-api/usage-cost/get-cost-report
//
// Auth: requires an admin org key (`sk-ant-admin01-...`) — get one in
// Console → Settings → API keys → "Admin keys".
// Set as env var ANTHROPIC_ADMIN_KEY.

const BASE = "https://api.anthropic.com/v1";

export interface AnthropicCostBucket {
  starting_at: string;
  ending_at: string;
  results: Array<{
    workspace_id: string | null;
    model: string;
    service_tier: string | null;
    context_window: string | null;
    uncached_input_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    output_tokens: number;
    server_tool_use: number | null;
    amount: number;            // USD
    currency: string;
  }>;
}

export interface AnthropicCostReport {
  data: AnthropicCostBucket[];
  has_more: boolean;
  next_page: string | null;
}

interface FetchOpts {
  starting_at: string;        // RFC3339, day boundary
  ending_at: string;          // RFC3339, day boundary
  bucket_width?: "1d" | "1h";
  group_by?: Array<"workspace_id" | "model" | "service_tier" | "context_window">;
  workspace_ids?: string[];
}

async function* paginate<T extends { has_more: boolean; next_page: string | null }>(
  url: URL,
  apiKey: string,
): AsyncGenerator<T> {
  let next: string | null = null;
  do {
    if (next) url.searchParams.set("page", next);
    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Anthropic Admin API ${res.status} ${await res.text().catch(() => "")}`,
      );
    }
    const body = (await res.json()) as T;
    yield body;
    next = body.next_page;
  } while (next);
}

export async function fetchCostReport(
  opts: FetchOpts,
): Promise<AnthropicCostBucket[]> {
  const apiKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_ADMIN_KEY not set");

  const url = new URL(`${BASE}/organizations/cost_report`);
  url.searchParams.set("starting_at", opts.starting_at);
  url.searchParams.set("ending_at", opts.ending_at);
  url.searchParams.set("bucket_width", opts.bucket_width ?? "1d");
  (opts.group_by ?? ["workspace_id", "model"]).forEach((g) =>
    url.searchParams.append("group_by[]", g),
  );
  (opts.workspace_ids ?? []).forEach((id) =>
    url.searchParams.append("workspace_ids[]", id),
  );

  const buckets: AnthropicCostBucket[] = [];
  for await (const page of paginate<AnthropicCostReport>(url, apiKey)) {
    buckets.push(...page.data);
  }
  return buckets;
}

export async function fetchUsageReport(opts: FetchOpts) {
  const apiKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_ADMIN_KEY not set");

  const url = new URL(`${BASE}/organizations/usage_report/messages`);
  url.searchParams.set("starting_at", opts.starting_at);
  url.searchParams.set("ending_at", opts.ending_at);
  url.searchParams.set("bucket_width", opts.bucket_width ?? "1d");
  (opts.group_by ?? ["workspace_id", "model"]).forEach((g) =>
    url.searchParams.append("group_by[]", g),
  );

  const out: unknown[] = [];
  // Same pagination shape as cost_report.
  for await (const page of paginate<{ data: unknown[]; has_more: boolean; next_page: string | null }>(
    url,
    apiKey,
  )) {
    out.push(...page.data);
  }
  return out;
}
