import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { COUNSELOR_APPROVAL, COUNSELOR_APPROVAL_VALUES } from "@/lib/permissions";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Students have no need to enumerate staff accounts.
    if (auth.user.role === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedStatus = searchParams.get("approvalStatus");
    const approvalFilter =
      requestedStatus && COUNSELOR_APPROVAL_VALUES.includes(requestedStatus)
        ? requestedStatus
        : undefined;

    const counselors = await prisma.user.findMany({
      where: {
        role: "COUNSELOR",
        ...(approvalFilter ? { approvalStatus: approvalFilter } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        isActive: true,
        approvalStatus: true,
        createdAt: true,
        counselorProfile: { select: { expertise: true, phone: true } },
        _count: { select: { assignedStudents: true } },
      },
      orderBy: [{ approvalStatus: "asc" }, { firstName: "asc" }],
    });

    // A row that predates the approval field reads as approved, so legacy
    // accounts keep showing up as active instead of as a pending request.
    const normalized = counselors.map((counselor) => ({
      ...counselor,
      approvalStatus: counselor.approvalStatus || COUNSELOR_APPROVAL.APPROVED,
    }));

    const pendingCount = normalized.filter(
      (counselor) => counselor.approvalStatus === COUNSELOR_APPROVAL.PENDING
    ).length;

    return NextResponse.json({ counselors: normalized, pendingCount });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
