/**
 * Server-side diagnostics helpers.
 *
 * Two jobs:
 *
 *   1. Turn an unknown thrown value into a small, structured, *safe* object that
 *      can be written to the platform logs (Netlify Function Logs) or returned
 *      to an admin. Secrets, connection strings, session tokens and file
 *      contents must never survive this function.
 *
 *   2. Detect the one failure that is otherwise invisible at runtime: a stale
 *      generated Prisma Client. When `prisma generate` has not run against the
 *      current schema, `prisma.<model>` is `undefined` and every query fails
 *      with "Cannot read properties of undefined" — which looks exactly like a
 *      database problem but is a build problem.
 */

/**
 * Keys inside `error.meta` that are safe to log. Prisma puts offending values in
 * `meta` for some codes, so only an explicit allowlist is ever emitted.
 */
const SAFE_META_KEYS = ["code", "modelName", "target", "field_name", "constraint", "cause_name"];

const MAX_VALUE_LENGTH = 400;

/** Keys whose *values* must never appear in a log line, however they got there. */
const SECRET_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_API_KEY",
  "NEXTAUTH_SECRET",
];

/**
 * Strip anything that could carry a credential out of an arbitrary string.
 *
 * A driver error sometimes embeds the connection string or a header value in
 * its message, so exact-match redaction of the configured secrets runs before
 * the structural patterns.
 */
export function redactSecrets(input) {
  if (typeof input !== "string" || input.length === 0) return input ?? "";
  let output = input;

  for (const key of SECRET_KEYS) {
    const value = process.env[key];
    if (value && value.length >= 8) output = output.split(value).join(`<redacted:${key}>`);
  }

  // The password inside a Mongo URI, even when the full URI is not configured here.
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const match = databaseUrl.match(/^mongodb(?:\+srv)?:\/\/([^:@/]+):([^@]+)@/);
    if (match?.[2] && match[2].length >= 3) output = output.split(match[2]).join("<redacted:db-password>");
  }

  return output
    .replace(/mongodb(\+srv)?:\/\/[^\s"'\\]+/gi, "mongodb://<redacted>")
    .replace(/cloudinary:\/\/[^\s"'\\]+/gi, "cloudinary://<redacted>")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, "$1 <redacted>");
}

function truncate(value) {
  const text = typeof value === "string" ? redactSecrets(value) : JSON.stringify(value);
  if (typeof text !== "string") return String(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

/**
 * Reduce any thrown value to a printable, secret-free shape.
 *
 * @returns {{ name: string, code: string|null, message: string, meta?: object }}
 */
export function describeError(error) {
  if (!error) return { name: "UnknownError", code: null, message: "no error object" };

  if (typeof error === "string") {
    return { name: "Error", code: null, message: truncate(error) };
  }

  // Never allow an error's own name to smuggle a value through.
  const safeName = redactSecrets(String(error.name || "Error")).split("\n")[0].slice(0, 80);

  const described = {
    name: safeName,
    code: error.code ? String(error.code) : null,
    // Only the first line: Prisma appends code frames and occasionally query
    // fragments that can contain values from the request.
    message: truncate(String(error.message || "").split("\n").map((line) => line.trim()).filter(Boolean)[0] || ""),
  };

  if (error.meta && typeof error.meta === "object") {
    const safeMeta = {};
    for (const key of SAFE_META_KEYS) {
      if (error.meta[key] === undefined) continue;
      safeMeta[key] = truncate(error.meta[key]);
    }
    if (Object.keys(safeMeta).length > 0) described.meta = safeMeta;
  }

  return described;
}

/**
 * A stale Prisma Client has no delegate for a model that exists in the schema,
 * so the first query throws a TypeError that mentions the delegate name.
 */
export function isMissingPrismaDelegate(error, model) {
  if (!error || error.name !== "TypeError") return false;
  const message = String(error.message || "");
  if (!message.includes("undefined")) return false;
  if (!model) return /prisma\.\w+/i.test(message) || /reading '\w+'/.test(message);
  return message.includes(model);
}

/** True when every key is present and non-empty. Values are never returned. */
export function envPresence(keys) {
  const result = {};
  for (const key of keys) {
    result[key] = Boolean(process.env[key]);
  }
  return result;
}

/**
 * Structured, secret-free failure log. Always include the failing step so a
 * Netlify log search for the step name finds the root cause directly.
 *
 * @param {string} scope  e.g. "home-media:create"
 * @param {Error}  error
 * @param {object} context  small, non-sensitive values only
 */
export function logApiFailure(scope, error, context = {}) {
  const described = describeError(error);

  // Context comes from the request, so it is redacted on the same terms.
  const safeContext = {};
  for (const [key, value] of Object.entries(context)) {
    safeContext[key] =
      typeof value === "string" ? redactSecrets(value).slice(0, MAX_VALUE_LENGTH) : value;
  }

  const payload = {
    scope,
    error: described.name,
    code: described.code,
    message: described.message,
    ...(described.meta ? { meta: described.meta } : {}),
    ...safeContext,
  };

  console.error(`[api-failure] ${scope}`, JSON.stringify(payload));

  if (isMissingPrismaDelegate(error)) {
    console.error(
      "[api-failure] The generated Prisma Client is out of date: a model from schema.prisma has no delegate. " +
        "Run `npx prisma generate` (and check that `prisma validate` passes) during the build."
    );
  }

  return described;
}

/**
 * Map a described error onto a Persian message a non-technical admin can act on
 * — without leaking server internals.
 */
export function userMessageFor(error) {
  if (isMissingPrismaDelegate(error)) {
    return "سرویس داده‌ها به‌روزرسانی نشده است. لطفاً به مدیر فنی اطلاع دهید (کد: PRISMA_CLIENT_STALE).";
  }

  const code = error?.code;

  if (code === "P2021" || code === "P2010") {
    return "ساختار داده‌ها در سامانه کامل نیست. لطفاً به مدیر فنی اطلاع دهید (کد: SCHEMA_OUT_OF_DATE).";
  }
  if (code === "P2003") {
    return "ارتباط فایل با کاربر ایجادکننده ممکن نشد. لطفاً دوباره تلاش کنید.";
  }
  if (code === "P2002") {
    return "این فایل قبلاً ثبت شده است.";
  }
  if (/Malformed ObjectID|Inconsistent column data|Unable to convert/i.test(String(error?.message || ""))) {
    return "قالب داده‌های ارسالی با ساختار سامانه سازگار نیست.";
  }
  if (/Authentication failed|bad auth|SCRAM/i.test(String(error?.message || ""))) {
    return "اتصال به بانک اطلاعاتی برقرار نشد. لطفاً به مدیر فنی اطلاع دهید (کد: DB_AUTH).";
  }
  if (/server selection|ETIMEDOUT|ECONNREFUSED|timed out|MongoNetworkError/i.test(String(error?.message || ""))) {
    return "بانک اطلاعاتی در دسترس نیست. لطفاً چند لحظه بعد دوباره تلاش کنید (کد: DB_UNREACHABLE).";
  }
  if (code === "P2031") {
    return "سرویس بانک اطلاعاتی در حالت صحیح اجرا نشده است. لطفاً به مدیر فنی اطلاع دهید (کد: DB_TRANSACTIONS).";
  }

  return "ذخیره فایل در سامانه انجام نشد. لطفاً دوباره تلاش کنید.";
}
