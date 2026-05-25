// Deterministic vendor classification: match a merchant string against the
// seeded/learned rules in card_vendor_rules. This is the fast, free, certain
// layer; anything it can't match falls through to the AI classifier.

import type { VendorRule } from "@/lib/types";

// Lowercase a merchant string and strip the noise that gets in the way of
// substring matching: a trailing "USD 10,01" / "EUR 45,56" original-amount
// suffix, and any punctuation except "." and "&" (kept for "recall.ai",
// "make.com", "b&"). "*" becomes a space so seed patterns stay clean.
export function normalizeMerchant(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(usd|eur)\s+[\d\s.,]+\s*$/i, " ")
    .replace(/[^a-z0-9.&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns the best-matching rule (longest pattern wins, so a specific
// "openai chatgpt subs" beats a generic "openai"), or null.
export function matchRule(
  rawText: string,
  rules: VendorRule[],
): VendorRule | null {
  const hay = normalizeMerchant(rawText);
  if (!hay) return null;
  let best: VendorRule | null = null;
  for (const r of rules) {
    const pat = r.match_pattern.toLowerCase().trim();
    if (!pat) continue;
    if (hay.includes(pat)) {
      if (!best || pat.length > best.match_pattern.trim().length) best = r;
    }
  }
  return best;
}
