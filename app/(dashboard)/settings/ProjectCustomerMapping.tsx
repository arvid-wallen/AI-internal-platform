"use client";

import { useState, useTransition } from "react";
import { SectionHead } from "@/components/ui";
import { assignProjectCustomers } from "@/lib/actions/projects";

export interface UnassignedProject {
  id: string; // real uuid
  name: string;
  slug: string;
}

export interface CustomerOption {
  id: string; // real uuid
  name: string;
}

export function ProjectCustomerMapping({
  projects,
  customers,
}: {
  projects: UnassignedProject[];
  customers: CustomerOption[];
}) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const chosenCount = projects.filter((p) => choice[p.id]).length;

  const save = () => {
    const assignments = projects
      .filter((p) => choice[p.id])
      .map((p) => ({ projectId: p.id, customerId: choice[p.id] }));
    if (assignments.length === 0) {
      setToast("Välj kund för minst ett projekt.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await assignProjectCustomers(assignments);
      setToast(
        res.ok
          ? res.message ?? "Sparat."
          : "Fel: " + (res.message ?? "okänt"),
      );
      if (res.ok) setChoice({});
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="card">
      <SectionHead
        title="Koppla projekt till kund"
        sub="Projekt som ligger kvar på platshållaren 'Ej tilldelad'."
      />
      {projects.length === 0 ? (
        <div className="empty" style={{ padding: 14 }}>
          Alla projekt är kopplade till kund.
        </div>
      ) : (
        <>
          <div className="stack" style={{ gap: 8 }}>
            {projects.map((p) => (
              <div key={p.id} className="row" style={{ gap: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }} className="strong">
                  {p.name}
                </div>
                <select
                  className="inp"
                  style={{ flex: 1 }}
                  value={choice[p.id] ?? ""}
                  aria-label={`Kund för ${p.name}`}
                  onChange={(e) =>
                    setChoice((c) => ({ ...c, [p.id]: e.target.value }))
                  }
                >
                  <option value="">— välj kund —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="row between" style={{ marginTop: 12 }}>
            <span className="dim" style={{ fontSize: 11.5 }}>
              {toast ?? `${chosenCount} av ${projects.length} valda`}
            </span>
            <button
              className="b primary sm"
              type="button"
              onClick={save}
              disabled={pending}
            >
              {pending ? "Sparar…" : "Spara tilldelningar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
