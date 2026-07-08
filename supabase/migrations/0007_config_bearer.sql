-- Per-project bearer tokens for the public pull-config endpoint.
-- Stores only a sha256 hex hash; the plaintext token (haus_cfg_...) is shown
-- once at rotation. A project with no hash has the endpoint disabled (401).
-- Replaces the never-used vault reference column.

alter table public.projects
  add column if not exists config_bearer_hash text,
  add column if not exists config_bearer_rotated_at timestamptz;

alter table public.projects
  drop column if exists config_bearer_secret_id;
