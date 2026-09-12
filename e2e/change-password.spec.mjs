/**
 * Changing a password from the settings page: policy and current-password
 * checks, the successful change, and the two security consequences — other
 * devices lose their session and the old password stops working.
 *
 * A freshly registered student is used so the seeded development accounts keep
 * their documented passwords for the rest of the suite.
 */

import { test, expect } from "@playwright/test";
import {
  DEV_CREDENTIALS,
  clientIp,
  formAlert,
  loginAs,
  logout,
  registerStudent,
  uniquePassword,
  uniqueUsername,
} from "./helpers.mjs";

test.use({ extraHTTPHeaders: clientIp(41) });

const account = {
  username: uniqueUsername("e2epassword"),
  password: uniquePassword(),
  firstName: "پویا",
  lastName: "رمزدار",
};

const NEW_PASSWORD = uniquePassword();

async function openSettings(page) {
  await page.goto("/student/settings");
  await expect(page.getByRole("heading", { name: "تنظیمات", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function fillChangeForm(page, { current, next, confirm }) {
  // `exact` matters here: "رمز عبور جدید" is a substring of the confirmation
  // field's label, and an inexact match would be ambiguous.
  await page.getByLabel("رمز عبور فعلی", { exact: true }).fill(current);
  await page.getByLabel("رمز عبور جدید", { exact: true }).fill(next);
  await page.getByLabel("تکرار رمز عبور جدید", { exact: true }).fill(confirm);
  await page.getByRole("button", { name: "ذخیره رمز عبور جدید" }).click();
}

test.describe.serial("تغییر رمز عبور", () => {
  test("ثبت‌نام دانش‌آموز آزمایشی برای این سناریو", async ({ page }) => {
    await registerStudent(page, account);
    await loginAs(page, "student", account);
  });

  test("رمز فعلی اشتباه، تکرار ناهمخوان و رمز ضعیف رد می‌شوند", async ({ page }) => {
    await loginAs(page, "student", account);
    await openSettings(page);

    // A weak new password never reaches the server.
    await fillChangeForm(page, {
      current: account.password,
      next: "weakpass",
      confirm: "weakpass",
    });
    await expect(page.getByText(/رمز عبور باید حداقل یک حرف بزرگ/)).toBeVisible();

    // Mismatched confirmation is caught before sending too.
    await fillChangeForm(page, {
      current: account.password,
      next: NEW_PASSWORD,
      confirm: `${NEW_PASSWORD}x`,
    });
    await expect(page.getByText("تکرار رمز عبور جدید مطابقت ندارد")).toBeVisible();

    // A wrong current password is rejected by the server.
    await fillChangeForm(page, {
      current: "WrongCurrent123",
      next: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    });
    await expect(page.getByText("رمز عبور فعلی صحیح نیست")).toBeVisible({ timeout: 30_000 });
  });

  test("تغییر رمز انجام می‌شود و نشست دستگاه دیگر باطل می‌شود", async ({ page, browser }) => {
    // A second device signed in with the current password, before the change.
    const otherContext = await browser.newContext({
      extraHTTPHeaders: clientIp(42),
      locale: "fa-IR",
    });

    try {
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, "student", account);

      await loginAs(page, "student", account);
      await openSettings(page);

      await fillChangeForm(page, {
        current: account.password,
        next: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      });
      await expect(page.getByText("رمز عبور تغییر کرد")).toBeVisible({ timeout: 30_000 });

      // The tab that changed the password keeps working.
      await page.goto("/student");
      await expect(page).toHaveURL((url) => url.pathname === "/student");

      // The other device is signed out, because its session row was removed.
      await otherPage.goto("/student");
      await expect(otherPage).toHaveURL((url) => url.pathname === "/login/student");
    } finally {
      await otherContext.close();
    }
  });

  test("ورود با رمز جدید کار می‌کند و رمز قدیمی دیگر کار نمی‌کند", async ({ page }) => {
    await loginAs(page, "student", { username: account.username, password: NEW_PASSWORD });
    await expect(page.locator("header")).toContainText("پویا رمزدار");

    await logout(page);

    await page.goto("/login/student");
    await page.getByLabel("نام کاربری", { exact: true }).fill(account.username);
    await page.getByLabel("رمز عبور", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "ورود به پنل" }).click();

    await expect(formAlert(page)).toContainText("نام کاربری یا رمز عبور صحیح نیست");
    await expect(page).toHaveURL((url) => url.pathname === "/login/student");
  });

  test("ثبت‌نام‌های قبلی دست‌نخورده مانده‌اند", async ({ page }) => {
    // The seeded accounts still work, which proves the suite did not damage the
    // shared development data by changing a password.
    await loginAs(page, "student", DEV_CREDENTIALS.student);
    await expect(page.locator("header")).toContainText("دانش‌آموز");
  });
});
