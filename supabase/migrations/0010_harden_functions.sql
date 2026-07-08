-- Security-advisor hardening (supabase get_advisors, 2026-07-08):
--  - SECURITY DEFINER functions were executable by anon via PostgREST RPC
--  - mv_project_pnl_monthly was selectable by anon
--  - set_updated_at had a mutable search_path
--  - pg_trgm lived in the public schema

-- Trigger functions never need API-role EXECUTE (triggers run regardless).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- RLS helper functions: only authenticated sessions evaluate policies.
revoke execute on function public.is_haus_member() from public, anon;
revoke execute on function public.has_role(text) from public, anon;

-- Matview refresh: keep authenticated (called from the card-cost import
-- server actions with the user session) + service_role; block anon spam.
revoke execute on function public.refresh_pnl_monthly() from public, anon;

alter function public.set_updated_at() set search_path = public;

revoke select on public.mv_project_pnl_monthly from anon;

-- Move pg_trgm out of public. The only usage is the gin index
-- projects_slug_trgm_idx, whose opclass reference survives relocation.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
