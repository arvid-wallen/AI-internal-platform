"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/icons";
import { ProviderChip, SectionHead } from "@/components/ui";
import { fmt } from "@/lib/format";
import { switchActiveModel } from "@/lib/actions/switch-model";
import { rotateConfigBearer } from "@/lib/actions/config-bearer";
import type { AIModel } from "@/lib/types";

interface HistoryRow {
  project_id: string;
  model_id: string;
  from: string;
  to: string | null;
  actor: string;
  note: string;
  model_display: string;
}

export function ProjectModelsClient({
  projectId,
  projectSlug,
  activeModelId,
  models,
  history,
  canEdit,
  canRotate,
}: {
  projectId: string;
  projectSlug: string;
  activeModelId: string;
  models: AIModel[];
  history: HistoryRow[];
  canEdit: boolean;
  canRotate: boolean;
}) {
  const [selected, setSelected] = useState(activeModelId);
  const [activeModel, setActiveModel] = useState(activeModelId);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [rotating, startRotate] = useTransition();
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);

  const rotate = () => {
    startRotate(async () => {
      const res = await rotateConfigBearer(projectId);
      if (res.ok && res.token) {
        setRotatedToken(res.token);
      } else {
        setToast("Fel: " + (res.message ?? "okänd"));
        setTimeout(() => setToast(null), 4000);
      }
    });
  };

  const current = models.find((m) => m.id === activeModel);
  const candidate = models.find((m) => m.id === selected);
  const compatible = models.filter((m) => m.is_current);

  const activate = () => {
    if (selected === activeModel) return;
    const toModelId = selected;
    startTransition(async () => {
      const res = await switchActiveModel({
        projectId,
        toModelId,
      });
      if (res.ok) {
        setActiveModel(toModelId);
        setToast(res.message ?? "Modell aktiverad.");
      } else {
        setToast("Fel: " + (res.message ?? "okänd"));
      }
      setTimeout(() => setToast(null), 4000);
    });
  };

  return (
    <div className="grid-12">
      <div className="stack">
        <div className="card">
          <SectionHead
            title="Välj modell"
            sub="Aktivering byter modellen direkt och loggar till audit."
            actions={
              <>
                <span className="dim" style={{ fontSize: 12 }}>
                  Filtrera:
                </span>
                <button className="chip active" type="button">
                  Aktuella ({compatible.length})
                </button>
                <button className="chip" type="button">
                  Alla ({models.length})
                </button>
              </>
            }
          />
          <div className="mp-list">
            {compatible.map((mo) => (
              <div
                key={mo.id}
                className={"mp-row" + (selected === mo.id ? " selected" : "")}
                onClick={() => setSelected(mo.id)}
              >
                <span className="mp-radio"></span>
                <div>
                  <div className="mp-name">{mo.display}</div>
                  <div className="mp-meta">
                    <ProviderChip provider={mo.provider} /> · ctx{" "}
                    {fmt.tokens(mo.ctx)} · släppt {fmt.date(mo.released)}
                  </div>
                </div>
                <div className="mp-price">
                  ${mo.price_in.toFixed(2)} / ${mo.price_out.toFixed(2)}
                  <div style={{ fontSize: 10, opacity: 0.7 }}>
                    per Mtok in/ut
                  </div>
                </div>
                <div>
                  {mo.id === activeModel ? (
                    <span className="mp-active-tag">Aktiv</span>
                  ) : selected === mo.id && canEdit ? (
                    <button
                      className="b sm primary"
                      type="button"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        activate();
                      }}
                    >
                      {pending ? "Aktiverar…" : "Aktivera"}
                    </button>
                  ) : (
                    <span
                      className="dim"
                      style={{
                        fontSize: 11.5,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      —
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {toast && (
            <div
              className="mt-3"
              style={{
                padding: "10px 12px",
                background: "var(--c-mint-soft)",
                color: "var(--c-mint-ink)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {toast}
            </div>
          )}
        </div>

        <div className="card">
          <SectionHead
            title="Modellhistorik"
            sub={`${history.length} byten registrerade`}
          />
          <div className="timeline">
            {history.map((h, i) => (
              <div
                key={i}
                className={"tl-item" + (h.to ? " past" : "")}
              >
                <div className="tl-time">
                  {fmt.date(h.from)} → {h.to ? fmt.date(h.to) : "pågående"} · {h.actor}
                </div>
                <div className="tl-title">{h.model_display}</div>
                <div className="tl-desc">{h.note}</div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="empty">Ingen historik.</div>
            )}
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <SectionHead title="Aktiv just nu" />
          {current && (
            <>
              <div className="mp-current">
                <span
                  className={"pdot " + current.provider}
                  style={{ width: 12, height: 12, borderRadius: 4 }}
                ></span>
                <div style={{ flex: 1 }}>
                  <div className="name">{current.display}</div>
                  <div
                    className="dim"
                    style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }}
                  >
                    {current.id}
                  </div>
                </div>
              </div>
              <dl className="def-list mt-4">
                <dt>Provider</dt>
                <dd>
                  <ProviderChip provider={current.provider} />
                </dd>
                <dt>Context</dt>
                <dd className="tnum">{fmt.tokens(current.ctx)} tokens</dd>
                <dt>In-pris</dt>
                <dd className="tnum">${current.price_in.toFixed(2)}/Mtok</dd>
                <dt>Ut-pris</dt>
                <dd className="tnum">${current.price_out.toFixed(2)}/Mtok</dd>
                <dt>Aktiverad</dt>
                <dd>{fmt.date(history[0]?.from)}</dd>
                <dt>Av</dt>
                <dd>{history[0]?.actor ?? "—"}</dd>
              </dl>
            </>
          )}
        </div>

        {candidate && current && candidate.id !== activeModel && (
          <div
            className="card"
            style={{ background: "var(--c-mint-soft)", borderColor: "transparent" }}
          >
            <SectionHead
              title="Vald att aktivera"
              sub={`Estimerad ändring vid byte från ${current.display}`}
            />
            <dl className="def-list">
              <dt>Ny modell</dt>
              <dd className="strong">{candidate.display}</dd>
              <dt>Pris in</dt>
              <dd className="tnum">
                ${current.price_in.toFixed(2)} → ${candidate.price_in.toFixed(2)}
              </dd>
              <dt>Pris ut</dt>
              <dd className="tnum">
                ${current.price_out.toFixed(2)} → ${candidate.price_out.toFixed(2)}
              </dd>
              <dt>Estimerad ändring</dt>
              <dd className="tnum">
                {(() => {
                  const ratio =
                    (candidate.price_in + candidate.price_out) /
                      (current.price_in + current.price_out) -
                    1;
                  return (
                    (ratio > 0 ? "+" : "") +
                    (ratio * 100).toFixed(0) +
                    "% AI-kostnad"
                  );
                })()}
              </dd>
            </dl>
            {canEdit ? (
              <button
                className="b primary mt-4"
                style={{ width: "100%", justifyContent: "center" }}
                type="button"
                disabled={pending}
                onClick={activate}
              >
                {pending ? "Aktiverar…" : "Aktivera " + candidate.display}
              </button>
            ) : (
              <p className="dim mt-4" style={{ fontSize: 12 }}>
                Modellbyte kräver redaktörsbehörighet.
              </p>
            )}
          </div>
        )}

        <div className="card">
          <SectionHead
            title="Hub config-endpoint"
            sub="Kundprojektet polar denna URL"
          />
          <pre
            style={{
              background: "var(--c-paper)",
              border: "var(--bd-hairline)",
              borderRadius: 6,
              padding: 12,
              fontSize: 11.5,
              lineHeight: 1.6,
              fontFamily: "var(--font-mono)",
              color: "var(--c-ink-2)",
              overflow: "auto",
              margin: 0,
            }}
          >
            {`GET ai-hub.haus.se
  /api/projects/${projectSlug}/config
Authorization: Bearer <projekt-token>

→ {
    "active_model": {
      "provider": "${current?.provider ?? ""}",
      "model_id": "${current?.id ?? ""}",
      "config": { ... }
    }
  }`}
          </pre>
          {rotatedToken && (
            <div
              className="mt-3"
              style={{
                padding: "10px 12px",
                background: "var(--c-mint-soft)",
                color: "var(--c-mint-ink)",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <strong>Ny token — visas bara en gång:</strong>
              <pre
                style={{
                  margin: "6px 0 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {rotatedToken}
              </pre>
            </div>
          )}
          {canRotate && (
            <div className="row mt-3" style={{ gap: 6 }}>
              <button
                className="b sm"
                type="button"
                disabled={rotating}
                onClick={rotate}
              >
                <Icons.Refresh size={12} />
                {rotating ? "Roterar…" : "Rotera bearer"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
