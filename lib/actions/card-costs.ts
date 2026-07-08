"use server";

// Server actions for the card-cost import flow. Mirrors lib/actions/workspace-map.ts:
// env guard, auth check via getUser(), returns { ok, message? }, revalidatePath.

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, getSessionMember, hasRole } from "@/lib/auth";
import { buildImportPreview } from "@/lib/integrations/card-costs";
import { normalizeMerchant } from "@/lib/integrations/card-costs/rules";
import {
  INVALID_INPUT_MESSAGE,
  manualCostSchema,
  saveCardCostsSchema,
} from "@/lib/schemas";
import type { CardImportRow, VendorRule } from "@/lib/types";

// Mutations require the editor role; RLS enforces this too, but checking here
// gives a friendly Swedish message instead of a raw Postgres error.
async function requireEditor(): Promise<string | null> {
  const member = await getSessionMember();
  if (!member) return "Inte inloggad.";
  if (!hasRole(member, "editor")) {
    return "Du har läsbehörighet — import kräver redaktörsroll.";
  }
  return null;
}

export interface ImportProject {
  id: string;
  name: string;
  slug: string;
}

type Supa = Awaited<ReturnType<typeof createSupabaseServer>>;

export interface ImportContextData {
  configured: boolean;
  projects: ImportProject[];
}

export async function getImportContext(): Promise<ImportContextData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { configured: false, projects: [] };
  }
  const supabase = await createSupabaseServer();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug")
    .order("name");
  return { configured: true, projects: (projects ?? []) as ImportProject[] };
}

async function loadRules(supabase: Supa): Promise<VendorRule[]> {
  const { data } = await supabase
    .from("card_vendor_rules")
    .select(
      "id, match_pattern, canonical_vendor, cost_category, is_software, is_api_usage, default_project_id",
    );
  return (data ?? []) as VendorRule[];
}

export async function previewCardCsv(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; rows?: CardImportRow[] }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Ingen fil vald." };

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Inte inloggad." };

  const text = await file.text();
  const [rules, { data: projects }] = await Promise.all([
    loadRules(supabase),
    supabase.from("projects").select("id, slug, name").order("name"),
  ]);

  try {
    const rows = await buildImportPreview(text, {
      rules,
      projects: (projects ?? []) as Array<{
        id: string;
        slug: string;
        name: string;
      }>,
    });
    return { ok: true, rows };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Kunde inte tolka filen.",
    };
  }
}

export async function saveCardCosts(
  rows: CardImportRow[],
): Promise<{ ok: boolean; message?: string; inserted?: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const roleError = await requireEditor();
  if (roleError) return { ok: false, message: roleError };
  const parsedRows = saveCardCostsSchema.safeParse(rows);
  if (!parsedRows.success) return { ok: false, message: INVALID_INPUT_MESSAGE };
  const supabase = await createSupabaseServer();

  const included = rows.filter((r) => r.include && r.amount_sek > 0);
  const months = [...new Set(included.map((r) => r.period_month))];
  if (months.length === 0) {
    return { ok: false, message: "Inga rader markerade för import." };
  }

  // Idempotent: replace prior csv_import rows for the affected months.
  const { error: delErr } = await supabase
    .from("costs_monthly")
    .delete()
    .eq("source", "csv_import")
    .in("period_month", months);
  if (delErr) return { ok: false, message: friendlyDbError(delErr) };

  const insertRows = included.map((r) => ({
    project_id: r.project_id,
    cost_category: r.cost_category,
    vendor: r.vendor,
    period_month: r.period_month,
    amount_sek: r.amount_sek,
    source: "csv_import" as const,
    raw: { txns: r.raw_texts, txn_count: r.txn_count },
    notes: r.sample_text,
  }));
  if (insertRows.length > 0) {
    const { error: insErr } = await supabase
      .from("costs_monthly")
      .insert(insertRows);
    if (insErr) return { ok: false, message: friendlyDbError(insErr) };
  }

  await learnRules(supabase, included);
  await supabase.rpc("refresh_pnl_monthly");
  revalidatePath("/costs");
  return { ok: true, inserted: insertRows.length };
}

// Persist confirmed classifications of previously-unknown merchants as rules so
// next month auto-classifies them. Only learns when the vendor name actually
// appears in the merchant text (so the pattern will match similar future rows).
async function learnRules(supabase: Supa, rows: CardImportRow[]): Promise<void> {
  const candidates = new Map<
    string,
    {
      vendor: string;
      cat: string;
      soft: boolean;
      api: boolean;
      proj: string | null;
    }
  >();
  for (const r of rows) {
    if (r.source === "rule") continue;
    const pat = r.vendor.trim().toLowerCase();
    if (pat.length < 3) continue;
    if (!normalizeMerchant(r.sample_text).includes(pat)) continue;
    if (!candidates.has(pat)) {
      candidates.set(pat, {
        vendor: r.vendor,
        cat: r.cost_category,
        soft: r.is_software,
        api: r.is_api_usage,
        proj: r.project_id,
      });
    }
  }
  if (candidates.size === 0) return;
  const ins = [...candidates.entries()].map(([pat, v]) => ({
    match_pattern: pat,
    canonical_vendor: v.vendor,
    cost_category: v.cat,
    is_software: v.soft,
    is_api_usage: v.api,
    default_project_id: v.proj,
  }));
  await supabase
    .from("card_vendor_rules")
    .upsert(ins, { onConflict: "match_pattern" });
}

export interface ManualCostInput {
  vendor: string;
  amount_sek: number;
  cost_category: string;
  period_month: string; // YYYY-MM or YYYY-MM-01
  project_id?: string | null;
  notes?: string;
}

export async function saveManualCost(
  input: ManualCostInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const roleError = await requireEditor();
  if (roleError) return { ok: false, message: roleError };
  const parsedInput = manualCostSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, message: INVALID_INPUT_MESSAGE };
  }
  const supabase = await createSupabaseServer();

  const vendor = input.vendor.trim();
  const period =
    input.period_month.length === 7
      ? input.period_month + "-01"
      : input.period_month;
  const projectId = input.project_id || null;

  // Delete-then-insert so a NULL project_id row stays idempotent (Postgres
  // treats NULLs as distinct in the unique index, so upsert would duplicate).
  let del = supabase
    .from("costs_monthly")
    .delete()
    .eq("source", "manual")
    .eq("cost_category", input.cost_category)
    .eq("vendor", vendor)
    .eq("period_month", period);
  del = projectId ? del.eq("project_id", projectId) : del.is("project_id", null);
  const { error: delErr } = await del;
  if (delErr) return { ok: false, message: friendlyDbError(delErr) };

  const { error } = await supabase.from("costs_monthly").insert({
    project_id: projectId,
    cost_category: input.cost_category,
    vendor,
    period_month: period,
    amount_sek: input.amount_sek,
    source: "manual",
    notes: input.notes ?? null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  await supabase.rpc("refresh_pnl_monthly");
  revalidatePath("/costs");
  return { ok: true };
}
