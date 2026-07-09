// AI fallback classifier for merchant strings the deterministic rules couldn't
// match. Uses the Anthropic Messages API with a single tool so the model is
// forced to return structured JSON. The static system prompt (taxonomy + known
// vendors + projects) is marked cache_control so repeat monthly runs are cheap.
//
// Requires the "Anthropic · API" key (a regular key, NOT the admin key) —
// set under Settings → API-nycklar (env var ANTHROPIC_API_KEY as fallback).
// If it's unset or the call fails, returns an empty map and the caller leaves
// those rows for manual review — nothing throws.

import { getIntegrationKey } from "@/lib/integrations/keys";
import type { CostCategory } from "@/lib/types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLASSIFIER_MODEL = "claude-haiku-4-5";

const CATEGORIES: CostCategory[] = [
  "hosting",
  "database",
  "storage",
  "cdn",
  "third_party_api",
  "domain",
  "other",
];

export interface AiClassification {
  canonical_vendor: string;
  cost_category: CostCategory;
  is_software: boolean;
  is_api_usage: boolean;
  suggested_project_slug: string | null;
  confidence: number;
}

export interface ClassifyContext {
  knownVendors: string[];
  projects: Array<{ slug: string; name: string }>;
}

interface ToolItem {
  merchant?: unknown;
  canonical_vendor?: unknown;
  cost_category?: unknown;
  is_software?: unknown;
  is_api_usage?: unknown;
  suggested_project_slug?: unknown;
  confidence?: unknown;
}

// Returns a map keyed by the ORIGINAL merchant string.
export async function classifyMerchants(
  merchants: string[],
  ctx: ClassifyContext,
): Promise<Map<string, AiClassification>> {
  const result = new Map<string, AiClassification>();
  const apiKey = await getIntegrationKey("anthropic_api");
  const uniq = [...new Set(merchants.filter((m) => m.trim()))];
  if (!apiKey || uniq.length === 0) return result;

  const tool = {
    name: "classify_merchants",
    description: "Return one classification object for every merchant provided.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              merchant: {
                type: "string",
                description: "The exact merchant string from the input list.",
              },
              canonical_vendor: {
                type: "string",
                description:
                  "Clean brand name, e.g. 'Vercel'. Reuse a known vendor name when it matches.",
              },
              cost_category: { type: "string", enum: CATEGORIES },
              is_software: {
                type: "boolean",
                description:
                  "true for software/SaaS/cloud spend; false for food, parking, hotels, taxis, groceries, trains.",
              },
              is_api_usage: {
                type: "boolean",
                description:
                  "true ONLY for raw OpenAI/Anthropic API usage or credits (tracked elsewhere). ChatGPT/Claude seat subscriptions are NOT api usage.",
              },
              suggested_project_slug: {
                type: ["string", "null"],
                description:
                  "A project slug from the provided list if the cost clearly belongs to one project, else null.",
              },
              confidence: {
                type: "number",
                description: "0..1 confidence in this classification.",
              },
            },
            required: [
              "merchant",
              "canonical_vendor",
              "cost_category",
              "is_software",
              "is_api_usage",
              "suggested_project_slug",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  };

  const systemText =
    "You classify line items from a Swedish company credit-card statement for a software agency (Haus AI). " +
    "For each merchant string decide whether it is a software/SaaS/cloud cost and assign a clean vendor name + a category. " +
    "Categories: hosting, database, storage, cdn, third_party_api, domain, other. " +
    "Use 'third_party_api' for SaaS tools/APIs and 'other' for non-infra software (security, design, productivity). " +
    "Set is_software=false for clearly non-software charges (restaurants, parking, hotels, taxis, groceries, trains). " +
    "Known vendors already in the system (reuse these names verbatim when they match): " +
    (ctx.knownVendors.join(", ") || "(none)") +
    ". Projects you may attribute a cost to (slug — name): " +
    (ctx.projects.map((p) => `${p.slug} — ${p.name}`).join("; ") || "(none)") +
    ".";

  const body = {
    model: CLASSIFIER_MODEL,
    max_tokens: 4096,
    system: [
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ],
    tools: [tool],
    tool_choice: { type: "tool", name: "classify_merchants" },
    messages: [
      {
        role: "user",
        content:
          "Classify these merchant strings (keep them in order):\n" +
          uniq.map((m, i) => `${i + 1}. ${m}`).join("\n"),
      },
    ],
  };

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return result;
    const json = (await res.json()) as {
      content?: Array<{
        type: string;
        name?: string;
        input?: { items?: ToolItem[] };
      }>;
    };
    const toolUse = (json.content ?? []).find(
      (c) => c.type === "tool_use" && c.name === "classify_merchants",
    );
    const items = toolUse?.input?.items ?? [];
    const byNorm = new Map(uniq.map((m) => [m.trim().toLowerCase(), m]));

    items.forEach((it, i) => {
      const echoed = String(it.merchant ?? "").trim().toLowerCase();
      const original = byNorm.get(echoed) ?? uniq[i] ?? null;
      if (!original) return;
      const cat = String(it.cost_category ?? "other") as CostCategory;
      result.set(original, {
        canonical_vendor: String(it.canonical_vendor ?? original),
        cost_category: CATEGORIES.includes(cat) ? cat : "other",
        is_software: Boolean(it.is_software),
        is_api_usage: Boolean(it.is_api_usage),
        suggested_project_slug: it.suggested_project_slug
          ? String(it.suggested_project_slug)
          : null,
        confidence:
          typeof it.confidence === "number" ? it.confidence : 0.5,
      });
    });
  } catch {
    return result;
  }
  return result;
}
