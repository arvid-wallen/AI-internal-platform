// Integration API keys, managed from the settings UI and stored on the
// provider's integrations_credentials row (admin-only RLS; same plaintext
// pattern as the Fortnox tokens — Vault is the future upgrade path).
// Storage: the provider's primary key lives in access_token; additional keys
// (a provider can have several, e.g. Anthropic admin + API) live in
// metadata.api_keys[slot]. Env vars remain as fallback so nothing breaks for
// keys already set in Vercel.
//
// NOT managed here: Fortnox (OAuth flow with self-rotating tokens — the
// "Anslut Fortnox" card) and Supabase (the platform's own database
// credentials; the app cannot fetch its DB password from the DB it is
// logging in to — those stay in Vercel env).
import { createSupabaseAdmin } from "@/lib/supabase/server";

export interface KeyDef {
  id: string;
  row: string; // integrations_credentials.provider_slug
  slot: "default" | string; // "default" → access_token, else metadata.api_keys[slot]
  env: string; // fallback env var
  label: string;
  hint: string;
  minLen: number;
  maxLen: number;
}

export const KEY_DEFS = [
  {
    id: "sentry",
    row: "sentry",
    slot: "default",
    env: "SENTRY_AUTH_TOKEN",
    label: "Sentry",
    hint: "Org auth token (org:read, project:read, event:read) — driver incident-synken.",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "github",
    row: "github",
    slot: "default",
    env: "GITHUB_TOKEN",
    label: "GitHub",
    hint: "Personal access token med repo-läsning — repo-metadata på projektsidorna.",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "vercel",
    row: "vercel",
    slot: "default",
    env: "VERCEL_TOKEN",
    label: "Vercel",
    hint: "API-token — länkar Hub-projekt till Vercel-projekt.",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "anthropic_admin",
    row: "anthropic",
    slot: "default",
    env: "ANTHROPIC_ADMIN_KEY",
    label: "Anthropic · admin",
    hint: "Admin-nyckel (sk-ant-admin01-…) — usage/kostnadsrapportering per workspace.",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "anthropic_api",
    row: "anthropic",
    slot: "api",
    env: "ANTHROPIC_API_KEY",
    label: "Anthropic · API",
    hint: "Vanlig API-nyckel (sk-ant-api03-…) — kortimportens AI-klassificering.",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "openai_admin",
    row: "openai",
    slot: "default",
    env: "OPENAI_ADMIN_KEY",
    label: "OpenAI · admin",
    hint: "Admin-nyckel — usage/kostnadsrapportering (primär org).",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "openai_admin_2",
    row: "openai",
    slot: "org2",
    env: "OPENAI_ADMIN_KEY_HAUS",
    label: "OpenAI · extra org",
    hint: "Admin-nyckel för den andra OpenAI-organisationen (valfri).",
    minLen: 10,
    maxLen: 500,
  },
  {
    id: "google_credentials",
    row: "google",
    slot: "credentials_json",
    env: "GOOGLE_CREDENTIALS_JSON",
    label: "Google · service account",
    hint: "Hela service-account-JSON:en — BigQuery-läsning av Vertex/Gemini-spend.",
    minLen: 50,
    maxLen: 10000,
  },
  {
    id: "google_billing_table",
    row: "google",
    slot: "billing_table",
    env: "GOOGLE_BILLING_TABLE",
    label: "Google · billing-tabell",
    hint: "Fullt kvalificerad BigQuery-exporttabell (project.dataset.table) — inte hemlig men krävs.",
    minLen: 5,
    maxLen: 300,
  },
] as const satisfies readonly KeyDef[];

export type KeyId = (typeof KEY_DEFS)[number]["id"];

export function keyDef(id: KeyId): KeyDef {
  const def = KEY_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Okänd nyckel: ${id}`);
  return def;
}

// DB first (set via settings UI), env second. Server-only — reads with the
// admin client (callers are cron routes and server actions).
export async function getIntegrationKey(id: KeyId): Promise<string | null> {
  const def = keyDef(id);
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("integrations_credentials")
    .select("access_token, metadata")
    .eq("provider_slug", def.row)
    .maybeSingle();
  if (data) {
    if (def.slot === "default" && data.access_token) {
      return data.access_token as string;
    }
    if (def.slot !== "default") {
      const meta = (data.metadata as Record<string, unknown> | null) ?? {};
      const apiKeys = (meta.api_keys as Record<string, string> | undefined) ?? {};
      if (apiKeys[def.slot]) return apiKeys[def.slot];
    }
  }
  return process.env[def.env] ?? null;
}
