"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";
import {
  KEYABLE_PROVIDERS,
  type KeyableProvider,
} from "@/lib/integrations/keys";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

// Stores an integration API key from the settings UI. Admin-only (RLS on
// integrations_credentials enforces the same); the key is write-only in the
// UI — it can be replaced or cleared but never read back.
export async function saveIntegrationKey(
  provider: KeyableProvider,
  token: string,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("admin");
  if (roleError) return { ok: false, message: roleError };

  if (!KEYABLE_PROVIDERS.includes(provider)) {
    return { ok: false, message: "Okänd integration." };
  }
  const trimmed = token.trim();
  if (trimmed.length < 10 || trimmed.length > 500) {
    return { ok: false, message: "Det där ser inte ut som en giltig nyckel." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("integrations_credentials")
    .update({ access_token: trimmed })
    .eq("provider_slug", provider)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (!data) return { ok: false, message: "Integrationsraden saknas i databasen." };

  revalidatePath("/settings");
  return { ok: true, message: "Nyckeln sparad. Nästa sync använder den." };
}

export async function clearIntegrationKey(
  provider: KeyableProvider,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("admin");
  if (roleError) return { ok: false, message: roleError };
  if (!KEYABLE_PROVIDERS.includes(provider)) {
    return { ok: false, message: "Okänd integration." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("integrations_credentials")
    .update({ access_token: null })
    .eq("provider_slug", provider);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/settings");
  return { ok: true, message: "Nyckeln borttagen." };
}
