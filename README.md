# Haus AI · Operations Hub

Intern operationsplattform för Haus AI — kundprojekt, AI-modeller, token-tracking,
intäkter, kostnader och marginaler i ett gränssnitt.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Tailwind 4** + handritad Apercu/Seriguela design (Haus brand)
- **Supabase** — Postgres + Auth (Google OAuth begränsad till `@haus.se`) + Vault
- **Vercel** — hosting + 8 cron jobs (alla integrationer)

## Lokal körning

```bash
pnpm install
cp .env.local.example .env.local
# Fyll i NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm dev
```

Appen körs på <http://localhost:3000>. Utan Supabase env vars fungerar mock-läget
direkt (alla sidor visar sample-data från `lib/data.ts`).

## Supabase-uppsättning

```bash
# 1. Skapa projekt på supabase.com
# 2. Kör migrationerna mot din nya db
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_pnl_refresh.sql
# 3. Seed med samma sample-data som mock-läget
psql "$DATABASE_URL" -f supabase/seed.sql
# 4. Aktivera Google OAuth provider i Auth → Providers
#    Sätt "Authorized domain" till haus.se
```

Lägg sedan in dina @haus.se-användare i `team_members` och koppla
`supabase_user_id` till deras `auth.users.id` (sker automatiskt vid första
inloggning om du gör en upsert-trigger — se TODO i 0001_init.sql).

## Cron-jobb (Vercel)

8 cron endpoints konfigurerade i `vercel.json`. Alla autentiseras via
`Authorization: Bearer $CRON_SECRET` eller Vercels interna cron-header.

| Endpoint | Schedule (UTC) | Status |
|---|---|---|
| `/api/cron/refresh-fx` | 04:00 dgl | ✅ Riksbanken USD/EUR → SEK |
| `/api/cron/sync-anthropic` | 04:10 dgl | ✅ Admin API cost_report |
| `/api/cron/sync-openai` | 04:20 dgl | ✅ Usage + Costs API |
| `/api/cron/sync-google-billing` | 04:30 dgl | 🟡 Stub — kräver BigQuery |
| `/api/cron/sync-fortnox` | 05:00 dgl | 🟡 Stub — OAuth2 refresh + invoices |
| `/api/cron/sync-github` | 05:30 dgl | 🟡 Skiss — läser repo-meta |
| `/api/cron/sync-vercel` | 05:45 dgl | 🟡 Stub — Vercel API |
| `/api/cron/refresh-pnl` | 06:00 dgl | ✅ `REFRESH MATERIALIZED VIEW mv_project_pnl_monthly` |

## Sidor

Sidofältet speglar kollegans Haus Web-hub men anpassat för AI-leveranser:

```
Core      Operations · Customers · Projects · Models · Token Usage · Incidents
Finance   Billing & Revenue · Costs · Reports & Risk
Workflows Workflows & Tools
Admin     Wiki & Ideas · Settings
```

Projektdetalj har 7 flikar: Overview / Models / Tokens / Costs /
Dependencies / Updates / Notes. Modellfliken kan byta aktiv modell — på
Supabase-läge skriver `lib/actions/switch-model.ts` direkt till `project_models`
+ `model_switches` (audit-tabell).

## Pull-config endpoint

Varje kundprojekt anropar:

```
GET https://ai-hub.haus.se/api/projects/{slug}/config
Authorization: Bearer <projekt-token>
```

→ returnerar aktiv modell, pris, context window. SWR-cache 60s, stale-while-revalidate 1h.

## Struktur

```
app/
  (auth)/login                 # Google OAuth sign-in
  (dashboard)/...              # Skyddat segment med sidofält + topbar
  api/cron/                    # 8 cron endpoints
  api/projects/[slug]/config   # Public pull-config för kundprojekt
  auth/callback                # OAuth callback
components/
  icons.tsx ui.tsx charts.tsx layout.tsx TabNav.tsx
lib/
  data.ts                      # Mock-data (fallback)
  db/index.ts                  # Supabase-backed queries (async, opt-in)
  actions/switch-model.ts      # Server Action för modellbyte
  integrations/                # Anthropic + OpenAI klienter
  supabase/                    # server.ts client.ts middleware.ts
  cron.ts                      # Shared cron auth + run tracking
supabase/
  migrations/
    0001_init.sql              # Hela schemat + RLS + materialized view
    0002_pnl_refresh.sql       # RPC för MV-refresh
  seed.sql                     # Sample data
middleware.ts                  # @haus.se domänspärr
vercel.json                    # 8 cron jobs
```

## Att göra (i prioriteringsordning)

1. Skapa Supabase-projekt + kör migration + seed
2. Konfigurera Google OAuth (`hosted_domain=haus.se`)
3. Sätt `ANTHROPIC_ADMIN_KEY` + `CRON_SECRET` i Vercel
4. Lägg in workspace_map i `integrations_credentials.metadata` för Anthropic
5. Migrera pages från `lib/data` → `lib/db` (en sida i taget)
6. Implementera Fortnox OAuth + Google BigQuery + Vercel-API
