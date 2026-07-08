"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { resolveIncident } from "@/lib/actions/incidents";

export function ResolveIncident({ incidentId }: { incidentId: string }) {
  const [open, setOpen] = useState(false);
  const [rootCause, setRootCause] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button className="b sm" type="button" onClick={() => setOpen(true)}>
        <Icons.Check size={12} />
        Markera löst
      </button>
    );
  }

  const confirm = () =>
    startTransition(async () => {
      const res = await resolveIncident(
        incidentId,
        rootCause.trim() || undefined,
      );
      if (!res.ok) {
        setError(res.message ?? "Något gick fel.");
        setTimeout(() => setError(null), 4000);
      }
    });

  return (
    <div className="stack" style={{ gap: 4, minWidth: 180 }}>
      <div className="row" style={{ gap: 4 }}>
        <input
          className="inp"
          style={{ fontSize: 12, padding: "5px 8px" }}
          placeholder="Rotorsak (valfritt)"
          aria-label="Rotorsak"
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
        />
        <button
          className="b primary sm"
          type="button"
          onClick={confirm}
          disabled={pending}
          title="Markera löst"
        >
          {pending ? "…" : "Lös"}
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Avbryt"
          title="Avbryt"
        >
          <Icons.X size={14} />
        </button>
      </div>
      {error && (
        <span className="dim" style={{ fontSize: 11 }}>
          {error}
        </span>
      )}
    </div>
  );
}
