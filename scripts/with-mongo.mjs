/**
 * Boot a temporary, throw-away MongoDB (in-process, no system install), push the
 * Prisma schema, seed it, and run the full HTTP + live authentication
 * verification against that database.
 *
 *   npm run verify:live
 *
 * Everything (including the mongod binary) stays inside the project directory,
 * and the server is destroyed on exit — nothing is left running.
 *
 * The process/build helpers live in scripts/lib/runtime.mjs, shared with the
 * Playwright end-to-end runner so both stacks behave identically.
 */

import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ensureFreshBuild, runNodeCli } from "./lib/runtime.mjs";

const DB_NAME = process.env.VERIFY_MONGO_DB || "guidance_verify";
const MONGO_VERSION = process.env.MONGOMS_VERSION || "8.2.6";
const SEED_MANUAL =
  process.env.VERIFY_ADMIN_USER || process.env.VERIFY_COUNSELOR_USER || process.env.VERIFY_STUDENT_USER;

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
