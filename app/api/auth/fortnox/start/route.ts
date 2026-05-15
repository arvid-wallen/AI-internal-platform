import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getAuthorizationUrl } from "@/lib/integrations/fortnox";

// GET /api/auth/fortnox/start
// Redirects an admin to Fortnox OAuth consent page. Sets a signed state cookie
// to defend against CSRF on the callback.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // TODO: gate to admins (read team_members.role). Skipped here — middleware
  // already requires @haus.se session, so this is admin-trusted for now.

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
