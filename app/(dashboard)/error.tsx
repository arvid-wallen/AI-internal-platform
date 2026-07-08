"use client";

// Route-group error boundary — renders inside the sidebar/topbar shell.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[dashboard]", error);
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Något gick fel</h2>
        <p className="dim" style={{ margin: "0 0 16px", fontSize: 13.5 }}>
          Ett oväntat fel inträffade när sidan skulle läsas in. Försök igen —
          om felet kvarstår, kolla sync-loggen under Settings.
        </p>
        <button className="b primary" type="button" onClick={reset}>
          Försök igen
        </button>
      </div>
    </div>
  );
}
