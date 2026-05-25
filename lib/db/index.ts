// Supabase-backed data layer. All reads go through here. Returns live data
// only — empty arrays / null when there is no data yet (no mock fallback).

import { createSupabaseServer } from "@/lib/supabase/server";
import type {
  AIModel,
  Customer,
  DailyUsage,
  Dependency,
  Incident,
  Integration,
  Invoice,
  ModelHistoryEntry,
  MonthlyVendorCost,
  Note,
  PortfolioTotals,
  Project,
  SoftwareCostSummary,
  SyncRun,
  TeamMember,
  Update,
} from "@/lib/types";

// Domain project ids are "p-" + slug; strip the prefix to get the DB slug.
const stripP = (idOrSlug: string) =>
  idOrSlug.startsWith("p-") ? idOrSlug.slice(2) : idOrSlug;

// ============ Customers ============

export async function listCustomers(): Promise<Customer[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("customers")
    .select("*, account_manager:team_members(full_name)")
    .order("name");
  return (data ?? []).map((r) => toCustomer(r as unknown as DbCustomer));
}

export async function getCustomer(idOrSlug: string): Promise<Customer | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("customers")
    .select("*, account_manager:team_members(full_name)")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return data ? toCustomer(data as unknown as DbCustomer) : null;
}

// ============ Projects ============

const PROJECT_SELECT =
  "*, customer:customers(slug), project_models(is_active, model:ai_models(model_id))";

export async function listProjects(): Promise<Project[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .order("name");
  return (data as unknown as DbProject[] | null ?? []).map(toProject);
}

export async function getProject(idOrSlug: string): Promise<Project | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("slug", stripP(idOrSlug))
    .maybeSingle();
  return data ? toProject(data as unknown as DbProject) : null;
}

export async function listProjectsForCustomer(
  customerIdOrSlug: string,
): Promise<Project[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("projects")
    .select(
      "*, customer:customers!inner(slug), project_models(is_active, model:ai_models(model_id))",
    )
    .eq("customer.slug", customerIdOrSlug)
    .order("name");
  return (data as unknown as DbProject[] | null ?? []).map(toProject);
}

// ============ Models ============

export async function listModels(): Promise<AIModel[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("ai_models")
    .select("*, provider:ai_providers(slug)")
    .order("released_at", { ascending: false });
  return (data ?? []).map((r) => toModel(r as unknown as DbModel));
}

export async function getModel(modelIdString: string): Promise<AIModel | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("ai_models")
    .select("*, provider:ai_providers(slug)")
    .eq("model_id", modelIdString)
    .maybeSingle();
  return data ? toModel(data as unknown as DbModel) : null;
}

// ============ Token usage ============

export async function listDailyUsageForProject(
  projectId: string,
  days = 60,
): Promise<DailyUsage[]> {
  const supabase = await createSupabaseServer();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await supabase
    .from("token_usage_daily")
    .select("*, model:ai_models(model_id), project:projects!inner(slug)")
    .eq("project.slug", stripP(projectId))
    .gte("usage_date", since.toISOString().slice(0, 10))
    .order("usage_date");
  return ((data ?? []) as unknown as DbUsage[]).map(toUsage);
}

// ============ Portfolio aggregate ============

export async function getPortfolio(): Promise<PortfolioTotals> {
  const supabase = await createSupabaseServer();
  const thisMonth = new Date();
  thisMonth.setUTCDate(1);
  const isoMonth = thisMonth.toISOString().slice(0, 10);

  const [{ data: pnl }, projects, live, customers] = await Promise.all([
    supabase.from("mv_project_pnl_monthly").select("*").eq("period_month", isoMonth),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "live"),
    supabase.from("customers").select("*", { count: "exact", head: true }),
  ]);

  const rows = pnl ?? [];
  const total_mrr = rows.reduce((s, r) => s + Number(r.revenue_sek), 0);
  const ai_cost = rows.reduce((s, r) => s + Number(r.ai_cost_sek), 0);
  const infra_cost = rows.reduce((s, r) => s + Number(r.infra_cost_sek), 0);
  return {
    project_count: projects.count ?? 0,
    live_count: live.count ?? 0,
    customer_count: customers.count ?? 0,
    total_mrr,
    ai_cost,
    infra_cost,
    margin: total_mrr - ai_cost - infra_cost,
    margin_pct: total_mrr ? (total_mrr - ai_cost - infra_cost) / total_mrr : 0,
  };
}

// Software/SaaS costs straight from costs_monthly (includes company-wide rows
// with project_id = NULL, which the per-project P&L view omits). Defaults to the
// most recent month that has any cost data so a fresh import is visible.
export async function getSoftwareCosts(
  isoMonth?: string,
): Promise<SoftwareCostSummary> {
  const firstOfThisMonth = () => {
    const d = new Date();
    d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
  };
  if (!isSupabaseConfigured()) {
    return { month: isoMonth ?? firstOfThisMonth(), total_sek: 0, by_vendor: [] };
  }
  const supabase = await createSupabaseServer();
  let month = isoMonth ?? "";
  if (!month) {
    const { data: latest } = await supabase
      .from("costs_monthly")
      .select("period_month")
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    month = String(latest?.period_month ?? firstOfThisMonth());
  }
  const { data, error } = await supabase
    .from("costs_monthly")
    .select("vendor, amount_sek, cost_category")
    .eq("period_month", month);
  if (error || !data) return { month, total_sek: 0, by_vendor: [] };

  const byVendor = new Map<string, { amount: number; cat: string | null }>();
  let total = 0;
  for (const r of data) {
    const amt = Number(r.amount_sek ?? 0);
    total += amt;
    const v = (r.vendor as string) ?? "—";
    const cur = byVendor.get(v) ?? {
      amount: 0,
      cat: (r.cost_category as string) ?? null,
    };
    cur.amount += amt;
    byVendor.set(v, cur);
  }
  const by_vendor: MonthlyVendorCost[] = [...byVendor.entries()]
    .map(([vendor, x]) => ({ vendor, amount_sek: x.amount, cost_category: x.cat }))
    .sort((a, b) => b.amount_sek - a.amount_sek);
  return { month, total_sek: total, by_vendor };
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
    id: r.slug, // use slug as id (matches lib/data shape)
    name: r.name,
    org_number: r.org_number ?? "",
    cls: r.customer_class ?? "C",
    am: r.account_manager?.full_name ?? "—",
    contract: r.contract_status,
    mrr: 0, // derive later from invoices view
    mark: pickMark(r.slug),
    init: r.name[0]?.toUpperCase() ?? "?",
  };
}

interface DbProject {
  id: string;
  slug: string;
  name: string;
  customer_id: string;
  customer?: { slug?: string | null } | { slug?: string | null }[] | null;
  status: "discovery" | "building" | "live" | "paused" | "offboarded";
  go_live_date: string | null;
  github_repo_url: string | null;
  hosting_provider: string | null;
  tech_stack: string[] | null;
  monthly_revenue_sek: number | null;
  monthly_infra_budget_sek: number | null;
  project_models?: Array<{
    is_active: boolean;
    model?: { model_id?: string | null } | { model_id?: string | null }[] | null;
  }> | null;
}

function toProject(r: DbProject): Project {
  const customer = Array.isArray(r.customer) ? r.customer[0] : r.customer;
  const activePm = (r.project_models ?? []).find((pm) => pm.is_active);
  const activeModel = activePm
    ? Array.isArray(activePm.model)
      ? activePm.model[0]
      : activePm.model
    : null;
  return {
    id: "p-" + r.slug,
    slug: r.slug,
    name: r.name,
    customer_id: customer?.slug ?? r.customer_id,
    status: r.status,
    go_live: r.go_live_date,
    repo: r.github_repo_url
      ? r.github_repo_url.replace(/^https?:\/\/github\.com\//, "")
      : null,
    hosting: r.hosting_provider ?? "—",
    stack: r.tech_stack ?? [],
    active_model: activeModel?.model_id ?? "",
    monthly_revenue: Number(r.monthly_revenue_sek ?? 0),
    infra_cost: Number(r.monthly_infra_budget_sek ?? 0),
    ai_cost: 0, // aggregated from token_usage_daily
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

const MARKS = ["mint", "sky", "tomato", "lilac", "butter", "apricot", "blush"];
function pickMark(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) | 0;
  return MARKS[Math.abs(h) % MARKS.length];
}

// ============ Daily portfolio (cost per day, stacked by provider) ============

export interface PortfolioDayRow {
  date: string;
  cost_sek: number;
  tokens: number;
  byProvider: { anthropic: number; openai: number; google: number };
}

export async function getDailyPortfolio(days = 60): Promise<PortfolioDayRow[]> {
  const supabase = await createSupabaseServer();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await supabase
    .from("token_usage_daily")
    .select(
      "usage_date, cost_sek, input_tokens, output_tokens, provider:ai_providers(slug)",
    )
    .gte("usage_date", since.toISOString().slice(0, 10))
    .order("usage_date");

  const byDate = new Map<string, PortfolioDayRow>();
  for (const r of (data ?? []) as Array<{
    usage_date: string;
    cost_sek: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    provider: { slug?: "anthropic" | "openai" | "google" } | null;
  }>) {
    const row =
      byDate.get(r.usage_date) ??
      {
        date: r.usage_date,
        cost_sek: 0,
        tokens: 0,
        byProvider: { anthropic: 0, openai: 0, google: 0 },
      };
    const cost = Number(r.cost_sek ?? 0);
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    row.cost_sek += cost;
    row.tokens += tokens;
    const slug = r.provider?.slug;
    if (slug) row.byProvider[slug] += cost;
    byDate.set(r.usage_date, row);
  }
  return [...byDate.values()];
}

// ============ Top N projects by current-month AI cost ============

export interface TopProjectRow {
  project_id: string;
  project_slug: string;
  project_name: string;
  customer_name: string;
  monthly_revenue: number;
  ai_cost: number;
  infra_cost: number;
  active_model_id: string;
  active_model_display: string;
  active_model_provider: "anthropic" | "openai" | "google";
}

export async function getTopProjectsByAICost(
  limit = 6,
): Promise<TopProjectRow[]> {
  const supabase = await createSupabaseServer();
  const thisMonth = new Date();
  thisMonth.setUTCDate(1);
  const monthStart = thisMonth.toISOString().slice(0, 10);

  // Sum cost per project for current month.
  const { data: usageRows } = await supabase
    .from("token_usage_daily")
    .select("project_id, cost_sek")
    .gte("usage_date", monthStart)
    .not("project_id", "is", null);

  const costByProject = new Map<string, number>();
  for (const r of (usageRows ?? []) as Array<{
    project_id: string | null;
    cost_sek: number | null;
  }>) {
    if (!r.project_id) continue;
    costByProject.set(
      r.project_id,
      (costByProject.get(r.project_id) ?? 0) + Number(r.cost_sek ?? 0),
    );
  }

  const topIds = [...costByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const { data: projectRows } = await supabase
    .from("projects")
    .select(`id, slug, name, monthly_revenue_sek, monthly_infra_budget_sek,
             customer:customers(name),
             active_model:project_models!inner(
               model:ai_models(model_id, display_name, provider:ai_providers(slug))
             )`)
    .in("id", topIds)
    .eq("active_model.is_active", true);

  type JoinedProject = {
    id: string;
    slug: string;
    name: string;
    monthly_revenue_sek: number | null;
    monthly_infra_budget_sek: number | null;
    customer: { name?: string | null } | { name?: string | null }[] | null;
    active_model:
      | Array<{
          model?: {
            model_id?: string | null;
            display_name?: string | null;
            provider?: { slug?: "anthropic" | "openai" | "google" } | null;
          } | null;
        }>
      | null;
  };

  return (projectRows as unknown as JoinedProject[] | null ?? [])
    .map((r) => {
      const am = Array.isArray(r.active_model) ? r.active_model[0] : null;
      const model = am?.model;
      const customer = Array.isArray(r.customer) ? r.customer[0] : r.customer;
      return {
        project_id: r.id,
        project_slug: r.slug,
        project_name: r.name,
        customer_name: customer?.name ?? "",
        monthly_revenue: Number(r.monthly_revenue_sek ?? 0),
        ai_cost: costByProject.get(r.id) ?? 0,
        infra_cost: Number(r.monthly_infra_budget_sek ?? 0),
        active_model_id: model?.model_id ?? "",
        active_model_display: model?.display_name ?? "",
        active_model_provider: model?.provider?.slug ?? "anthropic",
      } satisfies TopProjectRow;
    })
    .sort((a, b) => b.ai_cost - a.ai_cost);
}

// ============ Recent updates feed (derived from real events) ============

export interface UpdateRow {
  when: string;
  actor: string;
  kind: string;
  project_id: string;
  project_name: string;
  body: string;
}

export async function getRecentUpdates(limit = 6): Promise<UpdateRow[]> {
  const supabase = await createSupabaseServer();
  const [switches, incidents, invoices] = await Promise.all([
    supabase
      .from("model_switches")
      .select(
        "switched_at, reason, to_model:ai_models!to_model_id(model_id), actor:team_members(full_name), project:projects(slug, name)",
      )
      .order("switched_at", { ascending: false })
      .limit(limit),
    supabase
      .from("incidents")
      .select("occurred_at, title, project:projects(slug, name)")
      .order("occurred_at", { ascending: false })
      .limit(limit),
    supabase
      .from("invoices")
      .select("invoice_date, invoice_number, status, customer:customers(name)")
      .order("invoice_date", { ascending: false })
      .limit(limit),
  ]);

  const out: Array<UpdateRow & { sort: string }> = [];

  for (const r of (switches.data ?? []) as unknown as Array<{
    switched_at: string;
    reason: string | null;
    to_model?: { model_id?: string | null } | { model_id?: string | null }[] | null;
    actor?: { full_name?: string | null } | { full_name?: string | null }[] | null;
    project?:
      | { slug?: string | null; name?: string | null }
      | Array<{ slug?: string | null; name?: string | null }>
      | null;
  }>) {
    const m = one(r.to_model);
    const a = one(r.actor);
    const p = one(r.project);
    out.push({
      sort: r.switched_at,
      when: fmtTs(r.switched_at),
      actor: a?.full_name ?? "—",
      kind: "model",
      project_id: p?.slug ? "p-" + p.slug : "",
      project_name: p?.name ?? "",
      body: `Bytte modell → ${m?.model_id ?? "?"}${r.reason ? " · " + r.reason : ""}`,
    });
  }

  for (const r of (incidents.data ?? []) as unknown as Array<{
    occurred_at: string;
    title: string;
    project?:
      | { slug?: string | null; name?: string | null }
      | Array<{ slug?: string | null; name?: string | null }>
      | null;
  }>) {
    const p = one(r.project);
    out.push({
      sort: r.occurred_at,
      when: fmtTs(r.occurred_at),
      actor: "—",
      kind: "incident",
      project_id: p?.slug ? "p-" + p.slug : "",
      project_name: p?.name ?? "",
      body: r.title,
    });
  }

  for (const r of (invoices.data ?? []) as unknown as Array<{
    invoice_date: string | null;
    invoice_number: string | null;
    status: string | null;
    customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
  }>) {
    const c = one(r.customer);
    out.push({
      sort: r.invoice_date ?? "",
      when: r.invoice_date ?? "",
      actor: "Fortnox",
      kind: "invoice",
      project_id: "",
      project_name: c?.name ?? "",
      body: `Faktura ${r.invoice_number ?? ""} · ${r.status ?? ""}`,
    });
  }

  return out
    .sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0))
    .slice(0, limit)
    .map(({ sort: _sort, ...rest }) => rest);
}

export async function listUpdatesForProject(
  projectId: string,
): Promise<Update[]> {
  const supabase = await createSupabaseServer();
  const slug = stripP(projectId);
  const [switches, incidents] = await Promise.all([
    supabase
      .from("model_switches")
      .select(
        "switched_at, reason, to_model:ai_models!to_model_id(model_id), actor:team_members(full_name), project:projects!inner(slug)",
      )
      .eq("project.slug", slug)
      .order("switched_at", { ascending: false }),
    supabase
      .from("incidents")
      .select("occurred_at, title, project:projects!inner(slug)")
      .eq("project.slug", slug)
      .order("occurred_at", { ascending: false }),
  ]);

  const out: Array<Update & { sort: string }> = [];
  for (const r of (switches.data ?? []) as unknown as Array<{
    switched_at: string;
    reason: string | null;
    to_model?: { model_id?: string | null } | { model_id?: string | null }[] | null;
    actor?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  }>) {
    const m = one(r.to_model);
    const a = one(r.actor);
    out.push({
      sort: r.switched_at,
      when: fmtTs(r.switched_at),
      actor: a?.full_name ?? "—",
      kind: "model",
      project: projectId,
      body: `Bytte modell → ${m?.model_id ?? "?"}${r.reason ? " · " + r.reason : ""}`,
    });
  }
  for (const r of (incidents.data ?? []) as unknown as Array<{
    occurred_at: string;
    title: string;
  }>) {
    out.push({
      sort: r.occurred_at,
      when: fmtTs(r.occurred_at),
      actor: "—",
      kind: "incident",
      project: projectId,
      body: r.title,
    });
  }
  return out
    .sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0))
    .map(({ sort: _sort, ...rest }) => rest);
}

// ============ Shared helpers ============

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtTs(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// ============ Dependencies ============

interface DbDependency {
  name: string;
  vendor: string | null;
  type: Dependency["category"] | null;
  monthly_cost_sek: number | null;
  is_critical: boolean;
  project?: { slug?: string | null } | { slug?: string | null }[] | null;
}

function toDependency(r: DbDependency): Dependency {
  const proj = one(r.project);
  return {
    project_id: proj?.slug ? "p-" + proj.slug : "",
    name: r.name,
    vendor: r.vendor ?? "",
    category: r.type ?? "other",
    monthly_sek: Number(r.monthly_cost_sek ?? 0),
    critical: r.is_critical,
  };
}

export async function listDependencies(): Promise<Dependency[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("dependencies")
    .select("name, vendor, type, monthly_cost_sek, is_critical, project:projects(slug)")
    .order("name");
  return (data as unknown as DbDependency[] | null ?? []).map(toDependency);
}

export async function listDependenciesForProject(
  projectId: string,
): Promise<Dependency[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("dependencies")
    .select(
      "name, vendor, type, monthly_cost_sek, is_critical, project:projects!inner(slug)",
    )
    .eq("project.slug", stripP(projectId))
    .order("name");
  return (data as unknown as DbDependency[] | null ?? []).map(toDependency);
}

// ============ Notes ============

interface DbNote {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  created_at: string;
  author?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

function toNote(r: DbNote, parent: string): Note {
  const author = one(r.author);
  return {
    id: r.id,
    parent,
    title: r.title ?? "",
    when: (r.created_at ?? "").slice(0, 10),
    author: initialsOf(author?.full_name ?? ""),
    tag: r.category ?? "general",
    body: r.content,
  };
}

const NOTE_SELECT =
  "id, title, content, category, created_at, author:team_members(full_name)";

export async function listGlobalNotes(): Promise<Note[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("parent_type", "global")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as unknown as DbNote[] | null ?? []).map((r) => toNote(r, "global"));
}

export async function listNotesForProject(projectId: string): Promise<Note[]> {
  const supabase = await createSupabaseServer();
  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", stripP(projectId))
    .maybeSingle();
  if (!proj) return [];
  const { data } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("parent_type", "project")
    .eq("parent_id", (proj as { id: string }).id)
    .order("created_at", { ascending: false });
  return (data as unknown as DbNote[] | null ?? []).map((r) =>
    toNote(r, projectId),
  );
}

// ============ Model history (from model_switches) ============

interface DbModelSwitch {
  switched_at: string;
  reason: string | null;
  to_model?: { model_id?: string | null } | { model_id?: string | null }[] | null;
  actor?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

export async function listModelSwitchesForProject(
  projectId: string,
): Promise<ModelHistoryEntry[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("model_switches")
    .select(
      "switched_at, reason, to_model:ai_models!to_model_id(model_id), actor:team_members(full_name), project:projects!inner(slug)",
    )
    .eq("project.slug", stripP(projectId))
    .order("switched_at", { ascending: false });
  return (data as unknown as DbModelSwitch[] | null ?? []).map((r) => {
    const m = one(r.to_model);
    const a = one(r.actor);
    return {
      project_id: projectId,
      model_id: m?.model_id ?? "",
      from: (r.switched_at ?? "").slice(0, 10),
      to: null,
      actor: a?.full_name ?? "—",
      note: r.reason ?? "",
    };
  });
}

// ============ Incidents ============

interface DbIncident {
  ref: string;
  severity: "low" | "medium" | "high" | "critical" | null;
  title: string;
  summary: string | null;
  occurred_at: string;
  resolved_at: string | null;
  project?: { slug?: string | null } | { slug?: string | null }[] | null;
}

function toIncident(r: DbIncident): Incident {
  const proj = one(r.project);
  const severity: Incident["severity"] =
    r.severity === "critical" ? "high" : (r.severity ?? "low");
  return {
    id: r.ref,
    when: fmtTs(r.occurred_at),
    project_id: proj?.slug ? "p-" + proj.slug : "",
    severity,
    title: r.title,
    summary: r.summary ?? "",
    resolved: r.resolved_at != null,
  };
}

export async function listIncidents(): Promise<Incident[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("incidents")
    .select(
      "ref, severity, title, summary, occurred_at, resolved_at, project:projects(slug)",
    )
    .order("occurred_at", { ascending: false });
  return (data as unknown as DbIncident[] | null ?? []).map(toIncident);
}

// ============ Invoices ============

interface DbInvoice {
  id: string;
  fortnox_invoice_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_excl_vat_sek: number | null;
  total_incl_vat_sek: number | null;
  status: "draft" | "sent" | "paid" | "overdue" | "credited" | null;
  recurring: boolean | null;
  customer?: { slug?: string | null } | { slug?: string | null }[] | null;
  project?: { slug?: string | null } | { slug?: string | null }[] | null;
}

function toInvoice(r: DbInvoice): Invoice {
  const cust = one(r.customer);
  const proj = one(r.project);
  const status: Invoice["status"] =
    r.status === "credited" ? "paid" : (r.status ?? "draft");
  return {
    id: r.invoice_number ?? r.fortnox_invoice_id ?? r.id,
    customer_id: cust?.slug ?? "",
    project_id: proj?.slug ? "p-" + proj.slug : "",
    date: r.invoice_date ?? "",
    due: r.due_date ?? "",
    amount: Number(r.total_incl_vat_sek ?? r.total_excl_vat_sek ?? 0),
    status,
    recurring: !!r.recurring,
  };
}

const INVOICE_SELECT =
  "id, fortnox_invoice_id, invoice_number, invoice_date, due_date, total_excl_vat_sek, total_incl_vat_sek, status, recurring, customer:customers(slug), project:projects(slug)";

export async function listInvoices(): Promise<Invoice[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .order("invoice_date", { ascending: false });
  return (data as unknown as DbInvoice[] | null ?? []).map(toInvoice);
}

export async function listInvoicesForCustomer(
  customerId: string,
): Promise<Invoice[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, fortnox_invoice_id, invoice_number, invoice_date, due_date, total_excl_vat_sek, total_incl_vat_sek, status, recurring, customer:customers!inner(slug), project:projects(slug)",
    )
    .eq("customer.slug", customerId)
    .order("invoice_date", { ascending: false });
  return (data as unknown as DbInvoice[] | null ?? []).map(toInvoice);
}

// ============ Team ============

interface DbTeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "editor" | "viewer";
  is_active: boolean;
}

function toTeamMember(r: DbTeamMember): TeamMember {
  return {
    id: r.id,
    name: r.full_name ?? r.email,
    email: r.email,
    role: r.role,
    initials: initialsOf(r.full_name ?? r.email),
    color: pickMark(r.email),
    active: r.is_active,
  };
}

export async function listTeam(): Promise<TeamMember[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("team_members")
    .select("id, email, full_name, role, is_active")
    .order("full_name");
  return (data as unknown as DbTeamMember[] | null ?? []).map(toTeamMember);
}

// ============ Integrations ============

interface DbIntegration {
  provider_slug: string;
  metadata: Record<string, unknown> | null;
  last_synced_at: string | null;
  last_sync_status: "ok" | "partial" | "failed" | "rate_limited" | null;
  last_sync_error: string | null;
}

const INTEGRATION_NAMES: Record<string, string> = {
  anthropic: "Anthropic Admin API",
  openai: "OpenAI Organization",
  google: "Google Cloud Billing",
  fortnox: "Fortnox",
  github: "GitHub",
  vercel: "Vercel",
  riksbanken: "Riksbanken (FX)",
};

function toIntegration(r: DbIntegration): Integration {
  const status: Integration["status"] =
    r.last_sync_status === "ok"
      ? "ok"
      : r.last_sync_status === "failed"
        ? "fail"
        : r.last_sync_status == null
          ? "ok"
          : "warn";
  const meta = r.metadata ?? {};
  return {
    id: r.provider_slug,
    name: INTEGRATION_NAMES[r.provider_slug] ?? r.provider_slug,
    desc: typeof meta.description === "string" ? meta.description : "",
    status,
    last_sync: r.last_synced_at ? fmtTs(r.last_synced_at) : "—",
    workspaces: typeof meta.workspaces === "number" ? meta.workspaces : null,
    color: "paper",
    note: r.last_sync_error ?? undefined,
  };
}

export async function listIntegrations(): Promise<Integration[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("integrations_credentials")
    .select(
      "provider_slug, metadata, last_synced_at, last_sync_status, last_sync_error",
    );
  return (data as unknown as DbIntegration[] | null ?? []).map(toIntegration);
}

// ============ Sync runs ============

interface DbSyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "ok" | "partial" | "failed" | "rate_limited" | null;
  records_ingested: number | null;
  error_message: string | null;
  integration?:
    | { provider_slug?: string | null }
    | { provider_slug?: string | null }[]
    | null;
}

function toSyncRun(r: DbSyncRun): SyncRun {
  const integ = one(r.integration);
  const status: SyncRun["status"] =
    r.status === "ok" ? "ok" : r.status === "failed" ? "fail" : "warn";
  let took = "—";
  if (r.finished_at && r.started_at) {
    const ms =
      new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
    if (ms >= 0) took = (ms / 1000).toFixed(1) + "s";
  }
  return {
    id: r.id,
    integration: integ?.provider_slug ?? "—",
    at: fmtTs(r.started_at),
    status,
    records: r.records_ingested ?? 0,
    took,
    err: r.error_message ?? undefined,
  };
}

export async function listSyncRuns(limit = 12): Promise<SyncRun[]> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("integration_sync_runs")
    .select(
      "id, started_at, finished_at, status, records_ingested, error_message, integration:integrations_credentials(provider_slug)",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data as unknown as DbSyncRun[] | null ?? []).map(toSyncRun);
}

// ============ Portfolio token totals ============

export interface PortfolioTokenTotals {
  cost_sek: number;
  tokens_in: number;
  tokens_out: number;
}

export async function getPortfolioTokenTotals(
  days = 60,
): Promise<PortfolioTokenTotals> {
  const supabase = await createSupabaseServer();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await supabase
    .from("token_usage_daily")
    .select("input_tokens, output_tokens, cost_sek")
    .gte("usage_date", since.toISOString().slice(0, 10));
  const rows = (data ?? []) as Array<{
    input_tokens: number | null;
    output_tokens: number | null;
    cost_sek: number | null;
  }>;
  return {
    cost_sek: rows.reduce((s, r) => s + Number(r.cost_sek ?? 0), 0),
    tokens_in: rows.reduce((s, r) => s + Number(r.input_tokens ?? 0), 0),
    tokens_out: rows.reduce((s, r) => s + Number(r.output_tokens ?? 0), 0),
  };
}
