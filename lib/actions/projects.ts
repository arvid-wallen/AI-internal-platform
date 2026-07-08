"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const stripP = (idOrSlug: string) =>
  idOrSlug.startsWith("p-") ? idOrSlug.slice(2) : idOrSlug;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);

export interface UpdateProjectInput {
  projectId: string; // "p-<slug>" or slug
  name?: string;
  status?: "discovery" | "building" | "live" | "paused" | "offboarded";
  customer_id?: string | null;
  internal_owner_id?: string | null;
  monthly_revenue_sek?: number | null;
  monthly_infra_budget_sek?: number | null;
  github_repo_url?: string | null;
  description?: string | null;
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const slug = stripP(input.projectId);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.status !== undefined) patch.status = input.status;
  if (input.customer_id !== undefined) patch.customer_id = input.customer_id;
  if (input.internal_owner_id !== undefined)
    patch.internal_owner_id = input.internal_owner_id;
  if (input.monthly_revenue_sek !== undefined)
    patch.monthly_revenue_sek = input.monthly_revenue_sek;
  if (input.monthly_infra_budget_sek !== undefined)
    patch.monthly_infra_budget_sek = input.monthly_infra_budget_sek;
  if (input.github_repo_url !== undefined)
    patch.github_repo_url = input.github_repo_url || null;
  if (input.description !== undefined)
    patch.description = input.description || null;
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Inget att spara." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("slug", slug)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (!data) return { ok: false, message: "Projektet hittades inte." };

  revalidatePath("/projects");
  revalidatePath(`/projects/p-${slug}`);
  revalidatePath("/customers");
  revalidatePath("/reports");
  return { ok: true, message: "Sparat." };
}

// Bulk customer assignment for the auto-provisioned projects (settings page).
export async function assignProjectCustomers(
  assignments: Array<{ projectId: string; customerId: string }>,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const valid = assignments.filter((a) => a.projectId && a.customerId);
  if (valid.length === 0) {
    return { ok: false, message: "Inga tilldelningar valda." };
  }

  const supabase = await createSupabaseServer();
  let updated = 0;
  for (const a of valid) {
    const { error } = await supabase
      .from("projects")
      .update({ customer_id: a.customerId })
      .eq("id", a.projectId);
    if (error) return { ok: false, message: friendlyDbError(error) };
    updated += 1;
  }

  revalidatePath("/settings");
  revalidatePath("/projects");
  revalidatePath("/customers");
  revalidatePath("/reports");
  return { ok: true, message: `${updated} projekt kopplade.` };
}

export interface CreateProjectInput {
  name: string;
  customer_id?: string | null;
  status?: "discovery" | "building" | "live";
  monthly_revenue_sek?: number | null;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResult & { slug?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Namn krävs." };
  const supabase = await createSupabaseServer();

  // Default owner: the "unassigned" placeholder customer.
  let customerId = input.customer_id ?? null;
  if (!customerId) {
    const { data: unassigned } = await supabase
      .from("customers")
      .select("id")
      .eq("slug", "unassigned")
      .maybeSingle();
    customerId = unassigned?.id ?? null;
  }
  if (!customerId) {
    return { ok: false, message: "Ingen kund vald (och 'unassigned' saknas)." };
  }

  const base = slugify(name) || "projekt";
  const { data: clash } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", base)
    .maybeSingle();
  const slug = clash ? `${base}-${Date.now().toString(36).slice(-4)}` : base;

  const { error } = await supabase.from("projects").insert({
    name,
    slug,
    customer_id: customerId,
    status: input.status ?? "discovery",
    monthly_revenue_sek: input.monthly_revenue_sek ?? 0,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/projects");
  return { ok: true, message: "Projekt skapat.", slug };
}
