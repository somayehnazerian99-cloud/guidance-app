import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { calculateGuidanceResult } from "@/lib/guidance-engine";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    const where = {};
    if (studentId) where.studentId = studentId;

    if (auth.user.role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
      if (profile) where.studentId = profile.id;
    } else if (auth.user.role === "COUNSELOR") {
      where.student = { counselorId: auth.user.id };
    }

    const results = await prisma.guidanceResult.findMany({
      where,
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role === "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const { studentId } = body;

    if (typeof studentId !== "string" || !studentId) {
      return NextResponse.json({ error: "شناسه دانش‌آموز الزامی است" }, { status: 400 });
    }

    // Resolved once, up front: it provides the access check, a proper 404 for an
    // unknown id (instead of an internal error) and the name for the audit log.
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true, username: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });
    }

    // Access control for counselor: only their own students.
    if (auth.user.role === "COUNSELOR" && student.counselorId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await calculateGuidanceResult(studentId);

    const guidanceResult = await prisma.guidanceResult.create({
      data: {
        studentId: result.studentId,
        suggestedFields: result.suggestedFields,
        analysis: result.analysis,
      },
    });

    await createAuditLog(
      auth.user.id,
      "GUIDANCE_CALCULATED",
      {
        studentId,
        targetName: [student.user?.firstName, student.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        targetUsername: student.user?.username,
      },
      normalizeIp(request)
    );

    return NextResponse.json({ result: guidanceResult }, { status: 201 });
  } catch {
    // Never surface internal errors (stack traces, Prisma messages) to the client.
    return NextResponse.json({ error: "محاسبه نتیجه هدایت تحصیلی انجام نشد" }, { status: 500 });
  }
}
