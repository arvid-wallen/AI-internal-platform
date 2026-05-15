-- Haus AI Operations Hub — initial schema
-- 2026-05-15

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
-- supabase_vault is opt-in — enable via Supabase Studio → Database → Extensions
-- to store integrations_credentials.vault_secret_id encrypted secrets.

-- ============================================================
-- Helper: set updated_at on UPDATE
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Team & access
-- ============================================================
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (email like '%@haus.se'),
  full_name text,
  role text not null check (role in ('admin','editor','viewer')) default 'viewer',
  title text,
  supabase_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();
create index team_members_user_id_idx on public.team_members(supabase_user_id) where supabase_user_id is not null;

-- ============================================================
-- AI providers + models
-- ============================================================
create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  api_base_url text,
  status text not null default 'active' check (status in ('active','deprecated'))
);

create table public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete restrict,
  model_id text not null,
  display_name text not null,
  family text,
  context_window int,
  input_price_per_mtok_usd numeric(10,4),
  output_price_per_mtok_usd numeric(10,4),
  cache_read_price_per_mtok_usd numeric(10,4),
  cache_write_price_per_mtok_usd numeric(10,4),
  released_at date,
  deprecated_at date,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider_id, model_id)
);
create index ai_models_provider_idx on public.ai_models(provider_id);
create index ai_models_is_current_idx on public.ai_models(is_current) where is_current;

-- ============================================================
-- Customers + projects
-- ============================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  org_number text unique,
  account_manager_id uuid references public.team_members(id) on delete set null,
  customer_class text check (customer_class in ('A','B','C')) default 'C',
  contract_status text not null default 'live' check (contract_status in ('live','paused','draft','offboarded')),
  invoice_email text,
  primary_contact_name text,
  primary_contact_email text,
  fortnox_customer_id text unique,
  notes_count int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();
create index customers_account_manager_idx on public.customers(account_manager_id);
create index customers_class_idx on public.customers(customer_class);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  name text not null,
  slug text unique not null,
  status text not null default 'discovery' check (status in ('discovery','building','live','paused','offboarded')),
  go_live_date date,
  github_repo_url text,
  github_default_branch text default 'main',
  hosting_provider text,
  hosting_external_id text,
  monthly_revenue_sek numeric(12,2) default 0,
  monthly_infra_budget_sek numeric(12,2),
  internal_owner_id uuid references public.team_members(id) on delete set null,
  tech_stack text[] default '{}',
  description text,
  config_bearer_secret_id uuid,  -- vault.secrets reference for pull-config endpoint
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
create index projects_customer_idx on public.projects(customer_id);
create index projects_status_idx on public.projects(status);
create index projects_slug_trgm_idx on public.projects using gin (slug gin_trgm_ops);

create table public.project_models (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  model_id uuid not null references public.ai_models(id) on delete restrict,
  role text not null default 'primary' check (role in ('primary','fallback','experimental')),
  is_active boolean not null default true,
  config jsonb default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  note text,
  created_by uuid references public.team_members(id) on delete set null
);
create index project_models_active_idx on public.project_models(project_id, is_active) where is_active;
create index project_models_window_idx on public.project_models(project_id, effective_to nulls first);

-- ============================================================
-- Token usage + costs
-- ============================================================
create table public.fx_rates (
  date date primary key,
  usd_sek numeric(10,4) not null,
  eur_sek numeric(10,4),
  source text
);

create table public.token_usage_daily (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  model_id uuid references public.ai_models(id) on delete set null,
  provider_id uuid references public.ai_providers(id) on delete set null,
  usage_date date not null,
  input_tokens bigint default 0,
  output_tokens bigint default 0,
  cache_read_tokens bigint default 0,
  cache_write_tokens bigint default 0,
  request_count int default 0,
  cost_usd numeric(12,4),
  cost_sek numeric(12,2),
  source_workspace_id text,
  raw jsonb,
  ingested_at timestamptz not null default now(),
  unique (project_id, model_id, usage_date, source_workspace_id)
);
create index token_usage_date_idx on public.token_usage_daily(usage_date desc, project_id);
create index token_usage_project_date_idx on public.token_usage_daily(project_id, usage_date);
create index token_usage_provider_date_idx on public.token_usage_daily(provider_id, usage_date);

create table public.costs_monthly (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  cost_category text check (cost_category in (
    'hosting','database','storage','cdn','third_party_api','domain','other'
  )),
  vendor text,
  period_month date not null,
  amount_sek numeric(12,2),
  amount_usd numeric(12,2),
  source text check (source in ('api','manual','csv_import')) default 'manual',
  raw jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, cost_category, vendor, period_month)
);
create index costs_monthly_project_idx on public.costs_monthly(project_id, period_month desc);
create index costs_monthly_period_idx on public.costs_monthly(period_month);

-- ============================================================
-- Invoices (Fortnox mirror)
-- ============================================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  fortnox_invoice_id text unique,
  customer_id uuid references public.customers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  invoice_number text,
  invoice_date date,
  due_date date,
  total_excl_vat_sek numeric(12,2),
  total_incl_vat_sek numeric(12,2),
  status text check (status in ('draft','sent','paid','overdue','credited')),
  recurring boolean default false,
  recurrence_period text check (recurrence_period in ('monthly','quarterly','yearly')),
  raw jsonb,
  synced_at timestamptz
);
create index invoices_customer_idx on public.invoices(customer_id, invoice_date desc);
create index invoices_status_idx on public.invoices(status);
create index invoices_project_idx on public.invoices(project_id);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text,
  amount_sek numeric(12,2),
  project_id uuid references public.projects(id) on delete set null,
  category text check (category in ('subscription','one_time','support'))
);

-- ============================================================
-- Dependencies, notes, incidents, integrations
-- ============================================================
create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  vendor text,
  type text check (type in ('database','hosting','auth','email','payment','ai_provider','storage','third_party_api','other')),
  external_url text,
  monthly_cost_sek numeric(12,2),
  is_critical boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index dependencies_project_idx on public.dependencies(project_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null check (parent_type in ('customer','project','model','global')),
  parent_id uuid,
  category text check (category in ('general','process','strategy','evaluation','financial','technical','hosting','plugin','file','link')) default 'general',
  title text,
  content text not null,
  url text,
  file_path text,
  author_id uuid references public.team_members(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_parent_idx on public.notes(parent_type, parent_id);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  project_id uuid references public.projects(id) on delete set null,
  severity text check (severity in ('low','medium','high','critical')) default 'low',
  title text not null,
  summary text,
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index incidents_project_idx on public.incidents(project_id, occurred_at desc);

create table public.integrations_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_slug text unique not null,
  vault_secret_id uuid,           -- API key / OAuth access token
  refresh_token_secret_id uuid,
  scope text,
  metadata jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok','partial','failed','rate_limited')),
  last_sync_error text,
  next_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.integrations_credentials(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text check (status in ('ok','partial','failed','rate_limited')),
  records_ingested int,
  cost_usd numeric(10,4),
  error_message text,
  raw_response_sample jsonb
);
create index sync_runs_integration_idx on public.integration_sync_runs(integration_id, started_at desc);

-- ============================================================
-- Model history (immutable-ish — uses effective_to instead of UPDATE on model)
-- ============================================================
create table public.model_switches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_model_id uuid references public.ai_models(id),
  to_model_id uuid not null references public.ai_models(id),
  switched_at timestamptz not null default now(),
  actor_id uuid references public.team_members(id) on delete set null,
  reason text,
  estimated_delta_pct numeric(6,2)
);
create index model_switches_project_idx on public.model_switches(project_id, switched_at desc);

-- ============================================================
-- Materialized view: P&L per project per month
-- ============================================================
create materialized view public.mv_project_pnl_monthly as
with revenue as (
  select il.project_id, date_trunc('month', i.invoice_date)::date as period_month,
         sum(il.amount_sek) as revenue_sek
  from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.status in ('sent','paid')
  group by 1, 2
),
ai_costs as (
  select t.project_id, date_trunc('month', t.usage_date)::date as period_month,
         sum(t.cost_sek) as ai_cost_sek
  from public.token_usage_daily t
  where t.project_id is not null
  group by 1, 2
),
infra_costs as (
  select c.project_id, c.period_month,
         sum(c.amount_sek) as infra_cost_sek
  from public.costs_monthly c
  group by 1, 2
)
select p.id as project_id,
       p.name,
       p.customer_id,
       coalesce(r.period_month, ac.period_month, ic.period_month) as period_month,
       coalesce(r.revenue_sek, 0) as revenue_sek,
       coalesce(ac.ai_cost_sek, 0) as ai_cost_sek,
       coalesce(ic.infra_cost_sek, 0) as infra_cost_sek,
       coalesce(r.revenue_sek, 0) - coalesce(ac.ai_cost_sek, 0) - coalesce(ic.infra_cost_sek, 0) as margin_sek,
       case when coalesce(r.revenue_sek, 0) = 0 then null
            else (coalesce(r.revenue_sek, 0) - coalesce(ac.ai_cost_sek, 0) - coalesce(ic.infra_cost_sek, 0))
                 / nullif(r.revenue_sek, 0) end as margin_pct
from public.projects p
left join revenue r on r.project_id = p.id
left join ai_costs ac on ac.project_id = p.id and ac.period_month = r.period_month
left join infra_costs ic on ic.project_id = p.id and ic.period_month = r.period_month;

create unique index mv_project_pnl_monthly_unique on public.mv_project_pnl_monthly (project_id, period_month);

-- ============================================================
-- RLS policies
-- ============================================================
create or replace function public.is_haus_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where supabase_user_id = auth.uid() and is_active
  );
$$;

create or replace function public.has_role(required text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select case required
    when 'viewer' then exists(
      select 1 from public.team_members
      where supabase_user_id = auth.uid() and role in ('admin','editor','viewer') and is_active
    )
    when 'editor' then exists(
      select 1 from public.team_members
      where supabase_user_id = auth.uid() and role in ('admin','editor') and is_active
    )
    when 'admin' then exists(
      select 1 from public.team_members
      where supabase_user_id = auth.uid() and role = 'admin' and is_active
    )
  end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'team_members','ai_providers','ai_models','customers','projects','project_models',
      'fx_rates','token_usage_daily','costs_monthly','invoices','invoice_lines',
      'dependencies','notes','incidents','model_switches'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read_haus_members" on public.%I for select using (public.is_haus_member())', t);
    execute format('create policy "write_editors" on public.%I for all using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
  end loop;
end$$;

-- integrations_credentials and sync runs — admin only
alter table public.integrations_credentials enable row level security;
create policy "admin_only" on public.integrations_credentials
  for all using (public.has_role('admin')) with check (public.has_role('admin'));

alter table public.integration_sync_runs enable row level security;
create policy "admin_only_runs" on public.integration_sync_runs
  for all using (public.has_role('admin')) with check (public.has_role('admin'));
