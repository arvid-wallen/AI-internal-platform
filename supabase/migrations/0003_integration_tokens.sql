-- Adds text columns for OAuth tokens on integrations_credentials.
-- Used until Supabase Vault is enabled; both columns are admin-only by RLS.
alter table public.integrations_credentials
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz;
