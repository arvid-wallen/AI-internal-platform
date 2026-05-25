-- Card-cost vendor classification rules.
-- match_pattern is a lowercase substring tested against the normalized merchant
-- text (see lib/integrations/card-costs/rules.ts). Longest match wins.
-- Seeded from the April 2026 company-card export; the import flow also learns
-- new rules when the user confirms a previously-unknown merchant.

create table public.card_vendor_rules (
  id uuid primary key default gen_random_uuid(),
  match_pattern text not null unique,
  canonical_vendor text not null,
  cost_category text check (cost_category in (
    'hosting','database','storage','cdn','third_party_api','domain','other'
  )),
  is_software boolean not null default true,
  is_api_usage boolean not null default false,
  default_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger card_vendor_rules_set_updated_at
  before update on public.card_vendor_rules
  for each row execute function public.set_updated_at();

alter table public.card_vendor_rules enable row level security;
create policy "read_haus_members" on public.card_vendor_rules
  for select using (public.is_haus_member());
create policy "write_editors" on public.card_vendor_rules
  for all using (public.has_role('editor')) with check (public.has_role('editor'));

-- ============================================================
-- Seed: known vendors from the April 2026 card export
-- ============================================================
insert into public.card_vendor_rules
  (match_pattern, canonical_vendor, cost_category, is_software, is_api_usage)
values
  -- Hosting / cloud
  ('vercel',          'Vercel',              'hosting', true, false),
  ('hetzner',         'Hetzner',             'hosting', true, false),
  ('digitalocean',    'DigitalOcean',        'hosting', true, false),
  ('railway',         'Railway',             'hosting', true, false),
  ('wix',             'Wix',                 'hosting', true, false),
  ('google cloud',    'Google Cloud',        'hosting', true, false),
  -- Database / vector
  ('supabase',        'Supabase',            'database', true, false),
  ('pinecone',        'Pinecone',            'database', true, false),
  -- Domain / site
  ('sqsp domain',     'Squarespace (domän)', 'domain', true, false),
  ('sqsp worksp',     'Squarespace',         'other',  true, false),
  -- SaaS tools / APIs
  ('cursor',          'Cursor',              'third_party_api', true, false),
  ('lovable',         'Lovable',             'third_party_api', true, false),
  ('make.com',        'Make',                'third_party_api', true, false),
  ('n8n',             'n8n',                 'third_party_api', true, false),
  ('zapier',          'Zapier',              'third_party_api', true, false),
  ('twilio',          'Twilio',              'third_party_api', true, false),
  ('resend',          'Resend',              'third_party_api', true, false),
  ('superhuman',      'Superhuman',          'third_party_api', true, false),
  ('notion',          'Notion',              'third_party_api', true, false),
  ('monday',          'Monday.com',          'third_party_api', true, false),
  ('typeform',        'Typeform',            'third_party_api', true, false),
  ('pandadoc',        'PandaDoc',            'third_party_api', true, false),
  ('qwilr',           'Qwilr',               'third_party_api', true, false),
  ('retool',          'Retool',              'third_party_api', true, false),
  ('apify',           'Apify',               'third_party_api', true, false),
  ('firecrawl',       'Firecrawl',           'third_party_api', true, false),
  ('recall',          'Recall.ai',           'third_party_api', true, false),
  ('fireflies',       'Fireflies',           'third_party_api', true, false),
  ('chatbase',        'Chatbase',            'third_party_api', true, false),
  ('perplexity',      'Perplexity',          'third_party_api', true, false),
  ('runway',          'Runway',              'third_party_api', true, false),
  ('llamaindex',      'LlamaIndex',          'third_party_api', true, false),
  ('lusha',           'Lusha',               'third_party_api', true, false),
  ('instantly',       'Instantly',           'third_party_api', true, false),
  ('dripify',         'Dripify',             'third_party_api', true, false),
  ('linkedin',        'LinkedIn',            'third_party_api', true, false),
  ('skool',           'Skool',               'third_party_api', true, false),
  -- Other software (non-infra)
  ('bitwarden',       'Bitwarden',           'other', true, false),
  ('adobe',           'Adobe',               'other', true, false),
  ('google workspace','Google Workspace',    'other', true, false),
  -- AI providers: raw API usage is already in the token sync -> exclude by default
  ('openai',          'OpenAI',              'third_party_api', true, true),
  ('anthropic',       'Anthropic',           'third_party_api', true, true),
  -- ...but the seat subscriptions are genuinely separate -> keep
  ('chatgpt',         'ChatGPT (OpenAI)',    'third_party_api', true, false),
  ('claude.ai',       'Claude (Anthropic)',  'third_party_api', true, false),
  -- Non-software (food, parking, hotels, travel) -> excluded from import
  ('apcoa',           'Apcoa Parking',       'other', false, false),
  ('aimo',            'Aimo Park',           'other', false, false),
  ('magpie',          'Magpie Restaurang',   'other', false, false),
  ('coop',            'Coop',                'other', false, false),
  ('comforthotel',    'Comfort Hotel',       'other', false, false),
  ('adam &',          'Adam & Oliver',       'other', false, false),
  ('sj.se',           'SJ',                  'other', false, false),
  ('uber',            'Uber',                'other', false, false)
on conflict (match_pattern) do nothing;
