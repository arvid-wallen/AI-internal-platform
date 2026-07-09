"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, getSessionMember, hasRole } from "@/lib/auth";
import { INVALID_INPUT_MESSAGE, workspaceMapSchema } from "@/lib/schemas";

// Maps a provider's workspace/project id -> our project uuid, stored in
// integrations_credentials.metadata. Anthropic uses key "workspace_map",
// OpenAI uses "project_map", Sentry uses "sentry_project_map" (matches the
// cron handlers in app/api/cron/sync-anthropic, sync-openai, sync-sentry).

export type MappableProvider = "anthropic" | "openai" | "sentry";

export interface MappableProject {
  id: string; // real project uuid
  name: string;
  slug: string;
}

export interface MappingData {
  configured: boolean;
  projects: MappableProject[];
  anthropicMap: Record<string, string>;
  openaiMap: Record<string, string>;
  sentryMap: Record<string, string>;
}

const metaKey = (p: MappableProvider) =>
  p === "openai"
    ? "project_map"
    : p === "sentry"
      ? "sentry_project_map"
      : "workspace_map";

export async function getMappingData(): Promise<MappingData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      configured: false,
      projects: [],
      anthropicMap: {},
      openaiMap: {},
      sentryMap: {},
    };
  }
  const supabase = await createSupabaseServer();

  const [{ data: projects }, { data: creds }] = await Promise.all([
    supabase.from("projects").select("id, name, slug").order("name"),
    supabase
      .from("integrations_credentials")
      .select("provider_slug, metadata")
      .in("provider_slug", ["anthropic", "openai", "sentry"]),
  ]);

  const mapFor = (p: MappableProvider): Record<string, string> => {
    const row = (creds ?? []).find((c) => c.provider_slug === p);
    const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
    return (meta[metaKey(p)] as Record<string, string> | undefined) ?? {};
  };

  return {
    configured: true,
    projects: (projects ?? []) as MappableProject[],
    anthropicMap: mapFor("anthropic"),
    openaiMap: mapFor("openai"),
    sentryMap: mapFor("sentry"),
  };
}

export async function saveWorkspaceMap(
  provider: MappableProvider,
  map: Record<string, string>, // workspace_id -> project_uuid
): Promise<{ ok: boolean; message?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase ar inte konfigurerat." };
  }
  const member = await getSessionMember();
  if (!member) return { ok: false, message: "Inte inloggad." };
  // integrations_credentials is admin-only by RLS.
  if (!hasRole(member, "admin")) {
    return {
      ok: false,
      message: "Endast administratörer kan ändra mappningen.",
    };
  }
  const parsed = workspaceMapSchema.safeParse({ provider, map });
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };
  const supabase = await createSupabaseServer();

  const { data: cred } = await supabase
    .from("integrations_credentials")
    .select("metadata")
    .eq("provider_slug", provider)
    .maybeSingle();
  const metadata = (cred?.metadata as Record<string, unknown> | null) ?? {};
  // Drop empty entries so the cron only sees real mappings.
  const cleaned: Record<string, string> = {};
  for (const [ws, pid] of Object.entries(map)) {
    if (ws.trim() && pid) cleaned[ws.trim()] = pid;
  }
  const next = { ...metadata, [metaKey(provider)]: cleaned };

  const { error } = await supabase
    .from("integrations_credentials")
    .update({ metadata: next })
    .eq("provider_slug", provider);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/settings");
  return { ok: true };
}
