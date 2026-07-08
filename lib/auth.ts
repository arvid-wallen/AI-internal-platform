// Session identity + role helpers, server-only.
// The auth onboarding trigger (0004_auth_onboarding.sql) guarantees every
// signed-in @haus.se user has a team_members row, so a missing row means a
// stale session — treat as viewer.
import { createSupabaseServer } from "@/lib/supabase/server";

export type MemberRole = "admin" | "editor" | "viewer";

export interface SessionMember {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: MemberRole;
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function getSessionMember(): Promise<SessionMember | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("team_members")
    .select("id, email, full_name, role")
    .eq("supabase_user_id", user.id)
    .maybeSingle();

  const email = row?.email ?? user.email ?? "";
  const name = row?.full_name ?? email.split("@")[0];
  const role = (row?.role as MemberRole | undefined) ?? "viewer";
  return {
    id: row?.id ?? user.id,
    email,
    name,
    initials: initialsOf(name),
    role,
  };
}

const ROLE_RANK: Record<MemberRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(member: SessionMember | null, required: MemberRole): boolean {
  if (!member) return false;
  return ROLE_RANK[member.role] >= ROLE_RANK[required];
}

// Convenience for server actions: resolves the session and returns a Swedish
// error message when the caller lacks the role (null = authorized). RLS
// enforces the same rule; this exists for friendly errors.
export async function requireRole(
  required: MemberRole,
): Promise<{ member: SessionMember | null; error: string | null }> {
  const member = await getSessionMember();
  if (!member) return { member: null, error: "Inte inloggad." };
  if (!hasRole(member, required)) {
    return {
      member,
      error:
        required === "admin"
          ? "Åtgärden kräver administratörsbehörighet."
          : "Du har läsbehörighet — åtgärden kräver redaktörsroll.",
    };
  }
  return { member, error: null };
}

// Map raw Postgres/RLS errors to a friendly Swedish message; log the raw
// error server-side so it is not lost.
export function friendlyDbError(e: unknown): string {
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e);
  console.error("[db]", raw);
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  if (code === "42501" || /row-level security/i.test(raw)) {
    return "Behörighet saknas — åtgärden kräver redaktörsroll.";
  }
  return "Något gick fel — försök igen.";
}
