import { describe, expect, it } from "vitest";
import { normalizeSek, parseCardCsv } from "./parse";

describe("normalizeSek", () => {
  it("handles U+2212 minus and returns the magnitude", () => {
    expect(normalizeSek("−94,92")).toBe(94.92);
  });
  it("handles en/em dashes as minus", () => {
    expect(normalizeSek("–1,50")).toBe(1.5);
    expect(normalizeSek("—2,00")).toBe(2);
  });
  it("strips NBSP and space thousands separators", () => {
    expect(normalizeSek("1 234,56")).toBe(1234.56);
    expect(normalizeSek("12 345,00")).toBe(12345);
  });
  it("returns null for header cells and empty strings", () => {
    expect(normalizeSek("Belopp i SEK")).toBeNull();
    expect(normalizeSek("")).toBeNull();
  });
});

describe("parseCardCsv", () => {
  const csv = [
    "Bokföringsdag,Text,Belopp i SEK,,,,Inköp",
    '2026-04-30,"Openai USD 10,01","−94,92",,,,',
    '2026-04-28,"CURSOR, AI POWERED IDE USD 20,00","−189,20",,,,',
    "2026-04-27,Parkering Stockholm,−45,,,,",
    "not-a-date,junk,123,,,,",
    "",
  ].join("\n");

  it("skips header and junk rows, parses valid ones", () => {
    const rows = parseCardCsv(csv);
    expect(rows).toHaveLength(3);
  });

  it("extracts original currency from the merchant text", () => {
    const rows = parseCardCsv(csv);
    expect(rows[0].origCurrency).toBe("USD");
    expect(rows[0].origAmount).toBe(10.01);
    expect(rows[2].origCurrency).toBeUndefined();
  });

  it("derives period_month as YYYY-MM-01", () => {
    const rows = parseCardCsv(csv);
    expect(rows[0].period_month).toBe("2026-04-01");
  });

  it("handles quoted fields containing commas and strips BOM", () => {
    const withBom = "﻿" + csv;
    const rows = parseCardCsv(withBom);
    expect(rows[1].rawText).toContain("CURSOR, AI POWERED IDE");
  });

  it("keeps positive magnitudes", () => {
    const rows = parseCardCsv(csv);
    expect(rows.every((r) => r.amountSek > 0)).toBe(true);
  });
});
