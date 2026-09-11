import { NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  invalidateSession,
  clearSessionCookie,
  createAuditLog,
  authenticateRequest,
} from "@/lib/auth";

export async function POST(request) {
  try {
    const session = await authenticateRequest(request);

    const token = getSessionTokenFromRequest(request);
    if (token) {
      await invalidateSession(token);
    }

    if (session) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "unknown";
      await createAuditLog(session.user.id, "LOGOUT", {}, ip);
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);

    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  }
}
