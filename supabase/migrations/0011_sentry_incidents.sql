-- Sentry → incidents mirroring: unresolved Sentry issues become incident rows
-- (auto-resolved when they resolve in Sentry, reopened on regression).

alter table public.incidents
  add column if not exists sentry_issue_id text unique,
  add column if not exists external_url text;

-- Integration row so the cron's sync runs land in the existing log.
insert into public.integrations_credentials (provider_slug, scope, metadata)
values ('sentry', 'org:read project:read event:read', '{}'::jsonb)
on conflict (provider_slug) do nothing;
