import { GroupPermissions } from '../services/business/groupManagement';

// Permission constants for easy reference
export const PERMISSIONS = {
  ADD_MEMBERS: 'canAddMembers' as const,
  REMOVE_MEMBERS: 'canRemoveMembers' as const,
  EDIT_SETTINGS: 'canEditSettings' as const,
  MARK_PAYMENTS: 'canMarkPayments' as const,
  DELETE_GROUP: 'canDeleteGroup' as const,
  TRANSFER_ADMIN: 'canTransferAdmin' as const,
  VIEW_FINANCES: 'canViewFinances' as const,
  MANAGE_CYCLES: 'canManageCycles' as const,
} as const;

// Permission groups for related actions
export const PERMISSION_GROUPS = {
  MEMBER_MANAGEMENT: [
    PERMISSIONS.ADD_MEMBERS,
    PERMISSIONS.REMOVE_MEMBERS,
  ],
  FINANCIAL_MANAGEMENT: [
    PERMISSIONS.MARK_PAYMENTS,
    PERMISSIONS.VIEW_FINANCES,
  ],
  GROUP_ADMINISTRATION: [
    PERMISSIONS.EDIT_SETTINGS,
    PERMISSIONS.DELETE_GROUP,
    PERMISSIONS.TRANSFER_ADMIN,
    PERMISSIONS.MANAGE_CYCLES,
  ],
} as const;

// Admin-only permissions
export const ADMIN_ONLY_PERMISSIONS = [
  PERMISSIONS.ADD_MEMBERS,
  PERMISSIONS.REMOVE_MEMBERS,
  PERMISSIONS.EDIT_SETTINGS,
  PERMISSIONS.MARK_PAYMENTS,
  PERMISSIONS.DELETE_GROUP,
  PERMISSIONS.TRANSFER_ADMIN,
  PERMISSIONS.MANAGE_CYCLES,
] as const;

// Permissions that both admin and members have
export const SHARED_PERMISSIONS = [
  PERMISSIONS.VIEW_FINANCES,
] as const;

// Helper functions
export const hasAllPermissions = (
  userPermissions: GroupPermissions,
  requiredPermissions: (keyof GroupPermissions)[]
): boolean => {
  return requiredPermissions.every(permission => userPermissions[permission]);
};

export const hasAnyPermission = (
  userPermissions: GroupPermissions,
  permissions: (keyof GroupPermissions)[]
): boolean => {
  return permissions.some(permission => userPermissions[permission]);
};

export const isFullAdmin = (userPermissions: GroupPermissions): boolean => {
  return hasAllPermissions(userPermissions, ADMIN_ONLY_PERMISSIONS);
};

export const canManageMembers = (userPermissions: GroupPermissions): boolean => {
  return hasAllPermissions(userPermissions, PERMISSION_GROUPS.MEMBER_MANAGEMENT);
};

export const canManageFinances = (userPermissions: GroupPermissions): boolean => {
  return hasAllPermissions(userPermissions, PERMISSION_GROUPS.FINANCIAL_MANAGEMENT);
};

export const canAdministrateGroup = (userPermissions: GroupPermissions): boolean => {
  return hasAnyPermission(userPermissions, PERMISSION_GROUPS.GROUP_ADMINISTRATION);
};

// Permission descriptions for UI
export const PERMISSION_DESCRIPTIONS = {
  [PERMISSIONS.ADD_MEMBERS]: {
    title: 'Add Members',
    description: 'Invite new members to join the group',
    icon: 'person-add',
  },
  [PERMISSIONS.REMOVE_MEMBERS]: {
    title: 'Remove Members',
    description: 'Remove members from the group',
    icon: 'person-remove',
  },
  [PERMISSIONS.EDIT_SETTINGS]: {
    title: 'Edit Settings',
    description: 'Modify group settings and rules',
    icon: 'settings',
  },
  [PERMISSIONS.MARK_PAYMENTS]: {
    title: 'Mark Payments',
    description: 'Confirm member payments and contributions',
    icon: 'payment',
  },
  [PERMISSIONS.DELETE_GROUP]: {
    title: 'Delete Group',
    description: 'Permanently delete the entire group',
    icon: 'delete',
  },
  [PERMISSIONS.TRANSFER_ADMIN]: {
    title: 'Transfer Admin Rights',
    description: 'Transfer admin privileges to another member',
    icon: 'admin-panel-settings',
  },
  [PERMISSIONS.VIEW_FINANCES]: {
    title: 'View Finances',
    description: 'View group financial information and reports',
    icon: 'account-balance-wallet',
  },
  [PERMISSIONS.MANAGE_CYCLES]: {
    title: 'Manage Cycles',
    description: 'Handle group completion, restart, and cycle management',
    icon: 'autorenew',
  },
} as const;

// Role-based permission templates
export const createAdminPermissions = (): GroupPermissions => ({
  canAddMembers: true,
  canRemoveMembers: true,
  canEditSettings: true,
  canMarkPayments: true,
  canDeleteGroup: true,
  canTransferAdmin: true,
  canViewFinances: true,
  canManageCycles: true,
});

export const createMemberPermissions = (): GroupPermissions => ({
  canAddMembers: false,
  canRemoveMembers: false,
  canEditSettings: false,
  canMarkPayments: false,
  canDeleteGroup: false,
  canTransferAdmin: false,
  canViewFinances: true,
  canManageCycles: false,
});

// Permission validation
export const validatePermissionChange = (
  currentPermissions: GroupPermissions,
  newPermissions: Partial<GroupPermissions>,
  isCurrentUserAdmin: boolean
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Only admins can modify permissions
  if (!isCurrentUserAdmin) {
    errors.push('Only administrators can modify permissions');
    return { isValid: false, errors };
  }

  // Validate specific permission changes
  if (newPermissions.canDeleteGroup === true && !currentPermissions.canDeleteGroup) {
    errors.push('Cannot grant delete group permission to non-admins');
  }

  if (newPermissions.canTransferAdmin === true && !currentPermissions.canTransferAdmin) {
    errors.push('Cannot grant admin transfer permission to non-admins');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// UI helper for permission status
export const getPermissionStatus = (
  hasPermission: boolean
): { color: string; icon: string; text: string } => {
  if (hasPermission) {
    return {
      color: '#4CAF50',
      icon: 'check-circle',
      text: 'Allowed',
    };
  }
  
  return {
    color: '#F44336',
    icon: 'cancel',
    text: 'Restricted',
  };
};

// Check if action requires confirmation based on permission level
export const requiresConfirmation = (permission: keyof GroupPermissions): boolean => {
  const dangerousPermissions: (keyof GroupPermissions)[] = [
    PERMISSIONS.REMOVE_MEMBERS,
    PERMISSIONS.DELETE_GROUP,
    PERMISSIONS.TRANSFER_ADMIN,
  ];
  
  return dangerousPermissions.includes(permission);
};

// Get minimum role required for permission
export const getMinimumRoleForPermission = (permission: keyof GroupPermissions): 'admin' | 'member' => {
  return ADMIN_ONLY_PERMISSIONS.includes(permission as any) ? 'admin' : 'member';
};