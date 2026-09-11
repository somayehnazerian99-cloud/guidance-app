import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  validatePasswordStrength,
  invalidateAllUserSessions,
  createAuditLog,
  checkRateLimit,
  normalizeIp,
} from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "لینک بازیابی نامعتبر یا منقضی شده است" }, { status: 400 });
    }

    const { token, newPassword } = parsed.data;
    const ip = normalizeIp(request);

    const limit = checkRateLimit(`reset:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "تعداد تلاش‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید." },
        { status: 429 }
      );
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.errors[0] }, { status: 400 });
    }

    // Only the hash is stored, so look the token up by its hash.
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(token) },
    });

    const invalid = async (reason) => {
      await createAuditLog(record?.userId ?? null, "PASSWORD_RESET_FAILED", { reason }, ip);
      return NextResponse.json(
        { error: "لینک بازیابی نامعتبر یا منقضی شده است" },
        { status: 400 }
      );
    };

    if (!record) return invalid("token_not_found");
    if (record.used) return invalid("token_already_used");
    if (new Date() > record.expiresAt) return invalid("token_expired");

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) return invalid("user_unavailable");

    const isSame = await verifyPassword(newPassword, user.password);
    if (isSame) {
      return NextResponse.json(
        { error: "رمز عبور جدید نمی‌تواند مانند رمز عبور فعلی باشد" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Single-use: mark this token used and revoke every other pending token.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Any session created with the old password must not survive a reset.
    await invalidateAllUserSessions(user.id);

    await createAuditLog(user.id, "PASSWORD_RESET", {}, ip);

    return NextResponse.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر کرد. لطفاً با رمز جدید وارد شوید.",
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
