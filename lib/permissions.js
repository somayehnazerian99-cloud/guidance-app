export const ROLE_PERMISSIONS = {
  ADMIN: {
    canManageUsers: true,
    canManageStudents: true,
    canManageCounselors: true,
    canManageSchools: true,
    canManageClasses: true,
    canManageTests: true,
    canManageGrades: true,
    canManageInterests: true,
    canManageAbilities: true,
    canManageParentOpinions: true,
    canManageVideos: true,
    canViewReports: true,
    canManageSettings: true,
    canViewSecurityLogs: true,
    canViewAllStudents: true,
    canChangeRoles: true,
    canDeleteUsers: true,
    canViewAuditLogs: true,
    canApproveCounselors: true,
    canManageAllTickets: true,
    canUseSupport: true,
  },
  COUNSELOR: {
    canManageUsers: false,
    canManageStudents: false,
    canManageCounselors: false,
    canManageSchools: false,
    canManageClasses: false,
    canManageTests: false,
    canManageGrades: false,
    canManageInterests: false,
    canManageAbilities: false,
    canManageParentOpinions: false,
    canManageVideos: false,
    canViewReports: true,
    canManageSettings: false,
    canViewSecurityLogs: false,
    canViewAssignedStudentsOnly: true,
    canUpdateStudentGuidance: true,
    canViewAuditLogs: false,
    canApproveCounselors: false,
    canManageAllTickets: false,
    canUseSupport: true,
  },
  STUDENT: {
    canManageUsers: false,
    canManageStudents: false,
    canManageCounselors: false,
    canManageSchools: false,
    canManageClasses: false,
    canManageTests: false,
    canManageGrades: false,
    canManageInterests: false,
    canManageAbilities: false,
    canManageParentOpinions: false,
    canManageVideos: false,
    canViewReports: false,
    canManageSettings: false,
    canViewSecurityLogs: false,
    canViewOwnProfile: true,
    canTakeTests: true,
    canViewOwnGrades: true,
    canViewOwnResults: true,
    canViewVideos: true,
    canViewAuditLogs: false,
    canApproveCounselors: false,
    canManageAllTickets: false,
    canUseSupport: true,
  },
};

// ---------------------------------------------------------------------------
// Counselor registration approval
//
// A counselor who signs up through the public registration form starts in
// PENDING and cannot use the system until an administrator approves them.
// Accounts created directly by an admin — and every account that predates this
// field — are treated as APPROVED, so legacy rows keep working.
// ---------------------------------------------------------------------------

export const COUNSELOR_APPROVAL = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const COUNSELOR_APPROVAL_VALUES = Object.values(COUNSELOR_APPROVAL);

export const COUNSELOR_APPROVAL_LABELS = {
  PENDING: "در انتظار تأیید",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
};

/**
 * Approval is only meaningful for counselors; every other role passes.
 * @param {{role?: string, approvalStatus?: string}|null} user
 */
export function isCounselorApproved(user) {
  if (!user || user.role !== "COUNSELOR") return true;
  // A missing value means the row predates the field, i.e. an admin-created
  // account: treat it as approved rather than locking it out.
  const status = user.approvalStatus ?? COUNSELOR_APPROVAL.APPROVED;
  return status === COUNSELOR_APPROVAL.APPROVED;
}

/** Is this account waiting for (or refused) administrator approval? */
export function isCounselorPending(user) {
  if (!user || user.role !== "COUNSELOR") return false;
  return !isCounselorApproved(user);
}

export function counselorApprovalLabel(status) {
  return COUNSELOR_APPROVAL_LABELS[status] || COUNSELOR_APPROVAL_LABELS.PENDING;
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.[permission] === true;
}

export function canAccessResource(user, resourceOwnerId, resourceType) {
  if (user.role === "ADMIN") return true;
  if (user.role === "STUDENT") {
    return user.studentProfile?.id === resourceOwnerId;
  }
  if (user.role === "COUNSELOR") {
    return user.counselorProfile?.id === resourceOwnerId;
  }
  return false;
}

/**
 * Panel access decision, kept pure so it can be unit tested and reused by every
 * private layout.
 *
 * - no session            -> the login page for the panel being requested
 * - wrong role            -> the user's own panel (never the requested one)
 * - matching role         -> allowed
 *
 * @param {{role: string}|null} user
 * @param {"ADMIN"|"COUNSELOR"|"STUDENT"} requiredRole
 * @returns {{action: "allow"}|{action: "redirect", to: string}}
 */
export function resolveRoleAccess(user, requiredRole) {
  if (!user) {
    return { action: "redirect", to: `/login/${requiredRole.toLowerCase()}` };
  }

  if (user.role !== requiredRole) {
    return { action: "redirect", to: `/${user.role.toLowerCase()}` };
  }

  return { action: "allow" };
}
