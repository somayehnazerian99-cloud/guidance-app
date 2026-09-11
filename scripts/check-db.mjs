/**
 * Database connection diagnostic.
 *
 *   npm run db:check
 *
 * Checks, in order:
 *   1. DATABASE_URL is present (in the environment or in .env)
 *   2. the URI names a database (Prisma refuses to run without one: P1013)
 *   3. the server answers a ping and reports its version
 *   4. the server is a replica set (Prisma needs one for transactions)
 *   5. a write -> read -> delete round trip succeeds on the app database
 *   6. the Prisma collections/indexes exist and hold no surprise index
 *
 * When a step fails the script explains the most likely cause (IP allowlist,
 * bad credentials, blocked SRV lookup, standalone server) instead of just
 * printing the driver error. Credentials are never printed.
 */

import { databaseNameIn, findEnvValue, maskSecret } from "./lib/env.mjs";
import { MongoClient } from "mongodb";

const ROOT = process.cwd();

const EXPECTED_COLLECTIONS = [
  "User", "Session", "School", "Class", "StudentProfile", "CounselorProfile",
  "Grade", "Interest", "Ability", "GuidanceTest", "Question", "Option",
  "TestAttempt", "TestAnswer", "ParentOpinion", "GuidanceResult",
  "EducationalVideo", "Notification", "AuditLog", "PasswordResetToken",
];

const configured = findEnvValue("DATABASE_URL", ROOT);
const uri = configured?.value;
const source = configured?.source ?? "not configured";

let failures = 0;

function ok(name, detail = "") {
  console.log(`✔ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  failures += 1;
  console.log(`✖ ${name}${detail ? ` — ${detail}` : ""}`);
}

function note(...lines) {
  for (const line of lines) console.log(`   → ${line}`);
}

/** Best-effort public IP lookup, used to make Atlas allowlist hints actionable. */
async function publicIp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("https://api.ipify.org", { signal: controller.signal });
    clearTimeout(timer);
    return (await response.text()).trim();
  } catch {
    return null;
  }
}

/**
 * Turn a driver error into the exact thing the developer has to change.
 * Returns an array of printable hint lines.
 */
async function diagnose(error, connectionString) {
  const message = String(error?.message ?? "").split("\n")[0];
  const isAtlas = connectionString.startsWith("mongodb+srv://");
  const hints = [];

  if (/ENOTFOUND|ENODATA|ESERVFAIL|querySrv|_mongodb\._tcp/i.test(message)) {
    hints.push("DNS/SRV lookup failed — the cluster hostname is wrong, or this network blocks SRV records.");
    hints.push("Try: nslookup -type=SRV _mongodb._tcp.<cluster-host>");
  } else if (error?.code === 18 || /Authentication failed|bad auth|SCRAM/i.test(message)) {
    hints.push("The database user or password is wrong.");
    hints.push("If the password contains @ : / # or %, it must be URL-encoded (@ → %40, : → %3A, / → %2F, # → %23).");
    hints.push("Also confirm the user exists in Atlas → Database Access and has readWrite on this database.");
  } else if (/server selection|ETIMEDOUT|ECONNREFUSED|timed out|MongooseServerSelectionError/i.test(message)) {
    if (isAtlas) {
      hints.push("Atlas refused the connection — almost always the IP allowlist.");
      const ip = await publicIp();
      if (ip) hints.push(`Add this machine's public IP in Atlas → Network Access: ${ip}`);
      else hints.push("Add this machine's public IP in Atlas → Network Access (0.0.0.0/0 only for a quick test).");
      hints.push("DNS seeds must also resolve: check with nslookup -type=SRV _mongodb._tcp.<cluster-host>");
    } else {
      hints.push(`Nothing is listening on ${connectionString.replace(/\/\/[^@]*@/, "//****@").split("?")[0]}.`);
      hints.push("Start the bundled server with `npm run mongo:start`, or point DATABASE_URL at Atlas.");
    }
  } else if (/MongoParseError|unescaped|not a valid|invalid scheme/i.test(message)) {
    hints.push("The connection string itself could not be parsed — most often an unescaped character in the password.");
    hints.push("Percent-encode these inside the password: @ → %40, : → %3A, / → %2F, # → %23, % → %25, ? → %3F, & → %26, + → %2B");
  } else if (/P1013|Database must be defined/i.test(message)) {
    hints.push("Prisma needs a database name inside the connection string, right after the host:");
    hints.push("mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/guidance?retryWrites=true&w=majority");
    hints.push('The Atlas "Connect" dialog always omits it — add the part between the last / and the ?.');
  } else if (/P2031|transaction/i.test(message)) {
    hints.push("Prisma needs a MongoDB replica set for transactions — a standalone mongod will not work.");
  }

  hints.push("Run `npm run env:show` to confirm which file DATABASE_URL is read from.");
  return hints;
}

/** Checks that only make sense once we know which database we are talking about. */
async function checkApplicationDatabase(dbName) {
  const db = client.db(dbName);
  ok("application database selected", dbName);

  // Round trip on a throwaway collection.
  const probe = db.collection("__connection_probe");
  await probe.insertOne({ at: new Date(), note: "db:check" });
  const found = await probe.findOne({ note: "db:check" });
  ok("write → read round trip", found ? "document returned" : "document missing");
  await probe.drop().catch(() => {});

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const missing = EXPECTED_COLLECTIONS.filter((name) => !existing.has(name));

  if (missing.length === 0) {
    ok("all Prisma collections exist", `${EXPECTED_COLLECTIONS.length} collections`);
  } else {
    fail(
      "Prisma collections exist",
      `${missing.length} missing (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}) — run: npx prisma db push`
    );
    return;
  }

  const userCount = await db.collection("User").countDocuments();
  const studentCount = await db.collection("StudentProfile").countDocuments();
  ok("row counts", `${userCount} user(s), ${studentCount} student profile(s)`);

  const indexes = await db.collection("User").indexes();
  ok("User indexes", indexes.map((index) => index.name).join(", "));

  const emailIndex = indexes.find((index) => index.key?.email === 1);
  if (emailIndex?.unique) {
    fail(
      "email index is not unique",
      "a unique index on the nullable email field would allow only one account without an email"
    );
  }

  if (userCount === 0) {
    console.log("\n→ The database is empty. Run `npm run seed` to load the development data.");
  }
}

let client;

async function main() {
  console.log("\nDatabase connection check\n");

  if (!uri) {
    fail("DATABASE_URL is set", "not found in the environment, .env.local or .env — run `npm run env:show`");
    process.exit(1);
  }
  ok("DATABASE_URL is set", `(${source}) ${maskSecret(uri)}`);

  // Prisma reads the target database from the URI path; without it every
  // `prisma db push` fails with P1013, so catch it before connecting.
  const dbName = databaseNameIn(uri);
  const hasDatabaseName = dbName.length > 0;

  if (hasDatabaseName) {
    ok("the URI names a database", dbName);
  } else {
    fail(
      "the URI names a database",
      "there is nothing between the last / and the ? — Prisma reports P1013 and cannot create the schema"
    );
    note(
      "Append a database name to DATABASE_URL, for example:",
      "mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/guidance?retryWrites=true&w=majority",
      'The Atlas "Connect" dialog leaves it out, so it has to be added by hand.',
      "Database-specific checks below are skipped until this is fixed."
    );
    console.log("");
  }

  try {
    // The constructor parses the URI and throws on unescaped characters, so it
    // belongs inside the try — otherwise a bad password crashes with a stack trace.
    client = new MongoClient(uri, {
      // Atlas clusters that are waking up or blocked by the allowlist need a moment.
      serverSelectionTimeoutMS: uri.startsWith("mongodb+srv://") ? 12000 : 8000,
      connectTimeoutMS: 8000,
    });

    await client.connect();
    ok(
      "server is reachable",
      uri.startsWith("mongodb+srv://") ? "Atlas SRV connection established" : "direct host"
    );

    const admin = client.db("admin");
    const buildInfo = await admin.command({ buildInfo: 1 });
    ok("server responded to ping", `MongoDB ${buildInfo.version}`);

    const hello = await admin.command({ hello: 1 });
    if (hello.setName) {
      ok(
        "replica set detected",
        `${hello.setName}${hello.isWritablePrimary ? " (writable primary)" : " (not primary)"}`
      );
    } else {
      fail(
        "replica set detected",
        "standalone server — Prisma transactions (seed, test submission) will fail with P2031"
      );
    }

    if (hasDatabaseName) await checkApplicationDatabase(dbName);
  } catch (error) {
    fail("connection failed", String(error?.message ?? error).split("\n")[0]);
    for (const hint of await diagnose(error, uri)) {
      console.log(`   → ${hint}`);
    }
  } finally {
    await client?.close().catch(() => {});
  }

  console.log(
    `\n${failures === 0 ? "DATABASE CHECK PASSED" : `DATABASE CHECK FAILED (${failures} problem(s))`}\n`
  );

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
