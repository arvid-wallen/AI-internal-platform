"use client";

import { createSupabaseClient } from "@/lib/supabase/client";

export function LoginButton() {
  const handleClick = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "haus.se", prompt: "select_account" },
      },
    });
  };
  return (
    <button
      type="button"
      className="b primary mt-4"
      style={{ width: "100%", justifyContent: "center" }}
      onClick={handleClick}
    >
      Logga in med Google
    </button>
  );
}
