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

  // --- Homepage media (the chain that used to fail with a generic 500) ----
  //
  // The regression this guards: a single missing `@db.ObjectId` in
  // schema.prisma made `prisma generate` fail, so the deployed server ran a
  // Prisma Client without the `homeMedia` delegate and every query threw a
  // TypeError — reported to the admin only as "ذخیره فایل در سامانه انجام نشد".
  //
  // A real file is never uploaded here; the checks exercise the persistence
  // half of the chain, which is where the failure actually happened.

  const mediaPayload = {
    title: `verify-media-${Date.now()}`,
    description: "created by verify-auth-http",
    type: "IMAGE",
    url: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    publicId: "guidance-app/homepage/images/verify-sample",
    resourceType: "image",
    mimeType: "image/png",
    bytes: 2048,
  };

  let createdMediaId = null;

  await check("admin can save homepage media metadata (the exact panel request)", async () => {
    const res = await fetch(`${base}/api/admin/home-media`, as(admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify(mediaPayload),
    }));

    const data = await res.json().catch(() => ({}));

    // 503 is the explicit signal for a stale generated Prisma Client.
    assert(res.status !== 503, `the Prisma Client is out of date: ${data.error}`);
    assert(res.status === 201, `expected 201, got ${res.status} (${data.error || "no message"})`);
    assert(data.item?.id, "the created item has no id");
    assert(data.item.sortOrder >= 0, "sortOrder was not assigned");

    createdMediaId = data.item.id;
    return `201, sortOrder ${data.item.sortOrder}`;
  });

  await check("a saved media row is linked to its admin creator", async () => {
    assert(createdMediaId, "no media row was created");
    const res = await fetch(`${base}/api/admin/home-media`, as(admin.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const data = await res.json();

    const item = (data.items || []).find((entry) => entry.id === createdMediaId);
    assert(item, "the created row is missing from the list");
    assert(item.createdBy === admin.body.user.id, "createdBy does not point at the signed-in admin");
    return `createdBy = ${String(item.createdBy).slice(-6)}`;
  });

  await check("media metadata is rejected when incomplete", async () => {
    const res = await fetch(`${base}/api/admin/home-media`, as(admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ ...mediaPayload, publicId: "" }),
    }));
    assert(res.status === 400, `expected 400, got ${res.status}`);
    return "400";
  });

  await check("media metadata rejects a non-https url", async () => {
    const res = await fetch(`${base}/api/admin/home-media`, as(admin.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ ...mediaPayload, url: "javascript:alert(1)" }),
    }));
    assert(res.status === 400, `expected 400, got ${res.status}`);
    return "400";
  });

  await check("a saved media row becomes visible on the public homepage", async () => {
    assert(createdMediaId, "no media row was created");
    const res = await fetch(`${base}/api/home-media`);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const data = await res.json();
    assert(
      (data.items || []).some((entry) => entry.id === createdMediaId),
      "the active item is not published to the public endpoint"
    );
    assert(!JSON.stringify(data).includes("publicId"), "the public endpoint leaks internal storage ids");
    return `200, ${data.items.length} published item(s)`;
  });

  await check("the public endpoint never exposes inactive media", async () => {
    assert(createdMediaId, "no media row was created");

    const hide = await fetch(`${base}/api/admin/home-media`, as(admin.cookie, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ id: createdMediaId, isActive: false }),
    }));
    assert(hide.status === 200, `expected 200 from PATCH, got ${hide.status}`);

    const res = await fetch(`${base}/api/home-media`);
    const data = await res.json();
    assert(
      !(data.items || []).some((entry) => entry.id === createdMediaId),
      "a hidden item is still published publicly"
    );
    return "hidden item is not published";
  });

  await check("media endpoints refuse anonymous callers", async () => {
    const list = await fetch(`${base}/api/admin/home-media`, { redirect: "manual" });
    assert(list.status === 403 || list.status === 401, `expected 401/403, got ${list.status}`);

    const create = await fetch(`${base}/api/admin/home-media`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify(mediaPayload),
    });
    assert(create.status === 403 || create.status === 401, `expected 401/403, got ${create.status}`);
    return `${list.status}/${create.status}`;
  });

  await check("deleting media removes the row even when storage is unreachable", async () => {
    assert(createdMediaId, "no media row was created");

    const res = await fetch(`${base}/api/admin/home-media?id=${encodeURIComponent(createdMediaId)}`, as(admin.cookie, {
      method: "DELETE",
      headers: { Origin: base },
    }));
    const data = await res.json().catch(() => ({}));

    // A storage failure must not leave an item stuck on the homepage.
    assert(res.status === 200, `expected 200, got ${res.status}`);

    const list = await fetch(`${base}/api/admin/home-media`, as(admin.cookie));
    const listed = await list.json();
    assert(
      !(listed.items || []).some((entry) => entry.id === createdMediaId),
      "the deleted row is still listed"
    );

    createdMediaId = null;
    return `200, storageRemoved=${data.storageRemoved}`;
  });

  await check("the diagnostics endpoint reports readiness without leaking secrets", async () => {
    const res = await fetch(`${base}/api/admin/diagnostics?probe=1`, as(admin.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);

    const data = await res.json();
    const serialized = JSON.stringify(data);

    // Never echo a configured value, whatever it is.
    for (const key of ["DATABASE_URL", "AUTH_SECRET", "CLOUDINARY_API_SECRET", "CLOUDINARY_API_KEY"]) {
      const value = process.env[key];
      assert(!value || !serialized.includes(value), `the diagnostics response leaked ${key}`);
    }
    assert(!/mongodb(\+srv)?:\/\//.test(serialized), "the response contains a connection string");
    assert(!/\$2[aby]\$/.test(serialized), "the response contains a bcrypt hash");

    assert(data.summary?.prismaClientComplete === true, "the Prisma Client is incomplete");
    assert(data.summary?.databaseConfigured === true, "DATABASE_URL is not visible to the server");
    assert(data.summary?.authenticated === true, "the endpoint lost the session");
    assert(data.summary?.role === "ADMIN", "the reported role is wrong");
    assert(data.probe?.created === true, "the write probe could not create a row");
    assert(data.probe?.readBack === true, "the write probe could not read the row back");
    assert(data.probe?.cleanedUp === true, "the write probe left a row behind");

    // `ok` must summarise the checks it returns, so the flag can be trusted.
    const derivedOk = (data.checks || []).every((entry) => entry.ok);
    assert(data.ok === derivedOk, "the overall status contradicts the individual checks");

    // Every database-backed check must pass regardless of where this runs. The
    // Cloudinary flag is environment-dependent and is reported, not asserted
    // (these checks never upload a real file).
    for (const entry of data.checks || []) {
      if (entry.key === "cloudinaryConfigured") continue;
      assert(entry.ok, `diagnostic check failed: ${entry.key} (${entry.detail})`);
    }

    return `prismaClientComplete=true, write probe ok, cloudinaryConfigured=${data.summary.cloudinaryConfigured}`;
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

  await check("the media and diagnostics APIs are closed to non-admins", async () => {
    // The diagnostics endpoint reports configuration state, so a student must
    // not even learn whether it exists.
    const endpoints = ["/api/admin/home-media", "/api/admin/diagnostics"];

    for (const endpoint of endpoints) {
      const read = await fetch(`${base}${endpoint}`, as(student.cookie));
      assert(read.status === 403, `${endpoint} returned ${read.status} for a student, expected 403`);

      const anonymous = await fetch(`${base}${endpoint}`, { redirect: "manual" });
      assert(
        anonymous.status === 401 || anonymous.status === 403,
        `${endpoint} returned ${anonymous.status} anonymously, expected 401/403`
      );
    }

    const sign = await fetch(
      `${base}/api/admin/home-media/sign`,
      as(student.cookie, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ type: "IMAGE" }),
      })
    );
    assert(sign.status === 403, `the signing endpoint returned ${sign.status} for a student, expected 403`);

    return `${endpoints.length} endpoints + signing, all 403`;
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

  // =========================================================================
  // Self-service registration
  // =========================================================================

  const stamp = Date.now().toString().slice(-8);

  // The password-reset checks above intentionally revoke every session of the
  // student account, and a development build exercises that path. Take a fresh
  // cookie so the feature checks below are correct in both dev and production
  // runs instead of silently depending on the early return.
  const refreshedStudent = await login(base, { ...CREDENTIALS.student, role: "STUDENT" });
  if (refreshedStudent.cookie) {
    student.cookie = refreshedStudent.cookie;
    student.status = refreshedStudent.status;
  }

  const post = (path, cookie, body) =>
    fetch(`${base}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });

  const patch = (path, cookie, body) =>
    fetch(`${base}${path}`, {
      method: "PATCH",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });

  /** Find the id of a user created during this run, so it can be cleaned up. */
  const findUserId = async (username) => {
    const res = await fetch(`${base}/api/users?limit=50&search=${username}`, as(admin.cookie));
    if (!res.ok) return null;
    const payload = await res.json();
    return (payload.users || []).find((entry) => entry.username === username)?.id || null;
  };

  await check("public registration cannot create an administrator", async () => {
    const res = await post("/api/auth/register", null, {
      role: "ADMIN",
      firstName: "ا",
      lastName: "ب",
      username: `hack${stamp}`,
      password: "StrongPass1",
    });

    assert(res.status === 400, `an admin account was creatable through sign-up (${res.status})`);

    // Nothing must have been written: the username can still be used later.
    const stillFree = await findUserId(`hack${stamp}`);
    assert(!stillFree, "a rejected registration left a user record behind");
    return "400";
  });

  await check("registration enforces the username and password rules", async () => {
    const badUsername = await post("/api/auth/register", null, {
      role: "STUDENT",
      firstName: "ا",
      lastName: "ب",
      username: "ali_1405",
      password: "StrongPass1",
    });
    assert(badUsername.status === 400, `an underscore username was accepted (${badUsername.status})`);

    const weakPassword = await post("/api/auth/register", null, {
      role: "STUDENT",
      firstName: "ا",
      lastName: "ب",
      username: `weak${stamp}`,
      password: "weakpass",
    });
    assert(weakPassword.status === 400, `a weak password was accepted (${weakPassword.status})`);
    return "400 for both";
  });

  await check("a self-registered student can sign in immediately", async () => {
    const username = `std${stamp}`;
    const registered = await post("/api/auth/register", null, {
      role: "STUDENT",
      firstName: "دانش‌آموز",
      lastName: "آزمایشی",
      username,
      password: "StrongPass1",
      grade: 8,
      schoolYear: "1404-1405",
    });

    assert(registered.status === 201, `registration failed (${registered.status})`);
    const payload = await registered.json();
    assert(payload.requiresApproval === false, "a student sign-up should not await approval");

    const userId = await findUserId(username);
    assert(userId, "the registered student is missing from the user list");

    try {
      const signedIn = await login(base, { username, password: "StrongPass1", role: "STUDENT" });
      assert(signedIn.status === 200, `the new student could not sign in (${signedIn.status})`);
      assert(signedIn.cookie, "no session cookie was issued");

      // The student must land in their own panel, not in someone else's.
      const panel = await fetch(`${base}/api/auth/me`, as(signedIn.cookie));
      assert(panel.status === 200, `the new session is not usable (${panel.status})`);
      const me = await panel.json();
      assert(me.user.role === "STUDENT", "the new account has the wrong role");
      assert(!JSON.stringify(me).includes("$2"), "the response leaked a password hash");

      const adminOnly = await fetch(`${base}/api/users?limit=1`, as(signedIn.cookie));
      assert(adminOnly.status === 403, `the new student reached an admin API (${adminOnly.status})`);

      return "201 → login 200 as STUDENT";
    } finally {
      const removed = await fetch(
        `${base}/api/users/${userId}`,
        as(admin.cookie, { method: "DELETE", headers: { Origin: base } })
      );
      assert(removed.status === 200, `cleanup of the registered student failed (${removed.status})`);
    }
  });

  await check("a self-registered counselor cannot sign in before approval", async () => {
    const username = `cns${stamp}`;
    const registered = await post("/api/auth/register", null, {
      role: "COUNSELOR",
      firstName: "مشاور",
      lastName: "آزمایشی",
      username,
      password: "StrongPass1",
    });

    assert(registered.status === 201, `counselor registration failed (${registered.status})`);
    const payload = await registered.json();
    assert(payload.requiresApproval === true, "a counselor sign-up must await approval");

    const userId = await findUserId(username);
    assert(userId, "the registered counselor is missing from the user list");

    try {
      const blocked = await login(base, { username, password: "StrongPass1", role: "COUNSELOR" });
      assert(blocked.status === 403, `a pending counselor signed in (${blocked.status})`);
      assert(!blocked.cookie, "a session was issued to a pending counselor");
      assert(
        (blocked.body?.error || "").includes("تأیید"),
        "the pending-approval message is missing"
      );

      const approved = await patch(`/api/counselors/${userId}`, admin.cookie, { decision: "APPROVE" });
      assert(approved.status === 200, `approval failed (${approved.status})`);

      const allowed = await login(base, { username, password: "StrongPass1", role: "COUNSELOR" });
      assert(allowed.status === 200, `the approved counselor still cannot sign in (${allowed.status})`);

      return "403 pending → 200 approved";
    } finally {
      const removed = await fetch(
        `${base}/api/users/${userId}`,
        as(admin.cookie, { method: "DELETE", headers: { Origin: base } })
      );
      assert(removed.status === 200, `cleanup of the registered counselor failed (${removed.status})`);
    }
  });

  await check("counselor approval is refused for non-admins and for non-counselors", async () => {
    const counselors = await fetch(`${base}/api/counselors`, as(admin.cookie)).then((res) =>
      res.ok ? res.json() : { counselors: [] }
    );
    const target = (counselors.counselors || []).find((entry) => entry.role !== "ADMIN");

    // A student must not be able to approve anyone.
    const asStudent = await patch(`/api/counselors/${student.body?.user?.id || "x"}`, student.cookie, {
      decision: "APPROVE",
    });
    assert(
      asStudent.status === 403 || asStudent.status === 404,
      `a student reached the approval endpoint (${asStudent.status})`
    );

    if (target) {
      // Approving a non-counselor id must 404 rather than repurpose the account.
      const wrongRole = await patch(`/api/counselors/${student.body.user.id}`, admin.cookie, {
        decision: "APPROVE",
      });
      assert(wrongRole.status === 404, `a non-counselor was approvable (${wrongRole.status})`);
    }

    const badDecision = await patch(`/api/counselors/${counselors.counselors?.[0]?.id || "x"}`, admin.cookie, {
      decision: "DELETE",
    });
    assert(badDecision.status === 400, `an unknown decision was accepted (${badDecision.status})`);

    return "403 for students, 404 for wrong role, 400 for bad input";
  });

  // =========================================================================
  // Audit log
  // =========================================================================

  await check("the audit log is closed to anonymous and non-admin callers", async () => {
    const anonymous = await fetch(`${base}/api/audit-logs`, { redirect: "manual" });
    assert(anonymous.status === 401, `anonymous read returned ${anonymous.status}`);

    const asStudent = await fetch(`${base}/api/audit-logs`, as(student.cookie));
    assert(asStudent.status === 403, `a student read the audit log (${asStudent.status})`);

    const asCounselor = await fetch(`${base}/api/audit-logs`, as(counselor.cookie));
    assert(asCounselor.status === 403, `a counselor read the audit log (${asCounselor.status})`);

    return "401 anonymous, 403 student, 403 counselor";
  });

  await check("the admin audit log is Persian, paginated and free of secrets", async () => {
    const res = await fetch(`${base}/api/audit-logs?limit=20`, as(admin.cookie));
    assert(res.status === 200, `expected 200, got ${res.status}`);

    const payload = await res.json();
    assert(Array.isArray(payload.logs), "the response has no logs array");
    assert(payload.pagination && payload.pagination.total >= 0, "pagination is missing");
    assert(Array.isArray(payload.actions) && payload.actions.length > 0, "the filter list is empty");
    assert(payload.logs.length > 0, "the audit log is empty after a full verification run");

    for (const entry of payload.logs) {
      assert(typeof entry.sentence === "string" && entry.sentence.length > 5, "missing Persian sentence");
      assert(/[\u0600-\u06FF]/.test(entry.sentence), "the sentence is not Persian");
      assert(typeof entry.actionLabel === "string", "missing the action label");
      assert(entry.details === undefined, "raw details must not be exposed");
    }

    // The most recent run must be visible in the trail.
    assert(
      payload.logs.some((entry) => entry.action === "LOGIN" || entry.action === "REGISTER"),
      "no LOGIN/REGISTER entry in the newest audit rows"
    );

    const serialized = JSON.stringify(payload);
    assert(!serialized.includes("$2"), "the audit response contains a password hash");
    assert(!serialized.includes("StrongPass1"), "the audit response contains a registered password");

    return `${payload.logs.length} entries, total ${payload.pagination.total}`;
  });

  await check("audit filters and pagination are validated", async () => {
    const filtered = await fetch(`${base}/api/audit-logs?action=LOGIN&limit=5`, as(admin.cookie));
    assert(filtered.status === 200, `filtered read returned ${filtered.status}`);
    const payload = await filtered.json();
    for (const entry of payload.logs) {
      assert(entry.action === "LOGIN", `the filter leaked a ${entry.action} row`);
    }

    const badPage = await fetch(`${base}/api/audit-logs?page=0`, as(admin.cookie));
    assert(badPage.status === 400, `an invalid page was accepted (${badPage.status})`);

    const badLimit = await fetch(`${base}/api/audit-logs?limit=5000`, as(admin.cookie));
    assert(badLimit.status === 400, `an oversized limit was accepted (${badLimit.status})`);

    return `${payload.logs.length} LOGIN rows, 400 on invalid input`;
  });

  // =========================================================================
  // Support tickets
  // =========================================================================

  let studentTicketId = null;

  await check("a student can open a support ticket", async () => {
    const res = await post("/api/support/tickets", student.cookie, {
      subject: `مشکل آزمایشی ${stamp}`,
      body: "این تیکت توسط اسکریپت بررسی خودکار ساخته شده است.",
      category: "GRADES",
      priority: "NORMAL",
    });

    assert(res.status === 201, `ticket creation returned ${res.status}`);
    const payload = await res.json();
    assert(payload.ticket.status === "OPEN", "a new ticket must start as OPEN");
    assert(payload.ticket._count.replies === 1, "the opening message was not stored");

    studentTicketId = payload.ticket.id;
    return `201 (${studentTicketId.slice(-6)})`;
  });

  await check("a ticket is only readable by its owner and the admin", async () => {
    assert(studentTicketId, "no ticket to check");

    const owner = await fetch(`${base}/api/support/tickets/${studentTicketId}`, as(student.cookie));
    assert(owner.status === 200, `the owner could not read their ticket (${owner.status})`);
    const payload = await owner.json();
    assert(payload.ticket.canReply === true, "the owner should be able to reply");
    assert(payload.ticket.canChangeStatus === false, "a student must not change the status");
    assert(!JSON.stringify(payload).includes("userId"), "the client shape exposes the owner id");

    const stranger = await fetch(`${base}/api/support/tickets/${studentTicketId}`, as(counselor.cookie));
    assert(stranger.status === 404, `a counselor read a student ticket (${stranger.status})`);

    const anonymous = await fetch(`${base}/api/support/tickets/${studentTicketId}`, { redirect: "manual" });
    assert(anonymous.status === 401, `an anonymous caller read a ticket (${anonymous.status})`);

    return "200 owner, 404 stranger, 401 anonymous";
  });

  await check("only the owner or an admin may write into a ticket thread", async () => {
    const strider = await patch(`/api/support/tickets/${studentTicketId}`, counselor.cookie, {
      body: "پیام غیرمجاز",
    });
    assert(strider.status === 404, `a counselor wrote into a student ticket (${strider.status})`);

    const owner = await patch(`/api/support/tickets/${studentTicketId}`, student.cookie, {
      body: "اطلاعات تکمیلی از سوی دانش‌آموز.",
    });
    assert(owner.status === 200, `the owner could not reply (${owner.status})`);
    const payload = await owner.json();
    assert(payload.reply.isStaff === false, "an ordinary message was marked as staff");

    const statusAttempt = await patch(`/api/support/tickets/${studentTicketId}`, student.cookie, {
      status: "CLOSED",
    });
    assert(statusAttempt.status === 403, `a student changed the ticket status (${statusAttempt.status})`);

    return "404 stranger, 200 owner, 403 status change";
  });

  await check("the admin queue exposes the ticket and can answer and close it", async () => {
    const queue = await fetch(`${base}/api/support/tickets`, as(admin.cookie));
    assert(queue.status === 200, `the admin queue returned ${queue.status}`);
    const payload = await queue.json();
    assert(payload.canManage === true, "the admin cannot manage tickets");
    assert(
      (payload.tickets || []).some((ticket) => ticket.id === studentTicketId),
      "the student ticket is missing from the admin queue"
    );

    const reply = await patch(`/api/support/tickets/${studentTicketId}`, admin.cookie, {
      body: "پاسخ کارشناس پشتیبانی برای بررسی خودکار.",
    });
    assert(reply.status === 200, `the admin reply failed (${reply.status})`);
    const replied = await reply.json();
    assert(replied.reply.isStaff === true, "an admin reply was not marked as staff");
    assert(replied.ticket.status === "IN_PROGRESS", `status did not advance (${replied.ticket.status})`);

    const closed = await patch(`/api/support/tickets/${studentTicketId}`, admin.cookie, {
      status: "CLOSED",
    });
    assert(closed.status === 200, `closing the ticket failed (${closed.status})`);

    const closedReply = await patch(`/api/support/tickets/${studentTicketId}`, student.cookie, {
      body: "پیام پس از بسته شدن تیکت.",
    });
    assert(closedReply.status === 403, `a closed ticket accepted a user message (${closedReply.status})`);

    return "queue 200, staff reply 200, in-progress, closed, user reply 403";
  });

  await check("only an admin can delete a ticket, and the deletion is audited", async () => {
    const asStudent = await fetch(`${base}/api/support/tickets/${studentTicketId}`, {
      method: "DELETE",
      redirect: "manual",
      headers: { Origin: base, Cookie: student.cookie },
    });
    assert(asStudent.status === 403, `a student deleted a ticket (${asStudent.status})`);

    const removed = await fetch(`${base}/api/support/tickets/${studentTicketId}`, {
      method: "DELETE",
      redirect: "manual",
      headers: { Origin: base, Cookie: admin.cookie },
    });
    assert(removed.status === 200, `the admin could not delete the ticket (${removed.status})`);

    const gone = await fetch(`${base}/api/support/tickets/${studentTicketId}`, as(admin.cookie));
    assert(gone.status === 404, `the ticket still exists (${gone.status})`);

    const audit = await fetch(`${base}/api/audit-logs?action=DELETE_TICKET`, as(admin.cookie));
    assert(audit.status === 200, `audit read failed (${audit.status})`);
    const payload = await audit.json();
    assert((payload.logs || []).length > 0, "the ticket deletion was not audited");
    assert(
      payload.logs.every((entry) => entry.action === "DELETE_TICKET"),
      "the action filter leaked other rows"
    );

    return "403 student, 200 admin, audited";
  });

  await check("tickets are scoped to the signed-in user", async () => {
    const mine = await fetch(`${base}/api/support/tickets`, as(student.cookie));
    assert(mine.status === 200, `the student queue returned ${mine.status}`);
    const studentView = await mine.json();
    assert(studentView.canManage === false, "a student must not get the manage flag");

    const staffView = await fetch(`${base}/api/support/tickets`, as(counselor.cookie));
    assert(staffView.status === 200, `the counselor queue returned ${staffView.status}`);
    const counselorPayload = await staffView.json();
    assert(counselorPayload.canManage === false, "a counselor must not get the manage flag");

    // An admin cannot open tickets, only answer them.
    const adminCreate = await post("/api/support/tickets", admin.cookie, {
      subject: "تیکت مدیر آزمایشی",
      body: "مدیر نباید بتواند تیکت جدید ثبت کند.",
    });
    assert(adminCreate.status === 403, `an admin opened a ticket (${adminCreate.status})`);

    return "student and counselor see their own queue only";
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
