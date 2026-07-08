"use client";

// Root error boundary — covers the login/auth segment, renders standalone
// (outside the dashboard shell).
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[root]", error);
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-sans, system-ui)",
        background: "var(--c-paper, #faf9f7)",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Något gick fel</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px" }}>
          Ett oväntat fel inträffade. Försök igen.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#1a1a1a",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Försök igen
        </button>
      </div>
    </div>
  );
}
