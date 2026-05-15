# Haus AI · Operations Hub

Intern operationsplattform för Haus AI — kundprojekt, AI-modeller, token-tracking,
intäkter, kostnader och marginaler i ett gränssnitt.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Tailwind CSS 4** + handritad Apercu/Seriguela design (Haus brand)
- **Supabase** — Postgres + Auth (Google OAuth restriktad till `@haus.se`) + Vault
- **Vercel** — hosting + cron jobs

## Lokal körning

```bash
pnpm install
cp .env.local.example .env.local
# Fyll i NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
pnpm dev
```

Appen körs på <http://localhost:3000>.

## Struktur

```
app/
  (auth)/login                  # Google OAuth signin
  (dashboard)/...               # Skyddat segment med sidofält + topbar
    dashboard                   # Operations dashboard
    customers, customers/[id]   # Kundlista + kunddetalj
    projects, projects/[id]     # Projektlista + projektdetalj
      models, tokens, costs,    #   - flikar
      dependencies, updates, notes
    models, tokens, incidents
    billing, costs, reports
    workflows, wiki, settings
  api/projects/[slug]/config    # Public endpoint kundprojekt pollar för aktiv modell
  auth/callback                 # OAuth callback
components/
  icons.tsx, ui.tsx, charts.tsx, layout.tsx, TabNav.tsx
lib/
  data.ts                       # Mock-data (ersätts av Supabase-queries)
  types.ts, format.ts
  supabase/                     # server.ts, client.ts, middleware.ts
supabase/migrations/
  0001_init.sql                 # Komplett schema + RLS + materialized view P&L
middleware.ts                   # Auth-gate, @haus.se-domänspärr
```

## Integrationer (kommer)

| Integration | Status | Cron |
|-------------|--------|------|
| Anthropic Admin API | Stub | 04:10 dgl |
| OpenAI Usage | Stub | 04:20 dgl |
| Google Cloud Billing (Vertex AI) | Stub | 04:30 dgl |
| Fortnox | Stub | 05:00 dgl |
| GitHub | Stub | 05:30 dgl |
| Vercel | Stub | 05:45 dgl |
| Riksbanken FX | Stub | 04:00 dgl |

## Designsystem

Brand-tokens i `app/styles/tokens.css` (Haus paper/ink + mint/sky/tomato/butter/lilac/blush
pastell). Custom-fonter Apercu (sans) och Seriguela (display) ligger under `/public/fonts`.

App-stilar i `app/styles/app.css` — shell, KPI-cards, pills, tables, charts, etc.
