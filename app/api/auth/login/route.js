import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  createSession,
  setSessionCookie,
  createAuditLog,
  checkRateLimit,
  resetRateLimit,
  normalizeIp,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

// 5 failed attempts per (ip + username) and 20 per ip, within 15 minutes.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_ACCOUNT = 5;
const LOGIN_MAX_PER_IP = 20;

const INVALID_CREDENTIALS = "نام کاربری یا رمز عبور صحیح نیست";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 400 });
    }

    const { username, password, role } = result.data;
    const ip = normalizeIp(request);

    const accountKey = `login:account:${ip}:${username.toLowerCase()}`;
    const ipKey = `login:ip:${ip}`;

    const ipLimit = checkRateLimit(ipKey, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
    const accountLimit = checkRateLimit(accountKey, LOGIN_MAX_PER_ACCOUNT, LOGIN_WINDOW_MS);

    if (!ipLimit.allowed || !accountLimit.allowed) {
      await createAuditLog(null, "RATE_LIMITED_LOGIN", { username }, ip);
      const retryAfter = !ipLimit.allowed ? ipLimit.retryAfterSeconds : accountLimit.retryAfterSeconds;
      return NextResponse.json(
        { error: "تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // Same generic message for "unknown user", "wrong password" and "wrong
    // portal" so the response cannot be used to enumerate accounts.
    const failLogin = async (reason, userId = null) => {
      await createAuditLog(userId, "FAILED_LOGIN", { username, reason }, ip);
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    };

    if (!user) {
      // Equalise timing a little against user enumeration.
      await verifyPassword(password, "$2a$12$eImiTXuWVxfM37uY4JANjQ.d1VJqO5pME0kSb1O0oY8kNdSTsHczu");
      return failLogin("user_not_found");
    }

    if (!user.isActive) {
      await createAuditLog(user.id, "FAILED_LOGIN", { reason: "account_disabled" }, ip);
      return NextResponse.json({ error: "حساب کاربری غیرفعال است" }, { status: 403 });
    }

    if (role && user.role !== role) {
      return failLogin("role_mismatch", user.id);
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return failLogin("wrong_password", user.id);
    }

    // Successful login clears the per-account counter.
    resetRateLimit(accountKey);

    const session = await createSession(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createAuditLog(user.id, "LOGIN", { role: user.role }, ip);

    const isSecure = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      redirect: `/${user.role.toLowerCase()}`,
    });

    setSessionCookie(response, session.token, isSecure);

    return response;
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
