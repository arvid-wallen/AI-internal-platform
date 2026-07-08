"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);

export interface CreateCustomerInput {
  name: string;
  customer_class?: "A" | "B" | "C";
  contract_status?: "live" | "paused" | "draft" | "offboarded";
  org_number?: string | null;
  invoice_email?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Namn krävs." };

  const supabase = await createSupabaseServer();
  const base = slugify(name) || "kund";
  const { data: clash } = await supabase
    .from("customers")
    .select("id")
    .eq("slug", base)
    .maybeSingle();
  const slug = clash ? `${base}-${Date.now().toString(36).slice(-4)}` : base;

  const { error } = await supabase.from("customers").insert({
    slug,
    name,
    customer_class: input.customer_class ?? "C",
    contract_status: input.contract_status ?? "live",
    org_number: input.org_number || null,
    invoice_email: input.invoice_email || null,
    primary_contact_name: input.primary_contact_name || null,
    primary_contact_email: input.primary_contact_email || null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/customers");
  return { ok: true, message: "Kund skapad." };
}

export interface UpdateCustomerInput {
  customerId: string;
  name?: string;
  customer_class?: "A" | "B" | "C";
  contract_status?: "live" | "paused" | "draft" | "offboarded";
  account_manager_id?: string | null;
  invoice_email?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
}

export async function updateCustomer(
  input: UpdateCustomerInput,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.customer_class !== undefined)
    patch.customer_class = input.customer_class;
  if (input.contract_status !== undefined)
    patch.contract_status = input.contract_status;
  if (input.account_manager_id !== undefined)
    patch.account_manager_id = input.account_manager_id;
  if (input.invoice_email !== undefined)
    patch.invoice_email = input.invoice_email || null;
  if (input.primary_contact_name !== undefined)
    patch.primary_contact_name = input.primary_contact_name || null;
  if (input.primary_contact_email !== undefined)
    patch.primary_contact_email = input.primary_contact_email || null;
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Inget att spara." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", input.customerId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (!data) return { ok: false, message: "Kunden hittades inte." };

  revalidatePath("/customers");
  revalidatePath(`/customers/${input.customerId}`);
  return { ok: true, message: "Sparat." };
}
