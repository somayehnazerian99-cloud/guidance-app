/**
 * Authentication coverage: the three role portals, the guards in front of each
 * panel, wrong credentials, cross-portal attempts and a real logout.
 */

import { test, expect } from "@playwright/test";
import { DEV_CREDENTIALS, clientIp, formAlert, loginAs, logout } from "./helpers.mjs";

test.use({ extraHTTPHeaders: clientIp(11) });

const FORBIDDEN_TEXT = "نام کاربری یا رمز عبور صحیح نیست";

test.describe("ورود و خروج سه نقش", () => {
  test("مسیرهای محافظت‌شده بدون ورود، به صفحه ورود همان نقش هدایت می‌شوند", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL((url) => url.pathname === "/login/admin");

    await page.goto("/counselor");
    await expect(page).toHaveURL((url) => url.pathname === "/login/counselor");

    await page.goto("/student/grades");
    await expect(page).toHaveURL((url) => url.pathname === "/login/student");
  });

  test("رمز عبور اشتباه، پیام فارسی نشان می‌دهد و ورود را باز نمی‌کند", async ({ page }) => {
    await page.goto("/login/student");
    await page.getByLabel("نام کاربری", { exact: true }).fill(DEV_CREDENTIALS.student.username);
    await page.getByLabel("رمز عبور", { exact: true }).fill("WrongPass123");
    await page.getByRole("button", { name: "ورود به پنل" }).click();

    await expect(formAlert(page)).toContainText(FORBIDDEN_TEXT);
    await expect(page).toHaveURL(/\/login\/student$/);
  });

  test("ورود مدیر از پنل مدیر انجام می‌شود", async ({ page }) => {
    await loginAs(page, "admin", DEV_CREDENTIALS.admin);

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.locator("header")).toContainText("مدیر سیستم");
  });

  test("ورود مشاور و مشاهده فهرست دانش‌آموزان خودش", async ({ page }) => {
    await loginAs(page, "counselor", DEV_CREDENTIALS.counselor);

    await expect(page.locator("header")).toContainText("مشاور");

    await page.goto("/counselor/students");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("محمد احمدی").first()).toBeVisible();
  });

  test("ورود دانش‌آموز و رد شدن دسترسی او به پنل مدیر", async ({ page }) => {
    await loginAs(page, "student", DEV_CREDENTIALS.student);
    await expect(page.locator("header")).toContainText("دانش‌آموز");

    // A student typing the admin URL is sent back to their own panel by the
    // server-side role guard, not merely hidden from a menu.
    await page.goto("/admin");
    await expect(page).toHaveURL((url) => url.pathname === "/student");

    await page.goto("/admin/users");
    await expect(page).toHaveURL((url) => url.pathname === "/student");
  });

  test("ورود از پنل اشتباه رد می‌شود", async ({ page }) => {
    // Student credentials submitted on the admin portal.
    await page.goto("/login/admin");
    await page.getByLabel("نام کاربری", { exact: true }).fill(DEV_CREDENTIALS.student.username);
    await page.getByLabel("رمز عبور", { exact: true }).fill(DEV_CREDENTIALS.student.password);
    await page.getByRole("button", { name: "ورود به پنل" }).click();

    await expect(formAlert(page)).toContainText(FORBIDDEN_TEXT);
    await expect(page).toHaveURL(/\/login\/admin$/);
  });

  test("کوکی نشست HttpOnly است و در جاوااسکریپت قابل خواندن نیست", async ({ page, context }) => {
    await loginAs(page, "student", DEV_CREDENTIALS.student);

    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "guidance-session");

    expect(session, "session cookie must exist after login").toBeTruthy();
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("Lax");

    const readableFromJs = await page.evaluate(() => document.cookie);
    expect(readableFromJs).not.toContain("guidance-session");
  });

  test("خروج، نشست را واقعاً بی‌اعتبار می‌کند", async ({ page }) => {
    await loginAs(page, "student", DEV_CREDENTIALS.student);
    await logout(page);

    // The panel is unreachable again, which means the session row was removed
    // rather than just the cookie being dropped in the browser.
    await page.goto("/student");
    await expect(page).toHaveURL(/\/login\/student$/);
  });

  test("پس از خروج، کوکی قدیمی دیگر پذیرفته نمی‌شود", async ({ page, context }) => {
    await loginAs(page, "counselor", DEV_CREDENTIALS.counselor);

    const before = (await context.cookies()).find(
      (cookie) => cookie.name === "guidance-session"
    );
    expect(before).toBeTruthy();

    await logout(page);

    // Replay the cookie that was valid a moment ago: the server has deleted the
    // session, so it must be rejected.
    await context.addCookies([before]);
    await page.goto("/counselor");
    await expect(page).toHaveURL(/\/login\/counselor$/);
  });
});
