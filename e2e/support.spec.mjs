/**
 * Support tickets end to end: a student opens a ticket, the administrator sees
 * it in the queue, replies, moves it through the statuses, and another student
 * cannot reach the thread at all.
 */

import { test, expect } from "@playwright/test";
import { DEV_CREDENTIALS, RUN_ID, clientIp, loginAs } from "./helpers.mjs";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3100";

const SUBJECT = `تیکت آزمون ${RUN_ID}`;
const BODY = "شرح کامل مشکل آزمایشی برای بررسی در تست خودکار انتها به انتها.";
const STUDENT_MESSAGE = "پیام پیگیری دانش‌آموز در همین تیکت.";
const ADMIN_REPLY = "پاسخ کارشناس پشتیبانی به این تیکت.";

test.use({ extraHTTPHeaders: clientIp(31) });

test.describe.serial("تیکت‌های پشتیبانی", () => {
  let ticketId = null;

  test("دانش‌آموز تیکت ثبت می‌کند و پیام پیگیری می‌فرستد", async ({ page }) => {
    await loginAs(page, "student", DEV_CREDENTIALS.student);
    await page.goto("/student/support");

    // Fresh database: the student starts with an empty queue.
    await expect(page.getByText("هنوز تیکتی ثبت نکرده‌اید")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "ثبت تیکت جدید" }).first().click();
    await page.getByLabel("عنوان", { exact: true }).fill(SUBJECT);
    await page.getByLabel("متن پیام", { exact: true }).fill(BODY);
    await page.getByLabel("اولویت").selectOption("HIGH");
    await page.getByRole("button", { name: "ثبت تیکت", exact: true }).click();

    await expect(page.getByText("تیکت ثبت شد")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(SUBJECT)).toBeVisible();

    // Open the thread and send a follow-up message.
    await page.getByRole("button", { name: "مشاهده گفت‌وگو" }).first().click();
    await expect(page.getByText(BODY)).toBeVisible({ timeout: 30_000 });

    await page.getByLabel("پیام جدید").fill(STUDENT_MESSAGE);
    await page.getByRole("button", { name: "ارسال پیام" }).click();
    await expect(page.getByText(STUDENT_MESSAGE)).toBeVisible({ timeout: 30_000 });

    // Resolve the ticket id through the API so the isolation check below can
    // ask for exactly this record.
    const listResponse = await page.request.get("/api/support/tickets");
    expect(listResponse.ok()).toBe(true);

    const payload = await listResponse.json();
    const ticket = payload.tickets.find((item) => item.subject === SUBJECT);
    expect(ticket, "the created ticket must be in the student's own list").toBeTruthy();
    ticketId = ticket.id;
  });

  test("مدیر تیکت را می‌بیند، پاسخ می‌دهد و وضعیت را تغییر می‌دهد", async ({ page }) => {
    expect(ticketId, "the student test must have created a ticket first").toBeTruthy();

    await loginAs(page, "admin", DEV_CREDENTIALS.admin);
    await page.goto("/admin/support");

    await expect(page.getByText(SUBJECT).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "مشاهده گفت‌وگو" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(SUBJECT).first()).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText(BODY)).toBeVisible();
    await expect(dialog.getByText(STUDENT_MESSAGE)).toBeVisible();

    // The ticket is still in the "open" state: the disabled status button tells
    // us what the current status is without relying on the badge styling.
    await expect(dialog.getByRole("button", { name: "باز", exact: true })).toBeDisabled();

    // The administrator's reply is visible to the thread owner too.
    await page.getByLabel("پیام جدید").fill(ADMIN_REPLY);
    await page.getByRole("button", { name: "ارسال پیام" }).click();
    await expect(dialog.getByText(ADMIN_REPLY)).toBeVisible({ timeout: 30_000 });

    // A staff reply moves an untouched ticket into review...
    await expect(dialog.getByRole("button", { name: "در حال بررسی" })).toBeDisabled({
      timeout: 30_000,
    });

    // ...and the administrator can close it.
    await dialog.getByRole("button", { name: "بسته شده", exact: true }).click();
    await expect(page.getByText("وضعیت تیکت به‌روزرسانی شد")).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole("button", { name: "بسته شده", exact: true })).toBeDisabled();
  });

  test("دانش‌آموز پاسخ مدیر و وضعیت بسته را می‌بیند و امکان پاسخ ندارد", async ({ page }) => {
    await loginAs(page, "student", DEV_CREDENTIALS.student);
    await page.goto("/student/support");

    await page.getByRole("button", { name: "مشاهده گفت‌وگو" }).first().click();

    await expect(page.getByText(ADMIN_REPLY)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("این تیکت بسته شده است", { exact: false })).toBeVisible();
    await expect(page.getByLabel("پیام جدید")).toHaveCount(0);
  });

  test("دانش‌آموز دیگر به این تیکت دسترسی ندارد", async ({ browser }) => {
    expect(ticketId, "the ticket id must be known").toBeTruthy();

    const otherContext = await browser.newContext({
      extraHTTPHeaders: clientIp(32),
      locale: "fa-IR",
    });

    try {
      const otherPage = await otherContext.newPage();
      await loginAs(otherPage, "student", DEV_CREDENTIALS.otherStudent);

      // Direct request with a valid session of a different student: the API
      // answers "not found", so ticket ids cannot be enumerated.
      const response = await otherContext.request.get(
        `${BASE_URL}/api/support/tickets/${ticketId}`
      );
      expect(response.status()).toBe(404);

      // And the other student's own list never contains someone else's ticket.
      const ownList = await otherContext.request.get(`${BASE_URL}/api/support/tickets`);
      const payload = await ownList.json();
      expect(payload.tickets.some((ticket) => ticket.subject === SUBJECT)).toBe(false);
    } finally {
      await otherContext.close();
    }
  });
});
