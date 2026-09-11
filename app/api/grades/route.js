import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { gradeSchema, firstValidationError } from "@/lib/validation";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    const where = {};
    if (studentId) {
      where.studentId = studentId;
      // Access control
      if (auth.user.role === "STUDENT") {
        const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
        if (!profile || profile.id !== studentId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      if (auth.user.role === "COUNSELOR") {
        const profile = await prisma.studentProfile.findUnique({ where: { id: studentId } });
        if (!profile || profile.counselorId !== auth.user.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    } else if (auth.user.role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
      if (profile) where.studentId = profile.id;
    } else if (auth.user.role === "COUNSELOR") {
      where.student = { counselorId: auth.user.id };
    }

    const grades = await prisma.grade.findMany({
      where,
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ gradeLevel: "asc" }, { subjectName: "asc" }],
    });

    return NextResponse.json({ grades });
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

    const parsed = gradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات نمره نامعتبر است") },
        { status: 400 }
      );
    }

    const { studentId, subjectName, score, maxScore, semester, academicYear, gradeLevel, evaluationType } =
      parsed.data;

    if (score > maxScore) {
      return NextResponse.json({ error: "نمره نمی‌تواند از حداکثر نمره بیشتر باشد" }, { status: 400 });
    }

    // Student must exist, and a counselor may only grade their own students.
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { id: true, counselorId: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });
    }
    if (auth.user.role === "COUNSELOR" && profile.counselorId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const grade = await prisma.grade.create({
      data: {
        studentId,
        subjectName,
        score,
        maxScore,
        semester,
        academicYear,
        gradeLevel,
        evaluationType: evaluationType || null,
      },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    await createAuditLog(
      auth.user.id,
      "CREATE_GRADE",
      { studentId, gradeId: grade.id },
      normalizeIp(request)
    );

    return NextResponse.json({ grade }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
