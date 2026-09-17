import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getCloudinaryConfig, signCloudinaryParams } from "@/lib/cloudinary";

const TYPES = {
  IMAGE: { resourceType: "image", folder: "guidance-app/homepage/images" },
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
    const message = error?.message === "Cloudinary is not configured"
      ? "اتصال فضای ذخیره‌سازی فایل هنوز تنظیم نشده است."
      : "خطای داخلی سرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
