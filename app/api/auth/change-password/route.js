import { NextResponse } from "next/server";
import {
  authenticateRequest,
  hashPassword,
  verifyPassword,
  createAuditLog,
  normalizeIp,
  checkRateLimit,
  validatePasswordStrength,
} from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";
import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const result = changePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "اطلاعات واردشده صحیح نیست" }, { status: 400 });
    }

    const { currentPassword, newPassword } = result.data;
    const ip = normalizeIp(request);

    // Throttle password guessing against a stolen session.
    const limit = checkRateLimit(`change-password:${auth.user.id}`, 5, 15 * 60 * 1000);
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

    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    if (!user) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      await createAuditLog(auth.user.id, "PASSWORD_CHANGE_FAILED", {}, ip);
      return NextResponse.json({ error: "رمز عبور فعلی صحیح نیست" }, { status: 400 });
    }

    const isSame = await verifyPassword(newPassword, user.password);
    if (isSame) {
      return NextResponse.json(
        { error: "رمز عبور جدید نمی‌تواند مانند رمز عبور فعلی باشد" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { password: hashedPassword },
    });

    await createAuditLog(auth.user.id, "PASSWORD_CHANGE", {}, ip);

    return NextResponse.json({ success: true, message: "رمز عبور با موفقیت تغییر کرد" });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
