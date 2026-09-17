import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getCloudinaryConfig, isCloudinaryConfigured, signCloudinaryParams } from "@/lib/cloudinary";
import { logApiFailure } from "@/lib/diagnostics";

const SCOPE = "admin/home-media/sign";

const TYPES = {
  IMAGE: { resourceType: "image", folder: "guidance-app/homepage/images" },
  // Cloudinary serves audio as a `video` resource, so audio uploads are signed
  // with resourceType "video".
  AUDIO: { resourceType: "video", folder: "guidance-app/homepage/audio" },
  VIDEO: { resourceType: "video", folder: "guidance-app/homepage/videos" },
};

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth || auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { type } = await request.json();
    const config = TYPES[type];
    if (!config) return NextResponse.json({ error: "نوع فایل نامعتبر است" }, { status: 400 });

    if (!isCloudinaryConfigured()) {
      // Name the missing variables — they are configuration keys, not secrets.
      const missing = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
        (key) => !process.env[key]
      );
      console.error(`[${SCOPE}] Cloudinary is not configured. Missing: ${missing.join(", ") || "unknown"}`);
      return NextResponse.json(
        { error: "اتصال فضای ذخیره‌سازی فایل هنوز تنظیم نشده است.", configuration: false },
        { status: 503 }
      );
    }

    const { cloudName, apiKey } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: config.folder, timestamp };

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      folder: config.folder,
      resourceType: config.resourceType,
      signature: signCloudinaryParams(params),
    });
  } catch (error) {
    // The thrown message for a missing configuration is expected, not a bug.
    logApiFailure(`${SCOPE}:sign`, error, { cloudinaryConfigured: isCloudinaryConfigured() });
    const message =
      error?.message === "Cloudinary is not configured"
        ? "اتصال فضای ذخیره‌سازی فایل هنوز تنظیم نشده است."
        : "آماده‌سازی آپلود انجام نشد. لطفاً دوباره تلاش کنید.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
