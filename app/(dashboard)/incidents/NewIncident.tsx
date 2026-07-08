"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead } from "@/components/ui";
import { createIncident } from "@/lib/actions/incidents";

const SEVERITY_OPTIONS = [
  { value: "low", label: "Låg" },
  { value: "medium", label: "Medel" },
  { value: "high", label: "Hög" },
  { value: "critical", label: "Kritisk" },
] as const;
type Severity = (typeof SEVERITY_OPTIONS)[number]["value"];

export interface IncidentProjectOption {
  id: string; // "p-<slug>" domain id (accepted by createIncident)
  name: string;
}

export function NewIncident({
  projects,
}: {
  projects: IncidentProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [projectId, setProjectId] = useState("");
  const [summary, setSummary] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="row mb-2" style={{ justifyContent: "flex-end" }}>
        <button
          className="b primary"
          type="button"
          onClick={() => setOpen(true)}
        >
          <Icons.Plus size={14} />
          Ny incident
        </button>
      </div>
    );
  }

  const save = () => {
    if (!title.trim()) {
      setToast("Titel krävs.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    startTransition(async () => {
      const res = await createIncident({
        title: title.trim(),
        severity,
        project_id: projectId || null,
        summary: summary.trim() || null,
      });
      if (res.ok) {
        setToast(res.message ?? "Incident skapad.");
        setTitle("");
        setSummary("");
      } else {
        setToast("Fel: " + (res.message ?? "okänt"));
      }
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="card mb-2">
      <SectionHead
        title="Ny incident"
        sub="Ref (INC-ÅÅÅÅ-NNN) sätts automatiskt."
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
          placeholder="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="row" style={{ gap: 8 }}>
          <select
            className="inp"
            style={{ flex: 1 }}
            value={severity}
            aria-label="Severity"
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="inp"
            style={{ flex: 1 }}
            value={projectId}
            aria-label="Projekt"
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— inget projekt —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="inp"
          placeholder="Sammanfattning (valfritt)"
          rows={3}
          style={{ resize: "vertical", minHeight: 64 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
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
          {pending ? "Sparar…" : "Skapa incident"}
        </button>
      </div>
    </div>
  );
}
