import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateRequest,
  hashPassword,
  createAuditLog,
  normalizeIp,
  validatePasswordStrength,
} from "@/lib/auth";
import { updateUserSchema, firstValidationError } from "@/lib/validation";

export async function GET(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Users can only view their own profile unless admin
    if (auth.user.role !== "ADMIN" && auth.user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

    return NextResponse.json({ user });
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
    const body = await request.json();
    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: firstValidationError(result.error, "اطلاعات نامعتبر") },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

    // Email uniqueness is enforced at the application level (see schema comment
    // about nullable unique fields in MongoDB).
    if (result.data.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: result.data.email, NOT: { id } },
        select: { id: true },
      });
      if (emailTaken) {
        return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 400 });
      }
    }

    // Explicit whitelist — never spread the request body into the update.
    const updateData = {};
    if (result.data.firstName) updateData.firstName = result.data.firstName;
    if (result.data.lastName) updateData.lastName = result.data.lastName;
    if (result.data.email !== undefined) updateData.email = result.data.email || null;
    if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive;

    // Prevent self-deactivation
    if (auth.user.id === id && updateData.isActive === false) {
      return NextResponse.json({ error: "نمی‌توانید حساب خود را غیرفعال کنید" }, { status: 400 });
    }

    // Prevent self role-change (privilege escalation guard)
    const roleChanged = Boolean(result.data.role) && result.data.role !== target.role;
    if (auth.user.id === id && roleChanged) {
      return NextResponse.json({ error: "نمی‌توانید نقش خود را تغییر دهید" }, { status: 400 });
    }

    if (roleChanged) {
      updateData.role = result.data.role;
    }

    if (result.data.password) {
      // An admin-driven reset must still satisfy the password policy.
      const passwordCheck = validatePasswordStrength(result.data.password);
      if (!passwordCheck.valid) {
        return NextResponse.json({ error: passwordCheck.errors[0] }, { status: 400 });
      }
      updateData.password = await hashPassword(result.data.password);
      // Any session created with the old password is no longer valid.
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Keep profile documents in sync with role changes.
    if (roleChanged) {
      if (updateData.role === "COUNSELOR") {
        const existing = await prisma.counselorProfile.findUnique({ where: { userId: id } });
        if (!existing) await prisma.counselorProfile.create({ data: { userId: id } });
      }
      await createAuditLog(
        auth.user.id,
        "ROLE_CHANGE",
        { targetUserId: id, from: target.role, to: updateData.role },
        normalizeIp(request)
      );
    }

    await createAuditLog(auth.user.id, "UPDATE_USER", { targetUserId: id }, normalizeIp(request));

    return NextResponse.json({ user });
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

    // Prevent self-deletion
    if (auth.user.id === id) {
      return NextResponse.json({ error: "نمی‌توانید حساب خود را حذف کنید" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: { select: { id: true } },
        counselorProfile: { select: { id: true } },
      },
    });
    if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

    // Delete the dependent records first so no orphaned documents are left
    // behind (MongoDB has no database-level cascade here).
    if (user.studentProfile) {
      const studentId = user.studentProfile.id;
      const attempts = await prisma.testAttempt.findMany({
        where: { studentId },
        select: { id: true },
      });
      for (const attempt of attempts) {
        await prisma.testAnswer.deleteMany({ where: { attemptId: attempt.id } });
      }
      await prisma.testAttempt.deleteMany({ where: { studentId } });
      await prisma.grade.deleteMany({ where: { studentId } });
      await prisma.interest.deleteMany({ where: { studentId } });
      await prisma.ability.deleteMany({ where: { studentId } });
      await prisma.parentOpinion.deleteMany({ where: { studentId } });
      await prisma.guidanceResult.deleteMany({ where: { studentId } });
      await prisma.notification.deleteMany({ where: { studentId } });
      await prisma.studentProfile.delete({ where: { id: studentId } });
    }

    if (user.counselorProfile) {
      // Keep the students and classes, but release them from this counselor.
      await prisma.studentProfile.updateMany({
        where: { counselorId: id },
        data: { counselorId: null },
      });
      await prisma.class.updateMany({
        where: { counselorId: id },
        data: { counselorId: null },
      });
      await prisma.counselorProfile.delete({ where: { id: user.counselorProfile.id } });
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: id } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.auditLog.deleteMany({ where: { userId: id } });

    await prisma.user.delete({ where: { id } });

    await createAuditLog(
      auth.user.id,
      "DELETE_USER",
      { targetUserId: id, username: user.username, role: user.role },
      normalizeIp(request)
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
