"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead } from "@/components/ui";
import { updateProject } from "@/lib/actions/projects";

const STATUS_OPTIONS = [
  { value: "discovery", label: "Discovery" },
  { value: "building", label: "Bygger" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Pausad" },
  { value: "offboarded", label: "Offboardad" },
] as const;

type ProjectStatus = (typeof STATUS_OPTIONS)[number]["value"];

export interface EditProjectValues {
  name: string;
  status: ProjectStatus;
  customer_id: string; // real uuid
  monthly_revenue_sek: number | null;
  monthly_infra_budget_sek: number | null;
  github_repo_url: string | null;
}

export interface EditCustomerOption {
  id: string; // real uuid
  name: string;
}

const parseNum = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function EditProject({
  projectId,
  current,
  customers,
  defaultOpen = false,
}: {
  projectId: string; // "p-<slug>"
  current: EditProjectValues;
  customers: EditCustomerOption[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState(current.name);
  const [status, setStatus] = useState<ProjectStatus>(current.status);
  const [customerId, setCustomerId] = useState(current.customer_id);
  const [revenue, setRevenue] = useState(
    current.monthly_revenue_sek != null
      ? String(current.monthly_revenue_sek)
      : "",
  );
  const [infra, setInfra] = useState(
    current.monthly_infra_budget_sek != null
      ? String(current.monthly_infra_budget_sek)
      : "",
  );
  const [repoUrl, setRepoUrl] = useState(current.github_repo_url ?? "");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="b sm" type="button" onClick={() => setOpen(true)}>
          <Icons.Edit size={12} />
          Redigera projekt
        </button>
      </div>
    );
  }

  const save = () => {
    if (!name.trim()) {
      setToast("Namn krävs.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await updateProject({
        projectId,
        name: name.trim(),
        status,
        customer_id: customerId || null,
        monthly_revenue_sek: parseNum(revenue),
        monthly_infra_budget_sek: parseNum(infra),
        github_repo_url: repoUrl.trim() || null,
      });
      setToast(res.ok ? "Sparat." : "Fel: " + (res.message ?? "okänt"));
      setTimeout(() => setToast(null), 4000);
    });
  };

  const label = { fontSize: 11.5 } as const;

  return (
    <div className="card">
      <SectionHead
        title="Redigera projekt"
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
        <label className="dim" style={label}>
          Namn
          <input
            className="inp"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <label className="dim" style={{ ...label, flex: 1 }}>
            Status
            <select
              className="inp"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="dim" style={{ ...label, flex: 1 }}>
            Kund
            <select
              className="inp"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <label className="dim" style={{ ...label, flex: 1 }}>
            Månadsintäkt SEK
            <input
              className="inp"
              inputMode="decimal"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
            />
          </label>
          <label className="dim" style={{ ...label, flex: 1 }}>
            Infra-budget SEK/mån
            <input
              className="inp"
              inputMode="decimal"
              value={infra}
              onChange={(e) => setInfra(e.target.value)}
            />
          </label>
        </div>
        <label className="dim" style={label}>
          GitHub repo-URL
          <input
            className="inp"
            placeholder="https://github.com/haus-se/…"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </label>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <span className="dim" style={{ fontSize: 11.5 }}>
          {toast ?? ""}
        </span>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="b sm ghost"
            type="button"
            onClick={() => setOpen(false)}
          >
            Avbryt
          </button>
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
    </div>
  );
}
