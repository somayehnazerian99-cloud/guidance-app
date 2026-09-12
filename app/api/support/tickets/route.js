import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateRequest,
  createAuditLog,
  normalizeIp,
  checkRateLimit,
} from "@/lib/auth";
import { supportTicketSchema, firstValidationError } from "@/lib/validation";
import { TICKET_STATUS } from "@/lib/support";

// A user may open 5 tickets per 15 minutes; enough for a real problem, useless
// for flooding the admin queue.
const TICKET_WINDOW_MS = 15 * 60 * 1000;
const TICKET_MAX_PER_USER = 5;

const listSelect = {
  id: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
  _count: { select: { replies: true } },
};

/**
 * GET /api/support/tickets
 *
 * A student or counselor only ever sees their own tickets; an administrator
 * sees the whole queue. Ownership is taken from the session, never from a query
 * parameter, so there is no id to tamper with.
 */
export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const allowedStatuses = Object.values(TICKET_STATUS);
    const statusFilter = status && allowedStatuses.includes(status) ? status : undefined;

    const isAdmin = auth.user.role === "ADMIN";

    const tickets = await prisma.supportTicket.findMany({
      where: {
        ...(isAdmin ? {} : { userId: auth.user.id }),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
      select: listSelect,
    });

    return NextResponse.json({
      tickets,
      canManage: isAdmin,
      // The admin queue is the only place a status filter is meaningful.
      statusFilter: statusFilter || null,
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

/**
 * POST /api/support/tickets
 *
 * Any signed-in user can open a ticket. The first message is stored as the
 * ticket body via an initial reply so the thread view has a uniform shape.
 */
export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Administrators have the review tools instead of opening tickets.
    if (auth.user.role === "ADMIN") {
      return NextResponse.json(
        { error: "مدیر سیستم می‌تواند به تیکت‌ها پاسخ دهد، اما تیکت جدید ثبت نمی‌کند" },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = supportTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "اطلاعات تیکت نامعتبر است") },
        { status: 400 }
      );
    }

    // Per-user throttle, reusing the shared in-memory limiter.
    const limit = checkRateLimit(
      `ticket:${auth.user.id}`,
      TICKET_MAX_PER_USER,
      TICKET_WINDOW_MS
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "تعداد تیکت‌های ثبت‌شده بیش از حد مجاز است. لطفاً بعداً تلاش کنید." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { subject, body: message, category, priority } = parsed.data;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: auth.user.id,
        subject,
        category,
        priority,
        status: TICKET_STATUS.OPEN,
        replies: {
          create: {
            userId: auth.user.id,
            body: message,
            isStaff: false,
          },
        },
      },
      select: listSelect,
    });

    await createAuditLog(
      auth.user.id,
      "CREATE_TICKET",
      { subject, category, priority, targetUserId: auth.user.id },
      normalizeIp(request)
    );

    return NextResponse.json({ ticket }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
