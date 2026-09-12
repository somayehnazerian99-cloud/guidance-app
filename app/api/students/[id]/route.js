import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { updateStudentSchema, firstValidationError } from "@/lib/validation";

export async function GET(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, isActive: true } },
        school: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        counselor: { select: { id: true, firstName: true, lastName: true } },
        grades: { orderBy: [{ gradeLevel: "asc" }, { academicYear: "asc" }] },
        interests: true,
        abilities: true,
        parentOpinions: true,
        guidanceResults: { orderBy: { createdAt: "desc" }, take: 1 },
        notifications: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!student) return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });

    if (auth.user.role === "STUDENT" && student.userId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (auth.user.role === "COUNSELOR" && student.counselorId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ student });
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

    const parsed = updateStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات ارسالی نامعتبر است") },
        { status: 400 }
      );
    }

    const student = await prisma.studentProfile.findUnique({ where: { id } });
    if (!student) return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });

    // Explicit whitelist: the request body is never spread into the update, so
    // fields like studentCode/userId cannot be mass-assigned.
    const updateData = {};
    const profileFields = [
      "schoolId",
      "classId",
      "counselorId",
      "grade",
      "schoolYear",
      "phone",
      "parentPhone",
      "address",
      "profileComplete",
    ];
    for (const field of profileFields) {
      if (parsed.data[field] !== undefined) {
        updateData[field] = parsed.data[field] === "" ? null : parsed.data[field];
      }
    }

    if (parsed.data.firstName || parsed.data.lastName) {
      const userUpdate = {};
      if (parsed.data.firstName) userUpdate.firstName = parsed.data.firstName;
      if (parsed.data.lastName) userUpdate.lastName = parsed.data.lastName;
      await prisma.user.update({ where: { id: student.userId }, data: userUpdate });
    }

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });

    await createAuditLog(
      auth.user.id,
      "UPDATE_STUDENT",
      {
        studentId: id,
        // Names (not ids) so the Persian audit sentence can identify the person.
        targetName: [updated.user?.firstName, updated.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        targetUsername: updated.user?.username,
      },
      normalizeIp(request)
    );

    return NextResponse.json({ student: updated });
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

    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });

    // Delete test attempts and their answers
    const attempts = await prisma.testAttempt.findMany({ where: { studentId: id }, select: { id: true } });
    for (const a of attempts) {
      await prisma.testAnswer.deleteMany({ where: { attemptId: a.id } });
    }
    await prisma.testAttempt.deleteMany({ where: { studentId: id } });
    await prisma.grade.deleteMany({ where: { studentId: id } });
    await prisma.interest.deleteMany({ where: { studentId: id } });
    await prisma.ability.deleteMany({ where: { studentId: id } });
    await prisma.parentOpinion.deleteMany({ where: { studentId: id } });
    await prisma.guidanceResult.deleteMany({ where: { studentId: id } });
    await prisma.notification.deleteMany({ where: { studentId: id } });

    await prisma.studentProfile.delete({ where: { id } });
    await prisma.session.deleteMany({ where: { userId: student.userId } });
    await prisma.auditLog.deleteMany({ where: { userId: student.userId } });
    await prisma.user.delete({ where: { id: student.userId } });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    await createAuditLog(
      auth.user.id,
      "DELETE_STUDENT",
      {
        studentId: id,
        // Captured before the row is gone, so the audit entry keeps the name.
        targetName: [student.user?.firstName, student.user?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        targetUsername: student.user?.username,
      },
      ip
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
