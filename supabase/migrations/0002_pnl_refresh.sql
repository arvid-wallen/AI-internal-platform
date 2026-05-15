-- Wrapper RPC so the Next.js cron route can refresh the materialized view
-- via PostgREST (which doesn't expose REFRESH MATERIALIZED VIEW directly).
create or replace function public.refresh_pnl_monthly()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_project_pnl_monthly;
exception
  -- First refresh can't use concurrently because the unique index hasn't
  -- been populated; fall back to a regular refresh in that case.
  when feature_not_supported then
    refresh materialized view public.mv_project_pnl_monthly;
end
$$;

grant execute on function public.refresh_pnl_monthly() to authenticated, service_role;
