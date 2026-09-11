/**
 * Boot a temporary, throw-away MongoDB (in-process, no system install), push the
 * Prisma schema, seed it, and run the full HTTP + live authentication
 * verification against that database.
 *
 *   npm run verify:live
 *
 * Everything (including the mongod binary) stays inside the project directory,
 * and the server is destroyed on exit — nothing is left running.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const DB_NAME = process.env.VERIFY_MONGO_DB || "guidance_verify";
const MONGO_VERSION = process.env.MONGOMS_VERSION || "8.2.6";
const SEED_MANUAL =
  process.env.VERIFY_ADMIN_USER || process.env.VERIFY_COUNSELOR_USER || process.env.VERIFY_STUDENT_USER;

/** Newest modification time across the directories that end up in the build. */
function newestSourceMtime(dirs) {
  let newest = 0;

  const walk = (target) => {
    if (!fs.existsSync(target)) return;
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) walk(path.join(target, entry));
      return;
    }

    if (stat.mtimeMs > newest) newest = stat.mtimeMs;
  };

  for (const dir of dirs) walk(dir);
  return newest;
}

/**
 * The verification runs against the production build, so a stale `.next` would
 * silently test old code. Rebuild when any source file is newer than the build.
 */
async function ensureFreshBuild() {
  const buildId = path.join(process.cwd(), ".next", "BUILD_ID");
  const sources = ["app", "lib", "components", "middleware.js", "next.config.mjs"];

  if (!fs.existsSync(buildId)) {
    console.log("\nNo production build found — building ...");
    const build = await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], {}, "npm run build");
    return build.code === 0;
  }

  const builtAt = fs.statSync(buildId).mtimeMs;
  if (newestSourceMtime(sources) > builtAt) {
    console.log("\nSource files changed since the last build — rebuilding ...");
    const build = await run(process.execPath, ["node_modules/next/dist/bin/next", "build"], {}, "npm run build");
    if (build.code !== 0) {
      console.log(build.output.slice(-2000));
      return false;
    }
    return true;
  }

  return true;
}

function run(command, args, env, label) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    // A missing binary should fail the step, not crash the whole run.
    child.on("error", (error) => resolve({ code: 1, output: `${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));

    if (label) console.log(`\n--- ${label} ---`);
  });
}

// Run a CLI installed in node_modules through node itself, which behaves the
// same on Windows (.cmd shims are not executable via spawn) and on POSIX.
function runNodeCli(entry, args, env, label) {
  return run(process.execPath, [entry, ...args], env, label);
}

async function main() {
  // Prisma's MongoDB connector needs a replica set for transactions (and for
  // nested writes such as creating a test attempt together with its answers).
  // A single-node replica set is what a local mongod as well as an Atlas
  // cluster both provide.
  console.log(`\nStarting a temporary single-node MongoDB ${MONGO_VERSION} replica set ...`);

  const mongod = await MongoMemoryReplSet.create({
    binary: { version: MONGO_VERSION },
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
      dbName: DB_NAME,
      args: ["--setParameter", "enableTestCommands=1"],
    },
  });

  const uri = mongod.getUri(DB_NAME);
  console.log(`MongoDB replica set ready: ${uri}`);

  const env = {
    DATABASE_URL: uri,
    AUTH_SECRET: process.env.AUTH_SECRET || "local-verification-secret-at-least-32-characters",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`,
  };

  let exitCode = 1;

  try {
    if (!(await ensureFreshBuild())) {
      console.error("The production build failed — cannot verify a stale build.");
      exitCode = 1;
      return;
    }
    const push = await runNodeCli(
      "node_modules/prisma/build/index.js",
      ["db", "push", "--skip-generate"],
      env,
      "prisma db push"
    );
    if (push.code !== 0) {
      console.log(push.output.slice(-1500));
      console.log("prisma db push failed — continuing, collections are created on first write.");
    } else {
      console.log("Schema pushed (collections and indexes created).");
    }

    const seed = await runNodeCli("prisma/seed.js", [], env, "npm run seed");
    console.log(seed.output.slice(-2500));
    if (seed.code !== 0) {
      console.error("Seeding failed.");
      exitCode = 1;
      return;
    }

    const resetChecks = await runNodeCli(
      "scripts/verify-password-reset.mjs",
      [],
      env,
      "password reset lifecycle"
    );
    process.stdout.write(resetChecks.output);

    const verify = await runNodeCli(
      "scripts/verify-auth-http.mjs",
      [],
      env,
      "auth verification"
    );
    process.stdout.write(verify.output);

    exitCode = resetChecks.code === 0 && verify.code === 0 ? 0 : 1;
  } finally {
    console.log("\nStopping temporary MongoDB ...");
    await mongod.stop();
    console.log("Temporary MongoDB stopped.\n");

    if (SEED_MANUAL) {
      console.log("Note: custom VERIFY_* credentials were detected — clean up any test data manually.\n");
    }
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("\nTemporary MongoDB setup failed:", error);
  console.error(
    "If the binary download failed, re-run: npx mongodb-memory-server-mdbin --version 8.2.6\n"
  );
  process.exit(1);
});
