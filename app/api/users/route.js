import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, hashPassword, createAuditLog } from "@/lib/auth";
import { createUserSchema, paginationSchema, firstValidationError } from "@/lib/validation";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams);
    const parsed = paginationSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "پارامترهای نامعتبر" }, { status: 400 });
    }
    const { page, limit, search } = parsed.data;
    let { sort, order } = parsed.data;

    // Whitelist sort fields to prevent injection
    const allowedSortFields = ["createdAt", "firstName", "lastName", "username", "role"];
    if (sort && !allowedSortFields.includes(sort)) sort = undefined;

    const where = {};
    if (search) {
      // For MongoDB we do simple username contains search (compatible)
      // Frontend can search by username; for name search we filter in-memory below
      where.username = { contains: search };
    }

    const skip = (page - 1) * limit;

    const orderBy = {};
    if (sort) {
      orderBy[sort] = order;
    } else {
      orderBy.createdAt = "desc";
    }

    let users;
    let total;
    if (search) {
      // Fetch all matching users and filter for name matches too
      const allUsers = await prisma.user.findMany({
        where: {},
        select: {
          id: true, username: true, firstName: true, lastName: true,
          email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
        orderBy,
      });
      const filtered = allUsers.filter(
        (u) => u.username.includes(search) || u.firstName.includes(search) || u.lastName.includes(search)
      );
      total = filtered.length;
      users = filtered.slice(skip, skip + limit);
    } else {
      [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true, username: true, firstName: true, lastName: true,
            email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
          },
          orderBy, skip, take: limit,
        }),
        prisma.user.count({ where }),
      ]);
    }

    return NextResponse.json({
      users,
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

    const body = await request.json();
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: firstValidationError(result.error, "اطلاعات نامعتبر") }, { status: 400 });
    }

    const { username, password, firstName, lastName, email, role } = result.data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "نام کاربری قبلاً استفاده شده است" }, { status: 400 });
    }

    // Email uniqueness is enforced here rather than with a database unique index:
    // in MongoDB a unique index on a nullable field would allow only one account
    // without an email.
    if (email) {
      const emailTaken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
      if (emailTaken) {
        return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 400 });
      }
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword, firstName, lastName, email: email || null, role },
      select: { id: true, username: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true },
    });

    if (role === "COUNSELOR") {
      await prisma.counselorProfile.create({ data: { userId: user.id } });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    await createAuditLog(auth.user.id, "CREATE_USER", { targetUserId: user.id, role }, ip);

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
