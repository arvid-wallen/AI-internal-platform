import { describe, expect, it } from "vitest";
import {
  formatLastModified,
  headerProjectId,
  isRecurringInvoice,
  mapStatus,
  resolveInvoiceRate,
  resolveProjectIdFromArticle,
} from "./fortnox-mapping";

const base = {
  Cancelled: false,
  FinalPayDate: null,
  Booked: true,
  DueDate: "2099-01-01",
};

describe("mapStatus", () => {
  it("cancelled wins over paid", () => {
    expect(
      mapStatus({ ...base, Cancelled: true, FinalPayDate: "2026-01-01" }),
    ).toBe("credited");
  });
  it("paid when FinalPayDate is set", () => {
    expect(mapStatus({ ...base, FinalPayDate: "2026-01-01" })).toBe("paid");
  });
  it("draft when not booked", () => {
    expect(mapStatus({ ...base, Booked: false })).toBe("draft");
  });
  it("overdue strictly after due date, sent before", () => {
    const now = Date.parse("2026-07-08T12:00:00Z");
    expect(mapStatus({ ...base, DueDate: "2026-07-01" }, now)).toBe("overdue");
    expect(mapStatus({ ...base, DueDate: "2026-07-20" }, now)).toBe("sent");
  });
});

describe("resolveProjectIdFromArticle", () => {
  const projects = new Map([["klarna-dispute", "uuid-1"]]);
  it("maps AI-<CUSTOMER>-<PROJECT> to the slug", () => {
    expect(resolveProjectIdFromArticle("AI-KLARNA-DISPUTE", projects)).toBe(
      "uuid-1",
    );
  });
  it("returns null for non-matching codes and unknown slugs", () => {
    expect(resolveProjectIdFromArticle("KONSULT-2026", projects)).toBeNull();
    expect(resolveProjectIdFromArticle("AI-FOO-BAR", projects)).toBeNull();
    expect(resolveProjectIdFromArticle(null, projects)).toBeNull();
  });
});

describe("resolveInvoiceRate", () => {
  it("SEK is always 1", () => {
    expect(resolveInvoiceRate({ Currency: "SEK", CurrencyRate: 0 })).toBe(1);
    expect(resolveInvoiceRate({})).toBe(1);
  });
  it("uses CurrencyRate per CurrencyUnit", () => {
    expect(
      resolveInvoiceRate({ Currency: "EUR", CurrencyRate: 11.4, CurrencyUnit: 1 }),
    ).toBeCloseTo(11.4);
    expect(
      resolveInvoiceRate({ Currency: "JPY", CurrencyRate: 7.2, CurrencyUnit: 100 }),
    ).toBeCloseTo(0.072);
  });
  it("falls back to fx_rates for USD/EUR when rate missing", () => {
    expect(
      resolveInvoiceRate(
        { Currency: "USD", CurrencyRate: 0 },
        { usd_sek: 10.5 },
      ),
    ).toBe(10.5);
  });
  it("returns null when unconvertible", () => {
    expect(resolveInvoiceRate({ Currency: "GBP", CurrencyRate: 0 }, {})).toBeNull();
  });
});

describe("headerProjectId", () => {
  it("returns the project when all resolved lines agree", () => {
    expect(headerProjectId(["a", null, "a"])).toBe("a");
  });
  it("returns null on disagreement or no resolution", () => {
    expect(headerProjectId(["a", "b"])).toBeNull();
    expect(headerProjectId([null, null])).toBeNull();
    expect(headerProjectId([])).toBeNull();
  });
});

describe("isRecurringInvoice", () => {
  it("detects AGREEMENTINVOICE case-insensitively", () => {
    expect(isRecurringInvoice("AGREEMENTINVOICE")).toBe(true);
    expect(isRecurringInvoice("agreementinvoice")).toBe(true);
    expect(isRecurringInvoice("INVOICE")).toBe(false);
    expect(isRecurringInvoice(null)).toBe(false);
  });
});

describe("formatLastModified", () => {
  it("formats as YYYY-MM-DD HH:MM in UTC", () => {
    expect(formatLastModified(new Date("2026-07-08T04:05:00Z"))).toBe(
      "2026-07-08 04:05",
    );
  });
});
