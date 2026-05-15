-- Seed data for Haus AI Operations Hub.
-- Insert AFTER running migrations 0001 and 0002.
-- All values mirror lib/data.ts and are synthetic.

-- ============ AI providers ============
insert into public.ai_providers (slug, display_name, api_base_url) values
  ('anthropic', 'Anthropic',     'https://api.anthropic.com'),
  ('openai',    'OpenAI',        'https://api.openai.com'),
  ('google',    'Google Gemini', 'https://generativelanguage.googleapis.com')
on conflict (slug) do nothing;

-- ============ AI models ============
with p as (select id, slug from public.ai_providers)
insert into public.ai_models (provider_id, model_id, display_name, family, context_window,
  input_price_per_mtok_usd, output_price_per_mtok_usd, released_at, is_current)
values
  ((select id from p where slug='anthropic'), 'claude-haiku-4-5',       'Claude Haiku 4.5',   'claude',  200000,  1.00,  5.00, '2026-02-04', true),
  ((select id from p where slug='anthropic'), 'claude-sonnet-4-5',      'Claude Sonnet 4.5',  'claude', 1000000,  3.00, 15.00, '2026-01-22', true),
  ((select id from p where slug='anthropic'), 'claude-opus-4-7',        'Claude Opus 4.7',    'claude',  500000, 15.00, 75.00, '2026-03-18', true),
  ((select id from p where slug='anthropic'), 'claude-opus-4-1',        'Claude Opus 4.1',    'claude',  200000, 15.00, 75.00, '2025-08-12', false),
  ((select id from p where slug='openai'),    'gpt-5',                  'GPT-5',              'gpt',     400000, 10.00, 30.00, '2025-12-09', true),
  ((select id from p where slug='openai'),    'gpt-5-mini',             'GPT-5 Mini',         'gpt',     200000,  0.40,  2.00, '2026-02-26', true),
  ((select id from p where slug='openai'),    'o4',                     'o4 (reasoning)',     'gpt',     200000, 20.00, 80.00, '2025-11-04', true),
  ((select id from p where slug='openai'),    'gpt-4o',                 'GPT-4o',             'gpt',     128000,  2.50, 10.00, '2024-05-13', false),
  ((select id from p where slug='google'),    'gemini-2-5-pro',         'Gemini 2.5 Pro',     'gemini', 2000000,  1.25,  5.00, '2025-09-30', true),
  ((select id from p where slug='google'),    'gemini-2-5-flash',       'Gemini 2.5 Flash',   'gemini', 1000000,  0.10,  0.40, '2025-09-30', true),
  ((select id from p where slug='google'),    'gemini-2-5-flash-lite',  'Gemini 2.5 Flash Lite','gemini',1000000, 0.05,  0.20, '2026-01-10', true)
on conflict (provider_id, model_id) do nothing;

-- ============ Team members ============
insert into public.team_members (email, full_name, role, title) values
  ('arvid@haus.se',     'Arvid Östermanwallen', 'admin',  'Founder'),
  ('sara@haus.se',      'Sara Bergström',       'admin',  'Account Director'),
  ('sebastian@haus.se', 'Sebastian Holm',       'editor', 'Lead Engineer'),
  ('lova@haus.se',      'Lova Nyberg',          'editor', 'ML Engineer'),
  ('linus@haus.se',     'Linus Frej',           'editor', 'Engineer'),
  ('per@haus.se',       'Per Lind',             'editor', 'Account Manager'),
  ('mia@haus.se',       'Mia Stark',            'viewer', 'Intern')
on conflict (email) do nothing;

-- ============ Customers ============
insert into public.customers (slug, name, org_number, customer_class, contract_status) values
  ('amanda',     'Amanda AI AB',         '559187-2244', 'B', 'live'),
  ('vasakronan', 'Vasakronan',           '556001-9301', 'A', 'live'),
  ('ica',        'ICA Gruppen',          '556048-3098', 'A', 'live'),
  ('klarna',     'Klarna Bank AB',       '556737-0431', 'A', 'live'),
  ('northvolt',  'Northvolt AB',         '559097-7679', 'B', 'paused'),
  ('polestar',   'Polestar',             '559123-4012', 'B', 'live'),
  ('skandia',    'Skandia',              '516406-0948', 'A', 'live'),
  ('storytel',   'Storytel AB',          '556575-2960', 'B', 'live'),
  ('haus',       'Haus AI (internal)',   '559302-1100', 'C', 'live')
on conflict (slug) do nothing;

-- Account manager assignments (after team_members exist)
update public.customers set account_manager_id = tm.id
from public.team_members tm
where (customers.slug, tm.email) in (
  ('amanda',     'arvid@haus.se'),
  ('vasakronan', 'sara@haus.se'),
  ('ica',        'sara@haus.se'),
  ('klarna',     'arvid@haus.se'),
  ('northvolt',  'sara@haus.se'),
  ('polestar',   'per@haus.se'),
  ('skandia',    'per@haus.se'),
  ('storytel',   'arvid@haus.se'),
  ('haus',       'arvid@haus.se')
);

-- ============ Projects ============
with c as (select id, slug from public.customers)
insert into public.projects (customer_id, name, slug, status, go_live_date, github_repo_url, hosting_provider,
  monthly_revenue_sek, monthly_infra_budget_sek, tech_stack)
values
  ((select id from c where slug='amanda'),     'Amanda Chatbot',              'amanda-chat',      'live',     '2025-11-04', 'https://github.com/haus/amanda-chat',  'Vercel + Supabase',  65000,  5000,  array['Next.js 16','Supabase','pgvector']),
  ((select id from c where slug='amanda'),     'Amanda Vision Tagger',        'amanda-vision',    'live',     '2026-02-18', 'https://github.com/haus/amanda-vision','GCP Vertex AI',      30000,  2500,  array['Python','FastAPI','Vertex AI']),
  ((select id from c where slug='vasakronan'), 'Vasakronan Lease Assistant',  'vasakronan-lease', 'live',     '2025-09-20', 'https://github.com/haus/vasakronan-lease','Vercel + Supabase', 180000, 9000,  array['Next.js 16','Supabase','pgvector','Resend']),
  ((select id from c where slug='vasakronan'), 'Vasakronan Doc Search',       'vasakronan-docs',  'building', null,         'https://github.com/haus/vasakronan-docs','Vercel + Supabase', 100000, 1500,  array['Next.js 16','Supabase','pgvector']),
  ((select id from c where slug='ica'),        'ICA Recipe Generator',        'ica-recipes',      'live',     '2025-06-12', 'https://github.com/haus/ica-recipes',  'GCP Cloud Run',     145000, 6500,  array['Python','FastAPI','Cloud Run','BigQuery']),
  ((select id from c where slug='ica'),        'ICA Checkout Helper',         'ica-checkout',     'live',     '2026-03-04', 'https://github.com/haus/ica-checkout', 'Vercel',            175000, 5500,  array['Next.js 16','Edge Functions']),
  ((select id from c where slug='klarna'),     'Klarna Dispute Triage',       'klarna-dispute',   'live',     '2025-08-22', 'https://github.com/haus/klarna-dispute','AWS Lambda',       240000, 15000, array['Python','AWS Lambda','DynamoDB','Anthropic']),
  ((select id from c where slug='klarna'),     'Klarna Voice Agent',          'klarna-voice',     'building', null,         'https://github.com/haus/klarna-voice','GCP Vertex AI',      0,      1500,  array['Python','Vertex AI','LiveKit']),
  ((select id from c where slug='klarna'),     'Klarna Fraud Co-pilot',       'klarna-fraud',     'live',     '2025-12-01', 'https://github.com/haus/klarna-fraud','AWS Lambda',         300000, 13000, array['Python','AWS','DynamoDB']),
  ((select id from c where slug='northvolt'),  'Northvolt QA Assistant',      'northvolt-qa',     'paused',   '2025-04-10', 'https://github.com/haus/nv-qa',        'Azure OpenAI',      0,      1200,  array['Python','Azure','OpenAI']),
  ((select id from c where slug='polestar'),   'Polestar Owners Manual',      'polestar-manual',  'live',     '2025-10-08', 'https://github.com/haus/polestar-manual','Vercel + Supabase',95000,  3500,  array['Next.js 16','Supabase']),
  ((select id from c where slug='polestar'),   'Polestar EU Compliance',      'polestar-eu',      'discovery',null,         null,                                    null,                50000,  0,     array['TBD']),
  ((select id from c where slug='skandia'),    'Skandia Claim Summarizer',    'skandia-claim',    'live',     '2025-07-14', 'https://github.com/haus/skandia-claim','Azure',             260000, 9500,  array['Python','Azure','OpenAI']),
  ((select id from c where slug='skandia'),    'Skandia Internal Wiki Q&A',   'skandia-wiki',     'discovery',null,         null,                                    null,                150000, 0,     array['TBD']),
  ((select id from c where slug='storytel'),   'Storytel Audio Tagger',       'storytel-tags',    'live',     '2025-12-01', 'https://github.com/haus/storytel-tags','GCP Vertex AI',     75000,  4500,  array['Python','Vertex AI','BigQuery']),
  ((select id from c where slug='storytel'),   'Storytel Reco Engine',        'storytel-reco',    'live',     '2026-01-22', 'https://github.com/haus/storytel-reco','GCP Cloud Run',     100000, 5500,  array['Python','Cloud Run','Anthropic']),
  ((select id from c where slug='haus'),       'Haus Internal Tools',         'haus-internal',    'live',     '2025-03-15', 'https://github.com/haus/internal',     'Vercel + Supabase', 0,      1300,  array['Next.js 16','Supabase'])
on conflict (slug) do nothing;

-- ============ Active project_models (one per project) ============
with p as (select id, slug from public.projects),
     m as (
       select am.id, am.model_id, prov.slug as provider_slug
       from public.ai_models am join public.ai_providers prov on prov.id = am.provider_id
     )
insert into public.project_models (project_id, model_id, role, is_active, effective_from)
values
  ((select id from p where slug='amanda-chat'),      (select id from m where model_id='claude-opus-4-7'),   'primary', true, '2026-03-22'),
  ((select id from p where slug='amanda-vision'),    (select id from m where model_id='gemini-2-5-pro'),    'primary', true, '2026-02-18'),
  ((select id from p where slug='vasakronan-lease'), (select id from m where model_id='claude-sonnet-4-5'), 'primary', true, '2026-01-24'),
  ((select id from p where slug='vasakronan-docs'),  (select id from m where model_id='gpt-5-mini'),        'primary', true, '2026-04-01'),
  ((select id from p where slug='ica-recipes'),      (select id from m where model_id='claude-haiku-4-5'),  'primary', true, '2026-02-10'),
  ((select id from p where slug='ica-checkout'),     (select id from m where model_id='gemini-2-5-flash'),  'primary', true, '2026-03-04'),
  ((select id from p where slug='klarna-dispute'),   (select id from m where model_id='claude-opus-4-7'),   'primary', true, '2026-04-02'),
  ((select id from p where slug='klarna-voice'),     (select id from m where model_id='gemini-2-5-pro'),    'primary', true, '2026-03-15'),
  ((select id from p where slug='klarna-fraud'),     (select id from m where model_id='claude-sonnet-4-5'), 'primary', true, '2025-12-01'),
  ((select id from p where slug='northvolt-qa'),     (select id from m where model_id='gpt-5'),             'primary', true, '2025-04-10'),
  ((select id from p where slug='polestar-manual'),  (select id from m where model_id='gpt-5'),             'primary', true, '2025-12-09'),
  ((select id from p where slug='polestar-eu'),      (select id from m where model_id='claude-sonnet-4-5'), 'primary', true, '2026-04-15'),
  ((select id from p where slug='skandia-claim'),    (select id from m where model_id='claude-sonnet-4-5'), 'primary', true, '2026-01-24'),
  ((select id from p where slug='skandia-wiki'),     (select id from m where model_id='gpt-5-mini'),        'primary', true, '2026-04-01'),
  ((select id from p where slug='storytel-tags'),    (select id from m where model_id='gemini-2-5-flash'),  'primary', true, '2025-12-01'),
  ((select id from p where slug='storytel-reco'),    (select id from m where model_id='claude-haiku-4-5'),  'primary', true, '2026-02-10'),
  ((select id from p where slug='haus-internal'),    (select id from m where model_id='claude-opus-4-7'),   'primary', true, '2026-03-22');

-- ============ Dependencies (subset) ============
with p as (select id, slug from public.projects)
insert into public.dependencies (project_id, name, vendor, type, monthly_cost_sek, is_critical) values
  ((select id from p where slug='amanda-chat'),      'Supabase Postgres', 'Supabase',  'database',         1100,  true),
  ((select id from p where slug='amanda-chat'),      'Vercel Pro',        'Vercel',    'hosting',          2700,  true),
  ((select id from p where slug='amanda-chat'),      'Resend',            'Resend',    'third_party_api',   220,  false),
  ((select id from p where slug='amanda-chat'),      'Cloudflare R2',     'Cloudflare','storage',           780,  false),
  ((select id from p where slug='vasakronan-lease'), 'Supabase Postgres', 'Supabase',  'database',         4400,  true),
  ((select id from p where slug='vasakronan-lease'), 'Vercel Pro',        'Vercel',    'hosting',          3100,  true),
  ((select id from p where slug='vasakronan-lease'), 'Resend',            'Resend',    'third_party_api',  1100,  false);

-- ============ Notes (global wiki) ============
insert into public.notes (parent_type, parent_id, category, title, content, pinned) values
  ('global', null, 'process',    'Onboarding-checklista för nya kundprojekt',
    'Workspace per kundprojekt hos Anthropic + OpenAI. Mappa workspace_id i settings/integrations innan första sync.', true),
  ('global', null, 'process',    'Modellbytesrutiner — när byter vi modell?',
    'Tre frågor: bättre, billigare eller bredare context. Annars rör vi inte. Logga skäl i timeline.', false),
  ('global', null, 'process',    'Fortnox-artikelnamnkonvention',
    'AI-<KUND>-<PROJEKT>. Ex: AI-KLARNA-DISPUTE. Mappas automatiskt till project_id via /settings/integrations.', false),
  ('global', null, 'strategy',   'Q2 OKR — minska AI-kostnaden 18%',
    'Tre spår: (1) Haiku/Flash på lågkrav-flöden, (2) prompt caching överallt, (3) trim av context window.', true);

-- ============ Integrations (rows without secrets — set vault_secret_id via UI) ============
insert into public.integrations_credentials (provider_slug, metadata, last_synced_at, last_sync_status) values
  ('anthropic',  '{"workspace_map": {}}'::jsonb, null, 'ok'),
  ('openai',     '{"project_map": {}}'::jsonb,   null, 'ok'),
  ('google',     '{}'::jsonb,                    null, 'warn'),
  ('fortnox',    '{}'::jsonb,                    null, 'ok'),
  ('github',     '{}'::jsonb,                    null, 'ok'),
  ('vercel',     '{}'::jsonb,                    null, 'ok'),
  ('riksbanken', '{}'::jsonb,                    null, 'ok')
on conflict (provider_slug) do nothing;

-- ============ FX rate seed (so first cron has a baseline) ============
insert into public.fx_rates (date, usd_sek, eur_sek, source) values
  (current_date - 1, 10.78, 11.42, 'manual-seed')
on conflict (date) do nothing;
