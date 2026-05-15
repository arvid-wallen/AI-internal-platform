import { Suspense } from "react";
import { LoginButton } from "./login-button";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="login">
      <div className="login-card">
        <h1>Operations Hub</h1>
        <p>Logga in med ditt @haus.se-konto för att fortsätta.</p>
        <Suspense>
          <LoginButton />
        </Suspense>
        <ErrorMessage searchParams={searchParams} />
      </div>
    </div>
  );
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  const msg =
    error === "domain"
      ? "Endast @haus.se-konton har åtkomst."
      : "Inloggning misslyckades. Försök igen.";
  return (
    <div
      className="dim mt-4"
      style={{ fontSize: 12, color: "var(--c-tomato-ink)" }}
    >
      {msg}
    </div>
  );
}
