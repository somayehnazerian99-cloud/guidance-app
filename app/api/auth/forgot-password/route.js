import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  createAuditLog,
  generateResetToken,
  getResetTokenExpiry,
  checkRateLimit,
  normalizeIp,
} from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validation";

const GENERIC_RESPONSE =
  "اگر این نام کاربری در سیستم موجود باشد، لینک بازیابی رمز عبور برای شما ارسال خواهد شد.";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "نام کاربری معتبر نیست" }, { status: 400 });
    }

    const { username } = parsed.data;
    const ip = normalizeIp(request);

    // Prevent using this endpoint to spam reset links / enumerate users.
    const limit = checkRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // Always answer the same way, whether or not the account exists.
    if (!user || !user.isActive) {
      await createAuditLog(user?.id ?? null, "PASSWORD_RESET_REQUESTED", { found: false }, ip);
      return NextResponse.json({ success: true, message: GENERIC_RESPONSE });
    }

    // Invalidate any previous unused tokens for this user.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const { token, tokenHash } = generateResetToken();

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: getResetTokenExpiry(),
      },
    });

    await createAuditLog(user.id, "PASSWORD_RESET_REQUESTED", { found: true }, ip);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // The token is NEVER returned in production. In development it is printed
    // to the server console and included in the response so the flow can be
    // exercised locally without a mail provider. Production must deliver it
    // over email.
    const isDevelopment = process.env.NODE_ENV !== "production";

    if (isDevelopment) {
      console.info(`[dev] Password reset link for ${username}: ${resetUrl}`);
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_RESPONSE,
      ...(isDevelopment ? { devResetUrl: resetUrl } : {}),
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
