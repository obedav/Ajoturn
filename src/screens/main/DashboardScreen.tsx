import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { MainTabScreenProps } from '../../navigation/types';

type Props = MainTabScreenProps<'Dashboard'>;

interface GroupSummary {
  id: string;
  name: string;
  totalAmount: number;
  nextPayoutDate: string;
  memberCount: number;
  myPosition: number;
}

interface QuickStats {
  totalSavings: number;
  activeGroups: number;
  nextPayout: number;
  reliabilityScore: number;
}

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStats>({
    totalSavings: 450000,
    activeGroups: 3,
    nextPayout: 500000,
    reliabilityScore: 98,
  });

  const [groups, setGroups] = useState<GroupSummary[]>([
    {
      id: '1',
      name: 'Family Savings Circle',
      totalAmount: 500000,
      nextPayoutDate: '2024-03-15',
      memberCount: 10,
      myPosition: 3,
    },
    {
      id: '2',
      name: 'Office Colleagues',
      totalAmount: 200000,
      nextPayoutDate: '2024-03-20',
      memberCount: 8,
      myPosition: 5,
    },
    {
      id: '3',
      name: 'Monthly Investment',
      totalAmount: 1000000,
      nextPayoutDate: '2024-04-01',
      memberCount: 20,
      myPosition: 12,
    },
  ]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Simulate loading data
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleCreateGroup = () => {
    navigation.navigate('CreateGroup');
  };

  const handleJoinGroup = () => {
    navigation.navigate('JoinGroup', {});
  };

  const handleGroupPress = (group: GroupSummary) => {
    navigation.navigate('GroupDetails', {
      groupId: group.id,
      groupName: group.name,
    });
  };

  const handleMakePayment = (group: GroupSummary) => {
    navigation.navigate('Payment', {
      groupId: group.id,
      amount: group.totalAmount / group.memberCount,
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (position: number, memberCount: number) => {
    const progress = position / memberCount;
    if (progress <= 0.3) return '#38a169'; // Green for early positions
    if (progress <= 0.7) return '#d69e2e'; // Yellow for middle positions
    return '#e53e3e'; // Red for later positions
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.welcomeText}>Welcome back! 👋</Text>
          <Text style={styles.subtitle}>Here's your savings overview</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatCurrency(stats.totalSavings)}</Text>
              <Text style={styles.statLabel}>Total Savings</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.activeGroups}</Text>
              <Text style={styles.statLabel}>Active Groups</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatCurrency(stats.nextPayout)}</Text>
              <Text style={styles.statLabel}>Next Payout</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.reliabilityScore}%</Text>
              <Text style={styles.statLabel}>Reliability</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCreateGroup}>
              <Text style={styles.actionIcon}>➕</Text>
              <Text style={styles.actionText}>Create Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleJoinGroup}>
              <Text style={styles.actionIcon}>🔗</Text>
              <Text style={styles.actionText}>Join Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('PaymentHistory', {})}
            >
              <Text style={styles.actionIcon}>📊</Text>
              <Text style={styles.actionText}>View History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Groups</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Groups')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {groups.map((group) => (
            <TouchableOpacity 
              key={group.id} 
              style={styles.groupCard}
              onPress={() => handleGroupPress(group)}
            >
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={[
                  styles.positionBadge,
                  { backgroundColor: getStatusColor(group.myPosition, group.memberCount) }
                ]}>
                  <Text style={styles.positionText}>#{group.myPosition}</Text>
                </View>
              </View>
              
              <View style={styles.groupDetails}>
                <Text style={styles.groupAmount}>{formatCurrency(group.totalAmount)}</Text>
                <Text style={styles.groupMembers}>{group.memberCount} members</Text>
              </View>
              
              <View style={styles.groupFooter}>
                <Text style={styles.nextPayoutDate}>
                  Next payout: {formatDate(group.nextPayoutDate)}
                </Text>
                <TouchableOpacity 
                  style={styles.payButton}
                  onPress={() => handleMakePayment(group)}
                >
                  <Text style={styles.payButtonText}>Pay</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          <View style={styles.activityItem}>
            <Text style={styles.activityIcon}>💰</Text>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Payment received</Text>
              <Text style={styles.activitySubtitle}>John Doe made a contribution</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
          </View>
          
          <View style={styles.activityItem}>
            <Text style={styles.activityIcon}>👥</Text>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>New member joined</Text>
              <Text style={styles.activitySubtitle}>Jane Smith joined Office Colleagues</Text>
              <Text style={styles.activityTime}>1 day ago</Text>
            </View>
          </View>
          
          <View style={styles.activityItem}>
            <Text style={styles.activityIcon}>🎉</Text>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Payout completed</Text>
              <Text style={styles.activitySubtitle}>You received ₦500,000 from Family Circle</Text>
              <Text style={styles.activityTime}>3 days ago</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    backgroundColor: '#3182ce',
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  seeAllText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#4a5568',
    fontWeight: '500',
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  positionText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  groupDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#38a169',
  },
  groupMembers: {
    fontSize: 14,
    color: '#718096',
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextPayoutDate: {
    fontSize: 12,
    color: '#718096',
    flex: 1,
  },
  payButton: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
    color: '#a0aec0',
  },
});

export default DashboardScreen;