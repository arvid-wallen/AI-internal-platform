# Migrations

Appliceras mot Supabase-projektet `haus-ai-ops` (`kxveauocjqpqpqmyrlhu`) via
Supabase MCP `apply_migration` (timestamp-trackade i
`supabase_migrations.schema_migrations`). Repo-filerna här är källdokumentet.

## Applicerade i ordning

| Fil | Innehåll |
|---|---|
| `0001_init.sql` | Hela schemat + RLS + materialized view |
| `0002_pnl_refresh.sql` | `refresh_pnl_monthly()` RPC |
| `0003_integration_tokens.sql` | Tokenkolumner på integrations_credentials |
| `0004_auth_onboarding.sql` | `handle_new_user`-trigger (auto-onboarding @haus.se) |
| `0005_card_vendor_rules.sql` | card_vendor_rules + seed |
| `0005_live_data.sql` | GitHub-kolumner, unassigned-kund, MV-rebuild |
| `0006_switch_model_rpc.sql` | Atomiskt modellbyte (`switch_active_model`) |
| `0007_config_bearer.sql` | Bearer-hash för pull-config-endpointet |
| `0008_fortnox_invoice_fields.sql` | invoices.currency/currency_rate + index |
| `0009_customer_mrr.sql` | MV-rebuild (overdue = intäkt) + `v_customer_mrr` |
| `0010_harden_functions.sql` | Advisor-fixar (revokes, search_path, pg_trgm) |
| `0011_sentry_incidents.sql` | incidents.sentry_issue_id/external_url + sentry-integrationsrad |

## Regler

- **Döp aldrig om applicerade filer.** De två `0005_`-filerna är en historisk
  numreringsmiss — båda är applicerade i prod och står kvar som de är.
- Nästa prefix = högsta + 1. En migration per ändring/PR.
- `seed.sql` är syntetisk sample-data för nya miljöer, inte en migration.
