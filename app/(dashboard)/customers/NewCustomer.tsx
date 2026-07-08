"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead } from "@/components/ui";
import { createCustomer } from "@/lib/actions/customers";

const CLASS_OPTIONS = ["A", "B", "C"] as const;
type CustomerClass = (typeof CLASS_OPTIONS)[number];

const STATUS_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "paused", label: "Pausad" },
  { value: "draft", label: "Utkast" },
] as const;
type ContractStatus = (typeof STATUS_OPTIONS)[number]["value"];

export function NewCustomer() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cls, setCls] = useState<CustomerClass>("C");
  const [status, setStatus] = useState<ContractStatus>("live");
  const [orgNumber, setOrgNumber] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setToast("Namn krävs.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await createCustomer({
        name: name.trim(),
        customer_class: cls,
        contract_status: status,
        org_number: orgNumber.trim() || null,
        invoice_email: invoiceEmail.trim() || null,
      });
      if (res.ok) {
        setToast(res.message ?? "Kund skapad.");
        setName("");
        setOrgNumber("");
        setInvoiceEmail("");
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
        Ny kund
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
            title="Ny kund"
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
            <div className="row" style={{ gap: 8 }}>
              <select
                className="inp"
                style={{ flex: 1 }}
                value={cls}
                aria-label="Klass"
                onChange={(e) => setCls(e.target.value as CustomerClass)}
              >
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Klass {c}
                  </option>
                ))}
              </select>
              <select
                className="inp"
                style={{ flex: 1 }}
                value={status}
                aria-label="Status"
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="inp"
              placeholder="Org-nr"
              value={orgNumber}
              onChange={(e) => setOrgNumber(e.target.value)}
            />
            <input
              className="inp"
              type="email"
              placeholder="Faktura-email"
              value={invoiceEmail}
              onChange={(e) => setInvoiceEmail(e.target.value)}
            />
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
              {pending ? "Sparar…" : "Skapa kund"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
