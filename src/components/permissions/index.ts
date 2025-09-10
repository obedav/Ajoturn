// Permission components
export { default as PermissionGate } from './PermissionGate';
export { default as withPermission } from './withPermission';

// Context and hooks
export {
  PermissionsProvider,
  usePermissions,
  useIsAdmin,
  useCanManageMembers,
  useCanEditSettings,
} from '../../contexts/PermissionsContext';

// Utilities and constants
export * from '../../utils/permissions';

// Types from the service
export type { GroupPermissions } from '../../services/business/groupManagement';