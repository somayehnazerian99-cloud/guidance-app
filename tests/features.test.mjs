/**
 * Feature regression tests for registration, the audit trail and support
 * tickets.
 *
 * Run with: npm test   (node --test, no extra dependencies)
 *
 * Only pure logic is covered here; the HTTP behaviour of these features is
 * verified against a running server by `npm run verify:auth`.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  registerSchema,
  registerStudentSchema,
  registerCounselorSchema,
  supportTicketSchema,
  supportReplySchema,
  supportStatusSchema,
  counselorApprovalSchema,
  auditLogQuerySchema,
} from "../lib/validation.js";
import {
  sanitizeAuditDetails,
  parseAuditDetails,
  describeAuditLog,
  toAuditLogEntry,
  listAuditActions,
  AUDIT_ACTIONS,
} from "../lib/audit-log.js";
import {
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  ticketStatusLabel,
  ticketCategoryLabel,
  ticketPriorityLabel,
  canReplyToTicket,
  canChangeTicketStatus,
} from "../lib/support.js";
import {
  isCounselorApproved,
  isCounselorPending,
  counselorApprovalLabel,
  hasPermission,
  COUNSELOR_APPROVAL,
} from "../lib/permissions.js";
import { validatePasswordStrength, PASSWORD_REQUIREMENTS } from "../lib/password-policy.js";
import { validatePasswordStrength as fromAuth } from "../lib/auth.js";
import { toPublicTicket } from "../lib/serializers.js";
import { apiRequest, pendingRequestCount } from "../lib/client-api.js";

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const STUDENT_SIGNUP = {
  role: "STUDENT",
  firstName: "علی",
  lastName: "احمدی",
  username: "ali1405",
  password: "Student1234",
  email: "",
  grade: 7,
  schoolYear: "1404-1405",
};

test("public registration cannot create an administrator", () => {
  const attempt = registerSchema.safeParse({
    ...STUDENT_SIGNUP,
    role: "ADMIN",
    username: "eviladmin",
  });

  assert.equal(attempt.success, false);
});

test("public registration only accepts the student and counselor roles", () => {
  assert.equal(registerStudentSchema.safeParse(STUDENT_SIGNUP).success, true);

  const counselor = registerCounselorSchema.safeParse({
    ...STUDENT_SIGNUP,
    role: "COUNSELOR",
    username: "counselor1405",
  });
  assert.equal(counselor.success, true);

  // The role is part of the discriminated union, so a missing/unknown role is
  // rejected instead of silently defaulting to STUDENT.
  assert.equal(registerSchema.safeParse({ ...STUDENT_SIGNUP, role: undefined }).success, false);
  assert.equal(registerSchema.safeParse({ ...STUDENT_SIGNUP, role: "TEACHER" }).success, false);
});

test("registration usernames may only contain English letters and digits", () => {
  const invalid = ["علی", "ali_1405", "ali.1405", "ali 1405", "ali-1405", "ali@1405"];

  for (const username of invalid) {
    assert.equal(
      registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, username }).success,
      false,
      `expected "${username}" to be rejected`
    );
  }

  for (const username of ["ali1405", "1405", "ALI1405"]) {
    assert.equal(
      registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, username }).success,
      true,
      `expected "${username}" to be accepted`
    );
  }
});

test("registration enforces the password policy and length limits", () => {
  const weak = ["short1", "alllowercase1", "ALLUPPERCASE1", "1234567890", "password", ""];

  for (const password of weak) {
    assert.equal(
      registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, password }).success,
      false,
      `expected "${password}" to be rejected`
    );
  }

  assert.equal(
    registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, password: "StrongPass1" }).success,
    true
  );

  // Non-ASCII passwords are rejected so the "letters and numbers" rule from the
  // specification holds for the secret as well as the username.
  assert.equal(
    registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, password: "رمزPass1" }).success,
    false
  );

  assert.equal(
    registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, password: `Aa1${"x".repeat(200)}` })
      .success,
    false
  );
});

test("student sign-up defaults a grade and school year when omitted", () => {
  const parsed = registerStudentSchema.safeParse({
    role: "STUDENT",
    firstName: "سارا",
    lastName: "محمدی",
    username: "sara1405",
    password: "StrongPass1",
  });

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.grade, 7);
  assert.equal(parsed.data.schoolYear, "1404-1405");
});

test("student sign-up rejects an out-of-range grade", () => {
  assert.equal(registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, grade: 6 }).success, false);
  assert.equal(registerStudentSchema.safeParse({ ...STUDENT_SIGNUP, grade: 12 }).success, false);
});

// ---------------------------------------------------------------------------
// Password policy is shared, not duplicated
// ---------------------------------------------------------------------------

test("the password policy has a single implementation shared by auth and validation", () => {
  const sample = ["short", "StrongPass1", "alllowercase1"];

  for (const password of sample) {
    assert.deepEqual(
      validatePasswordStrength(password),
      fromAuth(password),
      `the policy disagreed with itself for "${password}"`
    );
  }

  assert.ok(PASSWORD_REQUIREMENTS.length > 0);
  assert.equal(validatePasswordStrength("StrongPass1").valid, true);
});

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

test("audit details are stripped of secrets before they are stored", () => {
  const cleaned = sanitizeAuditDetails({
    username: "ali1405",
    password: "SuperSecret1",
    token: "abc123",
    resetTokenHash: "deadbeef",
    nested: { password: "hidden", keep: "visible" },
    reason: "ok",
  });

  assert.equal(cleaned.username, "ali1405");
  assert.equal(cleaned.reason, "ok");
  assert.equal(cleaned.password, undefined);
  assert.equal(cleaned.token, undefined);
  assert.equal(cleaned.resetTokenHash, undefined);
  assert.equal(cleaned.nested.password, undefined);
  assert.equal(cleaned.nested.keep, "visible");

  const serialized = JSON.stringify(cleaned);
  assert.equal(serialized.includes("SuperSecret1"), false);
  assert.equal(serialized.includes("hidden"), false);
});

test("audit details accept objects, JSON strings and plain strings", () => {
  assert.deepEqual(sanitizeAuditDetails(null), {});
  // A plain string is kept as-is, while a JSON string is parsed back to an object.
  assert.equal(sanitizeAuditDetails("plain note"), "plain note");
  assert.equal(sanitizeAuditDetails('{"role":"ADMIN"}').role, "ADMIN");
});

test("malformed stored details never break the reader", () => {
  assert.deepEqual(parseAuditDetails("not json at all"), { note: "not json at all" });
  assert.deepEqual(parseAuditDetails(null), {});
  assert.equal(parseAuditDetails('{"a":1}').a, 1);
});

test("an audit row is rendered as a Persian sentence naming the user", () => {
  const log = {
    action: "LOGIN",
    details: JSON.stringify({ role: "STUDENT" }),
    user: { firstName: "علی", lastName: "احمدی", role: "STUDENT" },
    createdAt: new Date(),
  };

  const described = describeAuditLog(log);

  assert.equal(described.label, "ورود به سیستم");
  assert.equal(described.actorName, "علی احمدی");
  assert.match(described.sentence, /علی احمدی/);
  assert.match(described.sentence, /وارد سیستم شد/);
  assert.match(described.sentence, /دانش‌آموز/);
});

test("the role is not repeated when the account name already is the role label", () => {
  const adminLog = describeAuditLog({
    action: "LOGIN",
    details: JSON.stringify({ role: "ADMIN" }),
    user: { firstName: "مدیر", lastName: "سیستم", role: "ADMIN" },
  });

  assert.equal(adminLog.sentence, "مدیر سیستم وارد سیستم شد");
  assert.equal(
    (adminLog.sentence.match(/مدیر سیستم/g) || []).length,
    1,
    "the role label is duplicated in the sentence"
  );

  // An ordinary name still gets the role for context.
  const studentLog = describeAuditLog({
    action: "LOGIN",
    details: JSON.stringify({ role: "STUDENT" }),
    user: { firstName: "علی", lastName: "احمدی", role: "STUDENT" },
  });
  assert.equal(studentLog.sentence, "علی احمدی (دانش‌آموز) وارد سیستم شد");
});

test("a deleted user is named in the audit sentence, not shown as a raw id", () => {
  const described = describeAuditLog({
    action: "DELETE_USER",
    details: JSON.stringify({
      targetUserId: "6aa5564ffe531683a666ea7a",
      targetName: "علی احمدی",
      targetUsername: "ali1405",
    }),
    user: { firstName: "مدیر", lastName: "سیستم", role: "ADMIN" },
  });

  assert.match(described.sentence, /علی احمدی/);
  assert.equal(described.sentence.includes("6aa5564f"), false);

  // Rows written before the name was recorded fall back to the username.
  const legacy = describeAuditLog({
    action: "DELETE_USER",
    details: JSON.stringify({ targetUserId: "6aa5564f", username: "ali1405" }),
  });
  assert.match(legacy.sentence, /ali1405/);
});

test("failed logins are described without a user record", () => {
  const described = describeAuditLog({
    action: "FAILED_LOGIN",
    details: JSON.stringify({ username: "ghost", reason: "user_not_found" }),
    user: null,
  });

  assert.match(described.sentence, /ghost/);
  assert.match(described.sentence, /کاربر یافت نشد/);
  assert.equal(described.tone, "warning");
});

test("counselor approval and registration actions read as Persian sentences", () => {
  const registration = describeAuditLog({
    action: "REGISTER",
    details: JSON.stringify({
      displayName: "مریم رضایی",
      role: "COUNSELOR",
      approvalStatus: "PENDING",
    }),
    user: null,
  });
  assert.match(registration.sentence, /مریم رضایی/);
  assert.match(registration.sentence, /در انتظار تأیید مدیر/);

  const approved = describeAuditLog({
    action: "COUNSELOR_APPROVED",
    details: JSON.stringify({ targetName: "مریم رضایی" }),
    user: { firstName: "مدیر", lastName: "سیستم", role: "ADMIN" },
  });
  assert.match(approved.sentence, /مدیر سیستم/);
  assert.match(approved.sentence, /مریم رضایی/);
  assert.match(approved.sentence, /تأیید کرد/);
});

test("an unknown audit action degrades gracefully instead of throwing", () => {
  const described = describeAuditLog({
    action: "SOMETHING_NEW",
    details: null,
    user: { firstName: "ا", lastName: "ب" },
  });

  assert.equal(described.action, "SOMETHING_NEW");
  assert.equal(typeof described.sentence, "string");
  assert.ok(described.sentence.length > 0);
  assert.equal(describeAuditLog({}).sentence.length > 0, true);
});

test("the audit API shape never exposes raw details", () => {
  const entry = toAuditLogEntry({
    id: "log1",
    action: "LOGIN",
    details: JSON.stringify({ role: "ADMIN", secretish: "keep-out" }),
    ipAddress: "1.2.3.4",
    user: { firstName: "مدیر", lastName: "سیستم", role: "ADMIN" },
    createdAt: new Date(),
  });

  assert.equal(entry.details, undefined);
  assert.equal(entry.ipAddress, "1.2.3.4");
  assert.equal(JSON.stringify(entry).includes("keep-out"), false);
});

test("every audit action used by an API route has a Persian description", async () => {
  // The audit page showed raw codes like «TEST_SUBMIT» whenever a route used an
  // action that was missing from the catalogue. This scans the API source so a
  // new action cannot ship without a Persian sentence.
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  const filesUnder = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });

  const routeFiles = filesUnder("app/api").filter((file) => file.endsWith("route.js"));

  const used = new Set();
  const pattern = /createAuditLog\(\s*[^,]+,\s*"([A-Z_]+)"/g;

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      used.add(match[1]);
    }
  }

  assert.ok(used.size > 10, `expected to find audit actions, found ${used.size}`);

  const missing = [...used].filter((action) => !AUDIT_ACTIONS[action]);
  assert.deepEqual(missing, [], `no Persian description for: ${missing.join(", ")}`);

  // And the reverse direction: nothing in the catalogue is a raw code either.
  for (const [action, definition] of Object.entries(AUDIT_ACTIONS)) {
    assert.equal(typeof definition.label, "string", `${action} has no label`);
    assert.ok(/[\u0600-\u06FF]/.test(definition.label), `${action} has a non-Persian label`);
  }
});

test("student, user and ticket audit entries name the subject, not «نامشخص»", () => {
  const rows = [
    { action: "CREATE_STUDENT", details: { targetName: "علی احمدی", targetUsername: "ali1405" } },
    { action: "UPDATE_STUDENT", details: { targetName: "علی احمدی" } },
    { action: "DELETE_STUDENT", details: { targetName: "علی احمدی" } },
    { action: "CREATE_GRADE", details: { subjectName: "ریاضی", targetName: "علی احمدی" } },
    { action: "GUIDANCE_CALCULATED", details: { targetName: "علی احمدی" } },
    { action: "UPDATE_USER", details: { targetName: "علی احمدی" } },
    { action: "DELETE_USER", details: { targetName: "علی احمدی" } },
  ];

  for (const row of rows) {
    const described = describeAuditLog({
      ...row,
      details: JSON.stringify(row.details),
      user: { firstName: "مدیر", lastName: "سیستم", role: "ADMIN" },
    });

    assert.equal(described.sentence.includes("نامشخص"), false, `${row.action}: ${described.sentence}`);
    assert.match(described.sentence, /علی احمدی/);
  }

  const grade = describeAuditLog({
    action: "CREATE_GRADE",
    details: JSON.stringify({ subjectName: "ریاضی", targetName: "علی احمدی" }),
  });
  assert.match(grade.sentence, /ریاضی/);
});

test("the filter catalogue covers every documented action", () => {
  const actions = listAuditActions().map((entry) => entry.action);

  for (const required of [
    "LOGIN",
    "LOGOUT",
    "PASSWORD_CHANGE",
    "PASSWORD_RESET",
    "REGISTER",
    "COUNSELOR_APPROVED",
    "COUNSELOR_REJECTED",
    "UPDATE_USER",
  ]) {
    assert.ok(actions.includes(required), `missing audit action ${required}`);
    assert.equal(typeof AUDIT_ACTIONS[required].label, "string");
  }
});

// ---------------------------------------------------------------------------
// Counselor approval
// ---------------------------------------------------------------------------

test("an account without an approval status is treated as approved", () => {
  // Rows created before the field existed must keep working.
  assert.equal(isCounselorApproved({ role: "COUNSELOR" }), true);
  assert.equal(isCounselorApproved({ role: "COUNSELOR", approvalStatus: null }), true);
  assert.equal(
    isCounselorApproved({ role: "COUNSELOR", approvalStatus: COUNSELOR_APPROVAL.APPROVED }),
    true
  );
});

test("a pending or rejected counselor is not approved", () => {
  assert.equal(
    isCounselorApproved({ role: "COUNSELOR", approvalStatus: COUNSELOR_APPROVAL.PENDING }),
    false
  );
  assert.equal(
    isCounselorApproved({ role: "COUNSELOR", approvalStatus: COUNSELOR_APPROVAL.REJECTED }),
    false
  );

  assert.equal(isCounselorPending({ role: "COUNSELOR", approvalStatus: "PENDING" }), true);
  assert.equal(isCounselorPending({ role: "STUDENT", approvalStatus: "PENDING" }), false);
  assert.equal(isCounselorPending(null), false);
});

test("approval is irrelevant for other roles and has a Persian label", () => {
  assert.equal(isCounselorApproved({ role: "STUDENT" }), true);
  assert.equal(isCounselorApproved({ role: "ADMIN" }), true);
  assert.equal(isCounselorApproved(null), true);
  assert.equal(counselorApprovalLabel("PENDING"), "در انتظار تأیید");
});

test("only administrators carry the new privileged permissions", () => {
  for (const permission of [
    "canViewAuditLogs",
    "canApproveCounselors",
    "canManageAllTickets",
  ]) {
    assert.equal(hasPermission("ADMIN", permission), true, `ADMIN must ${permission}`);
    assert.equal(hasPermission("COUNSELOR", permission), false, `COUNSELOR must not ${permission}`);
    assert.equal(hasPermission("STUDENT", permission), false, `STUDENT must not ${permission}`);
  }

  for (const role of ["ADMIN", "COUNSELOR", "STUDENT"]) {
    assert.equal(hasPermission(role, "canUseSupport"), true, `${role} must be able to use support`);
  }
});

test("counselor approval input only accepts approve or reject", () => {
  assert.equal(counselorApprovalSchema.safeParse({ decision: "APPROVE" }).success, true);
  assert.equal(counselorApprovalSchema.safeParse({ decision: "REJECT", reason: "ناقص" }).success, true);
  assert.equal(counselorApprovalSchema.safeParse({ decision: "DELETE" }).success, false);
  assert.equal(counselorApprovalSchema.safeParse({}).success, false);
});

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

test("ticket statuses have Persian labels", () => {
  assert.equal(ticketStatusLabel("OPEN"), "باز");
  assert.equal(ticketStatusLabel("IN_PROGRESS"), "در حال بررسی");
  assert.equal(ticketStatusLabel("CLOSED"), "بسته شده");
  assert.equal(ticketStatusLabel("WHATEVER"), "نامشخص");
  assert.equal(ticketCategoryLabel("GRADES"), "نمرات");
  assert.equal(ticketPriorityLabel("HIGH"), "فوری");
  assert.equal(Object.keys(TICKET_STATUS_LABELS).length, Object.keys(TICKET_STATUS).length);
});

test("a closed ticket cannot be replied to by its owner, but staff can always reply", () => {
  const closed = { status: TICKET_STATUS.CLOSED, userId: "u1" };
  const open = { status: TICKET_STATUS.OPEN, userId: "u1" };

  assert.equal(canReplyToTicket(open, "STUDENT", true), true);
  assert.equal(canReplyToTicket(closed, "STUDENT", true), false);
  assert.equal(canReplyToTicket(closed, "ADMIN", false), true);
  // A user who does not own the ticket can never write into it.
  assert.equal(canReplyToTicket(open, "STUDENT", false), false);
  assert.equal(canReplyToTicket(open, "COUNSELOR", false), false);
  assert.equal(canReplyToTicket(null, "ADMIN", false), false);
});

test("only administrators may change a ticket status", () => {
  assert.equal(canChangeTicketStatus("ADMIN"), true);
  assert.equal(canChangeTicketStatus("COUNSELOR"), false);
  assert.equal(canChangeTicketStatus("STUDENT"), false);
  assert.equal(canChangeTicketStatus(undefined), false);
});

test("ticket payloads are validated and bounded", () => {
  assert.equal(
    supportTicketSchema.safeParse({
      subject: "مشکل در نمرات",
      body: "نمره درس ریاضی ترم دوم ثبت نشده است.",
      category: "GRADES",
      priority: "HIGH",
    }).success,
    true
  );

  assert.equal(supportTicketSchema.safeParse({ subject: "اب", body: "کوتاه" }).success, false);
  assert.equal(
    supportTicketSchema.safeParse({ subject: "معتبر", body: "x".repeat(5000) }).success,
    false
  );
  // An unknown category must not slip through into the database.
  assert.equal(
    supportTicketSchema.safeParse({ subject: "معتبر", body: "توضیح کامل مشکل", category: "HACK" })
      .success,
    false
  );

  assert.equal(supportReplySchema.safeParse({ body: "پاسخ" }).success, true);
  assert.equal(supportReplySchema.safeParse({ body: "" }).success, false);
  assert.equal(supportStatusSchema.safeParse({ status: "IN_PROGRESS" }).success, true);
  assert.equal(supportStatusSchema.safeParse({ status: "DELETED" }).success, false);
});

test("the public ticket shape carries server-computed permissions only", () => {
  const ticket = {
    id: "t1",
    userId: "owner-1",
    subject: "مشکل",
    category: "OTHER",
    priority: "NORMAL",
    status: "OPEN",
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: "owner-1", firstName: "علی", lastName: "احمدی", role: "STUDENT" },
    _count: { replies: 2 },
  };

  const ownerView = toPublicTicket(ticket, { viewerId: "owner-1", viewerRole: "STUDENT" });
  assert.equal(ownerView.canReply, true);
  assert.equal(ownerView.canChangeStatus, false);
  assert.equal(ownerView.replyCount, 2);
  // The raw owner id is not part of the client shape.
  assert.equal(ownerView.userId, undefined);

  const otherView = toPublicTicket(ticket, { viewerId: "someone-else", viewerRole: "STUDENT" });
  assert.equal(otherView.canReply, false);
  assert.equal(otherView.isOwner, false);

  const adminView = toPublicTicket(ticket, { viewerId: "admin-1", viewerRole: "ADMIN" });
  assert.equal(adminView.canChangeStatus, true);
  // The administrator answers tickets: the reply button is part of the support
  // queue, so the flag must match what PATCH /api/support/tickets/[id] allows.
  assert.equal(adminView.canReply, true);
  assert.equal(adminView.canReply, canReplyToTicket(ticket, "ADMIN", false));

  const closedTicket = { ...ticket, status: TICKET_STATUS.CLOSED };
  assert.equal(toPublicTicket(closedTicket, { viewerRole: "ADMIN" }).canReply, true);
  assert.equal(toPublicTicket(closedTicket, { viewerId: "owner-1", viewerRole: "STUDENT" }).canReply, false);
  assert.equal(toPublicTicket(null), null);
});

test("audit log query filters are bounded and coerced", () => {
  const parsed = auditLogQuerySchema.safeParse({ page: "2", limit: "20", action: "LOGIN" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.page, 2);
  assert.equal(parsed.data.limit, 20);

  assert.equal(auditLogQuerySchema.safeParse({ page: "0" }).success, false);
  assert.equal(auditLogQuerySchema.safeParse({ limit: "5000" }).success, false);
});

// ---------------------------------------------------------------------------
// Duplicate-request protection
// ---------------------------------------------------------------------------

test("identical in-flight requests are coalesced into a single call", async () => {
  const original = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return new Response(JSON.stringify({ ok: true, n: calls }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const [first, second] = await Promise.all([
      apiRequest("/api/support/tickets", { method: "POST", body: { a: 1 } }),
      apiRequest("/api/support/tickets", { method: "POST", body: { a: 1 } }),
    ]);

    assert.equal(calls, 1, "the second identical submission must reuse the pending request");
    assert.equal(first, second, "both callers must receive the same resolved value");
    assert.deepEqual(first.data, { ok: true, n: 1 });
    assert.equal(first.ok, true);
    assert.equal(first.status, 200);

    // Once settled, the cache is cleared so a genuine retry goes out again.
    await apiRequest("/api/support/tickets", { method: "POST", body: { a: 1 } });
    assert.equal(calls, 2);
    assert.equal(pendingRequestCount(), 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("requests that differ in body or method are not coalesced", async () => {
  const original = globalThis.fetch;
  const seen = [];

  globalThis.fetch = async (url, init) => {
    seen.push(`${init.method} ${url} ${init.body || ""}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await Promise.all([
      apiRequest("/api/support/tickets", { method: "POST", body: { a: 1 } }),
      apiRequest("/api/support/tickets", { method: "POST", body: { a: 2 } }),
      apiRequest("/api/support/tickets/1", { method: "PATCH", body: { body: "x" } }),
    ]);

    assert.equal(seen.length, 3);
  } finally {
    globalThis.fetch = original;
  }
});

test("a network failure resolves to a result object instead of throwing", async () => {
  const original = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("offline");
  };

  try {
    const result = await apiRequest("/api/audit-logs");
    assert.equal(result.ok, false);
    assert.equal(result.networkError, true);
    assert.equal(result.status, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("a non-JSON error response does not break the caller", async () => {
  const original = globalThis.fetch;

  globalThis.fetch = async () => new Response("<html>500</html>", { status: 500 });

  try {
    const result = await apiRequest("/api/audit-logs");
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
    assert.equal(result.data, null);
  } finally {
    globalThis.fetch = original;
  }
});
