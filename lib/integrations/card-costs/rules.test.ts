import { describe, expect, it } from "vitest";
import { matchRule, normalizeMerchant } from "./rules";
import type { VendorRule } from "@/lib/types";

const rule = (pattern: string, vendor = pattern): VendorRule => ({
  id: pattern,
  match_pattern: pattern,
  canonical_vendor: vendor,
  cost_category: "third_party_api",
  is_software: true,
  is_api_usage: false,
  default_project_id: null,
});

describe("normalizeMerchant", () => {
  it("lowercases and strips a trailing currency suffix", () => {
    expect(normalizeMerchant("Openai USD 10,01")).toBe("openai");
  });
  it("keeps dots and ampersands for domain-style vendors", () => {
    expect(normalizeMerchant("RECALL.AI")).toBe("recall.ai");
    expect(normalizeMerchant("MAKE.COM EUR 45,56")).toBe("make.com");
  });
  it("turns asterisks and punctuation into single spaces", () => {
    expect(normalizeMerchant("PAYPAL *NOTION")).toBe("paypal notion");
  });
});

describe("matchRule", () => {
  it("matches by substring on the normalized text", () => {
    const r = matchRule("CURSOR, AI POWERED IDE USD 20,00", [rule("cursor")]);
    expect(r?.canonical_vendor).toBe("cursor");
  });
  it("prefers the longest matching pattern", () => {
    const generic = rule("openai");
    const specific = rule("openai chatgpt subs");
    const r = matchRule("OPENAI CHATGPT SUBS USD 25,00", [generic, specific]);
    expect(r?.match_pattern).toBe("openai chatgpt subs");
  });
  it("returns null when nothing matches", () => {
    expect(matchRule("Parkering Stockholm", [rule("cursor")])).toBeNull();
  });
});
