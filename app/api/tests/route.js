import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { guidanceTestSchema, firstValidationError } from "@/lib/validation";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "attempts") {
      const studentId = searchParams.get("studentId");
      const where = {};

      // Ownership is resolved from the session and can never be overridden by
      // a client-supplied studentId (IDOR protection).
      if (auth.user.role === "STUDENT") {
        const profile = await prisma.studentProfile.findUnique({
          where: { userId: auth.user.id },
          select: { id: true },
        });
        if (!profile) return NextResponse.json({ attempts: [] });
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

      const attempts = await prisma.testAttempt.findMany({
        where,
        include: {
          test: { select: { id: true, title: true } },
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          answers: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ attempts });
    }

    // List tests — students only ever see active tests.
    const where = {};
    if (auth.user.role === "STUDENT") {
      where.isActive = true;
    }

    const tests = await prisma.guidanceTest.findMany({
      where,
      include: {
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tests });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = guidanceTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات آزمون نامعتبر است") },
        { status: 400 }
      );
    }

    const { title, description, questions } = parsed.data;

    const test = await prisma.guidanceTest.create({
      data: {
        title,
        description: description || null,
        createdBy: auth.user.id,
        questions: questions
          ? {
              create: questions.map((q) => ({
                text: q.text,
                order: q.order || 0,
                options: q.options
                  ? {
                      create: q.options.map((o) => ({
                        text: o.text,
                        score: o.score || 0,
                        order: o.order || 0,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: { questions: { include: { options: true } } },
    });

    await createAuditLog(auth.user.id, "CREATE_TEST", { testId: test.id }, normalizeIp(request));

    return NextResponse.json({ test }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
