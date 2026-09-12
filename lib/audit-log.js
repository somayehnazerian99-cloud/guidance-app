/**
 * Audit trail helpers — Persian presentation layer.
 *
 * Two responsibilities, both dependency-free so they can be unit tested and
 * used from the server, the API and (indirectly) the admin UI:
 *
 *   1. `sanitizeAuditDetails` — makes sure a password, token or reset link can
 *      never be written into the audit trail.
 *   2. `describeAuditLog` — turns a raw log row into a readable Persian
 *      sentence such as «کاربر علی احمدی در تاریخ ... وارد سیستم شد».
 */

/** Keys whose values must never be persisted in the audit trail. */
const SENSITIVE_KEY_PATTERN =
  /(pass|password|token|secret|hash|credential|cookie|authorization)/i;

const MAX_DETAIL_LENGTH = 1200;

/**
 * Recursively drop sensitive keys and clamp value lengths.
 * Accepts an object, a JSON string, a plain string or null.
 */
export function sanitizeAuditDetails(details) {
  if (details === null || details === undefined) return {};

  let value = details;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed.slice(0, MAX_DETAIL_LENGTH);
      }
    } else {
      value = trimmed.slice(0, MAX_DETAIL_LENGTH);
    }
  }

  return scrub(value);
}

function scrub(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, MAX_DETAIL_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    if (depth > 4) return "[…]";
    return value.slice(0, 50).map((entry) => scrub(entry, depth + 1));
  }

  if (typeof value === "object") {
    if (depth > 4) return "[…]";
    const clean = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) continue;
      clean[key] = scrub(entry, depth + 1);
    }
    return clean;
  }

  return String(value);
}

/**
 * Parse the stored details column back into an object.
 * Legacy rows may hold invalid JSON, so this never throws.
 */
export function parseAuditDetails(details) {
  if (!details) return {};
  if (typeof details === "object") return details;

  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === "object") return parsed;
    return { note: String(parsed) };
  } catch {
    return { note: String(details) };
  }
}

const ROLE_LABELS = {
  ADMIN: "مدیر سیستم",
  COUNSELOR: "مشاور",
  STUDENT: "دانش‌آموز",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || "کاربر";
}

/**
 * The role in parentheses after a name — except when the name already *is* the
 * role label, which is the case for accounts like «مدیر سیستم». Without this
 * guard the sentence read «مدیر سیستم (مدیر سیستم) وارد سیستم شد».
 */
function roleSuffix(actor, role) {
  if (!role) return "";
  const label = roleLabel(role);
  if (actor.includes(label)) return "";
  return ` (${label})`;
}

/**
 * Tone drives the badge colour in the admin UI.
 * @typedef {"success"|"warning"|"danger"|"info"|"neutral"} AuditTone
 */

/**
 * The audit action catalogue.
 *
 * Every action maps to a short Persian label plus a sentence builder that
 * receives the actor's display name and the parsed details object.
 */
export const AUDIT_ACTIONS = {
  LOGIN: {
    label: "ورود به سیستم",
    tone: "success",
    sentence: (actor, d, role) => `${actor}${roleSuffix(actor, role)} وارد سیستم شد`,
  },
  LOGOUT: {
    label: "خروج از سیستم",
    tone: "neutral",
    sentence: (actor) => `${actor} از سیستم خارج شد`,
  },
  FAILED_LOGIN: {
    label: "ورود ناموفق",
    tone: "warning",
    sentence: (actor, d) =>
      `تلاش ناموفق برای ورود با نام کاربری «${d.username || actor}» - دلیل: ${reasonLabel(d.reason)}`,
  },
  RATE_LIMITED_LOGIN: {
    label: "مسدودسازی موقت ورود",
    tone: "danger",
    sentence: (actor, d) =>
      `ورود با نام کاربری «${d.username || actor}» به دلیل تلاش‌های بیش از حد موقتاً مسدود شد`,
  },
  REGISTER: {
    label: "ثبت‌نام کاربر جدید",
    tone: "info",
    sentence: (actor, d) => {
      const role = roleLabel(d.role);
      const status = d.approvalStatus === "PENDING" ? " و در انتظار تأیید مدیر است" : "";
      return `${role} جدیدی با نام «${d.displayName || actor}» ثبت‌نام کرد${status}`;
    },
  },
  COUNSELOR_APPROVED: {
    label: "تأیید مشاور",
    tone: "success",
    sentence: (actor, d) => `${actor} ثبت‌نام مشاور «${targetName(d)}» را تأیید کرد`,
  },
  COUNSELOR_REJECTED: {
    label: "رد مشاور",
    tone: "danger",
    sentence: (actor, d) => `${actor} ثبت‌نام مشاور «${targetName(d)}» را رد کرد`,
  },
  PASSWORD_CHANGE: {
    label: "تغییر رمز عبور",
    tone: "info",
    sentence: (actor) => `${actor} رمز عبور خود را تغییر داد`,
  },
  PASSWORD_CHANGE_FAILED: {
    label: "تغییر ناموفق رمز عبور",
    tone: "warning",
    sentence: (actor) => `تلاش ناموفق ${actor} برای تغییر رمز عبور`,
  },
  PASSWORD_RESET_REQUESTED: {
    label: "درخواست بازیابی رمز",
    tone: "info",
    sentence: (actor, d) =>
      d.found === false
        ? `درخواست بازیابی رمز عبور برای نام کاربری ناموجود «${
            d.attemptedUsername || d.username || "نامشخص"
          }» ثبت شد`
        : `${actor} درخواست بازیابی رمز عبور ثبت کرد`,
  },
  PASSWORD_RESET: {
    label: "بازیابی رمز عبور",
    tone: "info",
    sentence: (actor) => `${actor} رمز عبور خود را با لینک بازیابی بازنشانی کرد`,
  },
  PASSWORD_RESET_FAILED: {
    label: "بازیابی ناموفق رمز",
    tone: "warning",
    sentence: (actor, d) =>
      `تلاش ناموفق برای بازیابی رمز عبور - دلیل: ${reasonLabel(d.reason)}`,
  },
  CREATE_USER: {
    label: "ایجاد کاربر",
    tone: "success",
    sentence: (actor, d) =>
      `${actor} کاربر جدیدی با نقش «${roleLabel(d.role)}» ایجاد کرد`,
  },
  UPDATE_USER: {
    label: "ویرایش کاربر",
    tone: "info",
    sentence: (actor, d) => `${actor} اطلاعات کاربر «${targetName(d)}» را ویرایش کرد`,
  },
  DELETE_USER: {
    label: "حذف کاربر",
    tone: "danger",
    sentence: (actor, d) => `${actor} کاربر «${targetName(d)}» را حذف کرد`,
  },
  ROLE_CHANGE: {
    label: "تغییر نقش کاربر",
    tone: "warning",
    sentence: (actor, d) =>
      `${actor} نقش کاربر «${targetName(d)}» را به «${roleLabel(d.newRole)}» تغییر داد`,
  },
  CREATE_STUDENT: {
    label: "ایجاد دانش‌آموز",
    tone: "success",
    sentence: (actor, d) =>
      `${actor} پرونده دانش‌آموز «${targetName(d)}» را ایجاد کرد`,
  },
  UPDATE_STUDENT: {
    label: "ویرایش اطلاعات دانش‌آموز",
    tone: "info",
    sentence: (actor, d) => `${actor} اطلاعات دانش‌آموز «${targetName(d)}» را ویرایش کرد`,
  },
  DELETE_STUDENT: {
    label: "حذف دانش‌آموز",
    tone: "danger",
    sentence: (actor, d) => `${actor} پرونده دانش‌آموز «${targetName(d)}» را حذف کرد`,
  },
  CREATE_GRADE: {
    label: "ثبت نمره",
    tone: "info",
    sentence: (actor, d) =>
      d.subjectName
        ? `${actor} نمره درس «${d.subjectName}» را برای «${targetName(d)}» ثبت کرد`
        : `${actor} نمره‌ای برای «${targetName(d)}» ثبت کرد`,
  },
  CREATE_TEST: {
    label: "ایجاد آزمون",
    tone: "info",
    sentence: (actor) => `${actor} آزمون مشاوره‌ای جدیدی ایجاد کرد`,
  },
  TEST_SUBMIT: {
    label: "ثبت پاسخ آزمون",
    tone: "info",
    sentence: (actor) => `${actor} پاسخ‌های آزمون مشاوره‌ای خود را ثبت کرد`,
  },
  GUIDANCE_CALCULATED: {
    label: "محاسبه هدایت تحصیلی",
    tone: "info",
    sentence: (actor, d) =>
      `${actor} نتیجه هدایت تحصیلی «${targetName(d)}» را محاسبه کرد`,
  },
  CREATE_TICKET: {
    label: "ثبت تیکت پشتیبانی",
    tone: "info",
    sentence: (actor, d) => `${actor} تیکت پشتیبانی «${d.subject || "بدون عنوان"}» را ثبت کرد`,
  },
  REPLY_TICKET: {
    label: "پاسخ به تیکت",
    tone: "info",
    sentence: (actor, d) => `${actor} به تیکت «${d.subject || "بدون عنوان"}» پاسخ داد`,
  },
  DELETE_TICKET: {
    label: "حذف تیکت",
    tone: "danger",
    sentence: (actor, d) => `${actor} تیکت «${d.subject || "بدون عنوان"}» را حذف کرد`,
  },
  UPDATE_TICKET_STATUS: {
    label: "تغییر وضعیت تیکت",
    tone: "warning",
    sentence: (actor, d) =>
      `${actor} وضعیت تیکت «${d.subject || "بدون عنوان"}» را به «${ticketStatusLabel(d.status)}» تغییر داد`,
  },
};

function targetName(details = {}) {
  if (details.targetName) return details.targetName;
  if (details.targetUsername) return details.targetUsername;
  // A raw identifier is a poor substitute, but it is still better than
  // «نامشخص» when an older audit row has nothing else to offer.
  if (details.username) return details.username;
  if (details.targetUserId) return details.targetUserId;
  return "نامشخص";
}

const REASON_LABELS = {
  user_not_found: "کاربر یافت نشد",
  wrong_password: "رمز عبور نادرست",
  role_mismatch: "نقش کاربر با این پنل مطابقت ندارد",
  account_disabled: "حساب کاربری غیرفعال است",
  account_pending_approval: "حساب در انتظار تأیید مدیر است",
  account_rejected: "ثبت‌نام توسط مدیر رد شده است",
  token_not_found: "توکن یافت نشد",
  token_already_used: "توکن قبلاً استفاده شده",
  token_expired: "توکن منقضی شده",
  user_unavailable: "کاربر در دسترس نیست",
  wrong_current_password: "رمز عبور فعلی نادرست است",
};

export function reasonLabel(reason) {
  return REASON_LABELS[reason] || "نامشخص";
}

const TICKET_STATUS_LABELS = {
  OPEN: "باز",
  IN_PROGRESS: "در حال بررسی",
  CLOSED: "بسته شده",
};

function ticketStatusLabel(status) {
  return TICKET_STATUS_LABELS[status] || "نامشخص";
}

/**
 * Render one audit log row as Persian text.
 *
 * @param {{action: string, details?: any, user?: {firstName?: string, lastName?: string, role?: string}|null, createdAt?: Date|string}} log
 * @returns {{action: string, label: string, tone: AuditTone, sentence: string, actorName: string}}
 */
export function describeAuditLog(log = {}) {
  const details = parseAuditDetails(log.details);
  const action = log.action || "UNKNOWN";
  const definition = AUDIT_ACTIONS[action];

  const fullName = [log.user?.firstName, log.user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const actorName =
    fullName ||
    details.displayName ||
    details.username ||
    details.targetUsername ||
    "کاربر ناشناس";

  // The actor's own role: prefer the relation, fall back to the recorded role.
  const actorRole = log.user?.role || details.role || null;

  if (!definition) {
    return {
      action,
      label: action,
      tone: "neutral",
      sentence: `${actorName} عملیاتی با کد «${action}» انجام داد`,
      actorName,
    };
  }

  return {
    action,
    label: definition.label,
    tone: definition.tone,
    sentence: definition.sentence(actorName, details, actorRole),
    actorName,
  };
}

/**
 * Serialize an API audit log row for the admin UI: Persian sentence plus the
 * raw, non-sensitive metadata needed for filtering.
 */
export function toAuditLogEntry(log) {
  const described = describeAuditLog(log);

  return {
    id: log.id,
    action: described.action,
    actionLabel: described.label,
    tone: described.tone,
    sentence: described.sentence,
    actorName: described.actorName,
    actorRole: log.user?.role || null,
    ipAddress: log.ipAddress || null,
    createdAt: log.createdAt,
  };
}

/**
 * Every action that should be offered as a filter in the admin UI.
 */
export function listAuditActions() {
  return Object.entries(AUDIT_ACTIONS).map(([action, definition]) => ({
    action,
    label: definition.label,
  }));
}
