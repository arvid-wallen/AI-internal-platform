import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getAuthorizationUrl } from "@/lib/integrations/fortnox";
import { getSessionMember, hasRole } from "@/lib/auth";

// GET /api/auth/fortnox/start
// Redirects an admin to Fortnox OAuth consent page. Sets a signed state cookie
// to defend against CSRF on the callback.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Connecting Fortnox is an org-wide action — admins only (middleware
  // already requires an @haus.se session, this adds the role gate).
  const member = await getSessionMember();
  if (!hasRole(member, "admin")) {
    return NextResponse.json(
      { error: "Endast administratörer kan ansluta Fortnox." },
      { status: 403 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/auth/fortnox/callback`;

  let authUrl: string;
  try {
    authUrl = getAuthorizationUrl(redirectUri, state);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("fortnox_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
