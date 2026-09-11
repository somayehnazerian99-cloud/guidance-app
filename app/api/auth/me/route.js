import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: auth.user.id,
        username: auth.user.username,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        email: auth.user.email,
        role: auth.user.role,
        isActive: auth.user.isActive,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
