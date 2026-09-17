import crypto from "crypto";

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  return { cloudName, apiKey, apiSecret };
}

export function signCloudinaryParams(params) {
  const { apiSecret } = getCloudinaryConfig();
  const serialized = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}

export async function deleteCloudinaryAsset(publicId, resourceType = "image") {
  const { cloudName, apiKey } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinaryParams({ public_id: publicId, timestamp });
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cloudinary delete failed (${response.status} ${payload?.error?.message || "unknown"})`);
  }

  // "not found" means the asset is already gone, which is the desired end state.
  if (payload?.result === "not found") return { ...payload, alreadyMissing: true };

  return payload;
}
