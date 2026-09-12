/**
 * Shared helpers for the end-to-end specs.
 *
 * Everything here mirrors what a real user does: fill the visible form, click
 * the visible button, and wait for the URL the app is supposed to reach. No
 * test pokes at internal state or calls the API when a form exists for it,
 * because the point of these specs is to cover the browser path.
 */

import { expect } from "@playwright/test";

/** Unique per `npm run test:e2e` run, so repeated runs never collide. */
export const RUN_ID = (process.env.E2E_RUN_ID || Date.now().toString(36)).slice(0, 8);

/**
 * Rate limits are keyed on the first `x-forwarded-for` value, which is what a
 * reverse proxy sets in production. Giving each browser context its own
 * documentation-range address (RFC 5737) keeps the specs independent of each
 * other instead of sharing one localhost bucket — and it deliberately leaves
 * the limiter itself switched on, so the limits stay under test.
 */
export function clientIp(lastOctet) {
  return { "x-forwarded-for": `198.51.100.${lastOctet}` };
}

/** Development seed accounts (see README → Development credentials). */
export const DEV_CREDENTIALS = {
  admin: {
    username: process.env.E2E_ADMIN_USER || "admin",
    password: process.env.E2E_ADMIN_PASSWORD || "Admin@12345",
  },
  counselor: {
    username: process.env.E2E_COUNSELOR_USER || "counselor",
    password: process.env.E2E_COUNSELOR_PASSWORD || "Counselor@12345",
  },
  student: {
    username: process.env.E2E_STUDENT_USER || "student_1001",
    password: process.env.E2E_STUDENT_PASSWORD || "Student@12345",
  },
  /** Second seeded student, used to prove one student cannot read another's data. */
  otherStudent: {
    username: process.env.E2E_OTHER_STUDENT_USER || "student_1002",
    password: process.env.E2E_OTHER_STUDENT_PASSWORD || "Student@12345",
  },
};

/** Registration only accepts English letters and digits, 4–30 characters. */
export function uniqueUsername(prefix) {
  return `${prefix}${RUN_ID}${Math.floor(Math.random() * 900 + 100)}`.replace(/[^a-zA-Z0-9]/g, "");
}

/** Satisfies the shared password policy: 8+ chars, upper, lower and a digit. */
export function uniquePassword() {
  return `E2e${RUN_ID}Pass${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * Sign in through a role's login page and wait until the matching panel is up.
 *
 * @param {import("@playwright/test").Page} page
 * @param {"admin"|"counselor"|"student"} role
 * @param {{username: string, password: string}} credentials
 */
export async function loginAs(page, role, credentials) {
  await page.goto(`/login/${role}`);
  await page.getByLabel("نام کاربری", { exact: true }).fill(credentials.username);
  await page.getByLabel("رمز عبور", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "ورود به پنل" }).click();

  // The path must be exactly the panel: a plain `/${role}$` pattern would also
  // match `/login/${role}`, and would then report success before the session
  // cookie has even been set.
  await page.waitForURL((url) => url.pathname === `/${role}`, { timeout: 30_000 });

  // The panel shell is rendered by the server from the new session, so seeing
  // the header proves the cookie was accepted and not only that the URL moved.
  await expect(page.locator("header")).toBeVisible();
}

/**
 * The form-level error box.
 *
 * `getByRole("alert")` alone is ambiguous: Next.js renders its own
 * `#__next-route-announcer__` with `role="alert"` on every navigation, which
 * collides with the app's message boxes in strict mode.
 *
 * @param {import("@playwright/test").Page} page
 */
export function formAlert(page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/**
 * Open the account menu and sign out, landing back on the public home page.
 *
 * @param {import("@playwright/test").Page} page
 */
export async function logout(page) {
  await page.locator("header").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "خروج" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
}

/**
 * Submit the student sign-up form and wait for the success screen.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{username: string, password: string, firstName?: string, lastName?: string}} account
 */
export async function registerStudent(page, account) {
  await page.goto("/register/student");
  await page.getByLabel("نام", { exact: true }).fill(account.firstName || "آزمون");
  await page.getByLabel("نام خانوادگی", { exact: true }).fill(account.lastName || "دانش‌آموز");
  await page.getByLabel("نام کاربری", { exact: true }).fill(account.username);
  await page.getByLabel("رمز عبور", { exact: true }).fill(account.password);
  await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();
  await expect(page.getByText("ثبت‌نام با موفقیت انجام شد").first()).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Submit the counselor sign-up form and wait for the "pending approval" screen.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{username: string, password: string, firstName?: string, lastName?: string}} account
 */
export async function registerCounselor(page, account) {
  await page.goto("/register/counselor");
  await page.getByLabel("نام", { exact: true }).fill(account.firstName || "آزمون");
  await page.getByLabel("نام خانوادگی", { exact: true }).fill(account.lastName || "مشاور");
  await page.getByLabel("نام کاربری", { exact: true }).fill(account.username);
  await page.getByLabel("رمز عبور", { exact: true }).fill(account.password);
  await page.getByLabel("تکرار رمز عبور", { exact: true }).fill(account.password);
  await page
    .getByLabel("حوزه تخصص", { exact: false })
    .fill(account.expertise || "مشاوره تحصیلی پایه نهم");
  await page.getByRole("button", { name: "ارسال درخواست ثبت‌نام" }).click();
  await expect(page.getByText("ثبت‌نام شما ثبت شد").first()).toBeVisible({ timeout: 30_000 });
}
