import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  hashPassword,
  createAuditLog,
  checkRateLimit,
  normalizeIp,
} from "@/lib/auth";
import { registerSchema, firstValidationError } from "@/lib/validation";
import { COUNSELOR_APPROVAL } from "@/lib/permissions";

// Registration is a public endpoint, so it is rate limited per IP: 10 sign-ups
// per hour is generous for a school network and useless for bulk abuse.
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_PER_IP = 10;

/**
 * Generate a unique student code for a self-registered student who does not
 * have one yet. The API layer is the only place that may create it, so a client
 * cannot pick a code that already belongs to someone else's record.
 */
async function generateStudentCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `S${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const taken = await prisma.studentProfile.findUnique({
      where: { studentCode: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  // Extremely unlikely; a collision here must not create a duplicate record.
  throw new Error("could not allocate a student code");
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const ip = normalizeIp(request);

    const limit = checkRateLimit(`register:${ip}`, REGISTER_MAX_PER_IP, REGISTER_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "تعداد ثبت‌نام‌ها از این دستگاه بیش از حد مجاز است. لطفاً بعداً تلاش کنید." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات ثبت‌نام نامعتبر است") },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // The discriminated union above already rejects ADMIN, but the role is
    // re-checked here so a future schema change can never open a privilege
    // escalation path through this public route.
    if (data.role !== "STUDENT" && data.role !== "COUNSELOR") {
      return NextResponse.json({ error: "نقش انتخاب‌شده مجاز نیست" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({
      where: { username: data.username },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "این نام کاربری قبلاً استفاده شده است. نام کاربری دیگری انتخاب کنید." },
        { status: 400 }
      );
    }

    const email = data.email ? data.email.toLowerCase() : null;

    if (email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (emailTaken) {
        return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 400 });
      }
    }

    // A self-registered counselor can never be usable before an admin approves.
    const approvalStatus =
      data.role === "COUNSELOR" ? COUNSELOR_APPROVAL.PENDING : COUNSELOR_APPROVAL.APPROVED;

    let studentCode = null;
    if (data.role === "STUDENT") {
      studentCode = (data.studentCode || "").trim() || (await generateStudentCode());
      const codeTaken = await prisma.studentProfile.findUnique({
        where: { studentCode },
        select: { id: true },
      });
      if (codeTaken) {
        return NextResponse.json(
          { error: "این کد دانش‌آموزی قبلاً ثبت شده است" },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        role: data.role,
        approvalStatus,
        // Students may sign in immediately; counselors cannot (see the login
        // route and validateSession, which both enforce the approval status).
        isActive: true,
        ...(data.role === "STUDENT"
          ? {
              studentProfile: {
                create: {
                  studentCode,
                  grade: data.grade,
                  schoolYear: data.schoolYear,
                  phone: data.phone || null,
                },
              },
            }
          : {
              counselorProfile: {
                create: {
                  expertise: data.expertise || null,
                  phone: data.phone || null,
                },
              },
            }),
      },
      select: { id: true, username: true, role: true, approvalStatus: true },
    });

    await createAuditLog(
      user.id,
      "REGISTER",
      {
        displayName: `${data.firstName} ${data.lastName}`.trim(),
        role: user.role,
        approvalStatus: user.approvalStatus,
        studentCode: studentCode || undefined,
      },
      ip
    );

    const isPending = user.approvalStatus === COUNSELOR_APPROVAL.PENDING;

    return NextResponse.json(
      {
        success: true,
        requiresApproval: isPending,
        user: { username: user.username, role: user.role },
        message: isPending
          ? "ثبت‌نام شما با موفقیت ثبت شد. حساب مشاور پس از تأیید مدیر سیستم فعال می‌شود."
          : "ثبت‌نام با موفقیت انجام شد. اکنون می‌توانید وارد سیستم شوید.",
      },
      { status: 201 }
    );
  } catch (error) {
    // A unique-index race (two identical usernames submitted at once) must read
    // as a validation problem, not as an internal error.
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "این نام کاربری یا کد دانش‌آموزی قبلاً ثبت شده است" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
