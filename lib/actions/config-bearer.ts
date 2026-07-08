"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, getSessionMember, hasRole } from "@/lib/auth";

export interface RotateBearerResult {
  ok: boolean;
  token?: string; // plaintext, shown exactly once
  message?: string;
}

const stripP = (idOrSlug: string) =>
  idOrSlug.startsWith("p-") ? idOrSlug.slice(2) : idOrSlug;

// Generates a new bearer token for the project's pull-config endpoint and
// stores only its sha256 hash. Admin-only: the token gates a public endpoint.
export async function rotateConfigBearer(
  projectId: string,
): Promise<RotateBearerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }

  const member = await getSessionMember();
  if (!member) return { ok: false, message: "Inte inloggad." };
  if (!hasRole(member, "admin")) {
    return {
      ok: false,
      message: "Endast administratörer kan rotera bearer-tokens.",
    };
  }

  const slug = stripP(projectId);
  const token = "haus_cfg_" + randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("projects")
    .update({
      config_bearer_hash: hash,
      config_bearer_rotated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (!data) return { ok: false, message: "Projektet hittades inte." };

  revalidatePath(`/projects/p-${slug}/models`);
  return { ok: true, token };
}
