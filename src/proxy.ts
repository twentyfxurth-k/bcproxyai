import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "../auth";
import { verifyKey as verifyGatewayKey } from "@/lib/gateway-keys";

const API_KEY = process.env.GATEWAY_API_KEY?.trim() ?? "";
const OWNER_EMAIL = (process.env.AUTH_OWNER_EMAIL ?? "").toLowerCase();
const AUTH_ENABLED = Boolean(API_KEY || OWNER_EMAIL);

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status: number) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function proxy(req: NextRequest) {
  if (!AUTH_ENABLED) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (pathname === "/api/health") return NextResponse.next();
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  if (pathname === "/login") return NextResponse.next();

  const isApiRoute = pathname.startsWith("/api/") || pathname.startsWith("/v1/");
  const isV1Route = pathname.startsWith("/v1/");
  const isMutation = MUTATING_METHODS.has(method);

  const authHeader = req.headers.get("authorization") ?? "";
  const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (presented) {
    // 1) Master env key (ops/deploy)
    if (API_KEY && timingSafeEqual(presented, API_KEY)) {
      return NextResponse.next();
    }
    // 2) Admin-issued DB keys (created via /admin/keys UI)
    if (presented.startsWith("sml_live_")) {
      const valid = await verifyGatewayKey(presented);
      if (valid) return NextResponse.next();
    }
    if (isApiRoute) {
      return json({ error: { message: "invalid api key", type: "auth_error" } }, 401);
    }
  }

  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? "";
  const isOwner = Boolean(OWNER_EMAIL && email === OWNER_EMAIL);
  const isViewer = Boolean(session?.user && !isOwner);

  if (isOwner) return NextResponse.next();

  if (isViewer) {
    if (isV1Route) {
      return json(
        { error: { message: "forbidden: chat completions are owner-only", type: "permission_error" } },
        403
      );
    }
    if (isApiRoute && isMutation) {
      return json(
        { error: { message: "forbidden: read-only access", type: "permission_error" } },
        403
      );
    }
    return NextResponse.next();
  }

  if (isApiRoute) {
    return json(
      { error: { message: "authentication required", type: "auth_error" } },
      401
    );
  }

  const loginUrl = new URL("/login", req.nextUrl);
  loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|woff|woff2)$).*)",
  ],
};
