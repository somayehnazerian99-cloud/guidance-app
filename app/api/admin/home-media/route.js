import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { deleteCloudinaryAsset, isCloudinaryConfigured } from "@/lib/cloudinary";
import { logApiFailure, userMessageFor } from "@/lib/diagnostics";

const TYPES = ["IMAGE", "AUDIO", "VIDEO"];
const RESOURCE_TYPES = ["image", "video", "raw"];
const SCOPE = "admin/home-media";

/** Only the first line, and never the request body, reaches the log. */
function describeRequest(context) {
  return {
    type: context.type ?? null,
    resourceType: context.resourceType ?? null,
    mimeType: context.mimeType ?? null,
    bytes: Number.isFinite(context.bytes) ? context.bytes : null,
    // Length only — the value itself is an identifier, not a secret, but there
    // is no reason to store it in full.
    publicIdLength: typeof context.publicId === "string" ? context.publicId.length : 0,
  };
}

/**
 * Remove an asset that was uploaded to Cloudinary but could not be recorded in
 * the database, so a failed save never leaves an orphan behind.
 *
 * Safety: a row is looked up by `publicId` first. If anything already references
 * the asset (for example this POST is a retry of one that actually committed),
 * the asset is kept.
 */
async function cleanupOrphanedAsset(publicId, resourceType) {
  if (!publicId || !resourceType) return "skipped";

  if (!isCloudinaryConfigured()) {
    console.error(
      `[${SCOPE}] Orphaned asset left on Cloudinary: storage is not configured, so it cannot be cleaned up.`
    );
    return "not-configured";
  }

  let referenced = null;
  try {
    referenced = await prisma.homeMedia.findFirst({ where: { publicId }, select: { id: true } });
  } catch (error) {
    logApiFailure(`${SCOPE}:cleanup-lookup`, error, { publicIdLength: publicId.length });
    return "lookup-failed";
  }

  if (referenced) return "kept-referenced";

  try {
    await deleteCloudinaryAsset(publicId, resourceType);
    return "deleted";
  } catch (error) {
    logApiFailure(`${SCOPE}:cleanup-delete`, error, { publicIdLength: publicId.length, resourceType });
    return "delete-failed";
  }
}

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = await prisma.homeMedia.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    logApiFailure(`${SCOPE}:list`, error);
    return NextResponse.json({ error: userMessageFor(error) }, { status: 500 });
  }
}

export async function POST(request) {
  const context = { type: null, resourceType: null, mimeType: null, bytes: null, publicId: null };

  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, type, url, publicId, resourceType, mimeType, bytes } = body;

    Object.assign(context, { type, resourceType, mimeType, bytes, publicId });

    if (!title?.trim() || !url || !publicId || !RESOURCE_TYPES.includes(resourceType) || !TYPES.includes(type)) {
      logApiFailure(`${SCOPE}:validate`, new Error("incomplete media payload"), describeRequest(context));
      return NextResponse.json({ error: "اطلاعات فایل ناقص است" }, { status: 400 });
    }

    try {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.protocol !== "https:") {
        logApiFailure(`${SCOPE}:validate-url`, new Error("media url is not https"), describeRequest(context));
        return NextResponse.json({ error: "آدرس فایل معتبر نیست" }, { status: 400 });
      }
    } catch {
      logApiFailure(`${SCOPE}:validate-url`, new Error("media url is not a valid URL"), describeRequest(context));
      return NextResponse.json({ error: "آدرس فایل معتبر نیست" }, { status: 400 });
    }

    // A stale generated Prisma Client has no `homeMedia` delegate. Detect it here
    // so the log says so explicitly instead of a bare TypeError.
    if (typeof prisma.homeMedia?.create !== "function") {
      const stale = new TypeError("Cannot read properties of undefined (reading 'create')");
      logApiFailure(`${SCOPE}:create`, stale, describeRequest(context));
      return NextResponse.json({ error: userMessageFor(stale) }, { status: 503 });
    }

    const last = await prisma.homeMedia.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });

    // `createdBy` is an optional ObjectId reference. Sending a value that is not
    // a valid ObjectId (or a user id from another database) makes the insert
    // fail, so the reference is only written when it is provably usable.
    const creatorId =
      typeof auth.user.id === "string" && /^[a-f0-9]{24}$/i.test(auth.user.id) ? auth.user.id : null;

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
    const described = logApiFailure(`${SCOPE}:create`, error, describeRequest(context));

    // The browser has already uploaded the file straight to Cloudinary, so a
    // failed save must not leave the asset stranded there.
    const cleanup = await cleanupOrphanedAsset(context.publicId, context.resourceType);

    return NextResponse.json(
      { error: userMessageFor(error), cleanup, reference: described.code || described.name },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    logApiFailure(`${SCOPE}:update`, error);
    return NextResponse.json({ error: userMessageFor(error) }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "شناسه فایل الزامی است" }, { status: 400 });

    const item = await prisma.homeMedia.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "فایل پیدا نشد" }, { status: 404 });

    // A storage failure must not block removing the record: otherwise the item
    // stays visible on the homepage with no way to take it down from the panel.
    let storageRemoved = true;
    try {
      await deleteCloudinaryAsset(item.publicId, item.resourceType);
    } catch (error) {
      storageRemoved = false;
      logApiFailure(`${SCOPE}:delete-asset`, error, { resourceType: item.resourceType });
    }

    await prisma.homeMedia.delete({ where: { id } });

    return NextResponse.json({ success: true, storageRemoved });
  } catch (error) {
    logApiFailure(`${SCOPE}:delete`, error);
    return NextResponse.json({ error: userMessageFor(error) }, { status: 500 });
  }
}
