// OpenAI Organization Usage API client.
// Docs: https://platform.openai.com/docs/api-reference/usage
// Requires an admin org key (sk-admin-...). Pass apiKey explicitly to support
// multiple orgs; falls back to OPENAI_ADMIN_KEY for single-org callers.

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
  apiKey?: string;           // explicit org admin key; defaults to env
}

function resolveKey(explicit?: string): string {
  const key = explicit ?? process.env.OPENAI_ADMIN_KEY;
  if (!key) throw new Error("OpenAI admin key not provided");
  return key;
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
  const key = resolveKey(opts.apiKey);
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
  const key = resolveKey(opts.apiKey);
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

// All configured OpenAI org admin keys (Nimo legacy + Haus AI new, etc).
export function openAiAdminKeys(): string[] {
  return [process.env.OPENAI_ADMIN_KEY, process.env.OPENAI_ADMIN_KEY_HAUS]
    .filter((k): k is string => !!k);
}

// ============ Projects (for auto-provisioning Hub projects) ============

export interface OpenAIProject {
  id: string;            // proj_...
  name: string;
  status: string;        // "active" | "archived"
}

interface ProjectListPage {
  object: "list";
  data: Array<{ id: string; name: string; status: string }>;
  has_more: boolean;
  last_id: string | null;
}

// Lists all projects for one org admin key. Docs:
// https://platform.openai.com/docs/api-reference/projects/list
export async function fetchProjects(apiKey?: string): Promise<OpenAIProject[]> {
  const key = resolveKey(apiKey);
  const out: OpenAIProject[] = [];
  let after: string | null = null;
  do {
    const url = new URL(`${BASE}/projects`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("include_archived", "true");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok)
      throw new Error(`OpenAI Projects API ${res.status} ${await res.text()}`);
    const body = (await res.json()) as ProjectListPage;
    for (const p of body.data)
      out.push({ id: p.id, name: p.name, status: p.status });
    after = body.has_more ? body.last_id : null;
  } while (after);
  return out;
}
