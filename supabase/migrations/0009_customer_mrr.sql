-- Customer MRR from Fortnox-synced invoices + P&L fix: overdue invoices are
-- still booked revenue (mapStatus turns past-due 'sent' into 'overdue', which
-- the old MV filter silently dropped).

-- 1) Recreate the P&L matview including overdue invoices in revenue.
drop materialized view if exists public.mv_project_pnl_monthly;
create materialized view public.mv_project_pnl_monthly as
with revenue as (
  select il.project_id, date_trunc('month', i.invoice_date)::date as period_month,
         sum(il.amount_sek) as revenue_sek
  from public.invoice_lines il
  join public.invoices i on i.id = il.invoice_id
  where i.status in ('sent','paid','overdue') and il.project_id is not null
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

create unique index mv_project_pnl_monthly_unique
  on public.mv_project_pnl_monthly (project_id, period_month);
grant select on public.mv_project_pnl_monthly to authenticated;

-- 2) Customer MRR view. recurring_mrr_sek = recurring (avtalsfakturerade)
-- invoices in the latest complete month; trailing3_avg_sek = average monthly
-- invoiced total over the last 3 complete months (fallback while the
-- recurring flag is unproven).
create or replace view public.v_customer_mrr as
with monthly as (
  select i.customer_id,
         date_trunc('month', i.invoice_date)::date as m,
         sum(i.total_excl_vat_sek) filter (where i.recurring) as recurring_sek,
         sum(i.total_excl_vat_sek) as total_sek
  from public.invoices i
  where i.status in ('sent','paid','overdue') and i.customer_id is not null
  group by 1, 2
),
bounds as (
  select (date_trunc('month', now()) - interval '1 month')::date as last_complete
)
select c.id as customer_id,
       coalesce((
         select m2.recurring_sek from monthly m2, bounds b
         where m2.customer_id = c.id and m2.m = b.last_complete
       ), 0) as recurring_mrr_sek,
       coalesce((
         select avg(m3.total_sek) from monthly m3, bounds b
         where m3.customer_id = c.id
           and m3.m > (b.last_complete - interval '3 months')::date
           and m3.m <= b.last_complete
       ), 0) as trailing3_avg_sek
from public.customers c;

grant select on public.v_customer_mrr to authenticated, service_role;
