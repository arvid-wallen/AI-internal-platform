// Pure mapping helpers for the Fortnox sync — no I/O, unit-testable.

export interface InvoiceStatusFields {
  Cancelled: boolean;
  FinalPayDate: string | null;
  Booked: boolean;
  DueDate: string;
}

export function mapStatus(
  inv: InvoiceStatusFields,
  now: number = Date.now(),
): "draft" | "sent" | "paid" | "overdue" | "credited" {
  if (inv.Cancelled) return "credited";
  if (inv.FinalPayDate) return "paid";
  if (!inv.Booked) return "draft";
  const due = Date.parse(inv.DueDate);
  if (Number.isFinite(due) && due < now) return "overdue";
  return "sent";
}

// Article code convention: AI-<CUSTOMER>-<PROJECT>
//   e.g. AI-KLARNA-DISPUTE → projects.slug = klarna-dispute
export function resolveProjectIdFromArticle(
  articleCode: string | null | undefined,
  projectsBySlug: Map<string, string>,
): string | null {
  if (!articleCode) return null;
  const match = /^AI-([A-Z0-9]+)-([A-Z0-9]+)$/.exec(articleCode);
  if (!match) return null;
  const slug = `${match[1].toLowerCase()}-${match[2].toLowerCase()}`;
  return projectsBySlug.get(slug) ?? null;
}

export interface InvoiceCurrencyFields {
  Currency?: string | null;
  CurrencyRate?: number | null;
  CurrencyUnit?: number | null;
}

export interface FxFallback {
  usd_sek?: number | null;
  eur_sek?: number | null;
}

// SEK per 1 unit of the invoice currency. Fortnox carries the rate on the
// invoice itself (CurrencyRate per CurrencyUnit); fx_rates is only a fallback
// for older invoices where the rate is 0/missing. Returns null when the
// amount cannot be converted — the caller stores null totals and flags the
// run partial rather than silently storing a foreign amount as SEK.
export function resolveInvoiceRate(
  inv: InvoiceCurrencyFields,
  fx: FxFallback = {},
): number | null {
  const currency = (inv.Currency ?? "SEK").toUpperCase();
  if (currency === "SEK") return 1;
  const rate = inv.CurrencyRate ?? 0;
  const unit = inv.CurrencyUnit || 1;
  if (rate > 0) return rate / unit;
  if (currency === "USD" && fx.usd_sek) return fx.usd_sek;
  if (currency === "EUR" && fx.eur_sek) return fx.eur_sek;
  return null;
}

// Header-level project attribution: set only when every line that resolved a
// project agrees on the same one (line-level stays the source of truth).
export function headerProjectId(
  lineProjectIds: Array<string | null>,
): string | null {
  const resolved = lineProjectIds.filter((id): id is string => id !== null);
  if (resolved.length === 0) return null;
  const first = resolved[0];
  return resolved.every((id) => id === first) ? first : null;
}

// Fortnox contract-generated invoices arrive as InvoiceType AGREEMENTINVOICE.
export function isRecurringInvoice(invoiceType: string | null | undefined): boolean {
  return (invoiceType ?? "").toUpperCase() === "AGREEMENTINVOICE";
}

// Fortnox lastmodified parameter format: "YYYY-MM-DD HH:MM".
export function formatLastModified(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
