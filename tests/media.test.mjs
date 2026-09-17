/**
 * Regression tests for the homepage media upload chain.
 *
 * These lock in the fix for the failure that made `/admin/homepage` report
 * "ذخیره فایل در سامانه انجام نشد" in production:
 *
 *   `model Session` lost its `@db.ObjectId`, so `prisma generate` failed with
 *   P1012. The deploy kept a stale generated client that had no `homeMedia`
 *   delegate, so every media query threw a TypeError at request time while the
 *   build itself stayed green.
 *
 * The schema assertions below make that regression impossible to reintroduce
 * silently.
 *
 * Run with: npm test   (node --test, no extra dependencies)
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  describeError,
  redactSecrets,
  isMissingPrismaDelegate,
  envPresence,
  userMessageFor,
} from "../lib/diagnostics.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCHEMA = fs.readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
const CHECK_DB = fs.readFileSync(path.join(ROOT, "scripts", "check-db.mjs"), "utf8");

// ---------------------------------------------------------------------------
// Schema integrity — the root cause of the production failure
// ---------------------------------------------------------------------------

/** Split the schema into `{ name, body }` blocks so a model can be inspected. */
function parseModels(source) {
  const models = [];
  const pattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    models.push({ name: match[1], body: match[2] });
  }
  return models;
}

const MODELS = parseModels(SCHEMA);

test("the schema declares the models the media feature depends on", () => {
  const names = MODELS.map((model) => model.name);
  for (const required of ["User", "Session", "HomeMedia", "EducationalVideo", "AuditLog"]) {
    assert.ok(names.includes(required), `model ${required} is missing from schema.prisma`);
  }
});

test("Session.id keeps its @db.ObjectId native type", () => {
  // Exactly the field that was dropped: without it `prisma generate` fails with
  // P1012 ("MongoDB @default(auto()) fields must have ObjectId native type").
  const session = MODELS.find((model) => model.name === "Session");
  assert.ok(session, "Session model is missing");

  const idLine = session.body.split("\n").find((line) => /^\s*id\s/.test(line));
  assert.ok(idLine, "Session has no id field");
  assert.match(idLine, /@db\.ObjectId/, "Session.id must declare @db.ObjectId");
});

test("every MongoDB @id with @default(auto()) declares @db.ObjectId", () => {
  const offenders = [];

  MODELS.forEach((model) => {
    model.body.split("\n").forEach((line) => {
      if (!/@id\b/.test(line)) return;
      if (!/@default\(auto\(\)\)/.test(line)) return;
      if (/@db\.ObjectId/.test(line)) return;
      offenders.push(`${model.name}: ${line.trim()}`);
    });
  });

  assert.deepEqual(
    offenders,
    [],
    `prisma generate would fail with P1012 for: ${offenders.join(" | ")}`
  );
});

test("HomeMedia stores createdBy as an ObjectId and keeps the creator relation", () => {
  const media = MODELS.find((model) => model.name === "HomeMedia");
  assert.ok(media, "HomeMedia model is missing");

  const createdBy = media.body.split("\n").find((line) => /^\s*createdBy\s/.test(line));
  assert.ok(createdBy, "HomeMedia.createdBy is missing");
  assert.match(createdBy, /@db\.ObjectId/, "createdBy must be an ObjectId reference");
  assert.match(createdBy, /\?/, "createdBy must stay optional so a missing session id cannot break an insert");

  assert.match(media.body, /creator\s+User\?/, "the creator relation must be preserved");
  assert.match(media.body, /@map\("_id"\)/, "HomeMedia.id must map to _id");
});

test("the User model keeps the back-relation for uploaded media", () => {
  const user = MODELS.find((model) => model.name === "User");
  assert.ok(user, "User model is missing");
  assert.match(user.body, /homeMedia\s+HomeMedia\[\]/, "User.homeMedia back-relation is missing");
});

test("db:check covers every model so schema drift is reported", () => {
  const listMatch = CHECK_DB.match(/const EXPECTED_COLLECTIONS = \[([\s\S]*?)\];/);
  assert.ok(listMatch, "EXPECTED_COLLECTIONS is missing from scripts/check-db.mjs");

  const listed = new Set(listMatch[1].match(/"[^"]+"/g)?.map((entry) => entry.replace(/"/g, "")) ?? []);
  const uncovered = MODELS.map((model) => model.name).filter((name) => !listed.has(name));

  assert.deepEqual(uncovered, [], `these models are not checked by db:check: ${uncovered.join(", ")}`);
  assert.ok(listed.has("HomeMedia"), "HomeMedia must be checked by db:check");
});

// ---------------------------------------------------------------------------
// Secret hygiene in diagnostics
// ---------------------------------------------------------------------------

test("redactSecrets removes a configured secret wherever it appears", () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "super-secret-value-that-must-not-be-logged";

  try {
    const output = redactSecrets("failed with secret super-secret-value-that-must-not-be-logged in it");
    assert.ok(!output.includes("super-secret-value-that-must-not-be-logged"));
    assert.ok(output.includes("<redacted:AUTH_SECRET>"));
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});

test("redactSecrets masks a connection string in any form", () => {
  const output = redactSecrets("connect failed: mongodb+srv://user:p4ssw0rd@cluster0.example.mongodb.net/db?x=1");
  assert.ok(!output.includes("p4ssw0rd"), "the database password leaked");
  assert.ok(output.includes("mongodb://<redacted>"));
});

test("redactSecrets masks authorization headers", () => {
  const output = redactSecrets("Authorization: Bearer abcdef1234567890abcdef1234567890");
  assert.ok(!output.includes("abcdef1234567890abcdef1234567890"));
});

test("describeError never lets a credential escape through message or name", () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "mongodb+srv://appuser:TopSecret123@cluster0.example.mongodb.net/guidance";

  try {
    const error = new Error(
      "Command failed on mongodb+srv://appuser:TopSecret123@cluster0.example.mongodb.net/guidance\nsecond line"
    );
    error.name = "MongoServerError";
    error.code = "P2021";

    const described = describeError(error);
    const serialized = JSON.stringify(described);

    assert.ok(!serialized.includes("TopSecret123"), "the database password leaked into the described error");
    assert.ok(!serialized.includes("cluster0.example.mongodb.net"), "the cluster host leaked");
    assert.equal(described.code, "P2021");
    assert.equal(described.name, "MongoServerError");
    assert.equal(described.message.split("\n").length, 1, "only the first line is kept");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("describeError only copies allow-listed meta keys", () => {
  const error = new Error("unique constraint");
  error.code = "P2002";
  error.meta = {
    target: ["username"],
    modelName: "User",
    // Anything outside the allowlist must be dropped, whatever it holds.
    password: "should-not-survive",
    rawQuery: "db.users.insertOne({ password: 'hunter2' })",
    nested: { secret: "should-not-survive" },
  };

  const described = describeError(error);
  const serialized = JSON.stringify(described);

  // `target` is stringified for a bounded log line, and every non-allow-listed
  // key (password, rawQuery, nested) is dropped entirely.
  assert.deepEqual(Object.keys(described.meta).sort(), ["modelName", "target"]);
  assert.equal(described.meta.modelName, "User");
  assert.match(described.meta.target, /username/);
  assert.ok(!serialized.includes("should-not-survive"));
  assert.ok(!serialized.includes("hunter2"));
});

test("envPresence reports booleans and never the value", () => {
  const previous = process.env.CLOUDINARY_API_SECRET;
  process.env.CLOUDINARY_API_SECRET = "abcdef123456";

  try {
    const presence = envPresence(["CLOUDINARY_API_SECRET", "DEFINITELY_NOT_SET_KEY"]);
    assert.equal(presence.CLOUDINARY_API_SECRET, true);
    assert.equal(presence.DEFINITELY_NOT_SET_KEY, false);
    assert.ok(!JSON.stringify(presence).includes("abcdef123456"));
  } finally {
    if (previous === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = previous;
  }
});

// ---------------------------------------------------------------------------
// Stale Prisma Client detection
// ---------------------------------------------------------------------------

test("a stale generated client is detected from its TypeError", () => {
  const stale = new TypeError("Cannot read properties of undefined (reading 'findFirst')");
  assert.equal(isMissingPrismaDelegate(stale), true);
  assert.equal(isMissingPrismaDelegate(stale, "homeMedia"), false, "the message omits the model name");

  const named = new TypeError("Cannot read properties of undefined (reading 'homeMedia')");
  assert.equal(isMissingPrismaDelegate(named, "homeMedia"), true);
});

test("a normal error is not mistaken for a stale client", () => {
  const error = new Error("connection refused");
  error.name = "MongoNetworkError";
  assert.equal(isMissingPrismaDelegate(error), false);
});

test("a stale client produces an actionable Persian message", () => {
  const message = userMessageFor(new TypeError("Cannot read properties of undefined (reading 'create')"));
  assert.match(message, /PRISMA_CLIENT_STALE/);
});

test("known Prisma codes map to distinct, non-technical Persian messages", () => {
  const cases = [
    ["P2021", /SCHEMA_OUT_OF_DATE/],
    ["P2003", /ارتباط فایل/],
    ["P2002", /قبلاً ثبت شده/],
    ["P2031", /DB_TRANSACTIONS/],
  ];

  const seen = new Set();
  for (const [code, pattern] of cases) {
    const error = new Error("prisma failure");
    error.code = code;
    const message = userMessageFor(error);
    assert.match(message, pattern, `code ${code} produced an unexpected message`);
    seen.add(message);
  }

  assert.equal(seen.size, cases.length, "each failure must be distinguishable");

  for (const message of seen) {
    // No stack traces, driver names or technical identifiers beyond the code tag.
    assert.ok(!/MongoServerError|at Object\.|node_modules/.test(message));
  }
});

test("an unreachable database is reported without exposing internals", () => {
  const error = new Error("connect ETIMEDOUT 10.0.0.5:27017");
  const message = userMessageFor(error);
  assert.match(message, /DB_UNREACHABLE/);
  assert.ok(!message.includes("10.0.0.5"), "the internal address leaked into a user-facing message");
});

// ---------------------------------------------------------------------------
// Cloudinary signing
// ---------------------------------------------------------------------------

async function withCloudinaryEnv(run) {
  const previous = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "123456789012345";
  process.env.CLOUDINARY_API_SECRET = "test_secret";

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("the upload signature matches Cloudinary's documented algorithm", async () => {
  await withCloudinaryEnv(async () => {
    const { signCloudinaryParams } = await import("../lib/cloudinary.js");

    // sha1("folder=...&timestamp=1234567890" + "test_secret")
    const expected = "d4494e9482cad8e06e18e770a53ba6928f5896e9";
    const actual = signCloudinaryParams({
      folder: "guidance-app/homepage/images",
      timestamp: 1234567890,
    });

    assert.equal(actual, expected);
  });
});

test("signing sorts parameters and ignores empty values", async () => {
  await withCloudinaryParamsTest();
});

async function withCloudinaryParamsTest() {
  await withCloudinaryEnv(async () => {
    const { signCloudinaryParams } = await import("../lib/cloudinary.js");

    const sorted = signCloudinaryParams({ timestamp: 1, folder: "a" });
    const reversed = signCloudinaryParams({ folder: "a", timestamp: 1 });
    assert.equal(sorted, reversed, "parameter order must not change the signature");

    const withEmpty = signCloudinaryParams({ folder: "a", timestamp: 1, tags: "", publicId: null, x: undefined });
    assert.equal(withEmpty, sorted, "empty and null values must be omitted from the signature");
  });
}

test("a missing Cloudinary configuration is reported instead of signing with undefined", async () => {
  const previous = process.env.CLOUDINARY_API_SECRET;
  delete process.env.CLOUDINARY_API_SECRET;

  try {
    const { signCloudinaryParams, isCloudinaryConfigured } = await import("../lib/cloudinary.js");
    assert.equal(isCloudinaryConfigured(), false);
    assert.throws(() => signCloudinaryParams({ timestamp: 1 }), /Cloudinary is not configured/);
  } finally {
    if (previous !== undefined) process.env.CLOUDINARY_API_SECRET = previous;
  }
});

test("deleting an asset posts a signed request to the right resource endpoint", async () => {
  await withCloudinaryEnv(async () => {
    const { deleteCloudinaryAsset } = await import("../lib/cloudinary.js");

    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ result: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    try {
      const result = await deleteCloudinaryAsset("guidance-app/homepage/videos/clip", "video");

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.cloudinary.com/v1_1/test-cloud/video/destroy");
      assert.equal(calls[0].options.method, "POST");

      const body = calls[0].options.body;
      assert.equal(body.get("public_id"), "guidance-app/homepage/videos/clip");
      assert.equal(body.get("api_key"), "123456789012345");
      assert.ok(body.get("signature"), "the destroy request must be signed");
      assert.ok(body.get("timestamp"));
      assert.equal(result.result, "ok");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("a destroy that reports 'not found' is treated as already removed", async () => {
  await withCloudinaryEnv(async () => {
    const { deleteCloudinaryAsset } = await import("../lib/cloudinary.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ result: "not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await deleteCloudinaryAsset("already/gone", "image");
      assert.equal(result.alreadyMissing, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("a failed destroy surfaces a diagnosable error", async () => {
  await withCloudinaryEnv(async () => {
    const { deleteCloudinaryAsset } = await import("../lib/cloudinary.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Invalid signature" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    try {
      await assert.rejects(() => deleteCloudinaryAsset("asset", "image"), /Invalid signature/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("the signature is a stable 40 character SHA-1 hex digest", async () => {
  await withCloudinaryEnv(async () => {
    const { signCloudinaryParams } = await import("../lib/cloudinary.js");
    const signature = signCloudinaryParams({ folder: "x", timestamp: 1700000000 });

    assert.match(signature, /^[a-f0-9]{40}$/);
    assert.equal(signature, crypto.createHash("sha1").update(`folder=x&timestamp=1700000000test_secret`).digest("hex"));
  });
});
