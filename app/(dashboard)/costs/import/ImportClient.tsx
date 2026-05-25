"use client";

import { useRef, useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { SectionHead, Pill } from "@/components/ui";
import { fmt } from "@/lib/format";
import {
  previewCardCsv,
  saveCardCosts,
  type ImportProject,
} from "@/lib/actions/card-costs";
import type { CardImportRow, CostCategory } from "@/lib/types";

const CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: "hosting", label: "Hosting" },
  { value: "database", label: "Databas" },
  { value: "storage", label: "Lagring" },
  { value: "cdn", label: "CDN" },
  { value: "third_party_api", label: "SaaS / API" },
  { value: "domain", label: "Domän" },
  { value: "other", label: "Övrigt" },
];

export function ImportClient({ projects }: { projects: ImportProject[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CardImportRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const onFile = (file: File) => {
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await previewCardCsv(fd);
      if (res.ok && res.rows) {
        setRows(res.rows);
        setToast(null);
      } else {
        setToast("Fel: " + (res.message ?? "okänt"));
      }
    });
  };

  const update = (key: string, patch: Partial<CardImportRow>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? rs);

  const save = () => {
    if (!rows) return;
    startTransition(async () => {
      const res = await saveCardCosts(rows);
      setToast(
        res.ok
          ? `Sparat ${res.inserted ?? 0} rader.`
          : "Fel: " + (res.message ?? "okänt"),
      );
      setTimeout(() => setToast(null), 5000);
    });
  };

  const included = rows?.filter((r) => r.include) ?? [];
  const includedTotal = included.reduce((s, r) => s + r.amount_sek, 0);

  return (
    <div className="card">
      <SectionHead
        title="Importera kort-CSV"
        sub="Tolkar svenskt talformat och klassar leverantörer med regler + AI."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <button
              className="b sm"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
            >
              <Icons.Upload size={12} />
              {fileName ? "Byt fil" : "Välj CSV"}
            </button>
          </>
        }
      />

      {pending && !rows && (
        <div className="dim" style={{ padding: 12, fontSize: 12 }}>
          Tolkar och klassar…
        </div>
      )}

      {rows && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Leverantör</th>
                  <th>Kategori</th>
                  <th>Projekt</th>
                  <th className="num">SEK</th>
                  <th className="num">Txn</th>
                  <th>Källa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="no-hover"
                    style={{ opacity: r.include ? 1 : 0.5 }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) =>
                          update(r.key, { include: e.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="inp"
                        style={{ minWidth: 150, fontSize: 12 }}
                        value={r.vendor}
                        onChange={(e) => update(r.key, { vendor: e.target.value })}
                      />
                      <div
                        className="dim"
                        style={{ fontSize: 10.5, marginTop: 2 }}
                        title={r.raw_texts.join("\n")}
                      >
                        {r.sample_text}
                      </div>
                    </td>
                    <td>
                      <select
                        className="inp"
                        value={r.cost_category}
                        onChange={(e) =>
                          update(r.key, {
                            cost_category: e.target.value as CostCategory,
                          })
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="inp"
                        value={r.project_id ?? ""}
                        onChange={(e) =>
                          update(r.key, { project_id: e.target.value || null })
                        }
                      >
                        <option value="">Gemensamt</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num tnum">{fmt.sek(r.amount_sek)}</td>
                    <td className="num tnum dim">{r.txn_count}</td>
                    <td>
                      <SourcePill row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="row between"
            style={{ marginTop: 12, padding: "0 4px" }}
          >
            <span className="dim" style={{ fontSize: 11.5 }}>
              {toast ?? `${included.length} rader · ${fmt.sek(includedTotal)}`}
            </span>
            <button
              className="b primary sm"
              type="button"
              onClick={save}
              disabled={pending || included.length === 0}
            >
              {pending ? "Sparar…" : "Spara kostnader"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SourcePill({ row }: { row: CardImportRow }) {
  if (!row.is_software)
    return (
      <Pill kind="paused" dot={false}>
        ej mjukvara
      </Pill>
    );
  if (row.is_api_usage)
    return (
      <Pill kind="warn" dot={false}>
        API (synkad)
      </Pill>
    );
  if (row.source === "rule")
    return (
      <Pill kind="ok" dot={false}>
        regel
      </Pill>
    );
  if (row.source === "ai")
    return (
      <Pill kind="sent" dot={false}>
        AI{" "}
        {row.confidence != null ? Math.round(row.confidence * 100) + "%" : ""}
      </Pill>
    );
  return (
    <Pill kind="draft" dot={false}>
      okänd
    </Pill>
  );
}
