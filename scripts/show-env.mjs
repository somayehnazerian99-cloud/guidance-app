/**
 * Show which environment configuration the app will actually use.
 *
 *   npm run env:show
 *
 * Useful when an edit to .env does not seem to take effect: this prints the
 * file that was read, when it was last saved, and the resolved (masked)
 * DATABASE_URL — so a stale or misplaced file is obvious immediately.
 * Secrets are never printed.
 */

import fs from "node:fs";
import path from "node:path";
import { ENV_FILES, databaseNameIn, fileInfo, findEnvValue, maskSecret } from "./lib/env.mjs";

const ROOT = process.cwd();
const now = Date.now();

console.log(`\nWorking directory: ${ROOT}\n`);

for (const file of ENV_FILES) {
  const info = fileInfo(file, ROOT);

  if (!info.exists) {
    console.log(`— ${file}: not present`);
    continue;
  }

  const ageMinutes = Math.round((now - info.mtime.getTime()) / 60000);
  const age =
    ageMinutes < 1
      ? "just now"
      : ageMinutes < 60
        ? `${ageMinutes} minute(s) ago`
        : ageMinutes < 1440
          ? `${Math.round(ageMinutes / 60)} hour(s) ago`
          : `${Math.round(ageMinutes / 1440)} day(s) ago`;

  console.log(`• ${file}: ${info.size} bytes, last saved ${age} (${info.mtime.toISOString()})`);

  const keys = fs
    .readFileSync(path.join(ROOT, file), "utf8")
    .split("\n")
    .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean);

  console.log(`  keys: ${keys.join(", ") || "(none)"}`);
}

console.log("");

const databaseUrl = findEnvValue("DATABASE_URL", ROOT);

if (!databaseUrl) {
  console.log("✖ DATABASE_URL is not set in the environment or in an .env file.");
  console.log("  Create guidance-app/.env with a line such as:");
  console.log('  DATABASE_URL="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/guidance"');
  process.exit(1);
}

const isAtlas = databaseUrl.value.startsWith("mongodb+srv://");
const host = databaseUrl.value.replace(/^mongodb(\+srv)?:\/\//, "").split("@").pop().split("/")[0];

// Prisma refuses to run without a database name in the URI (P1013), so show
// the resolved target instead of letting it surface only at `db push`.
const databaseName = databaseNameIn(databaseUrl.value);

console.log(`✔ DATABASE_URL source: ${databaseUrl.source}`);
console.log(`  value: ${maskSecret(databaseUrl.value)}`);
console.log(`  kind:  ${isAtlas ? "MongoDB Atlas (SRV)" : "direct host"} → ${host}`);

if (databaseName) {
  console.log(`  database: ${databaseName}`);
} else {
  console.log("  database: (missing from the URI — Prisma will fail with P1013)");
  console.log('            add it after the host, e.g. "...mongodb.net/guidance?retryWrites=true"');
}

if (isAtlas) {
  console.log(
    "\n  Atlas notes: make sure this machine's public IP is allowed in\n" +
      "  Atlas → Network Access, and that the database user has readWrite on this database."
  );
}

const appUrl = findEnvValue("NEXT_PUBLIC_APP_URL", ROOT);
console.log(`\n  NEXT_PUBLIC_APP_URL: ${appUrl ? appUrl.value : "(not set, http://localhost:3000 is used)"}`);

console.log("");
