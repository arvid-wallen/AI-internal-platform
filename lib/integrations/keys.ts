// Integration API keys, managed from the settings UI and stored in
// integrations_credentials.access_token (admin-only RLS; same plaintext
// pattern as the Fortnox tokens — Vault is the future upgrade path).
// Env vars remain as fallback so nothing breaks for keys already in Vercel.
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const KEYABLE_PROVIDERS = ["sentry", "github", "vercel"] as const;
export type KeyableProvider = (typeof KEYABLE_PROVIDERS)[number];

const ENV_FALLBACK: Record<KeyableProvider, string> = {
  sentry: "SENTRY_AUTH_TOKEN",
  github: "GITHUB_TOKEN",
  vercel: "VERCEL_TOKEN",
};

// DB first (set via settings UI), env second. Server-only — called from
// cron routes with the admin client.
export async function getIntegrationKey(
  provider: KeyableProvider,
): Promise<string | null> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("integrations_credentials")
    .select("access_token")
    .eq("provider_slug", provider)
    .maybeSingle();
  if (data?.access_token) return data.access_token as string;
  return process.env[ENV_FALLBACK[provider]] ?? null;
}

export function envFallbackName(provider: KeyableProvider): string {
  return ENV_FALLBACK[provider];
}
