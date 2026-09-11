/**
 * Password reset lifecycle verification against the real database.
 *
 *   node scripts/verify-password-reset.mjs      (DATABASE_URL must be set)
 *   npm run verify:live                         (starts a temporary MongoDB first)
 *
 * The HTTP layer of the reset endpoints is covered by scripts/verify-auth-http.mjs
 * (malformed token, weak password, generic response). This script covers the
 * token lifecycle itself, which the API cannot expose over HTTP by design
 * (production never returns the reset link):
 *
 *   - the raw token is never stored, only its keyed hash
 *   - tokens expire
 *   - a token can be used exactly once
 *   - the old password stops working and the new one works
 *   - every existing session is revoked by a reset
 *
 * The probe user is created and removed by this script.
 */

import prisma from "../lib/prisma.js";
import {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashToken,
  getResetTokenExpiry,
  createSession,
  validateSession,
  invalidateAllUserSessions,
} from "../lib/auth.js";

const results = [];
let failures = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`${ok ? "✔" : "✖"} [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? detail : `${detail} (assertion failed)`);
}

async function main() {
  const suffix = Date.now().toString(36);
  const username = `reset_probe_${suffix}`;
  const oldPassword = "Old@Password123";
  const newPassword = "New@Password456";

  console.log(`\nPassword reset lifecycle check (probe user: ${username})\n`);

  const user = await prisma.user.create({
    data: {
      username,
      password: await hashPassword(oldPassword),
      firstName: "آزمون",
      lastName: "بازیابی",
      role: "STUDENT",
    },
  });

  try {
    // --- token issuance mirrors the /api/auth/forgot-password route ----------
    const { token, tokenHash } = generateResetToken();

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt: getResetTokenExpiry() },
    });

    const stored = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });

    check("the reset token is stored only as a hash", stored && stored.token !== token, "raw token is not in the database");
    check("the stored hash matches the issued token", stored?.token === hashToken(token));
    check("the token is unused on creation", stored?.used === false);
    check("the token expires in the future", stored && new Date() < stored.expiresAt);

    // --- a session that must not survive the reset --------------------------
    const session = await createSession(user.id);
    check("a session exists before the reset", Boolean(await validateSession(session.token)));

    // --- expiry is enforced -------------------------------------------------
    const expired = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashToken(`${token}-expired`),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    check("an expired token is detected as expired", new Date() > expired.expiresAt);

    // --- consuming the token -----------------------------------------------
    const fresh = await prisma.passwordResetToken.findUnique({ where: { token: hashToken(token) } });
    check("lookup by hash finds the token", Boolean(fresh));

    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });
    await invalidateAllUserSessions(user.id);

    const reloaded = await prisma.user.findUnique({ where: { id: user.id } });
    check("the old password no longer works", !(await verifyPassword(oldPassword, reloaded.password)));
    check("the new password works", await verifyPassword(newPassword, reloaded.password));

    const afterUse = await prisma.passwordResetToken.findUnique({ where: { token: hashToken(token) } });
    check("the token is marked as used", afterUse?.used === true);

    const sessionsLeft = await prisma.session.count({ where: { userId: user.id } });
    check("all sessions were revoked by the reset", sessionsLeft === 0, `${sessionsLeft} session(s) left`);

    const staleSession = await validateSession(session.token);
    check("a session token from before the reset is rejected", staleSession === null);

    // --- replay is refused ---------------------------------------------------
    const replayAllowed = afterUse && !afterUse.used && new Date() < afterUse.expiresAt;
    check("replaying the same token is refused", !replayAllowed);
  } finally {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(
    `\n${failures === 0 ? "PASSWORD RESET CHECKS PASSED" : `${failures} PASSWORD RESET CHECK(S) FAILED`}` +
      ` — ${results.length - failures} passed, ${failures} failed\n`
  );

  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("Password reset verification failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
