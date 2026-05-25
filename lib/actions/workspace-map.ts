"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

// Maps a provider's workspace/project id -> our project uuid, stored in
// integrations_credentials.metadata. Anthropic uses key "workspace_map",
// OpenAI uses "project_map" (matches the cron handlers in
// app/api/cron/sync-anthropic and sync-openai).

export type MappableProvider = "anthropic" | "openai";

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
}

const metaKey = (p: MappableProvider) =>
  p === "openai" ? "project_map" : "workspace_map";

export async function getMappingData(): Promise<MappingData> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { configured: false, projects: [], anthropicMap: {}, openaiMap: {} };
  }
  const supabase = await createSupabaseServer();

  const [{ data: projects }, { data: creds }] = await Promise.all([
    supabase.from("projects").select("id, name, slug").order("name"),
    supabase
      .from("integrations_credentials")
      .select("provider_slug, metadata")
      .in("provider_slug", ["anthropic", "openai"]),
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
  };
}

export async function saveWorkspaceMap(
  provider: MappableProvider,
  map: Record<string, string>, // workspace_id -> project_uuid
): Promise<{ ok: boolean; message?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase ar inte konfigurerat." };
  }
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Inte inloggad." };

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
  if (error) return { ok: false, message: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
