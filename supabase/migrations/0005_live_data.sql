-- 0005_live_data — support live integration data
-- GitHub metadata columns
alter table public.projects
  add column if not exists github_last_commit_sha text,
  add column if not exists github_last_commit_at timestamptz,
  add column if not exists github_open_prs int;

-- Placeholder customer for auto-provisioned (unmapped) projects.
insert into public.customers (slug, name, customer_class, contract_status)
values ('unassigned', 'Ej tilldelad', 'C', 'live')
on conflict (slug) do nothing;

-- Recreate P&L mv so AI/infra costs are not gated on a matching revenue row.
-- The original join required ac.period_month = r.period_month, which zeroed
-- AI cost for any project/month without an invoice. We instead union the
-- period keys from all three sources and left-join each.
drop materialized view if exists public.mv_project_pnl_monthly cascade;
create materialized view public.mv_project_pnl_monthly as
with revenue as (
  select il.project_id, date_trunc('month', i.invoice_date)::date as period_month,
         sum(il.amount_sek) as revenue_sek
  from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.status in ('sent','paid') and il.project_id is not null
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
  select c.project_id, c.period_month, sum(c.amount_sek) as infra_cost_sek
  from public.costs_monthly c
  where c.project_id is not null
  group by 1, 2
),
keys as (
  select project_id, period_month from revenue
  union select project_id, period_month from ai_costs
  union select project_id, period_month from infra_costs
)
select p.id as project_id,
       p.name,
       p.customer_id,
       k.period_month,
       coalesce(r.revenue_sek, 0) as revenue_sek,
       coalesce(ac.ai_cost_sek, 0) as ai_cost_sek,
       coalesce(ic.infra_cost_sek, 0) as infra_cost_sek,
       coalesce(r.revenue_sek, 0) - coalesce(ac.ai_cost_sek, 0) - coalesce(ic.infra_cost_sek, 0) as margin_sek,
       case when coalesce(r.revenue_sek, 0) = 0 then null
            else (coalesce(r.revenue_sek, 0) - coalesce(ac.ai_cost_sek, 0) - coalesce(ic.infra_cost_sek, 0))
                 / nullif(r.revenue_sek, 0) end as margin_pct
from keys k
join public.projects p on p.id = k.project_id
left join revenue r on r.project_id = k.project_id and r.period_month = k.period_month
left join ai_costs ac on ac.project_id = k.project_id and ac.period_month = k.period_month
left join infra_costs ic on ic.project_id = k.project_id and ic.period_month = k.period_month;

create unique index mv_project_pnl_monthly_unique on public.mv_project_pnl_monthly (project_id, period_month);
grant select on public.mv_project_pnl_monthly to authenticated;
