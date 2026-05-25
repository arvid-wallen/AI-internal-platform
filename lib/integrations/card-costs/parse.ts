// Parser for Swedish bank/card statement CSV exports.
//
// Format (per the company card export):
//   Bokföringsdag,Text,Belopp i SEK,,,,Inköp
//   2026-04-30,"Openai USD 10,01","−94,92",,,,
//
// Gotchas handled here:
//   - The minus sign is U+2212 (−), not ASCII "-" (also en/em dashes).
//   - Decimal comma; thousands sometimes separated by space / NBSP.
//   - Some fields are quoted because they contain a comma.
//   - The merchant text often carries the original currency: "… USD 10,01".

export interface ParsedTxn {
  date: string; // YYYY-MM-DD
  period_month: string; // YYYY-MM-01
  rawText: string; // merchant description
  amountSek: number; // positive magnitude in SEK
  origCurrency?: "USD" | "EUR";
  origAmount?: number;
}

// Minimal RFC4180-style splitter — handles quoted fields and "" escapes.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Parse a Swedish-formatted amount into a positive number. Returns null when
// the string holds no parseable number (e.g. a header cell).
export function normalizeSek(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/[−–—]/g, "-"); // minus / en-dash / em-dash -> ASCII
  s = s.replace(/[\s ]/g, ""); // drop spaces & NBSP (thousands separators)
  s = s.replace(",", "."); // decimal comma -> dot
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.abs(n);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ORIG_CCY = /\b(USD|EUR)\s+([\d\s.,]+)\s*$/i;

export function parseCardCsv(text: string): ParsedTxn[] {
  const clean = text.replace(/^﻿/, ""); // strip BOM
  const lines = clean.split(/\r?\n/);
  const out: ParsedTxn[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const date = (cols[0] ?? "").trim();
    if (!ISO_DATE.test(date)) continue; // skips header + any junk rows
    const rawText = (cols[1] ?? "").trim();
    const amountSek = normalizeSek(cols[2] ?? "");
    if (amountSek == null || amountSek === 0) continue;

    const txn: ParsedTxn = {
      date,
      period_month: date.slice(0, 7) + "-01",
      rawText,
      amountSek,
    };
    const m = ORIG_CCY.exec(rawText);
    if (m) {
      txn.origCurrency = m[1].toUpperCase() as "USD" | "EUR";
      const amt = normalizeSek(m[2]);
      if (amt != null) txn.origAmount = amt;
    }
    out.push(txn);
  }
  return out;
}
