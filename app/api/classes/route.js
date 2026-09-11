import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const classes = await prisma.class.findMany({
      include: {
        school: { select: { name: true } },
        counselor: { select: { firstName: true, lastName: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ classes });
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
    const { name, grade, schoolYear, schoolId, counselorId } = body;

    if (!name || !grade || !schoolYear || !schoolId) {
      return NextResponse.json({ error: "فیلدهای الزامی را پر کنید" }, { status: 400 });
    }

    const cls = await prisma.class.create({
      data: {
        name,
        grade: Number(grade),
        schoolYear,
        schoolId,
        counselorId: counselorId || null,
      },
      include: { school: { select: { name: true } } },
    });

    return NextResponse.json({ class: cls }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
