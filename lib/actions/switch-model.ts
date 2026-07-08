"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, getSessionMember, hasRole } from "@/lib/auth";
import { notifySlack } from "@/lib/notify";
import { INVALID_INPUT_MESSAGE, switchModelSchema } from "@/lib/schemas";

export interface SwitchModelInput {
  projectId: string; // domain id "p-<slug>" or bare slug
  toModelId: string;
  reason?: string;
}

export interface SwitchModelResult {
  ok: boolean;
  message?: string;
}

const stripP = (idOrSlug: string) =>
  idOrSlug.startsWith("p-") ? idOrSlug.slice(2) : idOrSlug;

// Switches the active AI model on a project via the switch_active_model RPC
// (one transaction: closes the previous project_models row, inserts the new
// one, writes the model_switches audit row with the acting team member).
export async function switchActiveModel(
  input: SwitchModelInput,
): Promise<SwitchModelResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const parsed = switchModelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };

  let supabase;
  try {
    supabase = await createSupabaseServer();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Supabase init failed",
    };
  }

  const member = await getSessionMember();
  if (!member) return { ok: false, message: "Inte inloggad." };
  if (!hasRole(member, "editor")) {
    return {
      ok: false,
      message: "Du har inte behörighet att byta modell (kräver redaktör).",
    };
  }

  const slug = stripP(input.projectId);
  const { error } = await supabase.rpc("switch_active_model", {
    p_project_slug: slug,
    p_to_model: input.toModelId,
    p_reason: input.reason ?? null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  // Fire-and-forget post-commit tasks.
  after(async () => {
    await notifySlack(
      `Modell bytt på *${slug}* → ${input.toModelId} av ${member.name}`,
    );
  });

  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/projects/${input.projectId}/models`);
  return { ok: true };
}
