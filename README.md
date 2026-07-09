# Haus AI · Operations Hub

Intern operationsplattform för Haus AI — kundprojekt, AI-modeller, token-tracking,
intäkter (Fortnox), kostnader och marginaler i ett gränssnitt.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Tailwind 4** + handritad Apercu/Seriguela design (Haus brand)
- **Supabase** — Postgres + Auth (Google OAuth begränsad till `@haus.se`)
- **Vercel** — hosting + cron (alla integrationer)

## Lokal körning

```bash
pnpm install
cp .env.local.example .env.local
# Fyll i NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm dev
```

Appen körs på <http://localhost:3000>. Utan Supabase-env svarar appen 503
(auth failar stängt — det finns inget mock-läge).

```bash
pnpm lint && pnpm typecheck && pnpm test   # körs även i CI (.github/workflows/ci.yml)
```

## Supabase

Prod-projekt: `haus-ai-ops`. Schema + regler i `supabase/migrations/`
(se `supabase/migrations/README.md` för ordning och policy). Ny miljö:
applicera alla migrationer i ordning + `seed.sql`, aktivera Google OAuth
(hosted domain `haus.se`). `@haus.se`-användare onboardas automatiskt som
`viewer` vid första inloggning (trigger i 0004); roller (`admin`/`editor`/
`viewer`) sätts i `team_members`.

## Cron-jobb (Vercel)

Alla autentiseras med `Authorization: Bearer $CRON_SECRET` (Vercel skickar
headern automatiskt när env-varn är satt; `x-vercel-cron` litas INTE på).
Misslyckade körningar loggas i `integration_sync_runs` och alertas till Slack.

| Endpoint | Schedule (UTC) | Gör |
|---|---|---|
| `/api/cron/refresh-fx` | 04:00 dgl | Riksbanken USD/EUR → SEK |
| `/api/cron/provision-workspaces` | 04:05 dgl | Auto-skapar projekt från AI-workspaces |
| `/api/cron/sync-anthropic` | 04:10 dgl | Admin API cost_report + usage |
| `/api/cron/sync-openai` | 04:20 dgl | Usage + Costs API (multi-org) |
| `/api/cron/sync-google-billing` | 04:30 dgl | BigQuery billing export (kräver env) |
| `/api/cron/sync-fortnox` | 05:00 dgl | Kunder + fakturor + P&L-refresh (kombinerad) |
| `/api/cron/sync-github` | 05:30 dgl | Repo-metadata (kräver GITHUB_TOKEN) |
| `/api/cron/sync-vercel` | 05:45 dgl | Projektlänkning (kräver VERCEL_TOKEN) |
| `/api/cron/refresh-pnl` | 06:00 dgl | `REFRESH MATERIALIZED VIEW mv_project_pnl_monthly` |
| `/api/cron/notify-digest` | 06:30 mån | Slack-veckodigest |
| `/api/cron/sync-sentry` | timvis | Sentry-issues → incidents (kräver SENTRY_AUTH_TOKEN) |

`/api/cron/sync-fortnox-customers` finns kvar för manuell körning men är inte
schemalagd (den kombinerade synken tog över).

## Fortnox

- Anslut via **Settings → Anslut Fortnox** (admin-only; OAuth authorization-code,
  scopes `invoice customer article`). Redirect-URI i Fortnox developer portal
  måste vara exakt `<NEXT_PUBLIC_APP_URL>/api/auth/fortnox/callback`.
- Första synken backfillar fakturor från `FORTNOX_BACKFILL_FROM`
  (default 2026-01-01); därefter inkrementellt via `lastmodified`-cursor.
- Valuta: SEK-belopp beräknas från fakturans `CurrencyRate`/`CurrencyUnit`
  (fx_rates som fallback). `recurring` härleds från `InvoiceType =
  AGREEMENTINVOICE` → driver kund-MRR (`v_customer_mrr`).
- Projektattribution via artikelkod `AI-<KUND>-<PROJEKT>` → `projects.slug`.
- Rate-limit-säkert: max 4 parallella anrop + 429-retry (Fortnox: 25 req/5s).
- Leverantörsfakturor (kostnadssidan) är ett medvetet senare steg — kräver
  scope `supplierinvoice` (re-consent) + dubbelräkningsskydd mot kortimporten.

## Intäkter & marginaler

`mv_project_pnl_monthly` = fakturerad intäkt (sent/paid/overdue) − AI-kostnad −
infrakostnad per projekt/månad. I läsvyerna coalescas intäkt: fakturerat när
det finns, annars projektets manuella `monthly_revenue_sek` (sätts i
projekt-edit). Kund-MRR: recurring-fakturor senaste hela månaden, annars
3-månaders fakturasnitt.

## Kortkostnadsimport

`/costs/import` — ladda upp månads-CSV från företagskortet: deterministiska
regler (`card_vendor_rules`) + Claude-klassificering av okända + manuell
granskning. API-usage (OpenAI/Anthropic) exkluderas för att inte dubbelräkna
token-synken; bekräftade okända lärs in som nya regler.

## Sentry → Incidents

Timvis cron speglar olösta Sentry-issues (org `haus-ai-je`, EU-regionen) in i
incidents-fliken: auto-skapas med severity från Sentry-level + spridning
(fatal→critical; error→high vid ≥10 användare eller ≥100 events, annars
medium; warning→low), auto-löses när de löses/ignoreras i Sentry, återöppnas
vid regression. Nya high/critical-incidenter notifieras i Slack. Mappa
Sentry-projekt → Hub-projekt under Settings ("Sentry project-mappning").
Manuellt skapade incidenter rörs aldrig av synken. Nyckeln (org-token med
org:read + project:read + event:read) läggs in under **Settings →
API-nycklar** (env-varn `SENTRY_AUTH_TOKEN` fungerar som fallback).

## Notiser (Slack)

`SLACK_WEBHOOK_URL` (incoming webhook) driver: alert vid misslyckad/rate-limitad
sync, notis vid modellbyte, veckodigest (måndagar). Utan env-varn skippas allt
tyst (console.warn).

## Pull-config endpoint

```
GET /api/projects/{slug}/config
Authorization: Bearer <projekt-token>
```

Returnerar aktiv modell + priser. Tokens genereras per projekt via
"Rotera bearer" på projektets modellsida (admin-only; endast sha256-hash
lagras — utan roterad token är endpointet avstängt/401).

## Env-variabler

Se `.env.local.example`. I Vercel prod behövs minst: Supabase-trion,
`NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `ANTHROPIC_ADMIN_KEY`,
`ANTHROPIC_API_KEY` (kortimportens klassificerare), `OPENAI_ADMIN_KEY`(+`_HAUS`),
`FORTNOX_CLIENT_ID`/`FORTNOX_CLIENT_SECRET`, `SLACK_WEBHOOK_URL`; valfritt
`GOOGLE_CREDENTIALS_JSON`+`GOOGLE_BILLING_TABLE`, `FORTNOX_BACKFILL_FROM`,
`VERCEL_TEAM_ID`, `SENTRY_ORG`/`SENTRY_REGION_URL` (defaultar till Haus org).
**Sentry-, GitHub- och Vercel-nycklarna hanteras i UI:t** (Settings →
API-nycklar, lagras i integrations_credentials); env-varianterna
`SENTRY_AUTH_TOKEN`/`GITHUB_TOKEN`/`VERCEL_TOKEN` är bara fallback.

## Struktur

```
app/
  (auth)/login                 # Google OAuth sign-in
  (dashboard)/...              # Skyddat segment med sidofält + topbar
  api/cron/                    # Cron endpoints (se tabellen)
  api/projects/[slug]/config   # Token-gated pull-config för kundprojekt
  api/auth/fortnox/            # OAuth start + callback (admin-gated)
components/                    # icons, ui, charts, layout, TabNav
lib/
  auth.ts                      # Sessionsmedlem + roller + friendlyDbError
  db/index.ts                  # Supabase-backed queries (RLS via session)
  actions/                     # Server actions (CRUD, import, Fortnox, auth)
  integrations/                # anthropic, openai, google, fortnox(+sync/mapping), card-costs
  cron.ts notify.ts fx.ts schemas.ts csv.ts format.ts
supabase/migrations/           # Schema + RLS (se README där)
middleware.ts                  # @haus.se-spärr, failar stängt utan env
vercel.json                    # Cron-schemat
```
