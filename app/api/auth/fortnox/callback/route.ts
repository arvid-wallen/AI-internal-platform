import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForTokens,
  writeStoredTokens,
} from "@/lib/integrations/fortnox";
import { getSessionMember, hasRole } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/auth/fortnox/callback?code=...&state=...
export async function GET(request: NextRequest) {
  // Same admin gate as /start — the state cookie is CSRF protection, not
  // authorization.
  const member = await getSessionMember();
  if (!hasRole(member, "admin")) {
    return NextResponse.redirect(
      new URL("/settings?fortnox=error&reason=admin_required", request.url),
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/settings?fortnox=error&reason=${encodeURIComponent(errorParam)}`, request.url),
    );
  }

  const expectedState = request.cookies.get("fortnox_oauth_state")?.value;
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/settings?fortnox=error&reason=state_mismatch", request.url),
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/auth/fortnox/callback`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await writeStoredTokens(tokens);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(`/settings?fortnox=error&reason=${encodeURIComponent(msg)}`, request.url),
    );
  }

  const response = NextResponse.redirect(
    new URL("/settings?fortnox=connected", request.url),
  );
  response.cookies.delete("fortnox_oauth_state");
  return response;
}
