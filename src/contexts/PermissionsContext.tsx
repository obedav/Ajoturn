import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import GroupManagementService, { GroupPermissions } from '../services/business/groupManagement';

interface GroupPermissionCache {
  [groupId: string]: {
    permissions: GroupPermissions;
    role: 'admin' | 'member';
    lastUpdated: number;
    userId: string;
  };
}

interface PermissionsContextType {
  // Check if user has specific permission for a group
  hasPermission: (userId: string, groupId: string, permission: keyof GroupPermissions) => Promise<boolean>;
  
  // Get all permissions for a user in a group
  getPermissions: (userId: string, groupId: string) => Promise<GroupPermissions | null>;
  
  // Get user's role in a group
  getUserRole: (userId: string, groupId: string) => Promise<'admin' | 'member' | null>;
  
  // Clear cache for specific group (e.g., when permissions change)
  clearGroupCache: (groupId: string) => void;
  
  // Clear all cached permissions
  clearAllCache: () => void;
  
  // Preload permissions for a group (useful for optimization)
  preloadPermissions: (userId: string, groupId: string) => Promise<void>;
  
  // Check if user is admin of any group
  isAdminOfAnyGroup: (userId: string, groupIds: string[]) => Promise<boolean>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

interface PermissionsProviderProps {
  children: ReactNode;
  cacheTimeout?: number; // Cache timeout in milliseconds (default: 5 minutes)
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ 
  children, 
  cacheTimeout = 5 * 60 * 1000 // 5 minutes 
}) => {
  const [cache, setCache] = useState<GroupPermissionCache>({});

  const isCacheValid = useCallback((groupId: string, userId: string): boolean => {
    const cached = cache[groupId];
    if (!cached || cached.userId !== userId) {
      return false;
    }
    return Date.now() - cached.lastUpdated < cacheTimeout;
  }, [cache, cacheTimeout]);

  const getUserRole = useCallback(async (
    userId: string, 
    groupId: string
  ): Promise<'admin' | 'member' | null> => {
    try {
      // Check cache first
      if (isCacheValid(groupId, userId)) {
        return cache[groupId].role;
      }

      // Fetch from service
      const memberResult = await GroupManagementService.checkPermission(userId, groupId, 'canViewFinances');
      if (!memberResult.success) {
        return null;
      }

      // Get detailed permissions to determine role
      const permissions = await getPermissions(userId, groupId);
      if (!permissions) return null;

      // Admin has all permissions, member has limited permissions
      const role: 'admin' | 'member' = permissions.canDeleteGroup ? 'admin' : 'member';
      return role;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }, [cache, isCacheValid]);

  const getPermissions = useCallback(async (
    userId: string, 
    groupId: string
  ): Promise<GroupPermissions | null> => {
    try {
      // Check cache first
      if (isCacheValid(groupId, userId)) {
        return cache[groupId].permissions;
      }

      // This is a simplified approach - in a real app, you'd fetch this in one call
      // For now, we'll determine permissions based on role
      const roleResult = await GroupManagementService.checkPermission(userId, groupId, 'canDeleteGroup');
      
      if (!roleResult.success) {
        return null;
      }

      const isAdmin = roleResult.data;
      const permissions: GroupPermissions = {
        canAddMembers: isAdmin,
        canRemoveMembers: isAdmin,
        canEditSettings: isAdmin,
        canMarkPayments: isAdmin,
        canDeleteGroup: isAdmin,
        canTransferAdmin: isAdmin,
        canViewFinances: true, // Both admin and member can view
        canManageCycles: isAdmin,
      };

      // Cache the result
      setCache(prev => ({
        ...prev,
        [groupId]: {
          permissions,
          role: isAdmin ? 'admin' : 'member',
          lastUpdated: Date.now(),
          userId,
        },
      }));

      return permissions;
    } catch (error) {
      console.error('Error getting permissions:', error);
      return null;
    }
  }, [cache, isCacheValid]);

  const hasPermission = useCallback(async (
    userId: string, 
    groupId: string, 
    permission: keyof GroupPermissions
  ): Promise<boolean> => {
    try {
      // Check cache first
      if (isCacheValid(groupId, userId)) {
        return cache[groupId].permissions[permission];
      }

      // Fetch from service
      const result = await GroupManagementService.checkPermission(userId, groupId, permission);
      return result.success && result.data === true;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }, [cache, isCacheValid]);

  const clearGroupCache = useCallback((groupId: string) => {
    setCache(prev => {
      const newCache = { ...prev };
      delete newCache[groupId];
      return newCache;
    });
  }, []);

  const clearAllCache = useCallback(() => {
    setCache({});
  }, []);

  const preloadPermissions = useCallback(async (userId: string, groupId: string): Promise<void> => {
    await getPermissions(userId, groupId);
  }, [getPermissions]);

  const isAdminOfAnyGroup = useCallback(async (
    userId: string, 
    groupIds: string[]
  ): Promise<boolean> => {
    try {
      const checks = await Promise.all(
        groupIds.map(groupId => hasPermission(userId, groupId, 'canDeleteGroup'))
      );
      return checks.some(isAdmin => isAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }, [hasPermission]);

  const value: PermissionsContextType = {
    hasPermission,
    getPermissions,
    getUserRole,
    clearGroupCache,
    clearAllCache,
    preloadPermissions,
    isAdminOfAnyGroup,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = (): PermissionsContextType => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

// Utility hooks for common permission checks
export const useIsAdmin = (userId: string, groupId: string) => {
  const { hasPermission } = usePermissions();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const checkAdmin = async () => {
      setLoading(true);
      const adminStatus = await hasPermission(userId, groupId, 'canDeleteGroup');
      setIsAdmin(adminStatus);
      setLoading(false);
    };

    if (userId && groupId) {
      checkAdmin();
    }
  }, [userId, groupId, hasPermission]);

  return { isAdmin, loading };
};

export const useCanManageMembers = (userId: string, groupId: string) => {
  const { hasPermission } = usePermissions();
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const checkPermission = async () => {
      setLoading(true);
      const result = await hasPermission(userId, groupId, 'canAddMembers');
      setCanManage(result);
      setLoading(false);
    };

    if (userId && groupId) {
      checkPermission();
    }
  }, [userId, groupId, hasPermission]);

  return { canManage, loading };
};

export const useCanEditSettings = (userId: string, groupId: string) => {
  const { hasPermission } = usePermissions();
  const [canEdit, setCanEdit] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const checkPermission = async () => {
      setLoading(true);
      const result = await hasPermission(userId, groupId, 'canEditSettings');
      setCanEdit(result);
      setLoading(false);
    };

    if (userId && groupId) {
      checkPermission();
    }
  }, [userId, groupId, hasPermission]);

  return { canEdit, loading };
};