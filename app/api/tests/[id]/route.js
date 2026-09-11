import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { guidanceTestUpdateSchema } from "@/lib/validation";

export async function GET(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const test = await prisma.guidanceTest.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!test) return NextResponse.json({ error: "آزمون یافت نشد" }, { status: 404 });

    // Students can only open active tests, and never see option scores before
    // they submit (that would let them pick the "best" answer).
    if (auth.user.role === "STUDENT") {
      if (!test.isActive) {
        return NextResponse.json({ error: "آزمون یافت نشد" }, { status: 404 });
      }

      const sanitizedTest = {
        ...test,
        questions: test.questions.map((q) => ({
          ...q,
          options: q.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
        })),
      };
      return NextResponse.json({ test: sanitizedTest });
    }

    return NextResponse.json({ test });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = guidanceTestUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "اطلاعات آزمون نامعتبر است" }, { status: 400 });
    }

    const test = await prisma.guidanceTest.findUnique({ where: { id } });
    if (!test) return NextResponse.json({ error: "آزمون یافت نشد" }, { status: 404 });

    // Explicit whitelist only - never spread the request body into the update.
    const updateData = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const updated = await prisma.guidanceTest.update({
      where: { id },
      data: updateData,
      include: { questions: { include: { options: true } } },
    });

    return NextResponse.json({ test: updated });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Delete answers and attempts
    const attempts = await prisma.testAttempt.findMany({ where: { testId: id } });
    for (const attempt of attempts) {
      await prisma.testAnswer.deleteMany({ where: { attemptId: attempt.id } });
    }
    await prisma.testAttempt.deleteMany({ where: { testId: id } });
    await prisma.option.deleteMany({ where: { question: { testId: id } } });
    await prisma.question.deleteMany({ where: { testId: id } });
    await prisma.guidanceTest.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
