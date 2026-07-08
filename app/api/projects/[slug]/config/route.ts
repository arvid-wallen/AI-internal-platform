import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/projects/[slug]/config
// Public endpoint — customer projects fetch their active-model config here.
// Auth: per-project bearer token; only the sha256 hash is stored
// (projects.config_bearer_hash, rotated from the project's models page).
// A project without a rotated token is effectively disabled (401 for all).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_bearer" }, { status: 401 });
  }
  const presented = auth.slice("Bearer ".length).trim();

  // Reads use the admin client: the caller is an external service with no
  // Supabase session, so RLS would otherwise hide every row. The bearer hash
  // check below is the actual access control.
  const supabase = createSupabaseAdmin();
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, name, status, config_bearer_hash")
    .eq("slug", slug)
    .maybeSingle();

  if (!project?.config_bearer_hash) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const presentedHash = Buffer.from(
    createHash("sha256").update(presented).digest("hex"),
  );
  const storedHash = Buffer.from(project.config_bearer_hash);
  if (
    presentedHash.length !== storedHash.length ||
    !timingSafeEqual(presentedHash, storedHash)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: active } = await supabase
    .from("project_models")
    .select(
      "effective_from, config, model:ai_models(model_id, display_name, context_window, input_price_per_mtok_usd, output_price_per_mtok_usd, provider:ai_providers(slug))",
    )
    .eq("project_id", project.id)
    .eq("is_active", true)
    .is("effective_to", null)
    .maybeSingle();

  const model = Array.isArray(active?.model) ? active?.model[0] : active?.model;
  if (!active || !model) {
    return NextResponse.json({ error: "model_not_found" }, { status: 404 });
  }
  const provider = Array.isArray(model.provider)
    ? model.provider[0]
    : model.provider;

  return NextResponse.json(
    {
      project: { slug: project.slug, name: project.name, status: project.status },
      active_model: {
        provider: provider?.slug ?? null,
        model_id: model.model_id,
        display: model.display_name,
        price_in_per_mtok_usd: model.input_price_per_mtok_usd,
        price_out_per_mtok_usd: model.output_price_per_mtok_usd,
        context_window: model.context_window,
        config: active.config ?? {},
      },
      effective_from: active.effective_from,
    },
    {
      headers: {
        // Token-gated response — must not be publicly cacheable.
        "Cache-Control": "private, max-age=60, stale-while-revalidate=3600",
      },
    },
  );
}
