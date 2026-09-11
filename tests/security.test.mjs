/**
 * Security & validation regression tests.
 *
 * Run with: npm test   (node --test, no extra dependencies)
 *
 * These cover the pure security-relevant logic that the API routes rely on:
 * password policy, role-locked login input, request validation bounds, the
 * permission matrix, the guidance engine and the user serializer. Route-level
 * authentication is exercised separately by scripts/verify-auth-http.mjs.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  checkRateLimit,
  resetRateLimit,
  generateResetToken,
  hashToken,
  getSessionCookieOptions,
} from "../lib/auth.js";
import {
  loginSchema,
  createUserSchema,
  gradeSchema,
  studentProfileSchema,
  updateStudentSchema,
  interestSchema,
  educationalVideoSchema,
  paginationSchema,
  resetPasswordSchema,
  testSubmitSchema,
  firstValidationError,
} from "../lib/validation.js";
import { ROLE_PERMISSIONS, hasPermission, resolveRoleAccess } from "../lib/permissions.js";
import { toPublicUser } from "../lib/serializers.js";
import {
  WEIGHTS,
  analyzeGrades,
  analyzeInterests,
  analyzeAbilities,
  calculateSuggestions,
} from "../lib/guidance-engine.js";

// ---------------------------------------------------------------------------
// Password handling
// ---------------------------------------------------------------------------

test("passwords are hashed with bcrypt and never stored in clear text", async () => {
  const password = "Str0ngPass!";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("password policy rejects short, weak and single-class passwords", () => {
  const rejected = [
    "short1A",
    "password",
    "12345678",
    "alllowercase",
    "ALLUPPERCASE",
    "1234567890",
    "a".repeat(200),
  ];

  for (const candidate of rejected) {
    assert.equal(
      validatePasswordStrength(candidate).valid,
      false,
      `expected "${candidate}" to be rejected`
    );
  }
});

test("password policy accepts a strong password", () => {
  assert.equal(validatePasswordStrength("Str0ngPass!").valid, true);
});

// ---------------------------------------------------------------------------
// Login input (regression: the role field must survive validation)
// ---------------------------------------------------------------------------

test("login schema preserves the role sent by the login page", () => {
  for (const role of ["ADMIN", "COUNSELOR", "STUDENT"]) {
    const parsed = loginSchema.safeParse({ username: "u", password: "p", role });
    assert.equal(parsed.success, true);
    // If this ever fails, each login page would silently accept any role and
    // the dedicated portals would stop being role-locked.
    assert.equal(parsed.data.role, role);
  }
});

test("login schema rejects unknown roles and oversized credentials", () => {
  assert.equal(
    loginSchema.safeParse({ username: "u", password: "p", role: "SUPERUSER" }).success,
    false
  );
  assert.equal(
    loginSchema.safeParse({ username: "u", password: "x".repeat(200), role: "ADMIN" }).success,
    false
  );
});

test("create user schema only accepts the three known roles", () => {
  const base = { username: "newuser", password: "Str0ngPass!", firstName: "ا", lastName: "ب" };
  assert.equal(createUserSchema.safeParse({ ...base, role: "ADMIN" }).success, true);
  assert.equal(createUserSchema.safeParse({ ...base, role: "ROOT" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, role: "ADMIN", username: "bad name!" }).success, false);
});

// ---------------------------------------------------------------------------
// Request validation bounds
// ---------------------------------------------------------------------------

test("grade validation enforces the 0..20 range and grade level", () => {
  const valid = {
    studentId: "s1",
    subjectName: "ریاضی",
    score: 18,
    semester: 1,
    academicYear: "1402-1403",
    gradeLevel: 9,
  };

  assert.equal(gradeSchema.safeParse(valid).success, true);
  assert.equal(gradeSchema.safeParse({ ...valid, score: 20.5 }).success, false);
  assert.equal(gradeSchema.safeParse({ ...valid, score: -1 }).success, false);
  assert.equal(gradeSchema.safeParse({ ...valid, gradeLevel: 10 }).success, false);
  assert.equal(gradeSchema.safeParse({ ...valid, semester: 3 }).success, false);
});

test("grade validation coerces form strings but still applies the bounds", () => {
  const parsed = gradeSchema.safeParse({
    studentId: "s1",
    subjectName: "علوم",
    score: "17.5",
    semester: "2",
    academicYear: "1402-1403",
    gradeLevel: "8",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.score, 17.5);
  assert.equal(parsed.data.gradeLevel, 8);
});

test("student profile validation rejects out-of-range grades and unsafe codes", () => {
  const base = { firstName: "ا", lastName: "ب", studentCode: "1001", grade: 7, schoolYear: "1402-1403" };
  assert.equal(studentProfileSchema.safeParse(base).success, true);
  assert.equal(studentProfileSchema.safeParse({ ...base, grade: 6 }).success, false);
  assert.equal(studentProfileSchema.safeParse({ ...base, grade: 10 }).success, false);
  assert.equal(studentProfileSchema.safeParse({ ...base, studentCode: "1001;drop" }).success, false);
});

test("update student schema cannot mass-assign protected fields", () => {
  const parsed = updateStudentSchema.safeParse({
    grade: 8,
    studentCode: "hacked",
    userId: "someone-else",
    id: "other-id",
  });

  assert.equal(parsed.success, true);
  // Unknown keys are stripped by Zod, so the route can never apply them.
  assert.equal(parsed.data.studentCode, undefined);
  assert.equal(parsed.data.userId, undefined);
  assert.equal(parsed.data.id, undefined);
});

test("pagination is clamped to a sane window", () => {
  assert.equal(paginationSchema.safeParse({ page: "1", limit: "10" }).success, true);
  assert.equal(paginationSchema.safeParse({ page: "0" }).success, false);
  assert.equal(paginationSchema.safeParse({ limit: "100000" }).success, false);
  assert.equal(paginationSchema.safeParse({ order: "sideways" }).success, false);
});

test("interest payloads are size-limited", () => {
  const tooMany = {
    studentId: "s1",
    interests: Array.from({ length: 51 }, () => ({ category: "MATH", level: 1 })),
  };
  assert.equal(interestSchema.safeParse(tooMany).success, false);
  assert.equal(
    interestSchema.safeParse({ studentId: "s1", interests: [{ category: "MATH", level: 9 }] }).success,
    false
  );
});

test("video links are restricted to the supported embed providers", () => {
  const base = { title: "ویدئو" };
  assert.equal(
    educationalVideoSchema.safeParse({ ...base, videoUrl: "https://www.youtube.com/watch?v=abc" }).success,
    true
  );
  assert.equal(
    educationalVideoSchema.safeParse({ ...base, videoUrl: "https://www.aparat.com/v/abc" }).success,
    true
  );
  assert.equal(
    educationalVideoSchema.safeParse({ ...base, videoUrl: "https://evil.example.com/x.mp4" }).success,
    false
  );
  assert.equal(
    educationalVideoSchema.safeParse({ ...base, videoUrl: "javascript:alert(1)" }).success,
    false
  );
});

test("test submission requires at least one answer and bounded payloads", () => {
  assert.equal(testSubmitSchema.safeParse({ testId: "t1", answers: [] }).success, false);
  assert.equal(
    testSubmitSchema.safeParse({ testId: "t1", answers: [{ questionId: "q1", optionId: "o1" }] }).success,
    true
  );
  assert.equal(
    testSubmitSchema.safeParse({ testId: "t1", answers: [{ questionId: "q1" }] }).success,
    false
  );
});

test("validation failures produce a readable message (Zod v4 issues API)", () => {
  const parsed = gradeSchema.safeParse({
    studentId: "s1",
    subjectName: "ریاضی",
    score: 99,
    semester: 1,
    academicYear: "1402-1403",
    gradeLevel: 7,
  });

  assert.equal(parsed.success, false);
  assert.ok(Array.isArray(parsed.error.issues), "Zod v4 exposes `issues`");

  const message = firstValidationError(parsed.error);
  assert.equal(typeof message, "string");
  assert.ok(message.length > 0);
  // Regression guard: reading the removed `error.errors` property used to throw
  // and turn every validation failure into a 500.
  assert.doesNotThrow(() => firstValidationError(parsed.error));
  assert.equal(firstValidationError(undefined), "اطلاعات واردشده نامعتبر است");
  assert.equal(firstValidationError(undefined, "پیام جایگزین"), "پیام جایگزین");
});

test("reset token input only accepts hex tokens", () => {
  assert.equal(resetPasswordSchema.safeParse({ token: "a".repeat(64), newPassword: "Str0ngPass!" }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ token: "short", newPassword: "Str0ngPass!" }).success, false);
  assert.equal(
    resetPasswordSchema.safeParse({ token: `../../etc/passwd${"a".repeat(40)}`, newPassword: "Str0ngPass!" }).success,
    false
  );
});

// ---------------------------------------------------------------------------
// Role permissions
// ---------------------------------------------------------------------------

test("only ADMIN can manage users, roles and settings", () => {
  assert.equal(hasPermission("ADMIN", "canManageUsers"), true);
  assert.equal(hasPermission("ADMIN", "canChangeRoles"), true);
  assert.equal(hasPermission("ADMIN", "canDeleteUsers"), true);
  assert.equal(hasPermission("ADMIN", "canViewSecurityLogs"), true);

  for (const permission of [
    "canManageUsers",
    "canChangeRoles",
    "canDeleteUsers",
    "canViewSecurityLogs",
    "canManageSchools",
  ]) {
    assert.equal(hasPermission("COUNSELOR", permission), false, `COUNSELOR must not ${permission}`);
    assert.equal(hasPermission("STUDENT", permission), false, `STUDENT must not ${permission}`);
  }
});

test("counselors are scoped to their assigned students", () => {
  assert.equal(hasPermission("COUNSELOR", "canViewAssignedStudentsOnly"), true);
  assert.equal(hasPermission("COUNSELOR", "canViewAllStudents"), false);
  assert.equal(hasPermission("COUNSELOR", "canViewReports"), true);
  assert.equal(hasPermission("COUNSELOR", "canManageVideos"), false);
});

test("students can only reach their own data", () => {
  assert.equal(hasPermission("STUDENT", "canViewOwnProfile"), true);
  assert.equal(hasPermission("STUDENT", "canViewOwnGrades"), true);
  assert.equal(hasPermission("STUDENT", "canViewOwnResults"), true);
  assert.equal(hasPermission("STUDENT", "canViewReports"), false);
  assert.equal(hasPermission("STUDENT", "canViewAssignedStudentsOnly"), false);
  assert.equal(hasPermission("STUDENT", "canManageGrades"), false);
});

test("unknown permissions and unknown roles deny by default", () => {
  assert.equal(hasPermission("STUDENT", "doesNotExist"), false);
  assert.equal(hasPermission("GHOST", "canManageUsers"), false);
  assert.equal(ROLE_PERMISSIONS.GHOST, undefined);
});

// ---------------------------------------------------------------------------
// Panel access decisions (the guard behind /admin, /counselor, /student)
// ---------------------------------------------------------------------------

test("a student who opens the admin URL is sent back to their own panel", () => {
  const decision = resolveRoleAccess({ role: "STUDENT" }, "ADMIN");
  assert.deepEqual(decision, { action: "redirect", to: "/student" });
});

test("a counselor cannot open the admin panel", () => {
  assert.deepEqual(resolveRoleAccess({ role: "COUNSELOR" }, "ADMIN"), {
    action: "redirect",
    to: "/counselor",
  });
});

test("an admin cannot open the student or counselor panels", () => {
  assert.deepEqual(resolveRoleAccess({ role: "ADMIN" }, "STUDENT"), {
    action: "redirect",
    to: "/admin",
  });
  assert.deepEqual(resolveRoleAccess({ role: "ADMIN" }, "COUNSELOR"), {
    action: "redirect",
    to: "/admin",
  });
});

test("an anonymous visitor is sent to the login page of the panel they requested", () => {
  assert.deepEqual(resolveRoleAccess(null, "ADMIN"), { action: "redirect", to: "/login/admin" });
  assert.deepEqual(resolveRoleAccess(null, "COUNSELOR"), {
    action: "redirect",
    to: "/login/counselor",
  });
  assert.deepEqual(resolveRoleAccess(null, "STUDENT"), { action: "redirect", to: "/login/student" });
});

test("only the matching role is allowed into a panel", () => {
  assert.deepEqual(resolveRoleAccess({ role: "ADMIN" }, "ADMIN"), { action: "allow" });
  assert.deepEqual(resolveRoleAccess({ role: "COUNSELOR" }, "COUNSELOR"), { action: "allow" });
  assert.deepEqual(resolveRoleAccess({ role: "STUDENT" }, "STUDENT"), { action: "allow" });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

test("the public user shape never includes the password hash", () => {
  const user = {
    id: "u1",
    username: "admin",
    firstName: "ا",
    lastName: "ب",
    email: null,
    role: "ADMIN",
    isActive: true,
    password: "$2b$12$super-secret-hash",
    sessions: [{ token: "abc" }],
  };

  const serialized = toPublicUser(user);

  assert.equal(serialized.password, undefined);
  assert.equal(serialized.sessions, undefined);
  assert.equal(JSON.stringify(serialized).includes("super-secret-hash"), false);
  assert.equal(serialized.role, "ADMIN");
  assert.equal(toPublicUser(null), null);
});

// ---------------------------------------------------------------------------
// Session cookie and reset tokens
// ---------------------------------------------------------------------------

test("session cookie is HttpOnly, SameSite and Secure in production", () => {
  const dev = getSessionCookieOptions(false);
  const prod = getSessionCookieOptions(true);

  assert.equal(dev.httpOnly, true);
  assert.equal(dev.sameSite, "lax");
  assert.equal(dev.path, "/");
  assert.equal(dev.secure, false);
  assert.equal(prod.secure, true);
});

test("reset tokens are random, hashed at rest and single-value", () => {
  const first = generateResetToken();
  const second = generateResetToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.token.length, 64);
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(first.tokenHash, hashToken(first.token));
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test("rate limiting blocks after the configured number of attempts and can be reset", () => {
  const key = `test:${Math.random()}`;

  for (let i = 0; i < 5; i++) {
    assert.equal(checkRateLimit(key, 5, 60000).allowed, true);
  }

  const blocked = checkRateLimit(key, 5, 60000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);

  resetRateLimit(key);
  assert.equal(checkRateLimit(key, 5, 60000).allowed, true);
});

// ---------------------------------------------------------------------------
// Guidance engine
// ---------------------------------------------------------------------------

test("guidance weights form a normalised weighting scheme", () => {
  const total = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights must sum to 1, got ${total}`);
});

test("grade analysis detects strengths, weaknesses and the average", () => {
  const analysis = analyzeGrades([
    { subjectName: "ریاضی", score: 19 },
    { subjectName: "ریاضی", score: 18 },
    { subjectName: "ادبیات", score: 9 },
  ]);

  assert.ok(analysis.strengths.includes("ریاضی"));
  assert.ok(analysis.weaknesses.includes("ادبیات"));
  assert.ok(analysis.average > 0);
});

test("guidance suggestions always carry the 'review by a counsellor' disclaimer", () => {
  const grades = analyzeGrades([{ subjectName: "ریاضی", score: 19 }, { subjectName: "ریاضی", score: 20 }]);
  const interests = analyzeInterests([
    { category: "MATH", level: 5 },
    { category: "TECHNOLOGY", level: 4 },
  ]);
  const abilities = analyzeAbilities([
    { category: "MATHEMATICAL", score: 90, level: "EXCELLENT" },
    { category: "LOGICAL", score: 85, level: "EXCELLENT" },
  ]);

  const suggestions = calculateSuggestions({ grades, interests, abilities });

  assert.ok(Array.isArray(suggestions.suggestedFields));
  assert.ok(suggestions.suggestedFields.length > 0);
  assert.ok(suggestions.suggestedFields.length <= 5);
  for (const field of suggestions.suggestedFields) {
    assert.equal(typeof field.field, "string");
    assert.ok(["بالا", "متوسط", "پایین"].includes(field.confidence));
  }
  assert.match(suggestions.disclaimer, /مشاور/);
});

test("guidance engine degrades gracefully with no data", () => {
  const analysis = {
    grades: analyzeGrades([]),
    interests: analyzeInterests([]),
    abilities: analyzeAbilities([]),
  };

  const suggestions = calculateSuggestions(analysis);
  assert.deepEqual(suggestions.suggestedFields, []);
  assert.match(suggestions.disclaimer, /مشاور/);
});
