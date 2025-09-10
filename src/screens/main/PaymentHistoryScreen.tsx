import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useGroup } from '../../contexts/GroupContext';
import PaymentHistory from '../../components/PaymentHistory';
import { PaymentHistoryItem } from '../../services/business/paymentTracking';

interface PaymentHistoryScreenProps {
  navigation: any;
  route?: {
    params?: {
      groupId?: string;
      userId?: string;
    };
  };
}

const PaymentHistoryScreen: React.FC<PaymentHistoryScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { user } = useAuth();
  const { groups } = useGroup();
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(
    route?.params?.groupId
  );
  const [viewMode, setViewMode] = useState<'personal' | 'group'>('personal');

  const handlePaymentPress = (payment: PaymentHistoryItem) => {
    // Navigate to payment details screen or show detailed modal
    console.log('Payment pressed:', payment);
  };

  const renderGroupSelector = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.groupSelector}
      contentContainerStyle={styles.groupSelectorContent}
    >
      <TouchableOpacity
        style={[
          styles.groupSelectorItem,
          viewMode === 'personal' && styles.groupSelectorItemActive
        ]}
        onPress={() => {
          setViewMode('personal');
          setSelectedGroupId(undefined);
        }}
      >
        <Text style={[
          styles.groupSelectorText,
          viewMode === 'personal' && styles.groupSelectorTextActive
        ]}>
          My Payments
        </Text>
      </TouchableOpacity>
      
      {groups.map((group) => (
  <TouchableOpacity
    key={group.id}
    style={[
      styles.groupSelectorItem,
      selectedGroupId === group.id && styles.groupSelectorItemActive
    ]}
    onPress={() => {
      setViewMode('group');
      setSelectedGroupId(group.id);
    }}
  >
    <Text
      style={[
        styles.groupSelectorText,
        selectedGroupId === group.id && styles.groupSelectorTextActive
      ]}
    >
      Group {group.id.substring(0, 8)}
    </Text>
  </TouchableOpacity>
))}
    </ScrollView>
  );

  const renderStats = () => {
    // This would calculate and display payment statistics
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Icon name="payment" size={20} color="#4CAF50" />
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="schedule" size={20} color="#FF9800" />
          <Text style={styles.statValue}>2</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="error" size={20} color="#F44336" />
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Group Selector */}
      {renderGroupSelector()}

      {/* Stats Summary */}
      {renderStats()}

      {/* Payment History */}
      <View style={styles.historyContainer}>
        <PaymentHistory
          userId={viewMode === 'personal' ? user?.uid : undefined}
          groupId={selectedGroupId}
          showHeader={false}
          onPaymentPress={handlePaymentPress}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 32,
  },
  groupSelector: {
    backgroundColor: '#fff',
    maxHeight: 50,
  },
  groupSelectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  groupSelectorItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    minWidth: 80,
    alignItems: 'center',
  },
  groupSelectorItemActive: {
    backgroundColor: '#2196F3',
  },
  groupSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  groupSelectorTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  historyContainer: {
    flex: 1,
    marginTop: 8,
  },
});

export default PaymentHistoryScreen;