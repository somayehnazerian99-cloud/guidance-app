import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";

const TYPES = ["IMAGE", "AUDIO", "VIDEO"];

export async function GET(request) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.homeMedia.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ items });
}

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, type, url, publicId, resourceType, mimeType, bytes } = body;

    if (!title?.trim() || !url || !publicId || !resourceType || !TYPES.includes(type)) {
      return NextResponse.json({ error: "اطلاعات فایل ناقص است" }, { status: 400 });
    }

    const last = await prisma.homeMedia.findFirst({ orderBy: { sortOrder: "desc" } });
    const creatorId = typeof auth.user.id === "string" && /^[a-f0-9]{24}$/i.test(auth.user.id)
      ? auth.user.id
      : null;

    const item = await prisma.homeMedia.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        type,
        url,
        publicId,
        resourceType,
        mimeType: mimeType || null,
        bytes: Number.isFinite(bytes) ? Math.max(0, Math.round(bytes)) : null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        ...(creatorId ? { createdBy: creatorId } : {}),
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[home-media] Failed to save uploaded media:", error);
    return NextResponse.json({ error: "ذخیره فایل در سامانه انجام نشد." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, title, description, isActive, sortOrder } = body;
    if (!id) return NextResponse.json({ error: "شناسه فایل الزامی است" }, { status: 400 });

    const item = await prisma.homeMedia.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined && Number.isFinite(Number(sortOrder)) ? { sortOrder: Number(sortOrder) } : {}),
      },
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[home-media] Failed to update media:", error);
    return NextResponse.json({ error: "ویرایش فایل انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "شناسه فایل الزامی است" }, { status: 400 });

    const item = await prisma.homeMedia.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });

    await deleteCloudinaryAsset(item.publicId, item.resourceType);
    await prisma.homeMedia.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[home-media] Failed to delete media:", error);
    return NextResponse.json({ error: "حذف فایل انجام نشد. اتصال فضای ذخیره‌سازی را بررسی کنید." }, { status: 500 });
  }
}
