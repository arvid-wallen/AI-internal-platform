-- Atomic model switch as a single transaction.
-- Fixes the previous three-step client flow which (a) was non-transactional
-- (a failure after step 1 left a project with no active model) and (b) passed
-- domain ids ("p-<slug>", model_id strings) into uuid FK columns and failed.
-- SECURITY INVOKER so the existing write_editors RLS policies decide who may
-- switch; from_model and actor are derived server-side.

create or replace function public.switch_active_model(
  p_project_slug text,
  p_to_model text,
  p_reason text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
  v_to_model uuid;
  v_from_model uuid;
  v_actor uuid;
  v_now timestamptz := now();
begin
  select id into v_project from projects where slug = p_project_slug;
  if v_project is null then
    raise exception 'Projektet % finns inte', p_project_slug;
  end if;

  select id into v_to_model
  from ai_models
  where model_id = p_to_model
  order by is_current desc
  limit 1;
  if v_to_model is null then
    raise exception 'Modellen % finns inte', p_to_model;
  end if;

  select tm.id into v_actor
  from team_members tm
  where tm.supabase_user_id = auth.uid();

  select pm.model_id into v_from_model
  from project_models pm
  where pm.project_id = v_project and pm.is_active and pm.effective_to is null
  limit 1;

  if v_from_model = v_to_model then
    return; -- already active, nothing to do
  end if;

  update project_models
  set is_active = false, effective_to = v_now
  where project_id = v_project and is_active and effective_to is null;

  insert into project_models
    (project_id, model_id, role, is_active, effective_from, note, created_by)
  values
    (v_project, v_to_model, 'primary', true, v_now, p_reason, v_actor);

  insert into model_switches
    (project_id, from_model_id, to_model_id, switched_at, actor_id, reason)
  values
    (v_project, v_from_model, v_to_model, v_now, v_actor, p_reason);
end;
$$;

revoke execute on function public.switch_active_model(text, text, text) from public, anon;
grant execute on function public.switch_active_model(text, text, text) to authenticated, service_role;
