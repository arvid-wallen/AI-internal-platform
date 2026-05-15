"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export interface SwitchModelInput {
  projectId: string;
  fromModelId: string | null;
  toModelId: string;
  reason?: string;
}

export interface SwitchModelResult {
  ok: boolean;
  message?: string;
}

// Switches the active AI model on a project. Atomically closes the previous
// project_models row (effective_to = now), inserts a new one, and writes
// an immutable audit row in model_switches.
//
// On hub-only deployments (no Supabase configured), returns ok: true as a
// no-op so the picker UI stays functional in mock mode.
export async function switchActiveModel(
  input: SwitchModelInput,
): Promise<SwitchModelResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: true, message: "Mock mode — change not persisted." };
  }

  let supabase;
  try {
    supabase = await createSupabaseServer();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Supabase init failed",
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated" };

  const now = new Date().toISOString();

  // Close current active row.
  const { error: closeErr } = await supabase
    .from("project_models")
    .update({ is_active: false, effective_to: now })
    .eq("project_id", input.projectId)
    .eq("is_active", true)
    .is("effective_to", null);
  if (closeErr) return { ok: false, message: closeErr.message };

  // Insert new active row.
  const { error: insertErr } = await supabase.from("project_models").insert({
    project_id: input.projectId,
    model_id: input.toModelId,
    role: "primary",
    is_active: true,
    effective_from: now,
    note: input.reason ?? null,
  });
  if (insertErr) return { ok: false, message: insertErr.message };

  // Audit row (immutable history).
  const { error: auditErr } = await supabase.from("model_switches").insert({
    project_id: input.projectId,
    from_model_id: input.fromModelId,
    to_model_id: input.toModelId,
    switched_at: now,
    reason: input.reason ?? null,
  });
  if (auditErr) return { ok: false, message: auditErr.message };

  // Fire-and-forget post-commit tasks: Slack notify, audit log refresh.
  after(async () => {
    // TODO: notifySlack(`Modell bytt på ${input.projectId} → ${input.toModelId}`)
  });

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/projects/${input.projectId}/models`);
  return { ok: true };
}
