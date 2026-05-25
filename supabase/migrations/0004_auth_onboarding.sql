-- Auth onboarding: auto-link/create team_members on first @haus.se login.
-- Without this, a freshly signed-in user has no team_members row, so
-- is_haus_member() returns false and RLS hides everything.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only Haus staff. Middleware already blocks non-@haus.se, this is defence in depth.
  if new.email is null or new.email not like '%@haus.se' then
    return new;
  end if;

  -- Link an existing (seeded) team_members row by email.
  update public.team_members
    set supabase_user_id = new.id
    where email = new.email and supabase_user_id is null;

  -- No pre-seeded row → create a viewer so the user can read the hub.
  if not found then
    insert into public.team_members (email, full_name, role, supabase_user_id, is_active)
    values (
      new.email,
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.email
      ),
      'viewer',
      new.id,
      true
    )
    on conflict (email) do update set supabase_user_id = excluded.supabase_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
