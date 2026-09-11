import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "./prisma.js";

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_HOURS = 24;
const SESSION_COOKIE_NAME = "guidance-session";

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function validateSession(token) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  // A disabled account must lose access immediately, even if its session is
  // still inside the expiry window.
  if (!session.user || !session.user.isActive) {
    await invalidateSession(token);
    return null;
  }

  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function invalidateSession(token) {
  if (!token) return;
  try {
    await prisma.session.deleteMany({ where: { token } });
  } catch {
    // Session already deleted
  }
}

export async function invalidateAllUserSessions(userId) {
  await prisma.session.deleteMany({ where: { userId } });
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionCookieOptions(isSecure = false) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
  };
}

export function setSessionCookie(response, token, isSecure = false) {
  const options = getSessionCookieOptions(isSecure);
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) cookieParts.push("HttpOnly");
  if (options.secure) cookieParts.push("Secure");

  response.headers.set("Set-Cookie", cookieParts.join("; "));
}

export function clearSessionCookie(response) {
  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=lax; HttpOnly`
  );
}

export function getSessionTokenFromRequest(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) =>
    c.startsWith(`${SESSION_COOKIE_NAME}=`)
  );
  if (!sessionCookie) return null;
  return sessionCookie.split("=").slice(1).join("=");
}

export async function authenticateRequest(request) {
  const token = getSessionTokenFromRequest(request);
  return validateSession(token);
}

export function requireAuth(allowedRoles = []) {
  return async (request) => {
    const session = await authenticateRequest(request);
    if (!session) {
      return { error: "Unauthorized", status: 401 };
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
      return { error: "Forbidden", status: 403 };
    }
    return { session, user: session.user };
  };
}

export async function createAuditLog(userId, action, details, ipAddress) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: typeof details === "string" ? details : JSON.stringify(details),
        ipAddress,
      },
    });
  } catch {
    // Don't let audit log failures break the main flow
  }
}

export function validatePasswordStrength(password) {
  const errors = [];
  if (!password || password.length < 8) {
    errors.push("رمز عبور باید حداقل ۸ کاراکتر باشد");
  }
  if (password && password.length > 128) {
    errors.push("رمز عبور نباید بیش از ۱۲۸ کاراکتر باشد");
  }
  if (password && !/[A-Z]/.test(password)) {
    errors.push("رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد");
  }
  if (password && !/[a-z]/.test(password)) {
    errors.push("رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد");
  }
  if (password && !/[0-9]/.test(password)) {
    errors.push("رمز عبور باید حداقل یک عدد داشته باشد");
  }

  const weakPasswords = [
    "password",
    "12345678",
    "qwerty123",
    "admin123",
    "Password1",
    "11111111",
  ];
  if (password && weakPasswords.includes(password.toLowerCase())) {
    errors.push("این رمز عبور بسیار ضعیف است");
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory store)
//
// NOTE: in a multi-instance deployment replace this with a shared store
// (Redis / Upstash). The interface is intentionally small so the swap is local.
// ---------------------------------------------------------------------------
const rateLimitStore = new Map();
const MAX_RATE_LIMIT_ENTRIES = 5000;

function pruneRateLimitStore(now) {
  if (rateLimitStore.size < MAX_RATE_LIMIT_ENTRIES) return;
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
}

export function checkRateLimit(key, maxAttempts = 5, windowMs = 900000) {
  const now = Date.now();
  pruneRateLimitStore(now);

  const record = rateLimitStore.get(key) || { attempts: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.attempts = 0;
    record.resetAt = now + windowMs;
  }

  record.attempts++;
  rateLimitStore.set(key, record);

  return {
    allowed: record.attempts <= maxAttempts,
    remaining: Math.max(0, maxAttempts - record.attempts),
    resetAt: record.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

// Used after a successful login so a user is not locked out by their own
// successful attempts inside the same window.
export function resetRateLimit(key) {
  rateLimitStore.delete(key);
}

// ---------------------------------------------------------------------------
// Password reset tokens
//
// Only a SHA-256 hash of the token is persisted, so a database leak does not
// hand out usable reset links. Tokens are single-use and short-lived.
// ---------------------------------------------------------------------------
const RESET_TOKEN_TTL_MINUTES = 60;

export function generateResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    // Never run production without AUTH_SECRET. Locally we fall back to a plain
    // hash so a fresh checkout keeps working before .env is filled in.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not configured");
    }
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // Keyed hash: a database leak alone does not let an attacker forge or verify
  // reset tokens without also holding the application secret.
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function getResetTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + RESET_TOKEN_TTL_MINUTES);
  return expiresAt;
}

export function normalizeIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
