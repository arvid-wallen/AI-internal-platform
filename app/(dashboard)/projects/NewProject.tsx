"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead } from "@/components/ui";
import { createProject } from "@/lib/actions/projects";

const STATUS_OPTIONS = [
  { value: "discovery", label: "Discovery" },
  { value: "building", label: "Bygger" },
  { value: "live", label: "Live" },
] as const;
type NewProjectStatus = (typeof STATUS_OPTIONS)[number]["value"];

export interface ProjectCustomerOption {
  id: string; // real uuid
  name: string;
}

export function NewProject({
  customers,
}: {
  customers: ProjectCustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<NewProjectStatus>("discovery");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setToast("Namn krävs.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await createProject({
        name: name.trim(),
        customer_id: customerId || null,
        status,
      });
      if (res.ok) {
        setToast(res.message ?? "Projekt skapat.");
        setName("");
      } else {
        setToast("Fel: " + (res.message ?? "okänt"));
      }
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="b primary"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <Icons.Plus size={14} />
        Nytt projekt
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "min(380px, calc(100vw - 48px))",
            zIndex: 50,
            boxShadow: "0 12px 32px rgba(20, 20, 20, 0.14)",
            textAlign: "left",
          }}
        >
          <SectionHead
            title="Nytt projekt"
            actions={
              <button
                className="icon-btn"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Stäng"
                title="Stäng"
              >
                <Icons.X size={14} />
              </button>
            }
          />
          <div className="stack" style={{ gap: 8 }}>
            <input
              className="inp"
              placeholder="Namn"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="inp"
              value={customerId}
              aria-label="Kund"
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— Ej tilldelad —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="inp"
              value={status}
              aria-label="Status"
              onChange={(e) =>
                setStatus(e.target.value as NewProjectStatus)
              }
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="row between" style={{ marginTop: 12 }}>
            <span className="dim" style={{ fontSize: 11.5 }}>
              {toast ?? ""}
            </span>
            <button
              className="b primary sm"
              type="button"
              onClick={save}
              disabled={pending}
            >
              {pending ? "Sparar…" : "Skapa projekt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
