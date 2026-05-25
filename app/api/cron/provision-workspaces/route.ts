import type { NextRequest } from "next/server";
import {
  isCronAuthorized,
  jsonError,
  jsonOk,
  startSyncRun,
  finishSyncRun,
  errMsg,
} from "@/lib/cron";
import { fetchProjects, openAiAdminKeys } from "@/lib/integrations/openai";
import { fetchWorkspaces } from "@/lib/integrations/anthropic";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// Creates a Hub project for every OpenAI project / Anthropic workspace that
// isn't mapped yet (owned by the "unassigned" customer), and records the
// id -> project mapping in integrations_credentials.metadata. After this runs,
// re-running sync-openai / sync-anthropic attributes usage to those projects.
// The user later reassigns the real customer / renames in Settings.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  const run = await startSyncRun("provision");

  try {
    const supabase = createSupabaseAdmin();

    const { data: unassigned } = await supabase
      .from("customers")
      .select("id")
      .eq("slug", "unassigned")
      .maybeSingle();
    if (!unassigned) {
      const msg = "Missing 'unassigned' customer — apply migration 0005 first";
      await finishSyncRun(run?.id ?? null, "failed", { error: msg });
      return jsonError(msg);
    }
    const unassignedId = unassigned.id as string;

    const slugify = (name: string, fallback: string) => {
      const s = name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60);
      return s || fallback.toLowerCase().slice(0, 60);
    };

    // Ensure a project exists for a given slug; never clobber an existing one.
    const ensureProject = async (
      slug: string,
      name: string,
    ): Promise<string | null> => {
      const { data: ex } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (ex) return ex.id as string;
      const { data: ins, error } = await supabase
        .from("projects")
        .insert({
          slug,
          name,
          customer_id: unassignedId,
          status: "live",
        })
        .select("id")
        .single();
      if (error) return null;
      return ins?.id ?? null;
    };

    const provisionProvider = async (
      providerSlug: "openai" | "anthropic",
      metaKey: "project_map" | "workspace_map",
      sources: Array<{ id: string; name: string }>,
    ): Promise<{ created: number; mapped: number }> => {
      const { data: cred } = await supabase
        .from("integrations_credentials")
        .select("metadata")
        .eq("provider_slug", providerSlug)
        .maybeSingle();
      const metadata = (cred?.metadata as Record<string, unknown> | null) ?? {};
      const map = { ...((metadata[metaKey] as Record<string, string>) ?? {}) };

      let created = 0;
      for (const src of sources) {
        if (map[src.id]) continue; // already mapped (incl. user-assigned)
        const slug = slugify(src.name, src.id.replace(/^[a-z]+_/i, ""));
        const projectId = await ensureProject(slug, src.name || src.id);
        if (projectId) {
          map[src.id] = projectId;
          created += 1;
        }
      }

      await supabase
        .from("integrations_credentials")
        .update({ metadata: { ...metadata, [metaKey]: map } })
        .eq("provider_slug", providerSlug);

      return { created, mapped: Object.keys(map).length };
    };

    // OpenAI projects across all configured org keys.
    const openaiSources: Array<{ id: string; name: string }> = [];
    for (const key of openAiAdminKeys()) {
      try {
        for (const p of await fetchProjects(key))
          openaiSources.push({ id: p.id, name: p.name });
      } catch {
        // skip a failing org key
      }
    }
    const openai = openaiSources.length
      ? await provisionProvider("openai", "project_map", openaiSources)
      : { created: 0, mapped: 0 };

    // Anthropic workspaces.
    let anthropicSources: Array<{ id: string; name: string }> = [];
    try {
      anthropicSources = (await fetchWorkspaces()).map((w) => ({
        id: w.id,
        name: w.name,
      }));
    } catch {
      anthropicSources = [];
    }
    const anthropic = anthropicSources.length
      ? await provisionProvider("anthropic", "workspace_map", anthropicSources)
      : { created: 0, mapped: 0 };

    await finishSyncRun(run?.id ?? null, "ok", {
      records: openai.created + anthropic.created,
    });
    return jsonOk({ openai, anthropic });
  } catch (e) {
    await finishSyncRun(run?.id ?? null, "failed", { error: errMsg(e) });
    return jsonError(errMsg(e));
  }
}
