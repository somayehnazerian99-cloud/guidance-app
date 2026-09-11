/**
 * Serializers for values that cross the server -> client boundary.
 *
 * These exist so that no code path can accidentally hand a password hash (or
 * any other internal field) to a browser. Server components, API routes and
 * tests all share this single definition.
 */

/**
 * The only user shape that may ever reach a client.
 * @param {object} user
 */
export function toPublicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email ?? null,
    role: user.role,
    isActive: user.isActive,
  };
}

export function toPublicUsers(users = []) {
  return users.map(toPublicUser);
}
