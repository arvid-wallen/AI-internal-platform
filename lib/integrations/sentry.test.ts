import { describe, expect, it } from "vitest";
import { mapSentrySeverity, nextCursorUrl } from "./sentry";

describe("mapSentrySeverity", () => {
  it("fatal → critical", () => {
    expect(mapSentrySeverity({ level: "fatal", count: "1", userCount: 0 })).toBe(
      "critical",
    );
  });
  it("error escalates to high on blast radius", () => {
    expect(
      mapSentrySeverity({ level: "error", count: "5", userCount: 12 }),
    ).toBe("high");
    expect(
      mapSentrySeverity({ level: "error", count: "250", userCount: 1 }),
    ).toBe("high");
    expect(mapSentrySeverity({ level: "error", count: "5", userCount: 1 })).toBe(
      "medium",
    );
  });
  it("warning/info → low", () => {
    expect(
      mapSentrySeverity({ level: "warning", count: "999", userCount: 99 }),
    ).toBe("low");
    expect(mapSentrySeverity({ level: "info", count: "1", userCount: 0 })).toBe(
      "low",
    );
  });
});

describe("nextCursorUrl", () => {
  const next =
    '<https://de.sentry.io/api/0/projects/o/p/issues/?cursor=100:1:0>; rel="next"; results="true"; cursor="100:1:0"';
  const prev =
    '<https://de.sentry.io/api/0/projects/o/p/issues/?cursor=100:0:1>; rel="previous"; results="false"; cursor="100:0:1"';

  it("returns the next url when more results exist", () => {
    expect(nextCursorUrl(`${prev}, ${next}`)).toContain("cursor=100:1:0");
  });
  it('returns null when rel="next" has results="false"', () => {
    const done = next.replace('results="true"', 'results="false"');
    expect(nextCursorUrl(`${prev}, ${done}`)).toBeNull();
  });
  it("returns null without a header", () => {
    expect(nextCursorUrl(null)).toBeNull();
  });
});
