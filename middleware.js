import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "guidance-session";

// Public routes that don't need authentication.
const PUBLIC_PATHS = new Set([
  "/",
  "/login/admin",
  "/login/counselor",
  "/login/student",
  "/reset-password",
  "/forgot-password",
]);

// Public route prefixes (self-service sign-up pages).
const PUBLIC_PREFIXES = ["/register"];

// Panel prefix -> login page of the matching role.
const PANEL_LOGIN = {
  "/admin": "/login/admin",
  "/counselor": "/login/counselor",
  "/student": "/login/student",
};

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function applySecurityHeaders(response, isProduction) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self'",
      "media-src 'self' https://www.picofile.com https://picofile.com",
      "frame-src https://www.youtube.com https://www.aparat.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ")
  );

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

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

  // --- CSRF defence in depth -------------------------------------------------
  // The session cookie is SameSite=Lax, which already blocks cross-site POSTs;
  // this adds an explicit Origin check on top. Requests without an Origin
  // header (curl, server-to-server calls) are allowed through.
  if (STATE_CHANGING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      let originHost = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      const expectedHost = request.headers.get("host");

      if (!originHost || !expectedHost || originHost !== expectedHost) {
        return new NextResponse(JSON.stringify({ error: "درخواست از منبع نامعتبر" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  // --- API routes ------------------------------------------------------------
  // They authenticate and authorise themselves; here we only add headers and
  // make sure responses are never cached by the browser.
  if (pathname.startsWith("/api/")) {
    return applySecurityHeaders(applyNoStore(NextResponse.next()), isProduction);
  }

  // --- Panel routes ----------------------------------------------------------
  // The cookie check here is only a fast path to avoid rendering a shell for
  // anonymous visitors. The authoritative role check happens server-side in
  // app/{admin,counselor,student}/layout.js via requireRole().
  const panelPrefix = Object.keys(PANEL_LOGIN).find((prefix) => pathname.startsWith(prefix));

  if (panelPrefix) {
    if (!hasSessionCookie) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL(PANEL_LOGIN[panelPrefix], request.url)),
        isProduction
      );
    }
    return applySecurityHeaders(applyNoStore(NextResponse.next()), isProduction);
  }

  // --- Everything else -------------------------------------------------------
  const response = applySecurityHeaders(NextResponse.next(), isProduction);

  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.includes(".")
  ) {
    return response;
  }

  // Any other page is private.
  if (!hasSessionCookie) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/", request.url)), isProduction);
  }

  return applyNoStore(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|file.svg|globe.svg|next.svg|vercel.svg|window.svg).*)",
  ],
};
