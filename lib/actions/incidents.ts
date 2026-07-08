"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface CreateIncidentInput {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  project_id?: string | null; // uuid, or "p-<slug>"
  summary?: string | null;
  occurred_at?: string | null; // ISO; defaults to now
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createIncident(
  input: CreateIncidentInput,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const title = input.title.trim();
  if (!title) return { ok: false, message: "Titel krävs." };

  const supabase = await createSupabaseServer();

  // Project pages pass domain ids ("p-<slug>"); resolve to the real uuid.
  let projectId = input.project_id || null;
  if (projectId && !UUID_RE.test(projectId)) {
    const slug = projectId.startsWith("p-") ? projectId.slice(2) : projectId;
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!proj) return { ok: false, message: "Projektet hittades inte." };
    projectId = proj.id;
  }

  // Auto-ref INC-<year>-<NNN>, next number within the year.
  const year = new Date().getFullYear();
  const { data: last } = await supabase
    .from("incidents")
    .select("ref")
    .like("ref", `INC-${year}-%`)
    .order("ref", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNum = last?.ref ? Number(last.ref.split("-")[2]) : 0;
  const ref = `INC-${year}-${String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(3, "0")}`;

  const { error } = await supabase.from("incidents").insert({
    ref,
    title,
    severity: input.severity,
    project_id: projectId,
    summary: input.summary?.trim() || null,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/incidents");
  revalidatePath("/dashboard");
  return { ok: true, message: `${ref} skapad.` };
}

export async function resolveIncident(
  incidentId: string,
  rootCause?: string,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const supabase = await createSupabaseServer();
  const patch: Record<string, unknown> = {
    resolved_at: new Date().toISOString(),
  };
  if (rootCause?.trim()) {
    const { data: existing } = await supabase
      .from("incidents")
      .select("summary")
      .eq("id", incidentId)
      .maybeSingle();
    patch.summary = [existing?.summary, `Rotorsak: ${rootCause.trim()}`]
      .filter(Boolean)
      .join("\n");
  }
  const { error } = await supabase
    .from("incidents")
    .update(patch)
    .eq("id", incidentId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/incidents");
  revalidatePath("/dashboard");
  return { ok: true, message: "Incident löst." };
}
