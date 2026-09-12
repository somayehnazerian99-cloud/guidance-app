/**
 * Serializers for values that cross the server -> client boundary.
 *
 * These exist so that no code path can accidentally hand a password hash (or
 * any other internal field) to a browser. Server components, API routes and
 * tests all share this single definition.
 */

import { canChangeTicketStatus, canReplyToTicket } from "./support.js";

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

/**
 * The only support-ticket shape that may reach a client.
 *
 * Permission flags are computed here, on the server, so the UI never decides
 * for itself whether the current viewer is allowed to reply or change a status.
 * They come from the same helpers the API route enforces, so the buttons a user
 * sees can never disagree with what the endpoint would accept — an administrator
 * could previously see a thread they were allowed to answer without any way to
 * answer it.
 *
 * The ticket's owner id is stripped — the client has no use for it and it is
 * one less identifier in the browser.
 */
export function toPublicTicket(ticket, { viewerId, viewerRole } = {}) {
  if (!ticket) return null;

  const isOwner = Boolean(viewerId) && ticket.userId === viewerId;

  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt ?? null,
    author: ticket.user
      ? {
          id: ticket.user.id,
          firstName: ticket.user.firstName,
          lastName: ticket.user.lastName,
          role: ticket.user.role,
        }
      : null,
    replyCount: ticket._count?.replies ?? 0,
    isOwner,
    canReply: canReplyToTicket(ticket, viewerRole, isOwner),
    canChangeStatus: canChangeTicketStatus(viewerRole),
  };
}
