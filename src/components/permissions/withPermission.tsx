import React, { ComponentType, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import GroupManagementService, { GroupPermissions } from '../../services/business/groupManagement';

interface WithPermissionOptions {
  permission: keyof GroupPermissions;
  fallbackMessage?: string;
  showRetry?: boolean;
  loadingMessage?: string;
}

interface WithPermissionProps {
  userId: string;
  groupId: string;
}

function withPermission<P extends WithPermissionProps>(
  WrappedComponent: ComponentType<P>,
  options: WithPermissionOptions
) {
  const WithPermissionComponent: React.FC<P> = (props) => {
    const [loading, setLoading] = useState(true);
    const [hasPermission, setHasPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { userId, groupId } = props;
    const { permission, fallbackMessage, showRetry = true, loadingMessage } = options;

    useEffect(() => {
      checkPermission();
    }, [userId, groupId]);

    const checkPermission = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await GroupManagementService.checkPermission(userId, groupId, permission);
        
        if (result.success) {
          setHasPermission(result.data || false);
        } else {
          setHasPermission(false);
          setError(result.error || 'Permission check failed');
        }
      } catch (err) {
        setHasPermission(false);
        setError('Failed to verify permissions');
      } finally {
        setLoading(false);
      }
    };

    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {loadingMessage || 'Verifying permissions...'}
          </Text>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.centerContainer}>
          <Icon name="security" size={64} color="#999" />
          <Text style={styles.noPermissionTitle}>Access Restricted</Text>
          <Text style={styles.noPermissionMessage}>
            {fallbackMessage || 
             error || 
             'You need admin privileges to access this feature'}
          </Text>
          
          {showRetry && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={checkPermission}
            >
              <Icon name="refresh" size={20} color="#007AFF" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return <WrappedComponent {...props} />;
  };

  WithPermissionComponent.displayName = 
    `withPermission(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithPermissionComponent;
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noPermissionMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  retryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default withPermission;