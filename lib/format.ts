// Format helpers — sv-SE locale, all amounts in SEK.

export const fmt = {
  sek(n: number | null | undefined, opts: { unit?: boolean } = {}): string {
    if (n == null || isNaN(n)) return "—";
    const v = Math.round(n);
    return (
      v.toLocaleString("sv-SE", { maximumFractionDigits: 0 }) +
      (opts.unit === false ? "" : " kr")
    );
  },
  ksek(n: number | null | undefined): string {
    if (n == null) return "—";
    if (Math.abs(n) >= 1_000_000)
      return (n / 1_000_000).toFixed(2).replace(".", ",") + "M kr";
    if (Math.abs(n) >= 10_000)
      return Math.round(n / 1000).toLocaleString("sv-SE") + "k kr";
    return Math.round(n).toLocaleString("sv-SE") + " kr";
  },
  usd(n: number | null | undefined): string {
    return (
      "$" +
      (n ?? 0).toLocaleString("en-US", {
        maximumFractionDigits: (n ?? 0) < 10 ? 2 : 0,
      })
    );
  },
  pct(n: number | null | undefined): string {
    if (n == null || isNaN(n)) return "—";
    const s = (n * 100).toFixed(1).replace(".", ",");
    return s + "%";
  },
  tokens(n: number | null | undefined): string {
    if (n == null) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(".", ",") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + "M";
    if (n >= 1e3) return Math.round(n / 1e3).toLocaleString("sv-SE") + "k";
    return Math.round(n).toLocaleString("sv-SE");
  },
  date(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("sv-SE", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  },
  monthShort(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("sv-SE", { month: "short" });
  },
  dayShort(iso: string): string {
    const d = new Date(iso);
    return d.getUTCDate() + "/" + (d.getUTCMonth() + 1);
  },
  longDate(d: Date = new Date()): string {
    return d.toLocaleDateString("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Stockholm",
    });
  },
  greeting(d: Date = new Date()): string {
    const h = Number(
      d.toLocaleString("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: "Europe/Stockholm",
      }),
    );
    if (h < 10) return "God morgon";
    if (h < 18) return "God eftermiddag";
    return "God kväll";
  },
};
