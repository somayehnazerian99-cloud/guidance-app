import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { testSubmitSchema } from "@/lib/validation";

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "STUDENT") {
      return NextResponse.json({ error: "فقط دانش‌آموزان می‌توانند آزمون دهند" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = testSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "پاسخ‌های ارسالی نامعتبر است" }, { status: 400 });
    }

    const { testId, answers } = parsed.data;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: auth.user.id },
      select: { id: true },
    });
    if (!studentProfile) {
      return NextResponse.json({ error: "پروفایل دانش‌آموزی یافت نشد" }, { status: 404 });
    }

    const test = await prisma.guidanceTest.findUnique({
      where: { id: testId },
      select: { id: true, isActive: true },
    });
    if (!test) {
      return NextResponse.json({ error: "آزمون یافت نشد" }, { status: 404 });
    }
    if (!test.isActive) {
      return NextResponse.json({ error: "این آزمون غیرفعال است" }, { status: 400 });
    }

    const existingAttempt = await prisma.testAttempt.findFirst({
      where: { studentId: studentProfile.id, testId, completed: true },
      select: { id: true },
    });
    if (existingAttempt) {
      return NextResponse.json({ error: "شما قبلاً این آزمون را انجام داده‌اید" }, { status: 400 });
    }

    // Load the authoritative option set of this test. Anything the client sent
    // that is not in here is ignored, so scores cannot be inflated by posting
    // arbitrary optionIds.
    const questions = await prisma.question.findMany({
      where: { testId },
      select: {
        id: true,
        options: { select: { id: true, score: true } },
      },
    });

    const optionIndex = new Map();
    for (const question of questions) {
      for (const option of question.options) {
        optionIndex.set(option.id, { questionId: question.id, score: option.score });
      }
    }

    const seenQuestions = new Set();
    const gradedAnswers = [];
    let totalScore = 0;

    for (const answer of answers) {
      const option = optionIndex.get(answer.optionId);
      // The option must exist, must belong to the claimed question, and each
      // question may only be answered once.
      if (!option || option.questionId !== answer.questionId) continue;
      if (seenQuestions.has(answer.questionId)) continue;

      seenQuestions.add(answer.questionId);
      totalScore += option.score;
      gradedAnswers.push({
        questionId: answer.questionId,
        optionId: answer.optionId,
        score: option.score,
      });
    }

    if (gradedAnswers.length === 0) {
      return NextResponse.json({ error: "هیچ پاسخ معتبری ارسال نشد" }, { status: 400 });
    }

    const attempt = await prisma.testAttempt.create({
      data: {
        studentId: studentProfile.id,
        testId,
        completed: true,
        completedAt: new Date(),
        totalScore,
        answers: { create: gradedAnswers },
      },
    });

    await createAuditLog(
      auth.user.id,
      "TEST_SUBMIT",
      { testId, attemptId: attempt.id },
      normalizeIp(request)
    );

    return NextResponse.json({
      attemptId: attempt.id,
      totalScore,
      answeredQuestions: gradedAnswers.length,
      totalQuestions: questions.length,
      message: "آزمون با موفقیت ثبت شد",
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
