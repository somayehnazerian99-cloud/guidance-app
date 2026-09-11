import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { validateSession, getSessionCookieName } from "./auth";
import { toPublicUser } from "./serializers";
import { resolveRoleAccess } from "./permissions";

export { toPublicUser };

/**
 * Server-side session helpers.
 *
 * Middleware can only see whether a cookie is *present*, so every private
 * layout calls requireRole() to validate the session against the database and
 * enforce the role before a single byte of the panel is rendered. A student
 * hitting /admin therefore gets a server redirect, not an admin shell.
 */

/**
 * Resolve the signed-in user from the session cookie, or null.
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    if (!token) return null;

    const session = await validateSession(token);
    if (!session?.user) return null;

    return toPublicUser(session.user);
  } catch {
    return null;
  }
}

/**
 * Require a specific role for a server-rendered route.
 * Redirects to the matching login page when unauthenticated, and to the
 * user's own panel when the role does not match.
 */
export async function requireRole(role) {
  const user = await getCurrentUser();
  const decision = resolveRoleAccess(user, role);

  if (decision.action === "redirect") {
    redirect(decision.to);
  }

  return user;
}
