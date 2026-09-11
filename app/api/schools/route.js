import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const schools = await prisma.school.findMany({
      where: { isActive: true },
      include: { _count: { select: { students: true, classes: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ schools });
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
    const { name, city, province } = body;

    if (!name) {
      return NextResponse.json({ error: "نام مدرسه الزامی است" }, { status: 400 });
    }

    const school = await prisma.school.create({
      data: { name, city: city || null, province: province || null },
    });

    return NextResponse.json({ school }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
