import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { notificationSchema } from "@/lib/validation";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (auth.user.role !== "STUDENT") {
      return NextResponse.json({ notifications: [] });
    }

    const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
    if (!profile) return NextResponse.json({ notifications: [] });

    const notifications = await prisma.notification.findMany({
      where: { studentId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const parsed = notificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "اطلاعات اعلان نامعتبر است" }, { status: 400 });
    }

    const { studentId, title, message, type } = parsed.data;

    // Only an admin, or the counselor the student is assigned to, may notify.
    if (auth.user.role === "ADMIN") {
      const exists = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json({ error: "دانش‌آموز یافت نشد" }, { status: 404 });
      }
    } else if (auth.user.role === "COUNSELOR") {
      const profile = await prisma.studentProfile.findUnique({ where: { id: studentId } });
      if (!profile || profile.counselorId !== auth.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notification = await prisma.notification.create({
      data: {
        studentId,
        title,
        message,
        type: type || "INFO",
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }

    const { notificationId } = body;

    if (typeof notificationId !== "string" || !notificationId) {
      return NextResponse.json({ error: "شناسه اعلان الزامی است" }, { status: 400 });
    }

    const profile = await prisma.studentProfile.findUnique({ where: { userId: auth.user.id } });
    if (!profile) return NextResponse.json({ error: "پروفایل یافت نشد" }, { status: 404 });

    await prisma.notification.updateMany({
      where: { id: notificationId, studentId: profile.id },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
