import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const items = await prisma.educationalVideo.findMany({
      where: { isActive: true, category: "HOMEPAGE" },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ items });
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
    const { title, description, type = "LINK", url, thumbnail } = body;

    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "عنوان و آدرس محتوا الزامی است" }, { status: 400 });
    }
    if (!["LINK", "IMAGE", "VIDEO"].includes(type)) {
      return NextResponse.json({ error: "نوع محتوا نامعتبر است" }, { status: 400 });
    }
    if (!validUrl(url.trim()) || (thumbnail?.trim() && !validUrl(thumbnail.trim()))) {
      return NextResponse.json({ error: "آدرس محتوا یا تصویر معتبر نیست" }, { status: 400 });
    }

    const item = await prisma.educationalVideo.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        thumbnail: thumbnail?.trim() || (type === "IMAGE" ? url.trim() : null),
        videoUrl: url.trim(),
        category: "HOMEPAGE",
        isActive: true,
        createdBy: auth.user.id,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "شناسه محتوا الزامی است" }, { status: 400 });

    await prisma.educationalVideo.updateMany({
      where: { id, category: "HOMEPAGE" },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
