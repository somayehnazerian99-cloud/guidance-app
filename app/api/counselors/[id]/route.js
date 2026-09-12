import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { counselorApprovalSchema, firstValidationError } from "@/lib/validation";
import { COUNSELOR_APPROVAL } from "@/lib/permissions";

/**
 * PATCH /api/counselors/[id]
 *
 * Approve or reject a self-registered counselor. Administrator only: the role
 * is read from the session, never from the request body.
 *
 * Rejection also disables the account, so a rejected counselor needs an explicit
 * admin action to be enabled again rather than drifting back into service.
 */
export async function PATCH(request, { params }) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "تأیید یا رد مشاور فقط توسط مدیر سیستم امکان‌پذیر است" },
        { status: 403 }
      );
    }

    const { id } = await params;

    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = counselorApprovalSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات نامعتبر است") },
        { status: 400 }
      );
    }

    const { decision, reason } = parsed.data;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        username: true,
        approvalStatus: true,
      },
    });

    // Only counselor accounts can be approved, so this endpoint can never be
    // used to reactivate an unrelated account.
    if (!target || target.role !== "COUNSELOR") {
      return NextResponse.json({ error: "مشاور یافت نشد" }, { status: 404 });
    }

    const approve = decision === "APPROVE";

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        approvalStatus: approve
          ? COUNSELOR_APPROVAL.APPROVED
          : COUNSELOR_APPROVAL.REJECTED,
        isActive: approve,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        approvalStatus: true,
      },
    });

    // A rejected counselor must lose any live session immediately.
    if (!approve) {
      await prisma.session.deleteMany({ where: { userId: target.id } });
    }

    await createAuditLog(
      auth.user.id,
      approve ? "COUNSELOR_APPROVED" : "COUNSELOR_REJECTED",
      {
        targetUserId: target.id,
        targetName: `${target.firstName} ${target.lastName}`.trim(),
        targetUsername: target.username,
        ...(reason ? { reason } : {}),
      },
      normalizeIp(request)
    );

    return NextResponse.json({
      user: updated,
      message: approve
        ? `حساب مشاور «${target.firstName} ${target.lastName}» تأیید شد`
        : `ثبت‌نام مشاور «${target.firstName} ${target.lastName}» رد شد`,
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
