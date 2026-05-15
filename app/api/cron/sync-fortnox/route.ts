import type { NextRequest } from "next/server";
import {
  finishSyncRun,
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
} from "@/lib/cron";
import {
  ensureFreshAccessToken,
  listInvoicesSince,
} from "@/lib/integrations/fortnox";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/sync-fortnox
// Pulls all invoices created or updated in the last 35 days, upserts them
// + invoice_lines, attributing to projects via tech article-code convention
// AI-<KUND>-<PROJEKT> stored in invoice_lines.project_id.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("fortnox");

  try {
    const accessToken = await ensureFreshAccessToken();
    if (!accessToken) {
      await finishSyncRun(run?.id ?? null, "failed", {
        error:
          "No Fortnox tokens stored — connect at /api/auth/fortnox/start first",
      });
      return jsonOk({ skipped: "not_connected" });
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 35);
    const fromDate = since.toISOString().slice(0, 10);

    const invoices = await listInvoicesSince(fromDate, accessToken);
    const supabase = createSupabaseAdmin();

    // Map Fortnox CustomerNumber → public.customers.id via fortnox_customer_id.
    const { data: customerRows } = await supabase
      .from("customers")
      .select("id, slug, fortnox_customer_id");
    const customersByFortnoxId = new Map<string, { id: string; slug: string }>();
    for (const c of customerRows ?? []) {
      if (c.fortnox_customer_id)
        customersByFortnoxId.set(c.fortnox_customer_id, {
          id: c.id,
          slug: c.slug,
        });
    }

    // Map article codes AI-<CUSTOMER>-<PROJECT> → project_id via slug match.
    const { data: projectRows } = await supabase
      .from("projects")
      .select("id, slug");
    const projectsBySlug = new Map<string, string>();
    for (const p of projectRows ?? []) projectsBySlug.set(p.slug, p.id);

    let upsertedInvoices = 0;
    for (const inv of invoices) {
      const customer = customersByFortnoxId.get(inv.CustomerNumber);
      const invoiceStatus = mapStatus(inv);

      const { data: existing } = await supabase
        .from("invoices")
        .upsert(
          {
            fortnox_invoice_id: inv.DocumentNumber,
            customer_id: customer?.id ?? null,
            invoice_number: inv.DocumentNumber,
            invoice_date: inv.InvoiceDate,
            due_date: inv.DueDate,
            total_excl_vat_sek: null,
            total_incl_vat_sek: inv.Total,
            status: invoiceStatus,
            recurring: false,
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
      const lines = inv.InvoiceRows.map((row) => {
        const project_id = resolveProjectIdFromArticle(
          row.ArticleNumber,
          projectsBySlug,
        );
        return {
          invoice_id: existing.id,
          description: row.Description,
          amount_sek: row.Total,
          project_id,
          category: "subscription" as const,
        };
      });
      if (lines.length > 0) {
        await supabase.from("invoice_lines").insert(lines);
      }
    }

    await finishSyncRun(run?.id ?? null, "ok", {
      records: upsertedInvoices,
    });
    return jsonOk({ invoices: upsertedInvoices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncRun(run?.id ?? null, "failed", { error: msg });
    return jsonError(msg);
  }
}

function mapStatus(inv: {
  Cancelled: boolean;
  FinalPayDate: string | null;
  Booked: boolean;
  DueDate: string;
}): "draft" | "sent" | "paid" | "overdue" | "credited" {
  if (inv.Cancelled) return "credited";
  if (inv.FinalPayDate) return "paid";
  if (!inv.Booked) return "draft";
  const due = Date.parse(inv.DueDate);
  if (Number.isFinite(due) && due < Date.now()) return "overdue";
  return "sent";
}

// Article code convention: AI-<CUSTOMER>-<PROJECT>
//   e.g. AI-KLARNA-DISPUTE → projects.slug = klarna-dispute
function resolveProjectIdFromArticle(
  articleCode: string | null | undefined,
  projectsBySlug: Map<string, string>,
): string | null {
  if (!articleCode) return null;
  const match = /^AI-([A-Z0-9]+)-([A-Z0-9]+)$/.exec(articleCode);
  if (!match) return null;
  const slug = `${match[1].toLowerCase()}-${match[2].toLowerCase()}`;
  return projectsBySlug.get(slug) ?? null;
}
