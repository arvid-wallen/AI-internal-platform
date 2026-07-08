import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Fail closed: without Supabase env vars there is no auth to enforce and no
  // data to render (mock mode was removed with lib/data.ts) — a silent bypass
  // would expose the whole dashboard unauthenticated on a misconfigured deploy.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return new NextResponse(
      "Servern är felkonfigurerad — Supabase-miljövariabler saknas.",
      { status: 503 },
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isPublicApi =
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.match(/^\/api\/projects\/[^/]+\/config$/);

  if (isAuthRoute || isPublicApi) return response;

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user.email?.endsWith("@haus.se")) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=domain", request.url));
  }

  return response;
}
