import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest, createAuditLog, normalizeIp } from "@/lib/auth";
import { supportReplySchema, supportStatusSchema, firstValidationError } from "@/lib/validation";
import { TICKET_STATUS, canReplyToTicket, canChangeTicketStatus } from "@/lib/support";
import { toPublicTicket } from "@/lib/serializers";

const ticketSelect = {
  id: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  userId: true,
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
};

/**
 * Resolve a ticket the caller is allowed to see, or null.
 *
 * Ownership is the whole point: a student/counselor asking for someone else's
 * ticket id gets the same "not found" answer as a ticket that does not exist,
 * so the endpoint cannot be used to probe for valid ids.
 */
async function resolveTicketForViewer(id, viewer) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: ticketSelect,
  });

  if (!ticket) return { ticket: null, allowed: false };

  if (viewer.role === "ADMIN") return { ticket, allowed: true };

  return { ticket, allowed: ticket.userId === viewer.id };
}

export async function GET(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { ticket, allowed } = await resolveTicketForViewer(id, auth.user);

    if (!ticket || !allowed) {
      return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });
    }

    const replies = await prisma.supportReply.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        body: true,
        isStaff: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    return NextResponse.json({
      ticket: toPublicTicket(ticket, { viewerId: auth.user.id, viewerRole: auth.user.role }),
      replies,
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

/**
 * PATCH /api/support/tickets/[id]
 *
 * Body is either `{ body }` (a new message) or `{ status }` (admin only).
 * Staff replies and status changes result in an audit entry; ordinary messages
 * do not, so the trail stays readable.
 */
export async function PATCH(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const { ticket, allowed } = await resolveTicketForViewer(id, auth.user);
    if (!ticket || !allowed) {
      return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });
    }

    const isAdmin = auth.user.role === "ADMIN";
    const isOwner = ticket.userId === auth.user.id;
    const ip = normalizeIp(request);

    // --- Status change (administrator only) --------------------------------
    if (payload.status !== undefined) {
      if (!canChangeTicketStatus(auth.user.role)) {
        return NextResponse.json(
          { error: "تغییر وضعیت تیکت فقط توسط مدیر سیستم امکان‌پذیر است" },
          { status: 403 }
        );
      }

      const parsedStatus = supportStatusSchema.safeParse({ status: payload.status });
      if (!parsedStatus.success) {
        return NextResponse.json(
          { error: firstValidationError(parsedStatus.error, "وضعیت نامعتبر است") },
          { status: 400 }
        );
      }

      const status = parsedStatus.data.status;

      const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status,
          closedAt: status === TICKET_STATUS.CLOSED ? new Date() : null,
        },
        select: ticketSelect,
      });

      await createAuditLog(
        auth.user.id,
        "UPDATE_TICKET_STATUS",
        { subject: ticket.subject, status, targetUserId: ticket.userId },
        ip
      );

      return NextResponse.json({
        ticket: toPublicTicket(updated, { viewerId: auth.user.id, viewerRole: auth.user.role }),
      });
    }

    // --- New message -------------------------------------------------------
    const parsedReply = supportReplySchema.safeParse({ body: payload.body });
    if (!parsedReply.success) {
      return NextResponse.json(
        { error: firstValidationError(parsedReply.error, "متن پاسخ نامعتبر است") },
        { status: 400 }
      );
    }

    if (!canReplyToTicket(ticket, auth.user.role, isOwner)) {
      return NextResponse.json(
        { error: "این تیکت بسته شده است و امکان ارسال پیام جدید وجود ندارد" },
        { status: 403 }
      );
    }

    const reply = await prisma.supportReply.create({
      data: {
        ticketId: ticket.id,
        userId: auth.user.id,
        body: parsedReply.data.body,
        isStaff: isAdmin,
      },
      select: {
        id: true,
        body: true,
        isStaff: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    // A staff reply moves an untouched ticket into review; a user message
    // re-opens a ticket that is still being worked on but never un-closes one.
    const nextStatus =
      isAdmin && ticket.status === TICKET_STATUS.OPEN
        ? TICKET_STATUS.IN_PROGRESS
        : ticket.status;

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: nextStatus, updatedAt: new Date() },
      select: ticketSelect,
    });

    if (isAdmin) {
      await createAuditLog(
        auth.user.id,
        "REPLY_TICKET",
        { subject: ticket.subject, targetUserId: ticket.userId },
        ip
      );
    }

    return NextResponse.json({
      reply,
      ticket: toPublicTicket(updated, { viewerId: auth.user.id, viewerRole: auth.user.role }),
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

/**
 * DELETE /api/support/tickets/[id]
 *
 * Removing a ticket is an administrative action (spam, duplicates, test data).
 * Messages are removed with it, and the deletion is recorded in the audit trail.
 */
export async function DELETE(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "حذف تیکت فقط توسط مدیر سیستم امکان‌پذیر است" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, subject: true, userId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "تیکت یافت نشد" }, { status: 404 });
    }

    await prisma.supportReply.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.supportTicket.delete({ where: { id: ticket.id } });

    await createAuditLog(
      auth.user.id,
      "DELETE_TICKET",
      { subject: ticket.subject, targetUserId: ticket.userId },
      normalizeIp(request)
    );

    return NextResponse.json({ success: true, message: "تیکت حذف شد" });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
