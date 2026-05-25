"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead } from "@/components/ui";
import {
  saveWorkspaceMap,
  type MappableProject,
  type MappableProvider,
} from "@/lib/actions/workspace-map";

interface Row {
  workspaceId: string;
  projectId: string;
}

function toRows(map: Record<string, string>): Row[] {
  const rows = Object.entries(map).map(([workspaceId, projectId]) => ({
    workspaceId,
    projectId,
  }));
  return rows.length ? rows : [{ workspaceId: "", projectId: "" }];
}

export function WorkspaceMapping({
  provider,
  label,
  idLabel,
  projects,
  initialMap,
}: {
  provider: MappableProvider;
  label: string;
  idLabel: string;
  projects: MappableProject[];
  initialMap: Record<string, string>;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialMap));
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { workspaceId: "", projectId: "" }]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  const save = () => {
    const map: Record<string, string> = {};
    for (const r of rows) if (r.workspaceId.trim() && r.projectId) map[r.workspaceId.trim()] = r.projectId;
    startTransition(async () => {
      const res = await saveWorkspaceMap(provider, map);
      setToast(res.ok ? "Sparat." : "Fel: " + (res.message ?? "okänt"));
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="card">
      <SectionHead
        title={label}
        sub={`Mappa ${idLabel} → projekt så token-synken kan attribuera kostnad.`}
        actions={
          <button className="b sm" type="button" onClick={addRow}>
            <Icons.Plus size={12} />
            Rad
          </button>
        }
      />
      <div className="stack" style={{ gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input
              className="inp"
              style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
              placeholder={idLabel}
              value={r.workspaceId}
              onChange={(e) => update(i, { workspaceId: e.target.value })}
            />
            <select
              className="inp"
              style={{ flex: 1 }}
              value={r.projectId}
              onChange={(e) => update(i, { projectId: e.target.value })}
            >
              <option value="">— välj projekt —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              type="button"
              onClick={() => removeRow(i)}
              title="Ta bort"
            >
              <Icons.X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <span className="dim" style={{ fontSize: 11.5 }}>
          {toast ?? `${rows.filter((r) => r.workspaceId && r.projectId).length} mappningar`}
        </span>
        <button
          className="b primary sm"
          type="button"
          onClick={save}
          disabled={pending}
        >
          {pending ? "Sparar…" : "Spara mappning"}
        </button>
      </div>
    </div>
  );
}
