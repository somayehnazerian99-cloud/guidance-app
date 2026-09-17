import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { describeError, isMissingPrismaDelegate } from "@/lib/diagnostics";

const SCOPE = "admin/diagnostics";

/** Every Prisma model this feature depends on, so a stale client is obvious. */
const PRISMA_MODELS = [
  "user",
  "session",
  "homeMedia",
  "educationalVideo",
  "auditLog",
  "supportTicket",
  "counselorProfile",
  "studentProfile",
];

/**
 * Admin-only readiness report.
 *
 * Returns booleans and counters only. It never echoes an environment value, a
 * connection string, a session token or a Cloudinary signature — so it is safe
 * to open in a browser and to paste into a bug report.
 *
 *   GET /api/admin/diagnostics          → configuration + read checks
 *   GET /api/admin/diagnostics?probe=1  → also performs a write/read/delete
 *                                         round trip on HomeMedia
 */
export async function GET(request) {
  const checks = [];
  const record = (key, ok, label, detail = null) => checks.push({ key, ok: Boolean(ok), label, detail });

  // ------------------------------------------------------------- authentication
  let auth = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    record("authentication", false, "احراز هویت", describeError(error).code || describeError(error).name);
  }

  const authenticated = Boolean(auth?.user);
  const isAdmin = auth?.user?.role === "ADMIN";

  record("authenticated", authenticated, "نشست معتبر", null);
  record("role", isAdmin, "نقش مدیر", auth?.user?.role ?? null);

  if (!authenticated || !isAdmin) {
    // Do not reveal configuration state to a non-admin caller.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---------------------------------------------------------------- environment
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const authConfigured = Boolean(process.env.AUTH_SECRET);
  const cloudinaryConfigured = isCloudinaryConfigured();

  record("databaseConfigured", databaseConfigured, "DATABASE_URL تنظیم شده", null);
  record("authConfigured", authConfigured, "AUTH_SECRET تنظیم شده", null);
  record("cloudinaryConfigured", cloudinaryConfigured, "Cloudinary تنظیم شده", null);
  record("appUrlConfigured", Boolean(process.env.NEXT_PUBLIC_APP_URL), "NEXT_PUBLIC_APP_URL تنظیم شده", null);

  // ------------------------------------------------------- generated data client
  const missingModels = PRISMA_MODELS.filter((model) => !prisma[model] || typeof prisma[model].findMany !== "function");
  record(
    "prismaClient",
    missingModels.length === 0,
    "کلاینت Prisma کامل است",
    missingModels.length === 0 ? `${PRISMA_MODELS.length} مدل` : `مدل‌های غایب: ${missingModels.join(", ")}`
  );

  // ------------------------------------------------------------------ read checks
  const counts = {};
  if (missingModels.length === 0) {
    for (const model of ["user", "homeMedia", "educationalVideo", "auditLog"]) {
      try {
        counts[model] = await prisma[model].count();
        record(`count:${model}`, true, `خواندن ${model}`, String(counts[model]));
      } catch (error) {
        const described = describeError(error);
        record(`count:${model}`, false, `خواندن ${model}`, described.code || described.name);
      }
    }
  }

  // ----------------------------------------------------------------- write probe
  const wantsProbe = new URL(request.url).searchParams.get("probe") === "1";
  let probe = null;

  if (wantsProbe && missingModels.length === 0) {
    probe = { attempted: true, created: false, readBack: false, cleanedUp: false };
    let probeId = null;
    try {
      const created = await prisma.homeMedia.create({
        data: {
          title: "__diagnostics_probe__",
          type: "IMAGE",
          url: "https://res.cloudinary.com/diagnostics/image/upload/probe.png",
          publicId: "diagnostics/probe",
          resourceType: "image",
          sortOrder: -1,
          isActive: false,
        },
      });
      probeId = created.id;
      probe.created = true;

      const readBack = await prisma.homeMedia.findUnique({ where: { id: probeId }, select: { id: true } });
      probe.readBack = Boolean(readBack);
    } catch (error) {
      const described = describeError(error);
      probe.error = { name: described.name, code: described.code, message: described.message };
      if (isMissingPrismaDelegate(error)) probe.error.staleClient = true;
    } finally {
      if (probeId) {
        try {
          await prisma.homeMedia.delete({ where: { id: probeId } });
          probe.cleanedUp = true;
        } catch (error) {
          const described = describeError(error);
          probe.cleanupError = { name: described.name, code: described.code, message: described.message };
        }
      }
    }
  }

  record(
    "writeProbe",
    probe ? Boolean(probe.created && probe.readBack && probe.cleanedUp) : true,
    wantsProbe ? "تست نوشتن و خواندن" : "تست نوشتن (غیرفعال — با ?probe=1 اجرا کنید)",
    probe ? (probe.created && probe.readBack && probe.cleanedUp ? "موفق" : "ناموفق") : "اجرا نشد"
  );

  const ok = checks.every((check) => check.ok);

  return NextResponse.json({
    ok,
    checkedAt: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      // Only the deployment marker, never the URL or commit contents.
      netlify: Boolean(process.env.NETLIFY),
    },
    summary: {
      databaseConfigured,
      authConfigured,
      cloudinaryConfigured,
      authenticated,
      role: auth.user.role,
      prismaClientComplete: missingModels.length === 0,
    },
    counts,
    probe,
    checks,
  });
}

/** Keep this route dynamic; it must never be cached or prerendered. */
export const dynamic = "force-dynamic";
