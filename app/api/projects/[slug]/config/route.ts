import { NextResponse, type NextRequest } from "next/server";
import { modelById, projectBySlug } from "@/lib/data";

// GET /api/projects/[slug]/config
// Public endpoint - customer projects fetch their active-model config here.
// Auth: Bearer token in Authorization header (validated against project-specific token in DB).
// For now mock-data; real impl will query Supabase + vault.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_bearer" }, { status: 401 });
  }
  // TODO: validate bearer against projects.config_bearer_secret_id (vault).

  const p = projectBySlug(slug);
  if (!p) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }
  const m = modelById(p.active_model);
  if (!m) {
    return NextResponse.json({ error: "model_not_found" }, { status: 500 });
  }

  return NextResponse.json(
    {
      project: { slug: p.slug, name: p.name, status: p.status },
      active_model: {
        provider: m.provider,
        model_id: m.id,
        display: m.display,
        price_in_per_mtok_usd: m.price_in,
        price_out_per_mtok_usd: m.price_out,
        context_window: m.ctx,
        config: {},
      },
      effective_from: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
      },
    },
  );
}
