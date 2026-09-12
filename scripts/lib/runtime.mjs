/**
 * Shared helpers for the scripts that boot a throw-away runtime:
 * a temporary MongoDB, a production build and a Next server.
 *
 * Keeping them here means `verify-live` (HTTP verification) and `e2e`
 * (Playwright) cannot drift apart in how they run commands or decide whether a
 * rebuild is needed.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Directories whose change invalidates an existing production build. */
export const BUILD_SOURCE_DIRS = ["app", "lib", "components", "middleware.js", "next.config.mjs"];

/**
 * Run a command and resolve with its exit code and combined output.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string,string>} [env]
 * @param {string} [label]
 */
export function run(command, args, env, label) {
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

/**
 * Run a CLI installed in node_modules through node itself, which behaves the
 * same on Windows (.cmd shims are not executable via spawn) and on POSIX.
 */
export function runNodeCli(entry, args, env, label) {
  return run(process.execPath, [entry, ...args], env, label);
}

/** Newest modification time across the directories that end up in the build. */
export function newestSourceMtime(dirs = BUILD_SOURCE_DIRS) {
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
export async function ensureFreshBuild(env = {}) {
  const buildId = path.join(process.cwd(), ".next", "BUILD_ID");

  if (!fs.existsSync(buildId)) {
    console.log("\nNo production build found — building ...");
    const build = await runNodeCli(
      "node_modules/next/dist/bin/next",
      ["build"],
      env,
      "npm run build"
    );
    return build.code === 0;
  }

  const builtAt = fs.statSync(buildId).mtimeMs;
  if (newestSourceMtime() > builtAt) {
    console.log("\nSource files changed since the last build — rebuilding ...");
    const build = await runNodeCli(
      "node_modules/next/dist/bin/next",
      ["build"],
      env,
      "npm run build"
    );
    if (build.code !== 0) {
      console.log(build.output.slice(-2000));
      return false;
    }
    return true;
  }

  return true;
}

/** Poll a URL until it answers, or fail with the last error. */
export async function waitForHttp(url, { timeoutMs = 180_000, intervalMs = 750 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no attempt made";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`${url} did not answer within ${timeoutMs}ms (${lastError})`);
}
