/**
 * Home-media persistence diagnostic.
 *
 *   npm run diagnose:media
 *
 * Reproduces the exact steps the admin upload API performs *after* Cloudinary
 * has accepted the file, so a failure can be attributed to a precise step:
 *
 *   1. environment presence (booleans only — values are never printed)
 *   2. Prisma can connect and the `HomeMedia` collection exists
 *   3. `findFirst({ orderBy: { sortOrder: "desc" } })` (the next-sort-order lookup)
 *   4. `create()` with a real admin `_id` in `createdBy`
 *   5. `create()` without `createdBy`
 *   6. `create()` against the *other* likely-shape variants, so a schema drift
 *      shows up as a specific error instead of a generic 500
 *   7. cleanup of the probe rows
 *
 * Nothing sensitive is ever printed: no connection string, no password, no
 * secret. Errors are reduced to a name, a code and a first line.
 */

import { loadProjectEnv, findEnvValue, maskSecret } from "./lib/env.mjs";

loadProjectEnv();

const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "NEXT_PUBLIC_APP_URL",
];

let failures = 0;

function ok(name, detail = "") {
  console.log(`✔ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failures += 1;
  console.log(`✖ ${name}${detail ? ` — ${detail}` : ""}`);
}

function note(message) {
  console.log(`   → ${message}`);
}

/** A safe, printable fingerprint of an error: never the raw message body. */
function describeError(error) {
  if (!error) return "unknown error";
  const parts = [`name=${error.name || "Error"}`];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.errorCode) parts.push(`errorCode=${error.errorCode}`);
  if (error.statusCode) parts.push(`status=${error.statusCode}`);
  const firstLine = String(error.message || "").split("\n").map((l) => l.trim()).filter(Boolean)[0];
  if (firstLine) parts.push(`message="${firstLine.slice(0, 220)}"`);
  return parts.join(" | ");
}

/** Translate known Prisma/Atlas failures into the concrete fix. */
function remediationFor(error) {
  const code = error?.code;
  const message = String(error?.message || "");

  if (code === "P2021" || code === "P2010" && /ns not found|does not exist/i.test(message)) {
    return "The HomeMedia collection is missing in this database. Run `npx prisma db push` against the same DATABASE_URL Netlify uses.";
  }
  if (/ns not found|NamespaceNotFound|does not exist in the current database/i.test(message)) {
    return "The HomeMedia collection is missing in this database. Run `npx prisma db push` against the same DATABASE_URL Netlify uses.";
  }
  if (code === "P2003") {
    return "A relation constraint failed — createdBy points at a User that does not exist in this database.";
  }
  if (code === "P2000" || /too long/i.test(message)) {
    return "A string value is longer than the field allows.";
  }
  if (code === "P2002") {
    return "A unique constraint was violated.";
  }
  if (/Inconsistent column data|Malformed ObjectID|Unable to convert/i.test(message)) {
    return "A value does not match the BSON type declared in schema.prisma (most often createdBy). Check that the id is a 24-character hex ObjectId.";
  }
  if (/P1013|Database must be defined/i.test(message)) {
    return "DATABASE_URL has no database name after the host.";
  }
  if (/Authentication failed|bad auth|SCRAM/i.test(message)) {
    return "The database credentials are wrong or the password is not URL-encoded.";
  }
  if (/server selection|ETIMEDOUT|ECONNREFUSED|timed out/i.test(message)) {
    return "The database is unreachable from this machine — check the Atlas IP allowlist.";
  }
  if (code === "P2031") {
    return "Prisma needs a replica set; this server is standalone.";
  }
  return null;
}

function step(label, fn) {
  return fn().then(
    (value) => value,
    (error) => {
      fail(label, describeError(error));
      const hint = remediationFor(error);
      if (hint) note(hint);
      return { __failed: true };
    }
  );
}

async function main() {
  console.log("\nHome-media persistence diagnostic\n");

  // ---------------------------------------------------------------- step 1
  console.log("1) Environment");
  const configured = findEnvValue("DATABASE_URL");
  ok("DATABASE_URL configured", `${Boolean(configured)}${configured ? ` (from ${configured.source}, ${maskSecret(configured.value)})` : ""}`);
  if (!configured) note("Set DATABASE_URL before anything else: npm run env:set");

  for (const key of REQUIRED_ENV) {
    if (key === "DATABASE_URL") continue;
    console.log(`   ${process.env[key] ? "✔" : "✖"} ${key} configured: ${Boolean(process.env[key])}`);
  }

  // ---------------------------------------------------------------- step 2
  console.log("\n2) Prisma client");
  // lib/prisma.js is written as ESM and is normally resolved by the Next
  // bundler, so this script builds its own client from the generated output.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    ok("connected");
  } catch (error) {
    fail("connect", describeError(error));
    const hint = remediationFor(error);
    if (hint) note(hint);
    console.log(`\nHOME-MEDIA DIAGNOSTIC FAILED (${failures} problem(s))\n`);
    process.exit(1);
  }

  // ---------------------------------------------------------------- step 3
  console.log("\n3) Collections and counts");
  const counts = {};
  for (const model of ["user", "session", "homeMedia", "educationalVideo", "auditLog"]) {
    const result = await step(`prisma.${model}.count()`, () => prisma[model].count());
    if (result === undefined || result?.__failed) continue;
    counts[model] = result;
    ok(`prisma.${model}.count()`, String(result));
  }

  if (counts.homeMedia === undefined) {
    note("If the count above failed with `ns not found`, the HomeMedia collection has never been created in this database.");
  }

  // ---------------------------------------------------------------- step 4
  console.log("\n4) The exact POST sequence");
  let admin = null;
  const admins = await step("load an admin user", () =>
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, username: true }, take: 1 })
  );
  if (Array.isArray(admins) && admins.length > 0) {
    admin = admins[0];
    ok("admin user found", `${admin.username} (id length ${admin.id.length})`);
  } else if (!admins?.__failed) {
    fail("admin user found", "no ADMIN row in this database — run `npm run seed`");
  }

  const last = await step("findFirst(orderBy: { sortOrder: \"desc\" })", () =>
    prisma.homeMedia.findFirst({ orderBy: { sortOrder: "desc" } })
  );
  if (!last?.__failed) {
    ok("findFirst succeeded", last ? `highest sortOrder = ${last.sortOrder}` : "collection is empty");
  }

  const probeBase = {
    title: "__diagnose_probe__",
    description: null,
    type: "IMAGE",
    url: "https://res.cloudinary.com/diagnostic/image/upload/probe.png",
    publicId: "diagnostic/probe",
    resourceType: "image",
    mimeType: "image/png",
    bytes: 1024,
    sortOrder: (last?.sortOrder ?? -1) + 1,
  };

  const createdIds = [];

  const withCreator = await step("create() with createdBy = admin._id", () =>
    prisma.homeMedia.create({ data: { ...probeBase, ...(admin ? { createdBy: admin.id } : {}) } })
  );
  if (withCreator && !withCreator.__failed) {
    ok("create() with createdBy succeeded", `id ${String(withCreator.id).slice(-6)}`);
    createdIds.push(withCreator.id);
  }

  const withoutCreator = await step("create() without createdBy", () =>
    prisma.homeMedia.create({ data: probeBase })
  );
  if (withoutCreator && !withoutCreator.__failed) {
    ok("create() without createdBy succeeded", `id ${String(withoutCreator.id).slice(-6)}`);
    createdIds.push(withoutCreator.id);
  }

  // ---------------------------------------------------------------- step 5
  console.log("\n5) Field-shape checks");
  const relations = await step("inspect the User relation from HomeMedia", () =>
    prisma.homeMedia.findFirst({ include: { creator: true } })
  );
  if (relations && !relations.__failed) {
    ok("including the creator relation works");
  }

  if (admin) {
    const orphan = await step("create() with a non-existent createdBy", () =>
      prisma.homeMedia.create({
        data: { ...probeBase, createdBy: "000000000000000000000000" },
      })
    );
    if (orphan?.__failed) {
      note("The relation rejects dangling ids (this is expected Prisma behaviour for MongoDB references).");
    } else {
      ok("create() with a dangling createdBy is tolerated");
      createdIds.push(orphan.id);
    }
  }

  // ---------------------------------------------------------------- step 6
  console.log("\n6) Cleanup");
  if (createdIds.length > 0) {
    const removed = await step("delete probe rows", () =>
      prisma.homeMedia.deleteMany({ where: { id: { in: createdIds } } })
    );
    if (removed && !removed.__failed) ok("probe rows removed", String(removed.count));
  } else {
    ok("nothing to clean up");
  }

  const leftovers = await step("verify no probe rows remain", () =>
    prisma.homeMedia.count({ where: { title: "__diagnose_probe__" } })
  );
  if (typeof leftovers === "number" && leftovers > 0) {
    fail("probe rows remain", `${leftovers} left behind`);
  }

  await prisma.$disconnect().catch(() => {});

  console.log(
    `\n${failures === 0 ? "HOME-MEDIA DIAGNOSTIC PASSED" : `HOME-MEDIA DIAGNOSTIC FAILED (${failures} problem(s))`}\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(describeError(error));
  process.exit(1);
});
