import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { interestSchema } from "@/lib/validation";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    // Session-derived filters win over query parameters (IDOR protection).
    const where = {};
    if (auth.user.role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: auth.user.id },
        select: { id: true },
      });
      if (!profile) return NextResponse.json({ interests: [] });
      if (studentId && studentId !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      where.studentId = profile.id;
    } else if (auth.user.role === "COUNSELOR") {
      if (studentId) {
        const profile = await prisma.studentProfile.findUnique({
          where: { id: studentId },
          select: { counselorId: true },
        });
        if (!profile || profile.counselorId !== auth.user.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.studentId = studentId;
      } else {
        where.student = { counselorId: auth.user.id };
      }
    } else if (studentId) {
      where.studentId = studentId;
    }

    const interests = await prisma.interest.findMany({
      where,
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ interests });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = interestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "اطلاعات علایق نامعتبر است" }, { status: 400 });
    }

    const { studentId, interests } = parsed.data;

    // Access control — the student id is verified against the session, never trusted.
    const profile = await prisma.studentProfile.findUnique({
      where: auth.user.role === "STUDENT" ? { userId: auth.user.id } : { id: studentId },
      select: { id: true, counselorId: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });
    }
    if (auth.user.role === "STUDENT" && profile.id !== studentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (auth.user.role === "COUNSELOR" && profile.counselorId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Replace the student's interest set atomically.
    const created = await prisma.$transaction([
      prisma.interest.deleteMany({ where: { studentId } }),
      prisma.interest.createMany({
        data: interests.map((i) => ({
          studentId,
          category: i.category,
          level: i.level ?? 1,
          notes: i.notes || null,
        })),
      }),
    ]);

    return NextResponse.json({ count: created[1].count }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
