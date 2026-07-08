"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { Pill, SectionHead } from "@/components/ui";
import { fmt } from "@/lib/format";
import {
  createDependency,
  deleteDependency,
} from "@/lib/actions/dependencies";

const TYPE_OPTIONS = [
  { value: "database", label: "Databas" },
  { value: "hosting", label: "Hosting" },
  { value: "auth", label: "Auth" },
  { value: "email", label: "E-post" },
  { value: "payment", label: "Betalning" },
  { value: "ai_provider", label: "AI-leverantör" },
  { value: "storage", label: "Lagring" },
  { value: "third_party_api", label: "Tredjeparts-API" },
  { value: "other", label: "Övrigt" },
] as const;
type DepType = (typeof TYPE_OPTIONS)[number]["value"];

export interface DependencyRow {
  id: string; // real uuid
  name: string;
  vendor: string;
  category: string;
  monthly_sek: number;
  critical: boolean;
}

export function DependenciesClient({
  projectId,
  deps,
  canEdit,
}: {
  projectId: string; // "p-<slug>"
  deps: DependencyRow[];
  canEdit: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [type, setType] = useState<DepType>("other");
  const [cost, setCost] = useState("");
  const [critical, setCritical] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const total = deps.reduce((s, d) => s + d.monthly_sek, 0);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const save = () => {
    if (!name.trim()) {
      flash("Namn krävs.");
      return;
    }
    const parsed = parseFloat(cost.replace(",", "."));
    startTransition(async () => {
      const res = await createDependency({
        project_id: projectId,
        name: name.trim(),
        vendor: vendor.trim() || null,
        type,
        monthly_cost_sek: Number.isFinite(parsed) ? parsed : null,
        is_critical: critical,
      });
      if (res.ok) {
        flash(res.message ?? "Beroende tillagt.");
        setName("");
        setVendor("");
        setCost("");
        setCritical(false);
      } else {
        flash("Fel: " + (res.message ?? "okänt"));
      }
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteDependency(id);
      flash(
        res.ok
          ? res.message ?? "Beroende borttaget."
          : "Fel: " + (res.message ?? "okänt"),
      );
    });

  return (
    <div className="card flush">
      <div style={{ padding: "16px 18px 0" }}>
        <SectionHead
          title="Externa beroenden"
          sub={`${deps.length} system · ${fmt.ksek(total)}/mån totalt`}
          actions={
            canEdit ? (
              <button
                className="b sm primary"
                type="button"
                onClick={() => setFormOpen((o) => !o)}
              >
                {formOpen ? (
                  <Icons.X size={12} />
                ) : (
                  <Icons.Plus size={12} />
                )}
                {formOpen ? "Avbryt" : "Nytt beroende"}
              </button>
            ) : undefined
          }
        />
        {formOpen && (
          <div className="stack" style={{ gap: 8, paddingBottom: 14 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input
                className="inp"
                style={{ flex: 2, minWidth: 140 }}
                placeholder="Namn"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="inp"
                style={{ flex: 2, minWidth: 120 }}
                placeholder="Vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
              <select
                className="inp"
                style={{ flex: 2, minWidth: 120 }}
                value={type}
                aria-label="Typ"
                onChange={(e) => setType(e.target.value as DepType)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="inp"
                style={{ flex: 1, minWidth: 100 }}
                placeholder="SEK/mån"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <div className="row between">
              <label
                className="row"
                style={{ gap: 6, fontSize: 12.5, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={critical}
                  onChange={(e) => setCritical(e.target.checked)}
                />
                Kritisk
              </label>
              <div className="row" style={{ gap: 8 }}>
                <span className="dim" style={{ fontSize: 11.5 }}>
                  {toast ?? ""}
                </span>
                <button
                  className="b primary sm"
                  type="button"
                  onClick={save}
                  disabled={pending}
                >
                  {pending ? "Sparar…" : "Lägg till"}
                </button>
              </div>
            </div>
          </div>
        )}
        {!formOpen && toast && (
          <div className="dim" style={{ fontSize: 11.5, paddingBottom: 10 }}>
            {toast}
          </div>
        )}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Tjänst</th>
            <th>Vendor</th>
            <th>Kategori</th>
            <th>Kritisk</th>
            <th className="num">SEK/mån</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {deps.map((d) => (
            <tr key={d.id} className="no-hover">
              <td className="strong">{d.name}</td>
              <td>{d.vendor}</td>
              <td className="tnum dim" style={{ fontSize: 12 }}>
                {d.category}
              </td>
              <td>
                {d.critical ? (
                  <Pill kind="critical">Ja</Pill>
                ) : (
                  <span className="dim">nej</span>
                )}
              </td>
              <td className="num">{fmt.ksek(d.monthly_sek)}</td>
              {canEdit && (
                <td>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => remove(d.id)}
                    disabled={pending}
                    title="Ta bort beroende"
                    aria-label={`Ta bort ${d.name}`}
                  >
                    <Icons.X size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {deps.length === 0 && (
            <tr className="no-hover">
              <td colSpan={canEdit ? 6 : 5} className="empty">
                Inga registrerade beroenden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
