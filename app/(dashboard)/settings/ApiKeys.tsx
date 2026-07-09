"use client";

import { useState, useTransition } from "react";
import { Pill, SectionHead } from "@/components/ui";
import {
  clearIntegrationKey,
  saveIntegrationKey,
} from "@/lib/actions/integration-keys";
import type { KeyId } from "@/lib/integrations/keys";

export interface ApiKeyStatus {
  provider: KeyId;
  label: string;
  hint: string;
  source: "db" | "env" | "none";
}

// Write-only key management: keys can be set, replaced or cleared but never
// read back. "env" means the key comes from a Vercel env var (fallback).
export function ApiKeys({ keys }: { keys: ApiKeyStatus[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const save = (provider: KeyId) => {
    const token = (values[provider] ?? "").trim();
    if (!token) return;
    startTransition(async () => {
      const res = await saveIntegrationKey(provider, token);
      if (res.ok) setValues((v) => ({ ...v, [provider]: "" }));
      flash(res.message ?? (res.ok ? "Sparat." : "Något gick fel."));
    });
  };

  const clear = (provider: KeyId) => {
    startTransition(async () => {
      const res = await clearIntegrationKey(provider);
      flash(res.message ?? (res.ok ? "Borttagen." : "Något gick fel."));
    });
  };

  return (
    <div className="card">
      <SectionHead
        title="API-nycklar"
        sub="Nycklar för sync-integrationerna. Skrivs bara — kan aldrig läsas ut här."
      />
      <div className="stack" style={{ gap: 14 }}>
        {keys.map((k) => (
          <div key={k.provider}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="strong" style={{ fontSize: 13 }}>
                {k.label}
              </span>
              <Pill
                kind={
                  k.source === "db"
                    ? "live"
                    : k.source === "env"
                      ? "sent"
                      : "paused"
                }
              >
                {k.source === "db"
                  ? "Satt via plattformen"
                  : k.source === "env"
                    ? "Satt via env"
                    : "Ej satt"}
              </Pill>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="inp"
                style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
                type="password"
                autoComplete="off"
                placeholder={
                  k.source === "none" ? "Klistra in nyckel…" : "Ersätt nyckel…"
                }
                value={values[k.provider] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [k.provider]: e.target.value }))
                }
              />
              <button
                className="b sm primary"
                type="button"
                disabled={pending || !(values[k.provider] ?? "").trim()}
                onClick={() => save(k.provider)}
              >
                Spara
              </button>
              {k.source === "db" && (
                <button
                  className="b sm"
                  type="button"
                  disabled={pending}
                  onClick={() => clear(k.provider)}
                >
                  Rensa
                </button>
              )}
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>
              {k.hint}
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
      <p className="dim mt-3" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        Fortnox ansluts via OAuth-kortet ovan (självroterande tokens).
        Supabase-nycklarna är plattformens egna databas-uppgifter och måste
        ligga i Vercel-miljön.
      </p>
    </div>
  );
}
