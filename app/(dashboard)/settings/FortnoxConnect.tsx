"use client";

import { useState, useTransition } from "react";
import { SectionHead } from "@/components/ui";
import { triggerFortnoxSync } from "@/lib/actions/fortnox";

export interface FortnoxConnectProps {
  isAdmin: boolean;
  connected: boolean;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  queryStatus: "connected" | "error" | null;
  queryReason: string | null;
}

// Connection card for the Fortnox integration. The OAuth start route is a
// plain redirect flow, so "Anslut" is an anchor, not an action.
export function FortnoxConnect({
  isAdmin,
  connected,
  tokenExpiresAt,
  lastSyncedAt,
  queryStatus,
  queryReason,
}: FortnoxConnectProps) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const syncNow = () => {
    startTransition(async () => {
      const res = await triggerFortnoxSync();
      setToast(res.message ?? (res.ok ? "Sync klar." : "Sync misslyckades."));
      setTimeout(() => setToast(null), 8000);
    });
  };

  const fmtTs = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("sv-SE", {
          timeZone: "Europe/Stockholm",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";

  return (
    <div className="card">
      <SectionHead
        title="Fortnox"
        sub={
          connected
            ? "Ansluten — kunder + fakturor synkas varje natt"
            : "Inte ansluten — intäktsdata saknas i plattformen"
        }
      />

      {queryStatus === "connected" && (
        <div
          className="mt-2"
          style={{
            padding: "10px 12px",
            background: "var(--c-mint-soft)",
            color: "var(--c-mint-ink)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Fortnox anslöts. Kör en första sync med &quot;Synka nu&quot;.
        </div>
      )}
      {queryStatus === "error" && (
        <div
          className="mt-2"
          style={{
            padding: "10px 12px",
            background: "var(--c-tomato-soft, #fde8e4)",
            color: "var(--c-tomato-ink, #8a2b18)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Anslutningen misslyckades{queryReason ? `: ${queryReason}` : "."}
        </div>
      )}

      {connected ? (
        <>
          <dl className="def-list mt-3">
            <dt>Token giltig till</dt>
            <dd className="tnum">{fmtTs(tokenExpiresAt)}</dd>
            <dt>Senast synkad</dt>
            <dd className="tnum">{fmtTs(lastSyncedAt)}</dd>
          </dl>
          {isAdmin && (
            <div className="row mt-3" style={{ gap: 6 }}>
              <button
                className="b sm primary"
                type="button"
                disabled={pending}
                onClick={syncNow}
              >
                {pending ? "Synkar…" : "Synka nu"}
              </button>
            </div>
          )}
        </>
      ) : isAdmin ? (
        <div className="mt-3">
          <a className="b primary" href="/api/auth/fortnox/start">
            Anslut Fortnox
          </a>
          <p className="dim mt-2" style={{ fontSize: 12 }}>
            Du skickas till Fortnox för att godkänna åtkomst (fakturor, kunder,
            artiklar). Kräver FORTNOX_CLIENT_ID/SECRET i miljön.
          </p>
        </div>
      ) : (
        <p className="dim mt-3" style={{ fontSize: 13 }}>
          Be en administratör ansluta Fortnox.
        </p>
      )}

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
  );
}
