/**
 * Self-service registration: students get in immediately, counselors wait for
 * an administrator, and nobody can sign themselves up as an administrator.
 */

import { test, expect } from "@playwright/test";
import {
  DEV_CREDENTIALS,
  clientIp,
  formAlert,
  loginAs,
  registerCounselor,
  registerStudent,
  uniquePassword,
  uniqueUsername,
} from "./helpers.mjs";

test.use({ extraHTTPHeaders: clientIp(21) });

test.describe("ثبت‌نام کاربران", () => {
  test("دانش‌آموز ثبت‌نام می‌کند و بلافاصله وارد پنل خودش می‌شود", async ({ page }) => {
    const account = {
      username: uniqueUsername("e2estudent"),
      password: uniquePassword(),
      firstName: "سارا",
      lastName: "آزمونی",
    };

    await registerStudent(page, account);

    await page.getByRole("link", { name: "ورود به پنل" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login/student");

    await loginAs(page, "student", account);
    await expect(page.locator("header")).toContainText("سارا آزمونی");
  });

  test("نام کاربری فقط حروف انگلیسی و اعداد را می‌پذیرد", async ({ page }) => {
    const account = {
      username: uniqueUsername("e2esanitize"),
      password: uniquePassword(),
    };

    await page.goto("/register/student");
    const usernameInput = page.getByLabel("نام کاربری", { exact: true });

    // A user typing Persian text, a space or an underscore keeps only the
    // allowed characters — and the server enforces the same rule on its own.
    await usernameInput.fill(`${account.username}_ !`);
    await expect(usernameInput).toHaveValue(account.username);

    await page.getByLabel("نام", { exact: true }).fill("نیما");
    await page.getByLabel("نام خانوادگی", { exact: true }).fill("پاکیزه");
    await page.getByLabel("رمز عبور", { exact: true }).fill(account.password);
    await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();

    await expect(page.getByText("ثبت‌نام با موفقیت انجام شد").first()).toBeVisible({
      timeout: 30_000,
    });

    // The sanitised username is what actually logs in.
    await loginAs(page, "student", account);
    await expect(page.locator("header")).toContainText("نیما پاکیزه");
  });

  test("رمز عبور ضعیف پذیرفته نمی‌شود", async ({ page }) => {
    await page.goto("/register/student");
    await page.getByLabel("نام", { exact: true }).fill("رضا");
    await page.getByLabel("نام خانوادگی", { exact: true }).fill("ضعیف");
    await page.getByLabel("نام کاربری", { exact: true }).fill(uniqueUsername("e2eweak"));
    await page.getByLabel("رمز عبور", { exact: true }).fill("password");
    await page.getByLabel("تکرار رمز عبور", { exact: true }).fill("password");
    await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();

    // Stays on the form, shows the policy error and creates nothing.
    await expect(page.locator("p.text-destructive").first()).toContainText("رمز عبور");
    await expect(page.getByText("ثبت‌نام با موفقیت انجام شد")).toHaveCount(0);
    await expect(page).toHaveURL(/\/register\/student$/);
  });

  test("ثبت‌نام با نام کاربری تکراری رد می‌شود", async ({ page, request }) => {
    const username = uniqueUsername("e2etaken");

    // Occupy the name first. The username field strips anything outside
    // [a-zA-Z0-9], so the duplicate has to be an alphanumeric name — the seeded
    // `student_1001` could never be typed into this form.
    const seed = await request.post("/api/auth/register", {
      data: {
        role: "STUDENT",
        firstName: "صاحب",
        lastName: "اول",
        username,
        password: uniquePassword(),
      },
    });
    expect(seed.status()).toBe(201);

    await page.goto("/register/student");
    await page.getByLabel("نام", { exact: true }).fill("دوم");
    await page.getByLabel("نام خانوادگی", { exact: true }).fill("تکراری");
    await page.getByLabel("نام کاربری", { exact: true }).fill(username);

    const password = uniquePassword();
    await page.getByLabel("رمز عبور", { exact: true }).fill(password);
    await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();

    await expect(formAlert(page)).toContainText("این نام کاربری قبلاً استفاده شده است");
    await expect(page).toHaveURL((url) => url.pathname === "/register/student");
  });

  test("ثبت‌نام مدیر از طریق API ممکن نیست", async ({ request }) => {
    const response = await request.post("/api/auth/register", {
      data: {
        role: "ADMIN",
        firstName: "نفوذی",
        lastName: "آزمون",
        username: uniqueUsername("e2eadmin"),
        password: uniquePassword(),
      },
    });

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBeTruthy();
    expect(payload.success).toBeUndefined();
    expect(payload.user).toBeUndefined();
  });

  test("صفحه ثبت‌نام مدیر وجود ندارد", async ({ page }) => {
    const response = await page.goto("/register/admin");
    expect(response?.status()).toBe(404);
  });

  test("مشاور تا تأیید مدیر نمی‌تواند وارد شود و بعد از تأیید وارد می‌شود", async ({
    page,
    browser,
  }) => {
    const account = {
      username: uniqueUsername("e2ecounselor"),
      password: uniquePassword(),
      firstName: "مریم",
      lastName: "تازه‌وارد",
    };

    await registerCounselor(page, account);
    await expect(
      page.getByText("حساب شما در وضعیت «در انتظار تأیید مدیر» است")
    ).toBeVisible();

    // --- Before approval ---------------------------------------------------
    await page.goto("/login/counselor");
    await page.getByLabel("نام کاربری", { exact: true }).fill(account.username);
    await page.getByLabel("رمز عبور", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "ورود به پنل" }).click();

    await expect(formAlert(page)).toContainText("در انتظار تأیید مدیر سیستم");
    await expect(page).toHaveURL((url) => url.pathname === "/login/counselor");

    // The panel stays closed while the account is pending.
    await page.goto("/counselor");
    await expect(page).toHaveURL((url) => url.pathname === "/login/counselor");

    // --- Administrator approves -------------------------------------------
    const adminContext = await browser.newContext({
      extraHTTPHeaders: clientIp(22),
      locale: "fa-IR",
    });
    const adminPage = await adminContext.newPage();

    try {
      await loginAs(adminPage, "admin", DEV_CREDENTIALS.admin);
      await adminPage.goto("/admin/counselors");

      // The same counselor also appears in the full list below the queue, so
      // the first matching row is the one in the approval queue.
      const pendingRow = adminPage
        .getByRole("row")
        .filter({ hasText: account.username })
        .first();
      await expect(pendingRow).toBeVisible({ timeout: 30_000 });
      await pendingRow.getByRole("button", { name: "تأیید", exact: true }).click();

      await adminPage.getByRole("button", { name: "تأیید نهایی" }).click();
      await expect(adminPage.getByText("مشاور تأیید شد")).toBeVisible({ timeout: 30_000 });
    } finally {
      await adminContext.close();
    }

    // --- After approval ----------------------------------------------------
    await loginAs(page, "counselor", account);
    await expect(page.locator("header")).toContainText("مریم تازه‌وارد");
  });
});
