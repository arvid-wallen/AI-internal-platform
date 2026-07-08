"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateDependencyInput {
  project_id: string; // uuid, or "p-<slug>"
  name: string;
  vendor?: string | null;
  type?:
    | "database"
    | "hosting"
    | "auth"
    | "email"
    | "payment"
    | "ai_provider"
    | "storage"
    | "third_party_api"
    | "other";
  external_url?: string | null;
  monthly_cost_sek?: number | null;
  is_critical?: boolean;
  notes?: string | null;
}

export async function createDependency(
  input: CreateDependencyInput,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Namn krävs." };

  const supabase = await createSupabaseServer();

  // Project pages pass domain ids ("p-<slug>"); resolve to the real uuid.
  let projectId = input.project_id;
  if (!UUID_RE.test(projectId)) {
    const slug = projectId.startsWith("p-") ? projectId.slice(2) : projectId;
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!proj) return { ok: false, message: "Projektet hittades inte." };
    projectId = proj.id;
  }

  const { error } = await supabase.from("dependencies").insert({
    project_id: projectId,
    name,
    vendor: input.vendor?.trim() || null,
    type: input.type ?? "other",
    external_url: input.external_url || null,
    monthly_cost_sek: input.monthly_cost_sek ?? null,
    is_critical: input.is_critical ?? false,
    notes: input.notes?.trim() || null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/projects");
  return { ok: true, message: "Beroende tillagt." };
}

export async function deleteDependency(
  dependencyId: string,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("dependencies")
    .delete()
    .eq("id", dependencyId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/projects");
  return { ok: true, message: "Beroende borttaget." };
}
