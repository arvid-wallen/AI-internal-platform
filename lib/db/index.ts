// Supabase-backed data layer. Pages can opt into this incrementally —
// it mirrors lib/data.ts (mock) but returns async Supabase results.
//
// Migration pattern per page:
//   - import { customerById } from "@/lib/data"   →  import { getCustomer } from "@/lib/db"
//   - const c = customerById(id)                  →  const c = await getCustomer(id)
//
// When NEXT_PUBLIC_SUPABASE_URL is unset, every function returns the mock-data
// equivalent so dev works without Supabase.

import { createSupabaseServer } from "@/lib/supabase/server";
import {
  CUSTOMERS as MOCK_CUSTOMERS,
  PROJECTS as MOCK_PROJECTS,
  MODELS as MOCK_MODELS,
  DAILY_USAGE as MOCK_USAGE,
  modelById as mockModelById,
  customerById as mockCustomerById,
  projectById as mockProjectById,
  computePortfolio as mockPortfolio,
} from "@/lib/data";
import type {
  AIModel,
  Customer,
  DailyUsage,
  PortfolioTotals,
  Project,
} from "@/lib/types";

const isSupabaseConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// ============ Customers ============

export async function listCustomers(): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return MOCK_CUSTOMERS;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("customers")
    .select("*, account_manager:team_members(full_name)")
    .order("name");
  if (error || !data) return MOCK_CUSTOMERS;
  return data.map(toCustomer);
}

export async function getCustomer(idOrSlug: string): Promise<Customer | null> {
  if (!isSupabaseConfigured()) return mockCustomerById(idOrSlug) ?? null;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("customers")
    .select("*, account_manager:team_members(full_name)")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .maybeSingle();
  if (error || !data) return mockCustomerById(idOrSlug) ?? null;
  return toCustomer(data);
}

// ============ Projects ============

export async function listProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return MOCK_PROJECTS;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("projects")
    .select("*, customer:customers(slug)")
    .order("name");
  if (error || !data) return MOCK_PROJECTS;
  return data.map(toProject);
}

export async function getProject(idOrSlug: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) return mockProjectById(idOrSlug) ?? null;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("projects")
    .select("*, customer:customers(slug)")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .maybeSingle();
  if (error || !data) return mockProjectById(idOrSlug) ?? null;
  return toProject(data);
}

export async function listProjectsForCustomer(
  customerIdOrSlug: string,
): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_PROJECTS.filter((p) => p.customer_id === customerIdOrSlug);
  }
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("projects")
    .select("*, customer:customers!inner(slug)")
    .or(`customer_id.eq.${customerIdOrSlug},customer.slug.eq.${customerIdOrSlug}`)
    .order("name");
  return (data ?? []).map(toProject);
}

// ============ Models ============

export async function listModels(): Promise<AIModel[]> {
  if (!isSupabaseConfigured()) return MOCK_MODELS;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("ai_models")
    .select("*, provider:ai_providers(slug)")
    .order("released_at", { ascending: false });
  if (error || !data) return MOCK_MODELS;
  return data.map(toModel);
}

export async function getModel(modelIdString: string): Promise<AIModel | null> {
  if (!isSupabaseConfigured()) return mockModelById(modelIdString) ?? null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("ai_models")
    .select("*, provider:ai_providers(slug)")
    .eq("model_id", modelIdString)
    .maybeSingle();
  return data ? toModel(data) : mockModelById(modelIdString) ?? null;
}

// ============ Token usage ============

export async function listDailyUsageForProject(
  projectId: string,
  days = 60,
): Promise<DailyUsage[]> {
  if (!isSupabaseConfigured())
    return MOCK_USAGE.filter((u) => u.project_id === projectId);
  const supabase = await createSupabaseServer();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await supabase
    .from("token_usage_daily")
    .select("*, model:ai_models(model_id)")
    .eq("project_id", projectId)
    .gte("usage_date", since.toISOString().slice(0, 10))
    .order("usage_date");
  return (data ?? []).map(toUsage);
}

// ============ Portfolio aggregate ============

export async function getPortfolio(): Promise<PortfolioTotals> {
  if (!isSupabaseConfigured()) return mockPortfolio();
  const supabase = await createSupabaseServer();
  const thisMonth = new Date();
  thisMonth.setUTCDate(1);
  const isoMonth = thisMonth.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("mv_project_pnl_monthly")
    .select("*")
    .eq("period_month", isoMonth);
  if (!data || data.length === 0) return mockPortfolio();
  const total_mrr = data.reduce((s, r) => s + Number(r.revenue_sek), 0);
  const ai_cost = data.reduce((s, r) => s + Number(r.ai_cost_sek), 0);
  const infra_cost = data.reduce((s, r) => s + Number(r.infra_cost_sek), 0);
  return {
    project_count: data.length,
    live_count: data.length,
    customer_count: new Set(data.map((r) => r.customer_id)).size,
    total_mrr,
    ai_cost,
    infra_cost,
    margin: total_mrr - ai_cost - infra_cost,
    margin_pct: total_mrr ? (total_mrr - ai_cost - infra_cost) / total_mrr : 0,
  };
}

// ============ Adapters: DB row → domain shape ============

interface DbCustomer {
  id: string;
  slug: string;
  name: string;
  org_number: string | null;
  customer_class: "A" | "B" | "C" | null;
  contract_status: "live" | "paused" | "draft" | "offboarded";
  account_manager?: { full_name?: string | null } | null;
}

function toCustomer(r: DbCustomer): Customer {
  return {
    id: r.slug,                         // use slug as id (matches lib/data shape)
    name: r.name,
    org_number: r.org_number ?? "",
    cls: r.customer_class ?? "C",
    am: r.account_manager?.full_name ?? "—",
    contract: r.contract_status,
    mrr: 0,                              // derive later from invoices view
    mark: pickMark(r.slug),
    init: r.name[0]?.toUpperCase() ?? "?",
  };
}

interface DbProject {
  id: string;
  slug: string;
  name: string;
  customer_id: string;
  customer?: { slug?: string | null } | null;
  status: "discovery" | "building" | "live" | "paused" | "offboarded";
  go_live_date: string | null;
  github_repo_url: string | null;
  hosting_provider: string | null;
  tech_stack: string[] | null;
  monthly_revenue_sek: number | null;
  monthly_infra_budget_sek: number | null;
}

function toProject(r: DbProject): Project {
  return {
    id: "p-" + r.slug,
    slug: r.slug,
    name: r.name,
    customer_id: r.customer?.slug ?? r.customer_id,
    status: r.status,
    go_live: r.go_live_date,
    repo: r.github_repo_url
      ? r.github_repo_url.replace(/^https?:\/\/github\.com\//, "")
      : null,
    hosting: r.hosting_provider ?? "—",
    stack: r.tech_stack ?? [],
    active_model: "",                    // resolved from project_models view in detail pages
    monthly_revenue: Number(r.monthly_revenue_sek ?? 0),
    infra_cost: Number(r.monthly_infra_budget_sek ?? 0),
    ai_cost: 0,                          // aggregated from token_usage_daily
    owner: "—",
    healthy: true,
  };
}

interface DbModel {
  id: string;
  model_id: string;
  display_name: string;
  context_window: number | null;
  input_price_per_mtok_usd: number | null;
  output_price_per_mtok_usd: number | null;
  is_current: boolean;
  released_at: string | null;
  provider?: { slug?: "anthropic" | "openai" | "google" } | null;
}

function toModel(r: DbModel): AIModel {
  return {
    id: r.model_id,
    provider: r.provider?.slug ?? "anthropic",
    display: r.display_name,
    price_in: Number(r.input_price_per_mtok_usd ?? 0),
    price_out: Number(r.output_price_per_mtok_usd ?? 0),
    ctx: r.context_window ?? 0,
    is_current: r.is_current,
    released: r.released_at ?? "",
  };
}

interface DbUsage {
  usage_date: string;
  project_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  cost_sek: number | null;
  model?: { model_id?: string | null } | null;
}

function toUsage(r: DbUsage): DailyUsage {
  return {
    date: r.usage_date,
    project_id: r.project_id ?? "",
    model_id: r.model?.model_id ?? "",
    tokens_in: r.input_tokens ?? 0,
    tokens_out: r.output_tokens ?? 0,
    cost_usd: Number(r.cost_usd ?? 0),
    cost_sek: Number(r.cost_sek ?? 0),
  };
}

const MARKS = [
  "mint",
  "sky",
  "tomato",
  "lilac",
  "butter",
  "apricot",
  "blush",
];
function pickMark(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) | 0;
  return MARKS[Math.abs(h) % MARKS.length];
}
