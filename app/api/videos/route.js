import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where = {};
    if (auth.user.role === "STUDENT") {
      where.isActive = true;
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    if (category) where.category = category;

    const videos = await prisma.educationalVideo.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ videos });
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
    const { title, description, thumbnail, videoUrl, category, isActive } = body;

    if (!title || !videoUrl) {
      return NextResponse.json({ error: "عنوان و لینک ویدئو الزامی است" }, { status: 400 });
    }

    // URL validation
    try {
      const url = new URL(videoUrl);
      const validDomains = ["youtube.com", "youtu.be", "aparat.com"];
      if (!validDomains.some((d) => url.hostname.includes(d))) {
        return NextResponse.json(
          { error: "فقط لینک‌های YouTube و Aparat پشتیبانی می‌شوند" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "لینک ویدئو نامعتبر است" }, { status: 400 });
    }

    const video = await prisma.educationalVideo.create({
      data: {
        title,
        description: description || null,
        thumbnail: thumbnail || null,
        videoUrl,
        category: category || null,
        isActive: isActive !== false,
        createdBy: auth.user.id,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
