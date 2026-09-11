import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, hashPassword, createAuditLog, normalizeIp } from "@/lib/auth";
import { paginationSchema, studentProfileSchema, firstValidationError } from "@/lib/validation";

/**
 * Random password for a newly created student account.
 *
 * The previous implementation used `<studentCode>@12345`, which is guessable by
 * anyone who knows a student code. The generated password is returned exactly
 * once (to the admin creating the account) and is never stored in clear text.
 */
function generateInitialPassword() {
  // Ambiguous characters (0/O, 1/l/I) are excluded so the password can be read
  // out or written on paper without mistakes.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const randomPart = Array.from(crypto.randomBytes(10))
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
  return `St${randomPart}!`;
}

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
    }
    const { page, limit, search } = parsed.data;
    const skip = (page - 1) * limit;

    // Ownership filter comes from the session and can never be overridden by
    // query parameters.
    const where = {};
    if (auth.user.role === "COUNSELOR") {
      where.counselorId = auth.user.id;
    } else if (auth.user.role === "STUDENT") {
      where.userId = auth.user.id;
    }

    const include = {
      user: { select: { id: true, firstName: true, lastName: true, username: true, isActive: true } },
      school: { select: { name: true } },
      class: { select: { name: true } },
      counselor: { select: { id: true, firstName: true, lastName: true } },
    };

    let students;
    let total;

    if (search) {
      // MongoDB cannot filter across relations, so search matches the fields
      // that live on StudentProfile itself.
      const searchWhere = {
        ...where,
        OR: [{ studentCode: { contains: search } }, { schoolYear: { contains: search } }],
      };
      [students, total] = await Promise.all([
        prisma.studentProfile.findMany({
          where: searchWhere,
          include,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.studentProfile.count({ where: searchWhere }),
      ]);
    } else {
      [students, total] = await Promise.all([
        prisma.studentProfile.findMany({
          where,
          include,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.studentProfile.count({ where }),
      ]);
    }

    return NextResponse.json({
      students,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = studentProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات دانش‌آموز نامعتبر است") },
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      studentCode,
      schoolId,
      classId,
      counselorId,
      grade,
      schoolYear,
      phone,
      parentPhone,
      address,
    } = parsed.data;

    const existing = await prisma.studentProfile.findUnique({ where: { studentCode } });
    if (existing) {
      return NextResponse.json({ error: "کد دانش‌آموزی تکراری است" }, { status: 400 });
    }

    const username = `student_${studentCode}`;
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json({ error: "کاربری با این نام کاربری موجود است" }, { status: 400 });
    }

    const initialPassword = generateInitialPassword();
    const hashedPassword = await hashPassword(initialPassword);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        firstName,
        lastName,
        role: "STUDENT",
      },
      select: { id: true },
    });

    const student = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        studentCode,
        schoolId: schoolId || null,
        classId: classId || null,
        counselorId: counselorId || null,
        grade,
        schoolYear,
        phone: phone || null,
        parentPhone: parentPhone || null,
        address: address || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });

    await createAuditLog(
      auth.user.id,
      "CREATE_STUDENT",
      { studentCode, studentId: student.id },
      normalizeIp(request)
    );

    return NextResponse.json(
      {
        student,
        // Shown once so the admin can hand it to the student. It is not stored
        // anywhere in clear text; ask the admin to reset it if it is lost.
        initialCredentials: { username, password: initialPassword },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
