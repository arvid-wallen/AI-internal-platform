"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead } from "@/components/ui";
import { updateCustomer } from "@/lib/actions/customers";

const CLASS_OPTIONS = ["A", "B", "C"] as const;
type CustomerClass = (typeof CLASS_OPTIONS)[number];

const STATUS_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "paused", label: "Pausad" },
  { value: "draft", label: "Utkast" },
  { value: "offboarded", label: "Offboardad" },
] as const;
type ContractStatus = (typeof STATUS_OPTIONS)[number]["value"];

export interface EditCustomerValues {
  id: string; // real uuid
  name: string;
  customer_class: CustomerClass;
  contract_status: ContractStatus;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  invoice_email: string | null;
}

export function EditCustomer({ customer }: { customer: EditCustomerValues }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer.name);
  const [cls, setCls] = useState<CustomerClass>(customer.customer_class);
  const [status, setStatus] = useState<ContractStatus>(
    customer.contract_status,
  );
  const [contactName, setContactName] = useState(
    customer.primary_contact_name ?? "",
  );
  const [contactEmail, setContactEmail] = useState(
    customer.primary_contact_email ?? "",
  );
  const [invoiceEmail, setInvoiceEmail] = useState(
    customer.invoice_email ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) {
      setToast("Namn krävs.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await updateCustomer({
        customerId: customer.id,
        name: name.trim(),
        customer_class: cls,
        contract_status: status,
        primary_contact_name: contactName.trim() || null,
        primary_contact_email: contactEmail.trim() || null,
        invoice_email: invoiceEmail.trim() || null,
      });
      setToast(res.ok ? "Sparat." : "Fel: " + (res.message ?? "okänt"));
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="b" type="button" onClick={() => setOpen((o) => !o)}>
        <Icons.Edit size={14} />
        Redigera
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
            title="Redigera kund"
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
              placeholder="Kontaktperson"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <input
              className="inp"
              type="email"
              placeholder="Kontakt-email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
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
              {pending ? "Sparar…" : "Spara"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
