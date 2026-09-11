import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Students have no need to enumerate staff accounts.
    if (auth.user.role === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const counselors = await prisma.user.findMany({
      where: { role: "COUNSELOR" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        isActive: true,
        counselorProfile: { select: { expertise: true, phone: true } },
        _count: { select: { assignedStudents: true } },
      },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ counselors });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
