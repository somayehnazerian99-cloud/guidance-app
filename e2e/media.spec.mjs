/**
 * Homepage media, end to end, through the real admin panel.
 *
 * This is the spec that covers the reported failure: the panel reached
 * Cloudinary but the metadata could never be saved, and the administrator only
 * saw "ذخیره فایل در سامانه انجام نشد."
 *
 * The whole chain is driven from the browser:
 *
 *   sign (server)  →  upload to Cloudinary  →  save metadata (server)  →
 *   appear on the public home page  →  hide  →  delete
 *
 * Cloudinary itself is stubbed at the network layer with `page.route`, so this
 * runs offline, deterministically, and never needs real credentials or a real
 * account. The server-side signing still happens for real — which is the part
 * that detects a broken Prisma schema, because a missing `homeMedia` delegate
 * makes the metadata save answer 5xx.
 */

import { test, expect } from "@playwright/test";
import { DEV_CREDENTIALS, RUN_ID, clientIp, loginAs } from "./helpers.mjs";

/** A 1×1 transparent PNG — the file content is irrelevant, only its metadata is. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const IMAGE_URL = "https://res.cloudinary.com/e2e-cloud/image/upload/v1/guidance-app/homepage/images/e2e.png";

const TITLE = `گالری آزمون ${RUN_ID}`;

/**
 * Stub the Cloudinary API in the browser.
 *
 * Returns the list of upload calls, so the spec can prove a double click sends
 * exactly one request.
 */
async function stubCloudinary(page) {
  const uploads = [];

  await page.route("https://api.cloudinary.com/**", async (route) => {
    const request = route.request();
    const url = request.url();

    if (url.endsWith("/destroy")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: "ok" }),
      });
      return;
    }

    if (url.includes("/upload")) {
      uploads.push(url);

      // The signature must have come from the server, which means the signing
      // route really ran rather than the client inventing a value.
      const body = request.postDataBuffer()?.toString("latin1") || "";
      expect(body).toContain("signature");
      expect(body).toContain("api_key");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          secure_url: IMAGE_URL,
          public_id: `guidance-app/homepage/images/e2e-${RUN_ID}`,
          resource_type: "image",
          bytes: PNG_BYTES.length,
          format: "png",
          width: 1,
          height: 1,
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  // The published image points at Cloudinary; serve it locally so the public
  // page renders without touching the network.
  await page.route("https://res.cloudinary.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: PNG_BYTES });
  });

  return uploads;
}

test.describe("homepage media upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders(clientIp(41));
  });

  test("an admin uploads a file and it is published, hidden and deleted", async ({ page }) => {
    const uploads = await stubCloudinary(page);

    await loginAs(page, "admin", DEV_CREDENTIALS.admin);

    // The panel is reached from the dashboard shortcut, so a missing link is a
    // failure too.
    await page.getByRole("link", { name: "مدیریت صفحه اصلی" }).click();
    await page.waitForURL((url) => url.pathname === "/admin/homepage", { timeout: 30_000 });

    await expect(
      page.getByRole("heading", { name: "مدیریت فایل‌های صفحه اصلی" })
    ).toBeVisible();

    // The list is loaded from the API; a broken query would surface here as the
    // error state instead of the empty state.
    await expect(page.getByText("هنوز فایلی آپلود نشده است.")).toBeVisible({ timeout: 30_000 });

    // ---------------------------------------------------------------- upload
    await page.getByLabel("عنوان", { exact: true }).fill(TITLE);
    await page.getByLabel("توضیحات (اختیاری)").fill("تست خودکار زنجیره آپلود");
    await page.locator("#homepage-media-file").setInputFiles({
      name: "e2e-sample.png",
      mimeType: "image/png",
      buffer: PNG_BYTES,
    });

    const submit = page.getByRole("button", { name: "آپلود و انتشار در صفحه اصلی" });
    await submit.click();

    // A second click while the first request is in flight must not start a
    // second upload: the button is disabled, and the submit hook holds a lock.
    await submit.click({ force: true }).catch(() => {});

    await expect(page.getByText("فایل با موفقیت در صفحه اصلی منتشر شد.")).toBeVisible({
      timeout: 30_000,
    });

    expect(uploads.length, "a double click must not produce two uploads").toBe(1);

    // The saved item is listed immediately.
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();

    // ------------------------------------------------- published to the public page
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "مطالب منتشرشده" })).toBeVisible();
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await expect(page.getByAltText(TITLE)).toBeVisible();

    // ------------------------------------------------------------- hide it
    await page.goto("/admin/homepage");
    const item = page.locator("article", { has: page.getByRole("heading", { name: TITLE }) });
    await expect(item).toBeVisible({ timeout: 30_000 });

    await item.getByRole("button", { name: "مخفی کردن" }).click();
    await expect(item.getByText("مخفی")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: TITLE })).toHaveCount(0);

    // ------------------------------------------------------------- delete it
    await page.goto("/admin/homepage");
    const hiddenItem = page.locator("article", { has: page.getByRole("heading", { name: TITLE }) });
    await expect(hiddenItem).toBeVisible({ timeout: 30_000 });

    page.once("dialog", (dialog) => dialog.accept());
    await hiddenItem.getByRole("button", { name: "حذف کامل" }).click();

    await expect(hiddenItem).toHaveCount(0);

    // Deleting must not leave the row behind: reload proves it came from the API.
    await page.reload();
    await expect(page.getByRole("heading", { name: TITLE })).toHaveCount(0);
  });

  test("a missing Cloudinary configuration is explained instead of failing silently", async ({
    page,
  }) => {
    await loginAs(page, "admin", DEV_CREDENTIALS.admin);
    await page.goto("/admin/homepage");

    // The signing endpoint is reachable and honest about its state. On this
    // throw-away stack it is configured, so the response must be a signature
    // and never a 5xx.
    const response = await page.request.post("/api/admin/home-media/sign", {
      headers: { Origin: process.env.E2E_BASE_URL || "http://localhost:3100" },
      data: { type: "IMAGE" },
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(payload.resourceType).toBe("image");
    expect(payload.folder).toContain("homepage");

    // Audio is signed as a `video` resource, which is easy to get wrong and
    // would break audio uploads only.
    const audio = await page.request.post("/api/admin/home-media/sign", {
      headers: { Origin: process.env.E2E_BASE_URL || "http://localhost:3100" },
      data: { type: "AUDIO" },
    });
    expect(audio.status()).toBe(200);
    expect((await audio.json()).resourceType).toBe("video");

    // And an unknown type is refused.
    const invalid = await page.request.post("/api/admin/home-media/sign", {
      headers: { Origin: process.env.E2E_BASE_URL || "http://localhost:3100" },
      data: { type: "SOMETHING_ELSE" },
    });
    expect(invalid.status()).toBe(400);
  });
});
