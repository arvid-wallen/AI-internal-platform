-- Currency auditability for Fortnox-synced invoices + missing FK indexes.
-- SEK amounts are converted at sync time using the invoice's own
-- CurrencyRate/CurrencyUnit; currency + currency_rate record how.

alter table public.invoices
  add column if not exists currency text not null default 'SEK',
  add column if not exists currency_rate numeric(12,6);

-- mv_project_pnl_monthly joins invoice_lines on both columns; neither had an
-- index.
create index if not exists invoice_lines_invoice_idx
  on public.invoice_lines(invoice_id);
create index if not exists invoice_lines_project_idx
  on public.invoice_lines(project_id);
