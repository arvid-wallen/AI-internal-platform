"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";
import { KEY_DEFS, type KeyId } from "@/lib/integrations/keys";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

// Stores an integration API key from the settings UI. Admin-only (RLS on
// integrations_credentials enforces the same); keys are write-only in the
// UI — they can be replaced or cleared but never read back.
export async function saveIntegrationKey(
  id: KeyId,
  token: string,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("admin");
  if (roleError) return { ok: false, message: roleError };

  const def = KEY_DEFS.find((d) => d.id === id);
  if (!def) return { ok: false, message: "Okänd nyckel." };
  const trimmed = token.trim();
  if (trimmed.length < def.minLen || trimmed.length > def.maxLen) {
    return { ok: false, message: "Det där ser inte ut som en giltig nyckel." };
  }

  const supabase = await createSupabaseServer();

  if (def.slot === "default") {
    const { data, error } = await supabase
      .from("integrations_credentials")
      .update({ access_token: trimmed })
      .eq("provider_slug", def.row)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: friendlyDbError(error) };
    if (!data)
      return { ok: false, message: "Integrationsraden saknas i databasen." };
  } else {
    // Named slot: spread-merge into metadata.api_keys so sibling keys and
    // other metadata (workspace maps, sync cursors) survive.
    const { data: cred, error: readError } = await supabase
      .from("integrations_credentials")
      .select("metadata")
      .eq("provider_slug", def.row)
      .maybeSingle();
    if (readError) return { ok: false, message: friendlyDbError(readError) };
    if (!cred)
      return { ok: false, message: "Integrationsraden saknas i databasen." };
    const meta = (cred.metadata as Record<string, unknown> | null) ?? {};
    const apiKeys = (meta.api_keys as Record<string, string> | undefined) ?? {};
    const { error } = await supabase
      .from("integrations_credentials")
      .update({
        metadata: { ...meta, api_keys: { ...apiKeys, [def.slot]: trimmed } },
      })
      .eq("provider_slug", def.row);
    if (error) return { ok: false, message: friendlyDbError(error) };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Nyckeln sparad. Nästa sync använder den." };
}

export async function clearIntegrationKey(id: KeyId): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("admin");
  if (roleError) return { ok: false, message: roleError };

  const def = KEY_DEFS.find((d) => d.id === id);
  if (!def) return { ok: false, message: "Okänd nyckel." };

  const supabase = await createSupabaseServer();

  if (def.slot === "default") {
    const { error } = await supabase
      .from("integrations_credentials")
      .update({ access_token: null })
      .eq("provider_slug", def.row);
    if (error) return { ok: false, message: friendlyDbError(error) };
  } else {
    const { data: cred, error: readError } = await supabase
      .from("integrations_credentials")
      .select("metadata")
      .eq("provider_slug", def.row)
      .maybeSingle();
    if (readError) return { ok: false, message: friendlyDbError(readError) };
    if (cred) {
      const meta = (cred.metadata as Record<string, unknown> | null) ?? {};
      const apiKeys = {
        ...((meta.api_keys as Record<string, string> | undefined) ?? {}),
      };
      delete apiKeys[def.slot];
      const { error } = await supabase
        .from("integrations_credentials")
        .update({ metadata: { ...meta, api_keys: apiKeys } })
        .eq("provider_slug", def.row);
      if (error) return { ok: false, message: friendlyDbError(error) };
    }
  }

  revalidatePath("/settings");
  return { ok: true, message: "Nyckeln borttagen." };
}
