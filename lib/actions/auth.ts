"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
