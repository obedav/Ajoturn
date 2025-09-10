import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PermissionGate from '../../components/permissions/PermissionGate';
import withPermission from '../../components/permissions/withPermission';
import { useIsAdmin, useCanManageMembers, useCanEditSettings } from '../../contexts/PermissionsContext';
import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  getPermissionStatus,
  requiresConfirmation,
} from '../../utils/permissions';

interface GroupPermissionsDemoProps {
  userId: string;
  groupId: string;
}

const GroupPermissionsDemo: React.FC<GroupPermissionsDemoProps> = ({
  userId,
  groupId,
}) => {
  const { isAdmin, loading: adminLoading } = useIsAdmin(userId, groupId);
  const { canManage: canManageMembers, loading: membersLoading } = useCanManageMembers(userId, groupId);
  const { canEdit: canEditSettings, loading: settingsLoading } = useCanEditSettings(userId, groupId);

  const handleProtectedAction = (actionName: string) => {
    if (requiresConfirmation(actionName as keyof typeof PERMISSIONS)) {
      Alert.alert(
        'Confirm Action',
        `Are you sure you want to perform: ${actionName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => performAction(actionName) },
        ]
      );
    } else {
      performAction(actionName);
    }
  };

  const performAction = (actionName: string) => {
    Alert.alert('Success', `${actionName} completed successfully!`);
  };

  const renderPermissionItem = (permission: keyof typeof PERMISSIONS) => {
    const config = PERMISSION_DESCRIPTIONS[permission];
    const status = getPermissionStatus(true); // This would be dynamic in real usage

    return (
      <PermissionGate
        key={permission}
        userId={userId}
        groupId={groupId}
        permission={permission}
        fallback={
          <View style={[styles.permissionItem, styles.restrictedItem]}>
            <Icon name={config.icon} size={24} color="#999" />
            <View style={styles.permissionContent}>
              <Text style={[styles.permissionTitle, styles.restrictedText]}>
                {config.title}
              </Text>
              <Text style={[styles.permissionDescription, styles.restrictedText]}>
                Access Restricted
              </Text>
            </View>
            <Icon name="lock" size={20} color="#999" />
          </View>
        }
      >
        <TouchableOpacity
          style={styles.permissionItem}
          onPress={() => handleProtectedAction(config.title)}
        >
          <Icon name={config.icon} size={24} color={status.color} />
          <View style={styles.permissionContent}>
            <Text style={styles.permissionTitle}>{config.title}</Text>
            <Text style={styles.permissionDescription}>{config.description}</Text>
          </View>
          <View style={styles.statusContainer}>
            <Icon name={status.icon} size={16} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.text}
            </Text>
          </View>
        </TouchableOpacity>
      </PermissionGate>
    );
  };

  const renderRoleInfo = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.sectionTitle}>Your Role & Status</Text>
      
      <View style={styles.roleItem}>
        <Icon name="account-circle" size={24} color="#007AFF" />
        <View style={styles.roleContent}>
          <Text style={styles.roleTitle}>Role</Text>
          <Text style={styles.roleValue}>
            {adminLoading ? 'Checking...' : isAdmin ? 'Administrator' : 'Member'}
          </Text>
        </View>
      </View>

      <View style={styles.roleItem}>
        <Icon name="group" size={24} color="#4CAF50" />
        <View style={styles.roleContent}>
          <Text style={styles.roleTitle}>Member Management</Text>
          <Text style={styles.roleValue}>
            {membersLoading ? 'Checking...' : canManageMembers ? 'Allowed' : 'Restricted'}
          </Text>
        </View>
      </View>

      <View style={styles.roleItem}>
        <Icon name="settings" size={24} color="#FF9800" />
        <View style={styles.roleContent}>
          <Text style={styles.roleTitle}>Settings Management</Text>
          <Text style={styles.roleValue}>
            {settingsLoading ? 'Checking...' : canEditSettings ? 'Allowed' : 'Restricted'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderRoleInfo()}

      <View style={styles.permissionsContainer}>
        <Text style={styles.sectionTitle}>Available Actions</Text>
        <Text style={styles.sectionDescription}>
          Actions you can perform are highlighted. Restricted actions show with a lock icon.
        </Text>

        {Object.keys(PERMISSIONS).map(key => 
          renderPermissionItem(PERMISSIONS[key as keyof typeof PERMISSIONS])
        )}
      </View>

      {/* Admin-only section wrapped with HOC */}
      <AdminOnlySection userId={userId} groupId={groupId} />
    </ScrollView>
  );
};

// Example of using the HOC wrapper
const AdminOnlyComponent: React.FC<{ userId: string; groupId: string }> = () => (
  <View style={styles.adminSection}>
    <Text style={styles.sectionTitle}>Admin-Only Features</Text>
    <Text style={styles.adminText}>
      This section is only visible to administrators. It demonstrates 
      how the withPermission HOC can be used to wrap entire components.
    </Text>
    
    <TouchableOpacity style={styles.dangerButton}>
      <Icon name="delete-forever" size={20} color="#fff" />
      <Text style={styles.dangerButtonText}>Dangerous Admin Action</Text>
    </TouchableOpacity>
  </View>
);

const AdminOnlySection = withPermission(AdminOnlyComponent, {
  permission: 'canDeleteGroup',
  fallbackMessage: 'This section requires administrator privileges',
  showRetry: false,
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  roleContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  roleContent: {
    flex: 1,
    marginLeft: 12,
  },
  roleTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  roleValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  permissionsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  restrictedItem: {
    opacity: 0.6,
  },
  permissionContent: {
    flex: 1,
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
  },
  restrictedText: {
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  adminSection: {
    backgroundColor: '#E8F5E8',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  adminText: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 16,
    lineHeight: 20,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default GroupPermissionsDemo;