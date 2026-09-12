import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { auditLogQuerySchema, firstValidationError } from "@/lib/validation";
import { AUDIT_ACTIONS, toAuditLogEntry, listAuditActions } from "@/lib/audit-log";

/**
 * GET /api/audit-logs
 *
 * Administrator only. Returns paginated audit rows already rendered as Persian
 * sentences, so the UI never has to know how an action is worded. The raw
 * `details` column is deliberately not returned: it may contain internal
 * identifiers, and the presentation layer already extracted what matters.
 */
export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: firstValidationError(parsed.error, "پارامترهای نامعتبر") },
        { status: 400 }
      );
    }

    const { page, limit, action, search, from, to } = parsed.data;

    // Action names come from a known catalogue; anything else is ignored rather
    // than passed to the database.
    const safeAction = action && AUDIT_ACTIONS[action] ? action : undefined;

    const createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) createdAt.lte = toDate;
    }

    const baseWhere = {
      ...(safeAction ? { action: safeAction } : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    };

    const skip = (page - 1) * limit;

    let logs;
    let total;

    if (search) {
      // Search spans the action code, the stored details and the actor's name.
      // MongoDB `contains` is case-sensitive, so the name match is done in
      // memory exactly like the users endpoint does.
      const allLogs = await prisma.auditLog.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      });

      const needle = search.toLowerCase();
      const filtered = allLogs.filter((log) => {
        const haystack = [
          log.action,
          log.details,
          log.user?.firstName,
          log.user?.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });

      total = filtered.length;
      logs = filtered.slice(skip, skip + limit);
    } else {
      [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        }),
        prisma.auditLog.count({ where: baseWhere }),
      ]);
    }

    return NextResponse.json({
      logs: logs.map(toAuditLogEntry),
      actions: listAuditActions(),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
