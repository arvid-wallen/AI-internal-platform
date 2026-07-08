import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { isFxStale } from "./fx";
import {
  cardImportRowSchema,
  manualCostSchema,
  switchModelSchema,
} from "./schemas";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    const csv = toCsv([
      ["a", 'he said "hi"'],
      ["b,c", "line1\nline2"],
    ]);
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain('"b,c"');
    expect(csv).toContain('"line1\nline2"');
  });
});

describe("isFxStale", () => {
  const now = new Date("2026-07-08T00:00:00Z");
  it("fresh within 5 days", () => {
    expect(isFxStale("2026-07-06", now)).toBe(false);
  });
  it("stale after 5 days or unparseable", () => {
    expect(isFxStale("2026-06-20", now)).toBe(true);
    expect(isFxStale("not-a-date", now)).toBe(true);
  });
});

describe("schemas", () => {
  it("switchModelSchema accepts p-prefixed slugs and rejects garbage", () => {
    expect(
      switchModelSchema.safeParse({ projectId: "p-haus-crm", toModelId: "claude-sonnet-5" })
        .success,
    ).toBe(true);
    expect(
      switchModelSchema.safeParse({ projectId: "DROP TABLE", toModelId: "" }).success,
    ).toBe(false);
  });

  it("manualCostSchema requires positive amount and valid month", () => {
    const ok = manualCostSchema.safeParse({
      vendor: "Cursor",
      amount_sek: 189.2,
      cost_category: "third_party_api",
      period_month: "2026-04",
    });
    expect(ok.success).toBe(true);
    expect(
      manualCostSchema.safeParse({
        vendor: "",
        amount_sek: -5,
        cost_category: "nope",
        period_month: "april",
      }).success,
    ).toBe(false);
  });

  it("cardImportRowSchema requires YYYY-MM-01 months and uuid or null project", () => {
    const ok = cardImportRowSchema.safeParse({
      period_month: "2026-04-01",
      amount_sek: 94.92,
      cost_category: "third_party_api",
      vendor: "OpenAI",
      project_id: null,
      include: true,
    });
    expect(ok.success).toBe(true);
    expect(
      cardImportRowSchema.safeParse({
        period_month: "2026-04-15",
        amount_sek: 94.92,
        cost_category: "third_party_api",
        vendor: "OpenAI",
        project_id: "not-a-uuid",
        include: true,
      }).success,
    ).toBe(false);
  });
});
