"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for use in Client Components.
export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
