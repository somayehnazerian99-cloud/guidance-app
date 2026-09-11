import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { abilitySchema } from "@/lib/validation";

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
      if (!profile) return NextResponse.json({ abilities: [] });
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

    const abilities = await prisma.ability.findMany({
      where,
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ abilities });
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

    const parsed = abilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "اطلاعات توانایی‌ها نامعتبر است" }, { status: 400 });
    }

    const { studentId, abilities } = parsed.data;

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

    const created = await prisma.$transaction([
      prisma.ability.deleteMany({ where: { studentId } }),
      prisma.ability.createMany({
        data: abilities.map((a) => ({
          studentId,
          category: a.category,
          score: a.score ?? 0,
          level: a.level || "MEDIUM",
          notes: a.notes || null,
        })),
      }),
    ]);

    return NextResponse.json({ count: created[1].count }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
