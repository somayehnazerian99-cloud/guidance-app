/**
 * Guarded `prisma generate`.
 *
 *   npm run prisma:generate
 *
 * Why this exists
 * ---------------
 * `@prisma/client`'s own postinstall runs `prisma generate` and then calls
 * `process.exit(0)` when it fails, so an invalid schema does **not** break
 * `npm install`. The deploy stays green, the module cache keeps a stale
 * generated client, and the missing model only shows up at request time as:
 *
 *     TypeError: Cannot read properties of undefined (reading 'findFirst')
 *
 * ...which the API reports to the user as a generic 500. That is exactly how a
 * single missing `@db.ObjectId` reached production.
 *
 * This wrapper makes the failure land at build time instead:
 *
 *   - a schema validation error (P1012 and friends) always fails the build,
 *     because it is deterministic and the fix is known;
 *   - a missing CLI or a missing schema is only fatal when that would leave the
 *     app with no generated client at all, so an unusual install layout cannot
 *     take down a deploy that would otherwise work;
 *   - any other failure fails the build only when no client has been generated
 *     yet.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const GENERATED = path.join(ROOT, "node_modules", ".prisma", "client", "index.js");

const quiet = process.argv.includes("--quiet");

function say(message) {
  if (!quiet) console.log(message);
}

function warn(message) {
  console.warn(`\n[prisma-generate] ${message}\n`);
}

function generatedClientExists() {
  return fs.existsSync(GENERATED);
}

/** Deterministic schema problems: these must stop the build. */
function isSchemaError(output) {
  return /P1012|P1013|Error validating|schema validation|get-dmmf wasm|The schema .* is not valid/i.test(output);
}

function main() {
  if (!fs.existsSync(SCHEMA)) {
    warn("prisma/schema.prisma was not found — skipping generate.");
    return 0;
  }

  const result = spawnSync(process.execPath, [path.join(ROOT, "node_modules", "prisma", "build", "index.js"), "generate"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.error || (result.status !== 0 && /Cannot find module|ENOENT/.test(output))) {
    // The Prisma CLI itself is unavailable (a pruned production install, for
    // example). Re-generating is impossible, so only fail if the app would end
    // up with no client at all.
    if (generatedClientExists()) {
      warn(
        "The Prisma CLI is not installed, but a generated client already exists. " +
          "Skipping generate — install dev dependencies to regenerate."
      );
      return 0;
    }
    warn("The Prisma CLI is not installed and no generated client exists. Run `npm install` first.");
    return 1;
  }

  if (result.status === 0) {
    say(output.trim() || "Prisma Client generated.");
    return 0;
  }

  // Surface the real reason; this is the whole point of the wrapper.
  console.error(`\n${output.trim()}\n`);

  if (isSchemaError(output)) {
    console.error(
      "[prisma-generate] prisma/schema.prisma is invalid, so the Prisma Client cannot be generated.\n" +
        "                 Shipping this build would deploy a server with missing models that only fail at request time.\n" +
        "                 Fix the schema error above, then run `npx prisma validate` before rebuilding.\n"
    );
    return 1;
  }

  if (generatedClientExists()) {
    warn(
      "prisma generate failed, but a previously generated client exists. " +
        "Continuing, because this failure does not look like a schema problem — check the output above."
    );
    return 0;
  }

  console.error(
    "[prisma-generate] prisma generate failed and no client has ever been generated. " +
      "The app cannot query the database in this state.\n"
  );
  return 1;
}

process.exit(main());
