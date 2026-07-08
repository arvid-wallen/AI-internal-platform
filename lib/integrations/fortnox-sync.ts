// Shared Fortnox → Supabase sync logic, used by the combined nightly cron
// and the manual "Synka nu" trigger. Customers sync first (invoices need the
// fortnox_customer_id mapping), then invoices.
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  listCustomers,
  listInvoices,
  patchFortnoxMetadata,
  readFortnoxMetadata,
} from "./fortnox";
import {
  formatLastModified,
  headerProjectId,
  isRecurringInvoice,
  mapStatus,
  resolveInvoiceRate,
  resolveProjectIdFromArticle,
} from "./fortnox-mapping";

export interface CustomerSyncResult {
  customers: number;
}

export async function syncFortnoxCustomers(
  accessToken: string,
): Promise<CustomerSyncResult> {
  const customers = await listCustomers(accessToken);
  const supabase = createSupabaseAdmin();

  const slugify = (name: string, fallback: string) => {
    const s = name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);
    return s || fallback;
  };

  let upserted = 0;
  for (const c of customers) {
    const payload = {
      name: c.Name,
      org_number: c.OrganisationNumber || null,
      fortnox_customer_id: c.CustomerNumber,
      contract_status: c.Active === false ? "paused" : "live",
    };

    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("fortnox_customer_id", c.CustomerNumber)
      .maybeSingle();

    if (existing) {
      await supabase.from("customers").update(payload).eq("id", existing.id);
      upserted += 1;
      continue;
    }

    // New customer: ensure a unique slug.
    const base = slugify(c.Name, `kund-${c.CustomerNumber}`);
    const { data: clash } = await supabase
      .from("customers")
      .select("id")
      .eq("slug", base)
      .maybeSingle();
    const slug = clash ? `${base}-${c.CustomerNumber}`.slice(0, 60) : base;

    const { error } = await supabase
      .from("customers")
      .insert({ slug, ...payload });
    // org_number is unique; on a rare clash, retry without it.
    if (error) {
      await supabase
        .from("customers")
        .insert({ slug, ...payload, org_number: null });
    }
    upserted += 1;
  }

  return { customers: upserted };
}

export interface InvoiceSyncResult {
  invoices: number;
  mode: "backfill" | "incremental";
  rateWarnings: number; // invoices whose SEK amount could not be resolved
}

export async function syncFortnoxInvoices(
  accessToken: string,
): Promise<InvoiceSyncResult> {
  const supabase = createSupabaseAdmin();
  const syncStart = new Date();

  // First run backfills from FORTNOX_BACKFILL_FROM; afterwards we follow a
  // lastmodified cursor (sync start − 24h, advanced only on full success —
  // the overlap absorbs clock skew and mid-run edits; upserts make it
  // idempotent).
  const metadata = await readFortnoxMetadata();
  const cursor =
    typeof metadata.invoice_cursor === "string" ? metadata.invoice_cursor : null;
  const mode: InvoiceSyncResult["mode"] = cursor ? "incremental" : "backfill";
  const invoices = cursor
    ? await listInvoices(
        { lastModified: formatLastModified(new Date(cursor)) },
        accessToken,
      )
    : await listInvoices(
        { fromDate: process.env.FORTNOX_BACKFILL_FROM ?? "2026-01-01" },
        accessToken,
      );

  // Map Fortnox CustomerNumber → public.customers.id via fortnox_customer_id.
  const { data: customerRows } = await supabase
    .from("customers")
    .select("id, fortnox_customer_id");
  const customersByFortnoxId = new Map<string, string>();
  for (const c of customerRows ?? []) {
    if (c.fortnox_customer_id)
      customersByFortnoxId.set(c.fortnox_customer_id, c.id);
  }

  // Map article codes AI-<CUSTOMER>-<PROJECT> → project_id via slug match.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, slug");
  const projectsBySlug = new Map<string, string>();
  for (const p of projectRows ?? []) projectsBySlug.set(p.slug, p.id);

  // FX fallback for legacy invoices missing CurrencyRate.
  const { data: fxRow } = await supabase
    .from("fx_rates")
    .select("usd_sek, eur_sek")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let upsertedInvoices = 0;
  let rateWarnings = 0;
  for (const inv of invoices) {
    const rate = resolveInvoiceRate(inv, fxRow ?? {});
    if (rate === null) rateWarnings += 1;
    const toSek = (amount: number | null | undefined): number | null =>
      rate === null || amount == null
        ? null
        : Math.round(amount * rate * 100) / 100;

    const lineProjects = inv.InvoiceRows.map((row) =>
      resolveProjectIdFromArticle(row.ArticleNumber, projectsBySlug),
    );

    const { data: existing } = await supabase
      .from("invoices")
      .upsert(
        {
          fortnox_invoice_id: inv.DocumentNumber,
          customer_id: customersByFortnoxId.get(inv.CustomerNumber) ?? null,
          project_id: headerProjectId(lineProjects),
          invoice_number: inv.DocumentNumber,
          invoice_date: inv.InvoiceDate,
          due_date: inv.DueDate,
          total_excl_vat_sek: toSek(inv.Net),
          total_incl_vat_sek: toSek(inv.Total),
          currency: inv.Currency || "SEK",
          currency_rate: rate,
          status: mapStatus(inv),
          recurring: isRecurringInvoice(inv.InvoiceType),
          raw: inv as unknown as Record<string, unknown>,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "fortnox_invoice_id" },
      )
      .select("id")
      .single();
    if (!existing) continue;
    upsertedInvoices += 1;

    // Replace invoice_lines for this invoice.
    await supabase.from("invoice_lines").delete().eq("invoice_id", existing.id);
    const lines = inv.InvoiceRows.map((row, i) => ({
      invoice_id: existing.id,
      description: row.Description,
      amount_sek: toSek(row.Total),
      project_id: lineProjects[i],
      category: "subscription" as const,
    }));
    if (lines.length > 0) {
      await supabase.from("invoice_lines").insert(lines);
    }
  }

  // Advance the cursor only after a fully successful pass.
  const nextCursor = new Date(syncStart.getTime() - 24 * 3600 * 1000);
  await patchFortnoxMetadata({ invoice_cursor: nextCursor.toISOString() });

  return { invoices: upsertedInvoices, mode, rateWarnings };
}
