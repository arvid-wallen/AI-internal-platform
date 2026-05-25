// Fortnox OAuth 2.0 + Invoices API client.
// Docs:
//  - OAuth: https://developer.fortnox.se/general/authentication/
//  - Invoices: https://apps.fortnox.se/apidocs#tag/InvoicesResource

import { createSupabaseAdmin } from "@/lib/supabase/server";

const AUTH_BASE = "https://apps.fortnox.se/oauth-v1";
const API_BASE = "https://api.fortnox.se/3";
export const FORTNOX_SCOPES = [
  "companyinformation",
  "invoice",
  "customer",
  "article",
  "settings",
].join(" ");

export interface FortnoxTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;          // seconds
  token_type: string;
  scope: string;
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
  // Refresh.
  const fresh = await refreshAccessToken(stored.refresh_token);
  await writeStoredTokens(fresh);
  return fresh.access_token;
}

// ============ Invoices API ============

export interface FortnoxInvoice {
  DocumentNumber: string;
  CustomerNumber: string;
  CustomerName: string;
  InvoiceDate: string;          // YYYY-MM-DD
  DueDate: string;
  Total: number;
  TotalToPay: number;
  Currency: string;
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

export async function listInvoicesSince(
  fromDate: string,
  accessToken: string,
): Promise<FortnoxInvoice[]> {
  const out: FortnoxInvoice[] = [];
  let page = 1;
  // List endpoint paginates 100 per page.
  for (;;) {
    const url = new URL(`${API_BASE}/invoices`);
    url.searchParams.set("fromdate", fromDate);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "100");
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Fortnox /invoices ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as InvoiceListResponse;
    // Fetch each invoice's detail in parallel (small N).
    const details = await Promise.all(
      body.Invoices.map(async (i) => {
        const r = await fetch(`${API_BASE}/invoices/${i.DocumentNumber}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        if (!r.ok) return null;
        return ((await r.json()) as InvoiceDetailResponse).Invoice;
      }),
    );
    for (const d of details) if (d) out.push(d);
    if (body.MetaInformation["@CurrentPage"] >= body.MetaInformation["@TotalPages"]) break;
    page += 1;
    if (page > 50) break;        // safety
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
    url.searchParams.set("limit", "100");
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
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
