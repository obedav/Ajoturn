import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Loading...',
  transparent = true,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  style?: any;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = '#1E40AF',
  message,
  style,
}) => {
  return (
    <View style={[styles.spinner, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.spinnerMessage}>{message}</Text>}
    </View>
  );
};

interface SkeletonLoaderProps {
  height?: number;
  width?: string | number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  height = 20,
  width = '100%',
  borderRadius = 4,
  style,
}) => {
  return (
    <View
      style={[
        styles.skeleton,
        {
          height,
          width,
          borderRadius,
        },
        style,
      ]}
    />
  );
};

interface CardSkeletonProps {
  showAvatar?: boolean;
  lines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  showAvatar = true,
  lines = 3,
}) => {
  return (
    <View style={styles.cardSkeleton}>
      {showAvatar && (
        <View style={styles.skeletonHeader}>
          <SkeletonLoader height={40} width={40} borderRadius={20} />
          <View style={styles.skeletonHeaderContent}>
            <SkeletonLoader height={16} width="60%" />
            <SkeletonLoader height={12} width="40%" />
          </View>
        </View>
      )}
      <View style={styles.skeletonContent}>
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonLoader
            key={index}
            height={14}
            width={index === lines - 1 ? '70%' : '100%'}
            style={{ marginBottom: 8 }}
          />
        ))}
      </View>
    </View>
  );
};

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 5,
  showAvatar = true,
}) => {
  return (
    <View style={styles.listSkeleton}>
      {Array.from({ length: items }).map((_, index) => (
        <CardSkeleton key={index} showAvatar={showAvatar} lines={2} />
      ))}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  spinner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  spinnerMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#E5E7EB',
    opacity: 0.7,
  },
  cardSkeleton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonHeaderContent: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonContent: {
    flex: 1,
  },
  listSkeleton: {
    padding: 16,
  },
});