/**
 * Support ticket domain: statuses, priorities, categories and their Persian
 * labels. Dependency-free and pure so both the API and the UI import the same
 * definitions (and tests can assert on them).
 */

export const TICKET_STATUS = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  CLOSED: "CLOSED",
};

export const TICKET_STATUS_VALUES = Object.values(TICKET_STATUS);

export const TICKET_STATUS_LABELS = {
  OPEN: "باز",
  IN_PROGRESS: "در حال بررسی",
  CLOSED: "بسته شده",
};

/** Badge variants keyed by status, so every screen renders them identically. */
export const TICKET_STATUS_VARIANTS = {
  OPEN: "default",
  IN_PROGRESS: "secondary",
  CLOSED: "outline",
};

export const TICKET_CATEGORY = {
  ACCOUNT: "ACCOUNT",
  GRADES: "GRADES",
  TESTS: "TESTS",
  GUIDANCE: "GUIDANCE",
  TECHNICAL: "TECHNICAL",
  OTHER: "OTHER",
};

export const TICKET_CATEGORY_VALUES = Object.values(TICKET_CATEGORY);

export const TICKET_CATEGORY_LABELS = {
  ACCOUNT: "حساب کاربری",
  GRADES: "نمرات",
  TESTS: "آزمون‌ها",
  GUIDANCE: "هدایت تحصیلی",
  TECHNICAL: "مشکل فنی",
  OTHER: "سایر",
};

export const TICKET_PRIORITY = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
};

export const TICKET_PRIORITY_VALUES = Object.values(TICKET_PRIORITY);

export const TICKET_PRIORITY_LABELS = {
  LOW: "کم",
  NORMAL: "معمولی",
  HIGH: "فوری",
};

export function ticketStatusLabel(status) {
  return TICKET_STATUS_LABELS[status] || "نامشخص";
}

export function ticketCategoryLabel(category) {
  return TICKET_CATEGORY_LABELS[category] || "سایر";
}

export function ticketPriorityLabel(priority) {
  return TICKET_PRIORITY_LABELS[priority] || "معمولی";
}

/** A closed ticket is read-only for its owner until an admin reopens it. */
export function isTicketClosed(ticket) {
  return ticket?.status === TICKET_STATUS.CLOSED;
}

/** Can this viewer write a new message into the thread? */
export function canReplyToTicket(ticket, viewerRole, isOwner) {
  if (!ticket) return false;
  if (viewerRole === "ADMIN") return true;
  if (!isOwner) return false;
  return !isTicketClosed(ticket);
}

/** Only administrators may move a ticket between statuses. */
export function canChangeTicketStatus(viewerRole) {
  return viewerRole === "ADMIN";
}
