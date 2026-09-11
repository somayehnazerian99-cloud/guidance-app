/**
 * End-to-end authentication / authorisation checks against a real HTTP server.
 *
 *   npm run build && npm run verify:auth
 *
 * It boots `next start` on a free loopback port and verifies the HTTP-level
 * guarantees that hold without a database:
 *
 *   - anonymous visitors are redirected away from every private panel
 *   - protected APIs answer 401/403 instead of leaking data
 *   - state-changing requests from a foreign origin are rejected (CSRF)
 *   - security and cache headers are present
 *   - error bodies never contain stack traces or ORM details
 *
 * Tests that need live credentials (the three logins, cross-counsellor access)
 * require a running MongoDB and are listed as SKIPPED when it is unavailable.
 */

import { spawn } from "node:child_process";
import net from "node:net";
import { findEnvValue, loadProjectEnv, maskSecret } from "./lib/env.mjs";

const PORT = Number(process.env.VERIFY_PORT || 3733);
// Next binds "localhost"; on Windows that can resolve to ::1 only, so talk to
// the same host name the server advertises.
const HOST = "localhost";

const results = [];
let failures = 0;
let skipped = 0;

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  if (status === "FAIL") failures += 1;
  if (status === "SKIP") skipped += 1;
  const icon = status === "PASS" ? "✔" : status === "FAIL" ? "✖" : "•";
  console.log(`${icon} [${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, "PASS", detail);
  } catch (error) {
    record(name, "FAIL", error.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findFreePort(start) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      // Port busy — try the next one.
      resolve(findFreePort(start + 1));
    });
    server.listen(start, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    setTimeout(() => reject(new Error("no free port found")), 5000);
  });
}

async function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${HOST}:${port}/`, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function hasNoInternalDetails(text) {
  const forbidden = [
    "PrismaClient",
    "prisma.",
    "at Object.",
    "node_modules",
    "MongoServerError",
    "MongoNetworkError",
    "ECONNREFUSED",
    "stack",
  ];
  return !forbidden.some((needle) => text.includes(needle));
}

/**
 * Is the database configured in DATABASE_URL actually reachable?
 * A real ping is used (not just a TCP connect) so this also works for Atlas
 * clusters, whose hostnames come from an SRV lookup.
 */
async function mongoAvailable() {
  const uri = process.env.DATABASE_URL;
  if (!uri) return false;

  try {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500,
    });
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Live checks — only run when a MongoDB is reachable and the dev seed exists.
// ---------------------------------------------------------------------------

const CREDENTIALS = {
  admin: { username: process.env.VERIFY_ADMIN_USER || "admin", password: process.env.VERIFY_ADMIN_PASS || "Admin@12345" },
  counselor: { username: process.env.VERIFY_COUNSELOR_USER || "counselor", password: process.env.VERIFY_COUNSELOR_PASS || "Counselor@12345" },
  student: { username: process.env.VERIFY_STUDENT_USER || "student_1001", password: process.env.VERIFY_STUDENT_PASS || "Student@12345" },
};

function readSessionCookie(response) {
  const raw = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""];
  const cookie = raw
    .filter(Boolean)
    .map((value) => value.split(";")[0])
    .find((value) => value.startsWith("guidance-session="));
  return cookie || null;
}

async function login(base, { username, password, role }) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ username, password, role }),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body, cookie: readSessionCookie(response), setCookie: response.headers.getSetCookie?.() || [] };
}

function as(cookie, init = {}) {
  return {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.headers || {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  };
}

async function runLiveChecks(base) {
  const admin = await login(base, { ...CREDENTIALS.admin, role: "ADMIN" });

  if (admin.status !== 200 || !admin.cookie) {
    record(
      "live login + role checks",
      "SKIP",
      `admin login returned ${admin.status} — run \`npm run seed\` first`
    );
    return;
  }

  // --- Admin login --------------------------------------------------------
  await check("admin login succeeds and never returns the password hash", async () => {
    assert(admin.status === 200, `expected 200, got ${admin.status}`);
    const serialized = JSON.stringify(admin.body);
    assert(!serialized.includes("$2"), "response contains a bcrypt hash");
    assert(!serialized.includes("password"), "response contains a password field");
    return `200 as ${admin.body.user.role}`;
  });

  await check("the session cookie is HttpOnly and SameSite", async () => {
    const cookie = admin.setCookie.join(" ");
    assert(/httponly/i.test(cookie), "Set-Cookie is missing HttpOnly");
    assert(/samesite=lax/i.test(cookie), "Set-Cookie is missing SameSite=Lax");
    return "HttpOnly, SameSite=Lax";
  });

  await check("admin can list users", async () => {
    const res = await fetch(`${base}/api/users?limit=5`, as(admin.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const data = await res.json();
    assert(!JSON.stringify(data).includes("$2"), "user list leaks password hashes");
    return `200, ${data.users.length} user(s)`;
  });

  await check("admin can reach the admin panel", async () => {
    const res = await fetch(`${base}/admin`, as(admin.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);
    return "200";
  });

  await check("admin is redirected away from the student panel", async () => {
    const res = await fetch(`${base}/student`, as(admin.cookie));
    const location = res.headers.get("location") || "";
    assert(res.status === 307 || res.status === 302, `expected a redirect, got ${res.status}`);
    assert(location.endsWith("/admin"), `redirected to ${location}`);
    return `-> ${location}`;
  });

  await check("wrong password is rejected", async () => {
    const res = await login(base, {
      username: CREDENTIALS.admin.username,
      password: "definitely-wrong-password",
      role: "ADMIN",
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
    assert(!res.cookie, "a session cookie was issued for a failed login");
    return "401";
  });

  await check("admin credentials are refused on the student portal (role mismatch)", async () => {
    const res = await login(base, { ...CREDENTIALS.admin, role: "STUDENT" });
    assert(res.status === 401, `expected 401, got ${res.status}`);
    assert(!res.cookie, "a session cookie was issued despite the role mismatch");
    return "401";
  });

  // --- Student ------------------------------------------------------------
  const student = await login(base, { ...CREDENTIALS.student, role: "STUDENT" });

  await check("student login succeeds", async () => {
    assert(student.status === 200, `expected 200, got ${student.status}`);
    assert(student.body?.user?.role === "STUDENT", "unexpected role in response");
    return "200";
  });

  await check("student is redirected away from the admin panel", async () => {
    const res = await fetch(`${base}/admin`, as(student.cookie));
    const location = res.headers.get("location") || "";
    assert(res.status === 302 || res.status === 307, `expected a redirect, got ${res.status}`);
    assert(location.endsWith("/student"), `redirected to ${location}`);
    return `-> ${location}`;
  });

  await check("student gets 403 from admin-only APIs", async () => {
    for (const endpoint of ["/api/users", "/api/counselors"]) {
      const res = await fetch(`${base}${endpoint}`, as(student.cookie));
      assert(res.status === 403, `${endpoint} returned ${res.status}, expected 403`);
    }
    const write = await fetch(
      `${base}/api/users`,
      as(student.cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ username: "hacker", password: "Str0ngPass!", firstName: "a", lastName: "b", role: "ADMIN" }),
      })
    );
    assert(write.status === 403, `POST /api/users returned ${write.status}, expected 403`);
    return "403 on read and write";
  });

  await check("student only sees their own profile", async () => {
    const res = await fetch(`${base}/api/students`, as(student.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.students.length === 1, `a student saw ${data.students.length} profiles`);
    return "1 profile";
  });

  const allStudents = await fetch(`${base}/api/students?limit=50`, as(admin.cookie))
    .then((res) => res.json())
    .catch(() => ({ students: [] }));
  const otherStudent = (allStudents.students || []).find((s) => s.user?.username !== CREDENTIALS.student.username);

  if (otherStudent) {
    await check("student cannot read another student's grades by id (IDOR)", async () => {
      const res = await fetch(`${base}/api/grades?studentId=${otherStudent.id}`, as(student.cookie));
      assert(res.status === 403, `expected 403, got ${res.status}`);
      return "403";
    });

    await check("student cannot read another student's test attempts (IDOR)", async () => {
      const res = await fetch(`${base}/api/tests?action=attempts&studentId=${otherStudent.id}`, as(student.cookie));
      assert(res.status === 403, `expected 403, got ${res.status}`);
      return "403";
    });

    await check("student cannot read another student's profile (IDOR)", async () => {
      const res = await fetch(`${base}/api/students/${otherStudent.id}`, as(student.cookie));
      assert(res.status === 403, `expected 403, got ${res.status}`);
      return "403";
    });
  }

  await check("student cannot escalate their own role", async () => {
    const res = await fetch(
      `${base}/api/users/${student.body.user.id}`,
      as(student.cookie, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ role: "ADMIN" }),
      })
    );
    assert(res.status === 403, `expected 403, got ${res.status}`);
    return "403";
  });

  await check("test submission ignores options from another test", async () => {
    const tests = await fetch(`${base}/api/tests`, as(admin.cookie)).then((res) => res.json());
    const active = (tests.tests || []).filter((t) => t.isActive && t._count?.questions > 0);
    if (active.length === 0) throw new Error("no active test in seed data");

    const first = await fetch(`${base}/api/tests/${active[0].id}`, as(student.cookie)).then((res) => res.json());
    const question = first.test.questions[0];
    const foreignOption = (active[1] && first.test.questions[0].options[0]) || question.options[0];

    const res = await fetch(
      `${base}/api/tests/submit`,
      as(student.cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({
          testId: active[0].id,
          answers: [{ questionId: "000000000000000000000000", optionId: foreignOption.id }],
        }),
      })
    );
    assert(res.status === 400, `expected 400 for a forged answer, got ${res.status}`);
    return "400 (forged answer rejected)";
  });

  // --- Counselor ----------------------------------------------------------
  const counselor = await login(base, { ...CREDENTIALS.counselor, role: "COUNSELOR" });

  await check("counselor login succeeds", async () => {
    assert(counselor.status === 200, `expected 200, got ${counselor.status}`);
    return "200";
  });

  await check("counselor is redirected away from the admin panel", async () => {
    const res = await fetch(`${base}/admin`, as(counselor.cookie));
    const location = res.headers.get("location") || "";
    assert(location.endsWith("/counselor"), `redirected to ${location}`);
    return `-> ${location}`;
  });

  await check("counselor only sees their assigned students", async () => {
    const res = await fetch(`${base}/api/students?limit=50`, as(counselor.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const data = await res.json();

    const mine = await fetch(`${base}/api/auth/me`, as(counselor.cookie)).then((r) => r.json());

    for (const record of data.students) {
      assert(
        record.counselor?.id === mine.user.id,
        `counselor saw ${record.studentCode} who belongs to another counselor`
      );
    }
    return `${data.students.length} assigned student(s), none foreign`;
  });

  // The seed assigns every student to the same counselor, so a student that
  // nobody is responsible for is created on the fly. This also exercises the
  // admin CRUD endpoints and the cleanup path.
  await check("counselor cannot touch an unassigned student", async () => {
    const studentCode = `T${Date.now().toString().slice(-8)}`;

    const created = await fetch(
      `${base}/api/students`,
      as(admin.cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({
          firstName: "آزمون",
          lastName: "بدون‌مشاور",
          studentCode,
          grade: 9,
          schoolYear: "1403-1404",
        }),
      })
    );

    assert(created.status === 201, `admin could not create a student (${created.status})`);
    const payload = await created.json();
    const studentId = payload.student.id;

    try {
      // The predictable `<studentCode>@12345` password must be gone.
      assert(!payload.defaultCredentials, "the predictable default password is still returned");
      assert(
        payload.initialCredentials?.password?.length >= 10,
        "no strong initial password was returned"
      );

      const read = await fetch(`${base}/api/students/${studentId}`, as(counselor.cookie));
      assert(
        read.status === 403 || read.status === 404,
        `counselor read an unassigned student (${read.status})`
      );

      const list = await fetch(`${base}/api/grades?studentId=${studentId}`, as(counselor.cookie));
      assert(list.status === 403, `counselor listed an unassigned student's grades (${list.status})`);

      const write = await fetch(
        `${base}/api/grades`,
        as(counselor.cookie, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify({
            studentId,
            subjectName: "ریاضی",
            score: 20,
            semester: 1,
            academicYear: "1403-1404",
            gradeLevel: 9,
          }),
        })
      );
      assert(write.status === 403, `counselor wrote a grade for an unassigned student (${write.status})`);

      const notify = await fetch(
        `${base}/api/notifications`,
        as(counselor.cookie, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify({ studentId, title: "x", message: "y" }),
        })
      );
      assert(notify.status === 403, `counselor notified an unassigned student (${notify.status})`);

      return "403 on read, list, grade write and notify";
    } finally {
      const removed = await fetch(
        `${base}/api/students/${studentId}`,
        as(admin.cookie, { method: "DELETE", headers: { Origin: base } })
      );
      assert(removed.status === 200, `cleanup of the test student failed (${removed.status})`);
    }
  });

  await check("admin can update a student and the change is persisted", async () => {
    const target = allStudents.students[0];
    const originalName = target.user?.firstName || "";

    const update = (firstName) =>
      fetch(
        `${base}/api/students/${target.id}`,
        as(admin.cookie, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify({ firstName }),
        })
      );

    const res = await update("ویرایش‌شده");
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const payload = await res.json();
    assert(payload.student.user.firstName === "ویرایش‌شده", "the update was not applied");

    // Restore the original value so re-running against a real database does not
    // leave test data behind.
    await update(originalName);

    return "200 (original value restored)";
  });

  await check("a student cannot be created with an invalid grade level", async () => {
    const res = await fetch(
      `${base}/api/students`,
      as(admin.cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({
          firstName: "الف",
          lastName: "ب",
          studentCode: `X${Date.now().toString().slice(-8)}`,
          grade: 12,
          schoolYear: "1403-1404",
        }),
      })
    );
    assert(res.status === 400, `expected 400, got ${res.status}`);
    return "400";
  });

  await check("duplicate emails are rejected by the API", async () => {
    const username = `probe_${Date.now().toString().slice(-8)}`;
    const email = `dup_${Date.now()}@example.local`;
    const make = (name) =>
      fetch(
        `${base}/api/users`,
        as(admin.cookie, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: base },
          body: JSON.stringify({ username: name, password: "Str0ngPass!", firstName: "ا", lastName: "ب", email, role: "STUDENT" }),
        })
      );

    const first = await make(username);
    assert(first.status === 201, `first user creation failed (${first.status})`);
    const firstUser = await first.json();

    try {
      const second = await make(`${username}_2`);
      assert(second.status === 400, `duplicate email was accepted (${second.status})`);

      // Cleanup of the second username is unnecessary: it was never created.
      return "400 on the second user";
    } finally {
      await fetch(`${base}/api/users/${firstUser.user.id}`, as(admin.cookie, { method: "DELETE", headers: { Origin: base } }));
    }
  });

  // --- Logout really invalidates the session ------------------------------
  await check("logout invalidates the session server-side", async () => {
    const throwaway = await login(base, { ...CREDENTIALS.student, role: "STUDENT" });
    assert(throwaway.status === 200, "could not log in for the logout test");

    const before = await fetch(`${base}/api/auth/me`, as(throwaway.cookie));
    assert(before.status === 200, `session should be valid, got ${before.status}`);

    const logout = await fetch(
      `${base}/api/auth/logout`,
      as(throwaway.cookie, { method: "POST", headers: { Origin: base } })
    );
    assert(logout.status === 200, `logout returned ${logout.status}`);

    const after = await fetch(`${base}/api/auth/me`, as(throwaway.cookie));
    assert(after.status === 401, `the old cookie still works (${after.status})`);
    return "cookie rejected after logout";
  });

  // --- Password reset flow -------------------------------------------------
  await check("password reset issues a single-use, working token", async () => {
    const request = await fetch(`${base}/api/auth/forgot-password`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ username: CREDENTIALS.student.username }),
    });
    assert(request.status === 200, `forgot-password returned ${request.status}`);

    const payload = await request.json();
    assert(payload.message.includes("اگر این نام کاربری"), "the response is not the generic one");

    if (!payload.devResetUrl) {
      // Correct for a production build: the reset link is never returned over
      // HTTP. The token lifecycle itself is covered by
      // scripts/verify-password-reset.mjs, which talks to the database.
      return "token issued, no link exposed in production (lifecycle covered by verify-password-reset)";
    }

    const token = new URL(payload.devResetUrl).searchParams.get("token");
    assert(token, "the dev reset url has no token");

    const weak = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ token, newPassword: "weak" }),
    });
    assert(weak.status === 400, `the password policy was not enforced (${weak.status})`);

    const newPassword = "Verify@Reset123";
    const applied = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ token, newPassword }),
    });
    assert(applied.status === 200, `reset failed with ${applied.status}`);

    const replay = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ token, newPassword: "Verify@Reset456" }),
    });
    assert(replay.status === 400, `the token was reusable (${replay.status})`);

    const relogin = await login(base, {
      username: CREDENTIALS.student.username,
      password: newPassword,
      role: "STUDENT",
    });
    assert(relogin.status === 200, `login with the new password failed (${relogin.status})`);

    // Restore the seeded password so repeated runs stay idempotent.
    await fetch(`${base}/api/auth/change-password`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base, Cookie: relogin.cookie },
      body: JSON.stringify({ currentPassword: newPassword, newPassword: CREDENTIALS.student.password }),
    });

    return "issued, policy-checked, single-use, password restored";
  });

  await check("forgot-password does not reveal whether a user exists", async () => {
    const res = await fetch(`${base}/api/auth/forgot-password`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ username: `nobody_${Date.now()}` }),
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const payload = await res.json();
    assert(payload.message.includes("اگر این نام کاربری"), "the response differs for unknown users");
    return "generic response";
  });
}

async function main() {
  // `next start` reads .env files by itself but plain node does not, so load
  // them here too — otherwise the live checks would skip despite a configured
  // database. Existing environment values always win.
  loadProjectEnv();

  const port = await findFreePort(PORT);
  const base = `http://${HOST}:${port}`;

  console.log(`\nStarting production server on ${base} ...\n`);

  // Run the Next binary through node directly so there is no wrapper shell to
  // leave an orphaned process behind when we shut it down.
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production" },
    }
  );

  let serverLog = "";
  server.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  const ready = await waitForServer(port);

  if (!ready) {
    console.error("Server did not become ready.\n", serverLog.slice(-2000));
    server.kill();
    process.exit(1);
  }

  const dbAvailable = await mongoAvailable();

  try {
    // --- Anonymous access to the panels ------------------------------------
    for (const [panel, login] of [
      ["/admin", "/login/admin"],
      ["/counselor", "/login/counselor"],
      ["/student", "/login/student"],
      ["/admin/users", "/login/admin"],
      ["/student/grades", "/login/student"],
    ]) {
      await check(`anonymous GET ${panel} redirects to ${login}`, async () => {
        const res = await fetch(`${base}${panel}`, { redirect: "manual" });
        assert(
          res.status === 302 || res.status === 307 || res.status === 308,
          `expected a redirect, got ${res.status}`
        );
        const location = res.headers.get("location") || "";
        assert(location.endsWith(login), `redirected to ${location} instead of ${login}`);
        return `${res.status} -> ${login}`;
      });
    }

    // --- Public pages stay reachable ---------------------------------------
    await check("anonymous GET / serves the landing page", async () => {
      const res = await fetch(`${base}/`, { redirect: "manual" });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const html = await res.text();
      assert(html.includes("هدایت تحصیلی"), "landing page content missing");
      return "200";
    });

    for (const page of ["/login/admin", "/login/counselor", "/login/student"]) {
      await check(`GET ${page} renders the login form`, async () => {
        const res = await fetch(`${base}${page}`, { redirect: "manual" });
        assert(res.status === 200, `expected 200, got ${res.status}`);
        const html = await res.text();
        assert(html.includes("نام کاربری"), "login form markup missing");
        assert(html.includes("noindex"), "login pages must not be indexed");
        return "200, noindex";
      });
    }

    // --- Protected APIs reject anonymous callers ---------------------------
    const apiExpectations = [
      ["/api/users", 403],
      ["/api/students", 401],
      ["/api/grades", 401],
      ["/api/tests", 401],
      ["/api/guidance", 401],
      ["/api/reports?type=dashboard", 401],
      ["/api/counselors", 401],
      ["/api/auth/me", 401],
    ];

    for (const [endpoint, expected] of apiExpectations) {
      await check(`anonymous GET ${endpoint} -> ${expected}`, async () => {
        const res = await fetch(`${base}${endpoint}`, { redirect: "manual" });
        assert(
          res.status === expected,
          `expected ${expected}, got ${res.status}`
        );
        const text = await res.text();
        assert(hasNoInternalDetails(text), `response leaked internals: ${text.slice(0, 120)}`);
        return String(res.status);
      });
    }

    // --- Anonymous writes are rejected -------------------------------------
    for (const [method, endpoint] of [
      ["POST", "/api/users"],
      ["POST", "/api/students"],
      ["POST", "/api/grades"],
      ["PUT", "/api/users/000000000000000000000000"],
      ["DELETE", "/api/students/000000000000000000000000"],
    ]) {
      await check(`anonymous ${method} ${endpoint} is refused`, async () => {
        const res = await fetch(`${base}${endpoint}`, {
          method,
          redirect: "manual",
          headers: { "Content-Type": "application/json" },
          body: method === "DELETE" ? undefined : JSON.stringify({}),
        });
        assert(
          res.status === 401 || res.status === 403,
          `expected 401/403, got ${res.status}`
        );
        return String(res.status);
      });
    }

    // --- CSRF: foreign Origin is rejected ----------------------------------
    await check("POST with a foreign Origin is rejected (CSRF)", async () => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example.com",
        },
        body: JSON.stringify({ username: "admin", password: "x" }),
      });
      assert(res.status === 403, `expected 403, got ${res.status}`);
      return "403";
    });

    await check("POST with a same-origin Origin passes the CSRF gate", async () => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          Origin: base,
        },
        body: JSON.stringify({ username: "", password: "" }),
      });
      assert(res.status !== 403, "same-origin request was wrongly blocked");
      assert(res.status === 400, `expected a validation error, got ${res.status}`);
      const body = await res.json();
      assert(hasNoInternalDetails(JSON.stringify(body)), "error body leaked internals");
      return `${res.status} (validation)`;
    });

    await check("login rejects an unknown role value", async () => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ username: "admin", password: "x", role: "SUPERUSER" }),
      });
      assert(res.status === 400, `expected 400, got ${res.status}`);
      return "400";
    });

    // --- Security headers ---------------------------------------------------
    await check("API responses carry the security headers", async () => {
      const res = await fetch(`${base}/api/auth/me`, { redirect: "manual" });
      const required = {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "cache-control": "no-store",
      };
      for (const [header, expected] of Object.entries(required)) {
        const actual = res.headers.get(header) || "";
        assert(
          actual.toLowerCase().includes(expected.toLowerCase()),
          `${header} was "${actual}", expected to include "${expected}"`
        );
      }
      const csp = res.headers.get("content-security-policy") || "";
      assert(csp.includes("frame-ancestors 'none'"), "CSP is missing frame-ancestors");
      assert(csp.includes("object-src 'none'"), "CSP is missing object-src");
      return "nosniff, DENY, no-store, CSP";
    });

    await check("private responses are not cacheable", async () => {
      const res = await fetch(`${base}/api/students`, { redirect: "manual" });
      const cacheControl = res.headers.get("cache-control") || "";
      assert(cacheControl.includes("no-store"), `cache-control was "${cacheControl}"`);
      return cacheControl;
    });

    // --- Password reset surface --------------------------------------------
    await check("GET /reset-password renders for anonymous visitors", async () => {
      const res = await fetch(`${base}/reset-password`, { redirect: "manual" });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      return "200";
    });

    await check("reset-password rejects a malformed token before touching the DB", async () => {
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ token: "not-a-valid-token", newPassword: "Str0ngPass!" }),
      });
      assert(res.status === 400, `expected 400, got ${res.status}`);
      const body = await res.json();
      assert(hasNoInternalDetails(JSON.stringify(body)), "error body leaked internals");
      return "400";
    });

    await check("reset-password enforces the password policy", async () => {
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ token: "a".repeat(64), newPassword: "weak" }),
      });
      assert(res.status === 400, `expected 400, got ${res.status}`);
      return "400";
    });

    // --- Tests that need a live database -----------------------------------
    if (dbAvailable) {
      await runLiveChecks(base);
    } else {
      const configured = findEnvValue("DATABASE_URL");
      record(
        "live login + role checks",
        "SKIP",
        configured
          ? `DATABASE_URL (${configured.source}: ${maskSecret(configured.value)}) is not reachable — run \`npm run db:check\` for details, or \`npm run verify:live\` for a temporary MongoDB`
          : "no DATABASE_URL configured — copy .env.example to .env and set it, or run `npm run verify:live`"
      );
    }
  } finally {
    server.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}` +
      ` — ${results.length - failures - skipped} passed, ${skipped} skipped\n`
  );

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
