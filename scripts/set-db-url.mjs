/**
 * Store the database connection string without relying on an editor save.
 *
 *   npm run env:set              -> prompts for the URI (input is not echoed)
 *   npm run env:set -- --check   -> prompts, then runs npm run db:check
 *
 * The value is written to guidance-app/.env (git-ignored). Only a masked
 * version is ever printed, and it is never written to any log but .env.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { maskSecret } from "./lib/env.mjs";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env");

/** Prisma needs a database name in the URI path (otherwise: P1013). */
const DEFAULT_DATABASE = "guidance";

/** Characters that break the URI when they appear raw inside the password. */
const MUST_BE_ENCODED = ["@", ":", "/", "#", "%", "?", "&", "=", "+", " "];

const PROMPT = "Paste the connection string, then press Enter: ";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** Ask for the value; when attached to a terminal the characters stay unseen. */
function askHidden() {
  if (!process.stdin.isTTY) {
    const line = readStdin()
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find(Boolean);
    return Promise.resolve(line ?? "");
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Echo the prompt, swallow the typed characters.
    const echo = rl._writeToOutput ? rl._writeToOutput.bind(rl) : null;
    rl._writeToOutput = (text) => {
      if (text.includes(PROMPT)) rl.output.write(text);
      else echo?.(text);
    };

    rl.question(PROMPT, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function validate(url) {
  if (!url) return "nothing was entered.";
  if (!/^mongodb(\+srv)?:\/\//.test(url)) return "it must start with mongodb:// or mongodb+srv://";
  if (/[<>]/.test(url)) return "remove the angle brackets (< >) and the placeholder words.";
  if (/\/\/(USER|username|user):/i.test(url)) return "replace the placeholder user name with the real database user.";
  if (/:(PASSWORD|password|pass|pw)@/i.test(url)) return "replace the placeholder password with the real one.";
  if (!/@/.test(url)) return "the credentials part (user:password@host) is missing.";
  return null;
}

/**
 * The Atlas "Connect" dialog hands out a URI that stops at `/?appName=...`,
 * with no database name — which makes `prisma db push` fail with P1013.
 * Add the name when it is missing and report that we did.
 */
function withDatabaseName(url, name = DEFAULT_DATABASE) {
  const queryAt = url.indexOf("?");
  const before = queryAt === -1 ? url : url.slice(0, queryAt);
  const query = queryAt === -1 ? "" : url.slice(queryAt);

  // Only the slashes after the credentials belong to the path: the password
  // itself may contain a "/", which must not be mistaken for a database name.
  const withoutScheme = before.replace(/^mongodb(\+srv)?:\/\//, "");
  const at = withoutScheme.lastIndexOf("@");
  const hostAndPath = at === -1 ? withoutScheme : withoutScheme.slice(at + 1);
  const slash = hostAndPath.indexOf("/");

  if (slash === -1) return { url: `${before}/${name}${query}`, added: true };
  if (hostAndPath.slice(slash + 1).length > 0) return { url, added: false };
  return { url: `${before}${name}${query}`, added: true };
}

/** Warn about password characters that would be misread by the driver. */
function passwordWarnings(url) {
  const rest = url.replace(/^mongodb(\+srv)?:\/\//, "");

  // A raw "@" inside the password makes the URI ambiguous (everything up to
  // the last @ is treated as credentials), so flag it before anything else.
  if ((rest.match(/@/g) ?? []).length > 1) {
    return [
      'the password looks like it contains a raw "@" — it must be percent-encoded as %40, otherwise the URI is parsed incorrectly',
    ];
  }

  const at = rest.lastIndexOf("@");
  if (at === -1) return [];

  const credentials = rest.slice(0, at);
  const colon = credentials.indexOf(":");
  if (colon === -1) return [];

  const password = credentials.slice(colon + 1);
  const found = MUST_BE_ENCODED.filter((char) => password.includes(char));

  return found.length
    ? [
        `the password contains ${found.map((char) => JSON.stringify(char)).join(" ")} — those must be percent-encoded (@ → %40, : → %3A, / → %2F, # → %23)`,
      ]
    : [];
}

function writeDatabaseUrl(url) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
  const assignment = `DATABASE_URL="${url}"`;
  const index = lines.findIndex((line) => /^\s*DATABASE_URL\s*=/.test(line));

  if (index >= 0) lines[index] = assignment;
  else lines.push("", assignment);

  fs.writeFileSync(ENV_FILE, lines.join("\n"), "utf8");
}

async function main() {
  console.log("\nSet DATABASE_URL\n");

  const url = await askHidden();
  const problem = validate(url);

  if (problem) {
    console.log(`✖ That does not look like a connection string — ${problem}\n`);
    process.exit(1);
  }

  const isAtlas = url.startsWith("mongodb+srv://");
  const normalised = withDatabaseName(url);
  writeDatabaseUrl(normalised.url);

  console.log(`✔ Saved to ${path.relative(ROOT, ENV_FILE)}`);
  console.log(`  source file: .env (git-ignored, never committed)`);
  console.log(`  value:       ${maskSecret(normalised.url)}`);
  console.log(`  kind:        ${isAtlas ? "MongoDB Atlas (SRV)" : "direct host"}`);
  console.log(`  last saved:  ${new Date().toISOString()}`);

  if (normalised.added) {
    console.log(`\n  note: the URI had no database name, so /${DEFAULT_DATABASE} was added (Prisma requires one).`);
  }

  const warnings = passwordWarnings(normalised.url);
  if (warnings.length) {
    console.log("\n  warning:");
    for (const warning of warnings) console.log(`   → ${warning}`);
  }

  if (isAtlas) {
    console.log("\n  Remember: this machine's public IP must be allowed in Atlas → Network Access.");
  }

  console.log("\nNext:\n  npm run db:check   -> connection, replica set and collections\n  npx prisma db push\n  npm run seed       -> WARNING: empties the collections first\n  npm run verify:auth\n");

  if (process.argv.includes("--check")) {
    console.log("Running db:check...\n");
    const result = spawnSync("npm", ["run", "db:check"], { stdio: "inherit", shell: true });
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
