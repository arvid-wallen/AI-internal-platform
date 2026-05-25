// Orchestrates the card-cost import preview:
//   parse CSV -> deterministic rules -> AI for the leftovers -> aggregate
// per (project, category, vendor, month). The result is a list of reviewable
// rows the UI shows before anything is written to costs_monthly.

import { parseCardCsv, type ParsedTxn } from "./parse";
import { matchRule, normalizeMerchant } from "./rules";
import { classifyMerchants, type ClassifyContext } from "./classify";
import type { CardImportRow, CostCategory, VendorRule } from "@/lib/types";

export interface ImportContext {
  rules: VendorRule[];
  projects: Array<{ id: string; slug: string; name: string }>;
  useAi?: boolean; // default true
}

interface Classified extends ParsedTxn {
  vendor: string;
  cost_category: CostCategory;
  is_software: boolean;
  is_api_usage: boolean;
  project_id: string | null;
  source: "rule" | "ai" | "unknown";
  confidence: number | null;
}

export async function buildImportPreview(
  csvText: string,
  ctx: ImportContext,
): Promise<CardImportRow[]> {
  const txns = parseCardCsv(csvText);
  const projBySlug = new Map(ctx.projects.map((p) => [p.slug, p.id]));

  const classified: Classified[] = [];
  const unknownTexts: string[] = [];
  const unknownIdx: number[] = [];

  for (const t of txns) {
    const rule = matchRule(t.rawText, ctx.rules);
    if (rule) {
      classified.push({
        ...t,
        vendor: rule.canonical_vendor,
        cost_category: rule.cost_category ?? "other",
        is_software: rule.is_software,
        is_api_usage: rule.is_api_usage,
        project_id: rule.default_project_id ?? null,
        source: "rule",
        confidence: null,
      });
    } else {
      classified.push({
        ...t,
        vendor: cleanVendorGuess(t.rawText),
        cost_category: "other",
        is_software: true,
        is_api_usage: false,
        project_id: null,
        source: "unknown",
        confidence: null,
      });
      unknownTexts.push(t.rawText);
      unknownIdx.push(classified.length - 1);
    }
  }

  if (ctx.useAi !== false && unknownTexts.length > 0) {
    const aiCtx: ClassifyContext = {
      knownVendors: [...new Set(ctx.rules.map((r) => r.canonical_vendor))],
      projects: ctx.projects.map((p) => ({ slug: p.slug, name: p.name })),
    };
    const ai = await classifyMerchants(unknownTexts, aiCtx);
    for (const idx of unknownIdx) {
      const row = classified[idx];
      const cls = ai.get(row.rawText);
      if (!cls) continue;
      row.vendor = cls.canonical_vendor || row.vendor;
      row.cost_category = cls.cost_category;
      row.is_software = cls.is_software;
      row.is_api_usage = cls.is_api_usage;
      row.project_id = cls.suggested_project_slug
        ? projBySlug.get(cls.suggested_project_slug) ?? null
        : null;
      row.source = "ai";
      row.confidence = cls.confidence;
    }
  }

  // Aggregate per (project, category, vendor, month).
  const groups = new Map<string, CardImportRow>();
  for (const c of classified) {
    const key = `${c.project_id ?? "_"}|${c.cost_category}|${c.vendor}|${c.period_month}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        vendor: c.vendor,
        cost_category: c.cost_category,
        period_month: c.period_month,
        amount_sek: 0,
        txn_count: 0,
        project_id: c.project_id,
        is_software: c.is_software,
        is_api_usage: c.is_api_usage,
        include: c.is_software && !c.is_api_usage,
        source: c.source,
        confidence: c.confidence,
        sample_text: c.rawText,
        raw_texts: [],
      };
      groups.set(key, g);
    }
    g.amount_sek += c.amountSek;
    g.txn_count += 1;
    g.raw_texts.push(c.rawText);
    // Keep the most cautious (lowest) confidence for the group.
    if (
      c.confidence != null &&
      (g.confidence == null || c.confidence < g.confidence)
    ) {
      g.confidence = c.confidence;
    }
  }

  const rows = [...groups.values()];
  for (const r of rows) r.amount_sek = Math.round(r.amount_sek * 100) / 100;
  rows.sort((a, b) => b.amount_sek - a.amount_sek);
  return rows;
}

// Fallback label for an unmatched merchant: title-case its first few tokens.
function cleanVendorGuess(rawText: string): string {
  const tokens = normalizeMerchant(rawText).split(" ").filter(Boolean).slice(0, 3);
  if (tokens.length === 0) return rawText.trim() || "Okänd";
  return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
}
