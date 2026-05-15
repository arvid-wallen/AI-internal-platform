// Core domain types — mirrors prototype data.js shapes.

export type ProviderSlug = "anthropic" | "openai" | "google";

export interface Provider {
  slug: ProviderSlug;
  name: string;
  color: string;
}

export interface AIModel {
  id: string;
  provider: ProviderSlug;
  display: string;
  price_in: number; // USD per 1M input tokens
  price_out: number; // USD per 1M output tokens
  ctx: number;
  is_current: boolean;
  released: string; // ISO date
}

export type CustomerClass = "A" | "B" | "C";
export type ContractStatus = "live" | "paused" | "draft" | "offboarded";

export interface Customer {
  id: string;
  name: string;
  org_number: string;
  cls: CustomerClass;
  am: string;
  contract: ContractStatus;
  mrr: number;
  mark: string;
  init: string;
}

export type ProjectStatus =
  | "discovery"
  | "building"
  | "live"
  | "paused"
  | "offboarded";

export interface Project {
  id: string;
  slug: string;
  name: string;
  customer_id: string;
  status: ProjectStatus;
  go_live: string | null;
  repo: string | null;
  hosting: string;
  stack: string[];
  active_model: string;
  monthly_revenue: number;
  infra_cost: number;
  ai_cost: number;
  owner: string;
  healthy: boolean;
}

export interface DailyUsage {
  date: string;
  project_id: string;
  model_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  cost_sek: number;
}

export interface ModelHistoryEntry {
  project_id: string;
  model_id: string;
  from: string;
  to: string | null;
  actor: string;
  note: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice {
  id: string;
  customer_id: string;
  project_id: string;
  date: string;
  due: string;
  amount: number;
  status: InvoiceStatus;
  recurring: boolean;
}

export type IncidentSeverity = "low" | "medium" | "high";

export interface Incident {
  id: string;
  when: string;
  project_id: string;
  severity: IncidentSeverity;
  title: string;
  summary: string;
  resolved: boolean;
}

export type TeamRole = "admin" | "editor" | "viewer";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  initials: string;
  color: string;
  active: boolean;
}

export type IntegrationStatus = "ok" | "warn" | "fail";

export interface Integration {
  id: string;
  name: string;
  desc: string;
  status: IntegrationStatus;
  last_sync: string;
  workspaces: number | null;
  color: string;
  note?: string;
}

export interface SyncRun {
  id: string;
  integration: string;
  at: string;
  status: IntegrationStatus;
  records: number;
  took: string;
  err?: string;
}

export interface Note {
  id: string;
  parent: string;
  title: string;
  when: string;
  author: string;
  tag: string;
  body: string;
}

export interface Dependency {
  project_id: string;
  name: string;
  vendor: string;
  category:
    | "database"
    | "hosting"
    | "storage"
    | "third_party_api"
    | "auth"
    | "email"
    | "payment"
    | "ai_provider"
    | "other";
  monthly_sek: number;
  critical: boolean;
}

export interface Update {
  when: string;
  actor: string;
  kind: string;
  project: string;
  body: string;
}

export interface PortfolioTotals {
  project_count: number;
  live_count: number;
  customer_count: number;
  total_mrr: number;
  ai_cost: number;
  infra_cost: number;
  margin: number;
  margin_pct: number;
}
