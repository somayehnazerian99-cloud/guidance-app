/**
 * End-to-end run against a throw-away stack.
 *
 *   npm run test:e2e            # all specs
 *   npm run test:e2e -- --grep login   # extra args go straight to Playwright
 *
 * The stack is: an in-process single-node MongoDB replica set, the Prisma
 * schema pushed to it, the development seed, and a production Next server —
 * all inside this project folder and all destroyed on exit.
 *
 * Reason for the orchestrator instead of Playwright's own `webServer`: the
 * server needs a DATABASE_URL that only exists once MongoDB is up, so the
 * database has to start before the server, and Playwright would start the
 * server first. Nothing here touches the DATABASE_URL in .env, so an E2E run
 * can never write to the real cluster.
 */

import { spawn } from "node:child_process";
import net from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ensureFreshBuild, runNodeCli, waitForHttp } from "./lib/runtime.mjs";

const PORT = Number(process.env.E2E_PORT || 3100);
const DB_NAME = process.env.E2E_MONGO_DB || "guidance_e2e";
const MONGO_VERSION = process.env.MONGOMS_VERSION || "8.2.6";
const BASE_URL = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT_MS = Number(process.env.E2E_STARTUP_TIMEOUT_MS || 180_000);

/** Extra CLI arguments (after `--`) are forwarded to `playwright test`. */
const playwrightArgs = process.argv.slice(2);

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Start the production server as a long-lived child, keeping its output so a
 * startup failure can be reported instead of just timing out.
 */
function startServer(env) {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    }
  );

  child.output = "";
  child.stdout.on("data", (chunk) => {
    child.output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    child.output += chunk.toString();
  });

  return child;
}

async function main() {
  if (!(await portIsFree(PORT))) {
    console.error(
      `Port ${PORT} is already in use. Stop the process using it, or run with E2E_PORT=<other port>.`
    );
    process.exit(1);
  }

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
    AUTH_SECRET: process.env.AUTH_SECRET || "e2e-secret-that-is-at-least-32-characters-long",
    NEXT_PUBLIC_APP_URL: BASE_URL,
    // Placeholder Cloudinary credentials so the signing endpoint can be
    // exercised. They are never used against the real service: the browser's
    // upload request is intercepted by the media spec, so nothing leaves the
    // machine. Without these the signing endpoint correctly answers 503 and the
    // upload chain cannot be tested at all.
    CLOUDINARY_CLOUD_NAME: process.env.E2E_CLOUDINARY_CLOUD_NAME || "e2e-cloud",
    CLOUDINARY_API_KEY: process.env.E2E_CLOUDINARY_API_KEY || "000000000000000",
    CLOUDINARY_API_SECRET: process.env.E2E_CLOUDINARY_API_SECRET || "e2e-cloudinary-secret",
  };

  let server = null;
  let exitCode = 1;

  try {
    if (!(await ensureFreshBuild(env))) {
      console.error("The production build failed — cannot test a stale build.");
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
      console.error("prisma db push failed — the E2E database has no schema.");
      return;
    }
    console.log("Schema pushed (collections and indexes created).");

    const seed = await runNodeCli("prisma/seed.js", [], env, "npm run seed");
    console.log(seed.output.slice(-1200));
    if (seed.code !== 0) {
      console.error("Seeding failed.");
      return;
    }

    console.log(`\n--- next start (port ${PORT}) ---`);
    server = startServer(env);

    try {
      await waitForHttp(`${BASE_URL}/login/student`, { timeoutMs: STARTUP_TIMEOUT_MS });
    } catch (error) {
      console.error(`${error.message}\n\nServer output:\n${server.output.slice(-2000)}`);
      return;
    }
    console.log(`Server is answering on ${BASE_URL}`);

    const playwright = await runNodeCli(
      "node_modules/@playwright/test/cli.js",
      ["test", ...playwrightArgs],
      {
        ...env,
        E2E_BASE_URL: BASE_URL,
        E2E_RUN_ID: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      },
      "playwright test"
    );

    process.stdout.write(playwright.output);
    exitCode = playwright.code;
  } finally {
    if (server && !server.killed) {
      server.kill();
      console.log("\nNext server stopped.");
    }

    console.log("Stopping temporary MongoDB ...");
    await mongod.stop().catch(() => {});
    console.log("Temporary MongoDB stopped.\n");
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("\nE2E stack setup failed:", error);
  console.error(
    "If the MongoDB binary download failed, re-run: npx mongodb-memory-server-mdbin --version 8.2.6\n" +
      "If the browser is missing, run: npx playwright install chromium\n"
  );
  process.exit(1);
});
