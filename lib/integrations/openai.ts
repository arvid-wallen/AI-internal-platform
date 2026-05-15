// OpenAI Organization Usage API client.
// Docs: https://platform.openai.com/docs/api-reference/usage
// Requires an admin org key (sk-admin-...). Set OPENAI_ADMIN_KEY.

const BASE = "https://api.openai.com/v1/organization";

export interface OpenAIUsageBucket {
  object: "bucket";
  start_time: number;        // unix seconds
  end_time: number;
  results: Array<{
    object: "organization.usage.completions.result";
    project_id: string | null;
    model: string | null;
    input_tokens: number;
    input_cached_tokens: number;
    output_tokens: number;
    num_model_requests: number;
    user_id?: string | null;
    api_key_id?: string | null;
  }>;
}

export interface OpenAICostBucket {
  object: "bucket";
  start_time: number;
  end_time: number;
  results: Array<{
    object: "organization.costs.result";
    amount: { value: number; currency: string };
    line_item: string | null;
    project_id: string | null;
  }>;
}

interface UsagePage {
  object: "page";
  data: OpenAIUsageBucket[];
  has_more: boolean;
  next_page: string | null;
}

interface CostPage {
  object: "page";
  data: OpenAICostBucket[];
  has_more: boolean;
  next_page: string | null;
}

type UsageGroupBy = "project_id" | "model" | "api_key_id" | "user_id";
type CostGroupBy = "project_id" | "line_item";

interface FetchOpts<G extends string> {
  start_time: number;        // unix seconds, midnight UTC
  end_time: number;
  group_by?: G[];
}

export async function fetchCompletionsUsage(
  opts: FetchOpts<UsageGroupBy>,
): Promise<OpenAIUsageBucket[]> {
  return fetchUsage("/usage/completions", opts);
}

export async function fetchEmbeddingsUsage(
  opts: FetchOpts<UsageGroupBy>,
): Promise<OpenAIUsageBucket[]> {
  return fetchUsage("/usage/embeddings", opts);
}

async function fetchUsage(
  endpoint: string,
  opts: FetchOpts<UsageGroupBy>,
): Promise<OpenAIUsageBucket[]> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) throw new Error("OPENAI_ADMIN_KEY not set");

  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set("start_time", String(opts.start_time));
  url.searchParams.set("end_time", String(opts.end_time));
  url.searchParams.set("bucket_width", "1d");
  (opts.group_by ?? ["project_id", "model"]).forEach((g) =>
    url.searchParams.append("group_by[]", g),
  );

  const out: OpenAIUsageBucket[] = [];
  let page: string | null = null;
  do {
    if (page) url.searchParams.set("page", page);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok)
      throw new Error(`OpenAI Usage API ${res.status} ${await res.text()}`);
    const body = (await res.json()) as UsagePage;
    out.push(...body.data);
    page = body.has_more ? body.next_page : null;
  } while (page);
  return out;
}

export async function fetchCosts(
  opts: FetchOpts<CostGroupBy>,
): Promise<OpenAICostBucket[]> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) throw new Error("OPENAI_ADMIN_KEY not set");
  const url = new URL(`${BASE}/costs`);
  url.searchParams.set("start_time", String(opts.start_time));
  url.searchParams.set("end_time", String(opts.end_time));
  url.searchParams.set("bucket_width", "1d");
  (opts.group_by ?? ["project_id", "line_item"]).forEach((g) =>
    url.searchParams.append("group_by[]", g),
  );
  const out: OpenAICostBucket[] = [];
  let page: string | null = null;
  do {
    if (page) url.searchParams.set("page", page);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok)
      throw new Error(`OpenAI Costs API ${res.status} ${await res.text()}`);
    const body = (await res.json()) as CostPage;
    out.push(...body.data);
    page = body.has_more ? body.next_page : null;
  } while (page);
  return out;
}
