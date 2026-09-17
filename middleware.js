import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "guidance-session";

const PUBLIC_PATHS = new Set(["/", "/login/admin", "/login/counselor", "/login/student", "/reset-password", "/forgot-password"]);
const PUBLIC_PREFIXES = ["/register"];
const PANEL_LOGIN = { "/admin": "/login/admin", "/counselor": "/login/counselor", "/student": "/login/student" };
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function applySecurityHeaders(response, isProduction) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.cloudinary.com",
    "media-src 'self' https://www.picofile.com https://picofile.com https://res.cloudinary.com",
    "frame-src https://www.youtube.com https://www.aparat.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "));

  if (isProduction) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

function applyNoStore(response) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (STATE_CHANGING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      let originHost = null;
      try { originHost = new URL(origin).host; } catch { originHost = null; }
      const expectedHost = request.headers.get("host");
      if (!originHost || !expectedHost || originHost !== expectedHost) {
        return new NextResponse(JSON.stringify({ error: "درخواست از منبع نامعتبر" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
    }
  }

  if (pathname.startsWith("/api/")) return applySecurityHeaders(applyNoStore(NextResponse.next()), isProduction);

  const panelPrefix = Object.keys(PANEL_LOGIN).find((prefix) => pathname.startsWith(prefix));
  if (panelPrefix) {
    if (!hasSessionCookie) return applySecurityHeaders(NextResponse.redirect(new URL(PANEL_LOGIN[panelPrefix], request.url)), isProduction);
    return applySecurityHeaders(applyNoStore(NextResponse.next()), isProduction);
  }

  const response = applySecurityHeaders(NextResponse.next(), isProduction);
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.startsWith("/robots") || pathname.startsWith("/sitemap") || pathname.includes(".")) return response;
  if (!hasSessionCookie) return applySecurityHeaders(NextResponse.redirect(new URL("/", request.url)), isProduction);
  return applyNoStore(response);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|file.svg|globe.svg|next.svg|vercel.svg|window.svg).*)"] };
