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
  },
};

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
