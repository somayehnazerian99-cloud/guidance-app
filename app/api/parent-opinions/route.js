import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { parentOpinionSchema } from "@/lib/validation";

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
      if (!profile) return NextResponse.json({ opinions: [] });
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

    const opinions = await prisma.parentOpinion.findMany({
      where,
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ opinions });
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

    const parsed = parentOpinionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "اطلاعات نظر والدین نامعتبر است" }, { status: 400 });
    }

    const { studentId, parentName, interests, abilities, fieldInterest, behavioral, activities, generalNotes } =
      parsed.data;

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

    const opinion = await prisma.parentOpinion.create({
      data: {
        studentId,
        parentName: parentName || null,
        interests: interests || null,
        abilities: abilities || null,
        fieldInterest: fieldInterest || null,
        behavioral: behavioral || null,
        activities: activities || null,
        generalNotes: generalNotes || null,
      },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    return NextResponse.json({ opinion }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
