"use client";

import { useState, useTransition } from "react";
import { SectionHead } from "@/components/ui";
import { saveManualCost, type ImportProject } from "@/lib/actions/card-costs";
import type { CostCategory } from "@/lib/types";

const CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: "hosting", label: "Hosting" },
  { value: "database", label: "Databas" },
  { value: "storage", label: "Lagring" },
  { value: "cdn", label: "CDN" },
  { value: "third_party_api", label: "SaaS / API" },
  { value: "domain", label: "Domän" },
  { value: "other", label: "Övrigt" },
];

export function ManualCostForm({ projects }: { projects: ImportProject[] }) {
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CostCategory>("third_party_api");
  const [projectId, setProjectId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const submit = () => {
    const amt = parseFloat(amount.replace(",", "."));
    if (!vendor.trim() || !amt) {
      setToast("Leverantör och belopp krävs.");
      return;
    }
    startTransition(async () => {
      const res = await saveManualCost({
        vendor: vendor.trim(),
        amount_sek: amt,
        cost_category: category,
        period_month: month,
        project_id: projectId || null,
      });
      if (res.ok) {
        setToast("Sparat.");
        setVendor("");
        setAmount("");
      } else {
        setToast("Fel: " + (res.message ?? "okänt"));
      }
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="card">
      <SectionHead
        title="Manuell prenumeration"
        sub="Fasta månadskostnader, t.ex. Claude Code, Lovable."
      />
      <div className="stack" style={{ gap: 8 }}>
        <input
          className="inp"
          placeholder="Leverantör"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
        <input
          className="inp"
          placeholder="Belopp SEK/mån"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="inp"
          value={category}
          onChange={(e) => setCategory(e.target.value as CostCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="inp"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Gemensamt</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className="inp"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <span className="dim" style={{ fontSize: 11.5 }}>
          {toast ?? "Sparas som källa: manual"}
        </span>
        <button
          className="b primary sm"
          type="button"
          onClick={submit}
          disabled={pending}
        >
          {pending ? "Sparar…" : "Lägg till"}
        </button>
      </div>
    </div>
  );
}
