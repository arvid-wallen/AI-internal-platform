"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { friendlyDbError, requireRole } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface CreateNoteInput {
  parent_type: "customer" | "project" | "model" | "global";
  parent_id?: string | null; // uuid, or "p-<slug>" for projects
  title?: string | null;
  content: string;
  category?: string;
  url?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createNote(input: CreateNoteInput): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { member, error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const content = input.content.trim();
  if (!content) return { ok: false, message: "Anteckningen är tom." };

  const supabase = await createSupabaseServer();

  // Project pages pass domain ids ("p-<slug>"); resolve to the real uuid.
  let parentId = input.parent_id ?? null;
  if (parentId && input.parent_type === "project" && !UUID_RE.test(parentId)) {
    const slug = parentId.startsWith("p-") ? parentId.slice(2) : parentId;
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!proj) return { ok: false, message: "Projektet hittades inte." };
    parentId = proj.id;
  }

  const { error } = await supabase.from("notes").insert({
    parent_type: input.parent_type,
    parent_id: parentId,
    title: input.title?.trim() || null,
    content,
    category: input.category ?? "general",
    url: input.url || null,
    author_id: member?.id ?? null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/wiki");
  if (input.parent_type === "project" && input.parent_id) {
    revalidatePath(`/projects`);
  }
  return { ok: true, message: "Sparat." };
}

export async function toggleNotePin(
  noteId: string,
  pinned: boolean,
): Promise<ActionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { ok: false, message: "Supabase är inte konfigurerat." };
  }
  const { error: roleError } = await requireRole("editor");
  if (roleError) return { ok: false, message: roleError };

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("notes")
    .update({ pinned })
    .eq("id", noteId);
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/wiki");
  return { ok: true };
}
