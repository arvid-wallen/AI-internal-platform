// Google Cloud Billing (BigQuery export) client.
// Queries the standard billing export table for Vertex AI / Gemini spend,
// attributed per Hub project via a `haus_project` resource label.
//
// Auth: a service account with BigQuery read access. Provide its JSON key as
// the env var GOOGLE_CREDENTIALS_JSON (the whole JSON, not a file path — Vercel
// has no writable filesystem). Set GOOGLE_BILLING_TABLE to the fully-qualified
// export table, e.g. `my-proj.billing.gcp_billing_export_resource_v1_XXXXXX`.
//
// Uses the BigQuery REST API + a self-signed JWT so we avoid a heavyweight SDK.

import crypto from "node:crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface GoogleBillingConfig {
  credentials: ServiceAccount;
  billingTable: string; // project.dataset.table
}

export function readGoogleConfig(): GoogleBillingConfig | null {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON;
  const billingTable = process.env.GOOGLE_BILLING_TABLE;
  if (!raw || !billingTable) return null;
  let credentials: ServiceAccount;
  try {
    credentials = JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
  if (!credentials.client_email || !credentials.private_key) return null;
  return { credentials, billingTable };
}

const b64url = (buf: Buffer) =>
  buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

async function getAccessToken(creds: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(
    Buffer.from(
      JSON.stringify({
        iss: creds.client_email,
        scope: "https://www.googleapis.com/auth/bigquery.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = b64url(signer.sign(creds.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok)
    throw new Error(`Google token ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface GoogleBillingRow {
  haus_project: string;
  usage_date: string; // YYYY-MM-DD
  cost_usd: number;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function fetchVertexBilling(
  cfg: GoogleBillingConfig,
  from: string,
  to: string,
): Promise<GoogleBillingRow[]> {
  if (!isDate(from) || !isDate(to)) throw new Error("bad date range");
  const token = await getAccessToken(cfg.credentials);

  // Backtick-quote the table; from/to are validated YYYY-MM-DD literals.
  const sql = `
    SELECT
      (SELECT value FROM UNNEST(labels) WHERE key = 'haus_project') AS haus_project,
      DATE(usage_start_time) AS usage_date,
      SUM(cost) AS cost
    FROM \`${cfg.billingTable}\`
    WHERE service.description LIKE '%Vertex AI%'
      AND DATE(usage_start_time) BETWEEN '${from}' AND '${to}'
    GROUP BY 1, 2
    HAVING haus_project IS NOT NULL`;

  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${cfg.credentials.project_id}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 60000 }),
    },
  );
  if (!res.ok)
    throw new Error(`BigQuery query ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    rows?: Array<{ f: Array<{ v: string | null }> }>;
  };
  return (body.rows ?? []).map((r) => ({
    haus_project: r.f[0]?.v ?? "",
    usage_date: r.f[1]?.v ?? "",
    cost_usd: Number(r.f[2]?.v ?? 0),
  }));
}
