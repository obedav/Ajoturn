import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import GroupManagementService, { GroupPermissions } from '../../services/business/groupManagement';

interface PermissionGateProps {
  userId: string;
  groupId: string;
  permission: keyof GroupPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  loadingComponent?: React.ReactNode;
}

interface PermissionState {
  loading: boolean;
  hasPermission: boolean;
  error?: string;
}

const PermissionGate: React.FC<PermissionGateProps> = ({
  userId,
  groupId,
  permission,
  children,
  fallback,
  showError = false,
  loadingComponent,
}) => {
  const [state, setState] = useState<PermissionState>({
    loading: true,
    hasPermission: false,
  });

  useEffect(() => {
    checkPermission();
  }, [userId, groupId, permission]);

  const checkPermission = async () => {
    try {
      setState({ loading: true, hasPermission: false });

      const result = await GroupManagementService.checkPermission(userId, groupId, permission);
      
      if (result.success) {
        setState({
          loading: false,
          hasPermission: result.data || false,
        });
      } else {
        setState({
          loading: false,
          hasPermission: false,
          error: result.error,
        });
      }
    } catch (error) {
      setState({
        loading: false,
        hasPermission: false,
        error: 'Failed to check permissions',
      });
    }
  };

  if (state.loading) {
    return loadingComponent || (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (!state.hasPermission) {
    if (showError && state.error) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="error" size={24} color="#F44336" />
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      );
    }

    return (
      fallback ? (
        <>{fallback}</>
      ) : (
        <View style={styles.noPermissionContainer}>
          <Icon name="lock" size={24} color="#999" />
          <Text style={styles.noPermissionText}>
            You don't have permission to access this feature
          </Text>
        </View>
      )
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    marginLeft: 8,
    color: '#F44336',
    fontSize: 14,
    flex: 1,
  },
  noPermissionContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    margin: 16,
  },
  noPermissionText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default PermissionGate;