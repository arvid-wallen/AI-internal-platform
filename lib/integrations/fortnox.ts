// Fortnox OAuth 2.0 + Invoices/Customers API client.
// Docs:
//  - OAuth: https://developer.fortnox.se/general/authentication/
//  - Invoices: https://apps.fortnox.se/apidocs#tag/InvoicesResource
// Rate limit: 25 requests / 5-second sliding window per access token → 429.

import { createSupabaseAdmin } from "@/lib/supabase/server";

const AUTH_BASE = "https://apps.fortnox.se/oauth-v1";
const API_BASE = "https://api.fortnox.se/3";
// Least-privilege: we only read invoices + customers, and resolve article
// codes for project mapping. Dropping "settings"/"companyinformation" (unused
// and admin-gated) so a non-system-admin may be able to authorize.
// Supplier invoices (scope "supplierinvoice") are a deliberate later step —
// adding a scope forces a re-consent round trip.
export const FORTNOX_SCOPES = ["invoice", "customer", "article"].join(" ");

export interface FortnoxTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;          // seconds
  token_type: string;
  scope: string;
}

export class FortnoxRateLimitError extends Error {
  constructor(url: string) {
    super(`Fortnox rate limit (429) kvarstår efter retries: ${url}`);
    this.name = "FortnoxRateLimitError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// All Fortnox API GETs go through this wrapper: on 429, honor Retry-After
// (or exponential backoff) and retry up to 5 times before giving up with a
// typed error so cron handlers can record status "rate_limited".
async function fortnoxFetch(
  url: string,
  accessToken: string,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (res.status !== 429) return res;
    if (attempt >= 5) throw new FortnoxRateLimitError(url);
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2 ** attempt * 1000;
    await sleep(waitMs);
  }
}

// Bounded-concurrency map. Concurrency 4 with the 429-retry above stays well
// under Fortnox's 25 req/5s window including the list-page calls.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ============ OAuth flow ============

export function getAuthorizationUrl(redirectUri: string, state: string) {
  const clientId = requireEnv("FORTNOX_CLIENT_ID");
  const url = new URL(`${AUTH_BASE}/auth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", FORTNOX_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("account_type", "service");
  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<FortnoxTokens> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<FortnoxTokens> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function tokenRequest(
  body: Record<string, string>,
): Promise<FortnoxTokens> {
  const clientId = requireEnv("FORTNOX_CLIENT_ID");
  const clientSecret = requireEnv("FORTNOX_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fortnox token request ${res.status}: ${text}`);
  }
  return (await res.json()) as FortnoxTokens;
}

// ============ Stored token helpers ============

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}

export async function readStoredTokens(): Promise<StoredTokens | null> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("integrations_credentials")
    .select("access_token, refresh_token, token_expires_at")
    .eq("provider_slug", "fortnox")
    .maybeSingle();
  if (!data?.access_token || !data?.refresh_token) return null;
  return data as StoredTokens;
}

export async function writeStoredTokens(tokens: FortnoxTokens): Promise<void> {
  const supabase = createSupabaseAdmin();
  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
  await supabase
    .from("integrations_credentials")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      last_sync_status: "ok",
      last_synced_at: new Date().toISOString(),
    })
    .eq("provider_slug", "fortnox");
}

export async function ensureFreshAccessToken(): Promise<string | null> {
  const stored = await readStoredTokens();
  if (!stored) return null;
  const expiresAt = stored.token_expires_at
    ? new Date(stored.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 30_000) {
    return stored.access_token;
  }
  try {
    const fresh = await refreshAccessToken(stored.refresh_token);
    await writeStoredTokens(fresh);
    return fresh.access_token;
  } catch (e) {
    // Fortnox refresh tokens are single-use. If a concurrent run (manual
    // "Synka nu" during the nightly cron) already rotated it, our stored copy
    // is stale — re-read once and use the tokens the other run wrote.
    const reread = await readStoredTokens();
    if (
      reread &&
      reread.refresh_token !== stored.refresh_token &&
      reread.token_expires_at &&
      new Date(reread.token_expires_at).getTime() > Date.now() + 30_000
    ) {
      return reread.access_token;
    }
    throw e;
  }
}

// ============ Integration metadata (sync cursors etc.) ============

export async function readFortnoxMetadata(): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("integrations_credentials")
    .select("metadata")
    .eq("provider_slug", "fortnox")
    .maybeSingle();
  return (data?.metadata as Record<string, unknown> | null) ?? {};
}

// Spread-merge so sibling metadata keys survive.
export async function patchFortnoxMetadata(
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const current = await readFortnoxMetadata();
  await supabase
    .from("integrations_credentials")
    .update({ metadata: { ...current, ...patch } })
    .eq("provider_slug", "fortnox");
}

// ============ Invoices API ============

export interface FortnoxInvoice {
  DocumentNumber: string;
  CustomerNumber: string;
  CustomerName: string;
  InvoiceDate: string;          // YYYY-MM-DD
  DueDate: string;
  Total: number;                // incl VAT, in invoice currency
  TotalToPay: number;
  Net: number;                  // excl VAT, in invoice currency
  TotalVAT: number;
  Balance: number;
  Currency: string;
  CurrencyRate: number;         // SEK per CurrencyUnit of Currency
  CurrencyUnit: number;
  InvoiceType: string;          // INVOICE | AGREEMENTINVOICE | ...
  Booked: boolean;
  Cancelled: boolean;
  FinalPayDate: string | null;
  InvoiceRows: Array<{
    ArticleNumber: string;
    Description: string;
    Price: number;
    DeliveredQuantity: string | null;
    Total: number;
  }>;
}

interface InvoiceListResponse {
  Invoices: Array<{
    "@url": string;
    DocumentNumber: string;
    InvoiceDate: string;
  }>;
  MetaInformation: {
    "@TotalResources": number;
    "@TotalPages": number;
    "@CurrentPage": number;
  };
}

interface InvoiceDetailResponse {
  Invoice: FortnoxInvoice;
}

export interface ListInvoicesOptions {
  fromDate?: string;      // YYYY-MM-DD — backfill mode
  lastModified?: string;  // "YYYY-MM-DD HH:MM" — incremental mode
}

export async function listInvoices(
  opts: ListInvoicesOptions,
  accessToken: string,
): Promise<FortnoxInvoice[]> {
  const out: FortnoxInvoice[] = [];
  let page = 1;
  for (;;) {
    const url = new URL(`${API_BASE}/invoices`);
    if (opts.fromDate) url.searchParams.set("fromdate", opts.fromDate);
    if (opts.lastModified)
      url.searchParams.set("lastmodified", opts.lastModified);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "500");
    const res = await fortnoxFetch(url.toString(), accessToken);
    if (!res.ok) {
      throw new Error(`Fortnox /invoices ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as InvoiceListResponse;

    // Detail fetches with bounded concurrency; a failed detail throws (a
    // silently dropped invoice corrupts revenue).
    const details = await mapWithConcurrency(body.Invoices, 4, async (i) => {
      const r = await fortnoxFetch(
        `${API_BASE}/invoices/${encodeURIComponent(i.DocumentNumber)}`,
        accessToken,
      );
      if (!r.ok) {
        throw new Error(
          `Fortnox /invoices/${i.DocumentNumber} ${r.status}: ${await r.text()}`,
        );
      }
      return ((await r.json()) as InvoiceDetailResponse).Invoice;
    });
    out.push(...details);

    if (
      body.MetaInformation["@CurrentPage"] >=
      body.MetaInformation["@TotalPages"]
    )
      break;
    page += 1;
    if (page > 50) break; // safety: 25k invoices
  }
  return out;
}

// ============ Customers API ============

export interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  OrganisationNumber: string | null;
  Email: string | null;
  Active?: boolean;
}

interface CustomerListResponse {
  Customers: Array<{
    CustomerNumber: string;
    Name: string;
    OrganisationNumber?: string | null;
    Email?: string | null;
    Active?: boolean;
  }>;
  MetaInformation: {
    "@TotalResources": number;
    "@TotalPages": number;
    "@CurrentPage": number;
  };
}

export async function listCustomers(
  accessToken: string,
): Promise<FortnoxCustomer[]> {
  const out: FortnoxCustomer[] = [];
  let page = 1;
  for (;;) {
    const url = new URL(`${API_BASE}/customers`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "500");
    const res = await fortnoxFetch(url.toString(), accessToken);
    if (!res.ok) {
      throw new Error(`Fortnox /customers ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as CustomerListResponse;
    for (const c of body.Customers) {
      out.push({
        CustomerNumber: c.CustomerNumber,
        Name: c.Name,
        OrganisationNumber: c.OrganisationNumber ?? null,
        Email: c.Email ?? null,
        Active: c.Active,
      });
    }
    if (
      body.MetaInformation["@CurrentPage"] >=
      body.MetaInformation["@TotalPages"]
    )
      break;
    page += 1;
    if (page > 50) break; // safety
  }
  return out;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}
