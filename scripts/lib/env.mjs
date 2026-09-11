/**
 * Shared environment loading for the verification scripts.
 *
 * `next start` reads .env files by itself, but plain `node script.mjs` does not,
 * so the scripts load them the same way Next does:
 *
 *   process env  >  .env.local  >  .env
 *
 * Nothing that already exists in the process environment is ever overwritten.
 */

import fs from "node:fs";
import path from "node:path";

export const ENV_FILES = [".env.local", ".env"];

function parseEnvFile(filePath) {
  const values = {};

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }

  return values;
}

/** @returns {{key: string, value: string, source: "environment"|".env.local"|".env"} | null} */
export function findEnvValue(key, root = process.cwd()) {
  if (process.env[key]) {
    return { key, value: process.env[key], source: "environment" };
  }

  for (const file of ENV_FILES) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const values = parseEnvFile(filePath);
      if (values[key]) return { key, value: values[key], source: file };
    } catch {
      // unreadable file — treat as absent
    }
  }

  return null;
}

/** Load .env.local then .env into process.env without overriding anything. */
export function loadProjectEnv(root = process.cwd()) {
  for (const file of ENV_FILES) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      for (const [key, value] of Object.entries(parseEnvFile(filePath))) {
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // ignore unreadable files
    }
  }
}

/**
 * The database Prisma will target: the path segment of a connection string.
 *
 * Only the slashes after the credentials count — a "/" inside the password
 * must not be mistaken for the start of the database path.
 */
export function databaseNameIn(connectionString) {
  const withoutScheme = connectionString.replace(/^mongodb(\+srv)?:\/\//, "").split("?")[0];
  const at = withoutScheme.lastIndexOf("@");
  const hostAndPath = at === -1 ? withoutScheme : withoutScheme.slice(at + 1);
  const slash = hostAndPath.indexOf("/");

  return slash === -1 ? "" : hostAndPath.slice(slash + 1);
}

/** Hide the password (and any srv credentials) before printing a URI. */
export function maskSecret(value) {
  if (!value) return "";
  return value.replace(/\/\/([^:/@]+)(:[^@]*)?@/, "//$1:****@");
}

export function fileInfo(fileName, root = process.cwd()) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return { exists: false, path: filePath };

  const stat = fs.statSync(filePath);
  return { exists: true, path: filePath, mtime: stat.mtime, size: stat.size };
}
