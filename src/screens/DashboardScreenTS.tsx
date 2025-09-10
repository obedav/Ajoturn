import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { MainTabScreenProps } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { SavingsGroup, Contribution } from '../services/firestore';
import FirestoreService from '../services/firestore';
import { usePaymentStatus, useGroupCompletion } from '../hooks/useBusinessLogic';
import { formatNigerianDate, getRelativeTime } from '../utils/dateUtils';


interface DashboardStats {
  totalGroups: number;
  totalContributions: number;
  nextPayoutAmount: number;
  nextPayoutDate: string;
  reliabilityScore: number;
}

const DashboardScreenTS: React.FC<MainTabScreenProps<'Dashboard'>> = ({ navigation }) => {
  const { user } = useAuth();
  const { groups, loading: groupsLoading, refreshGroups } = useGroup();
  const paymentStatusHook = usePaymentStatus();
  const groupCompletionHook = useGroupCompletion();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalGroups: 0,
    totalContributions: 0,
    nextPayoutAmount: 0,
    nextPayoutDate: '',
    reliabilityScore: 0,
  });
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [groupStatuses, setGroupStatuses] = useState<{[key: string]: any}>({});

  // Load dashboard data
  const loadDashboardData = async (): Promise<void> => {
    if (!user) return;
    
    try {
      // Refresh groups data
      await refreshGroups();
      
      // Load user contributions
      const userContributions = await FirestoreService.getUserContributions(user.uid);
      setContributions(userContributions);
      
      // Calculate stats with business logic
      await calculateStats(groups, userContributions);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    }
  };

  // Calculate dashboard statistics with business logic
  const calculateStats = async (userGroups: SavingsGroup[], userContributions: Contribution[]): Promise<void> => {
    const totalContributions = userContributions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + c.amount, 0);
    
    const paidCount = userContributions.filter(c => c.status === 'paid').length;
    const totalCount = userContributions.length;
    const reliabilityScore = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 100;
    
    // Get detailed group statuses using business logic
    const groupStatusData: {[key: string]: any} = {};
    let nextPayoutAmount = 0;
    let nextPayoutDate = 'Not scheduled';
    
    for (const group of userGroups) {
      if (group.status === 'active') {
        // Get payment status for this group
        const paymentStatus = await paymentStatusHook.checkPaymentStatus(group.id);
        const completion = await groupCompletionHook.validateGroupCompletion(group.id);
        
        groupStatusData[group.id] = {
          paymentStatus: paymentStatus.data,
          completion: completion.data,
        };
        
        // Find user's next expected payout
        const userMember = group.members.find(m => m.userId === user?.uid);
        if (userMember && !nextPayoutAmount) {
          nextPayoutAmount = group.contributionAmount * group.members.length;
          nextPayoutDate = formatNigerianDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Rough estimate
        }
      }
    }
    
    setGroupStatuses(groupStatusData);
    setStats({
      totalGroups: userGroups.length,
      totalContributions,
      nextPayoutAmount,
      nextPayoutDate,
      reliabilityScore,
    });
  };
  
  // Handle refresh
  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Navigate to group details
  const navigateToGroup = (group: SavingsGroup): void => {
    navigation.navigate('GroupDetails', { 
      groupId: group.id, 
      groupName: group.name 
    });
  };

  // Navigate to create group
  const navigateToCreateGroup = (): void => {
    navigation.navigate('CreateGroup');
  };

  // Navigate to join group
  const navigateToJoinGroup = (): void => {
    navigation.navigate('JoinGroup');
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, groups]);
  
  useEffect(() => {
    if (groups.length > 0 && contributions.length >= 0) {
      calculateStats(groups, contributions);
    }
  }, [groups, contributions]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.displayName || 'User'}!</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalGroups}</Text>
          <Text style={styles.statLabel}>Active Groups</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₦{stats.totalContributions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Contributed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.reliabilityScore}%</Text>
          <Text style={styles.statLabel}>Reliability Score</Text>
        </View>
      </View>

      {/* Next Payout Info */}
      <View style={styles.payoutCard}>
        <Text style={styles.payoutTitle}>Next Payout</Text>
        <Text style={styles.payoutAmount}>₦{stats.nextPayoutAmount.toLocaleString()}</Text>
        <Text style={styles.payoutDate}>{stats.nextPayoutDate}</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={navigateToCreateGroup}>
          <Text style={styles.actionButtonText}>Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={navigateToJoinGroup}>
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Join Group</Text>
        </TouchableOpacity>
      </View>

      {/* My Groups */}
      <View style={styles.groupsSection}>
        <Text style={styles.sectionTitle}>My Groups</Text>
        {groups.length > 0 ? groups.map((group) => {
          const groupStatus = groupStatuses[group.id];
          const paymentCompletion = groupStatus?.paymentStatus?.completionPercentage || 0;
          const isCompleted = groupStatus?.completion?.isCompleted || false;
          
          return (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => navigateToGroup(group)}
            >
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupDetails}>
                  {group.members.length} members • Cycle {group.currentCycle}/{group.totalCycles}
                </Text>
                <Text style={styles.groupAmount}>₦{group.contributionAmount.toLocaleString()}/{group.contributionFrequency}</Text>
                {groupStatus && (
                  <Text style={styles.paymentProgress}>
                    {paymentCompletion}% paid this cycle
                  </Text>
                )}
              </View>
              <View style={styles.groupStatus}>
                <Text style={[
                  styles.statusBadge, 
                  isCompleted ? styles.completedBadge : styles.activeBadge
                ]}>
                  {isCompleted ? 'COMPLETED' : group.status.toUpperCase()}
                </Text>
                {groupStatus && (
                  <View style={styles.progressIndicator}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${paymentCompletion}%` }
                      ]} 
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No groups yet</Text>
            <Text style={styles.emptyStateSubtext}>Create or join a group to get started</Text>
          </View>
        )}
      </View>

      {/* Recent Activity with Business Logic */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {contributions.slice(0, 3).map((contribution) => {
          const contributionDate = contribution.paidDate 
            ? new Date(contribution.paidDate.seconds * 1000)
            : new Date(contribution.dueDate.seconds * 1000);
            
          return (
            <View key={contribution.id} style={styles.activityItem}>
              <Text style={styles.activityText}>
                {contribution.status === 'paid' ? 'Payment completed' : 
                 contribution.status === 'pending' ? 'Payment pending verification' :
                 'Payment overdue'}
              </Text>
              <Text style={styles.activityAmount}>
                ₦{contribution.amount.toLocaleString()}
              </Text>
              <Text style={styles.activityDate}>
                {getRelativeTime(contributionDate)}
              </Text>
            </View>
          );
        })}
        {contributions.length === 0 && (
          <View style={styles.emptyActivity}>
            <Text style={styles.emptyActivityText}>No recent activity</Text>
            <Text style={styles.emptyActivitySubtext}>Join or create a group to get started</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  welcomeText: {
    fontSize: 16,
    color: '#718096',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 15,
    margin: 5,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3182ce',
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 5,
    textAlign: 'center',
  },
  payoutCard: {
    backgroundColor: '#3182ce',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  payoutTitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  payoutAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 10,
  },
  payoutDate: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3182ce',
    padding: 15,
    margin: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3182ce',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#3182ce',
  },
  groupsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  groupDetails: {
    fontSize: 14,
    color: '#718096',
    marginTop: 5,
  },
  groupAmount: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '600',
    marginTop: 5,
  },
  groupStatus: {
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeBadge: {
    backgroundColor: '#c6f6d5',
    color: '#22543d',
  },
  activitySection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  activityItem: {
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3182ce',
  },
  activityText: {
    fontSize: 16,
    color: '#2d3748',
  },
  activityDate: {
    fontSize: 14,
    color: '#718096',
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#718096',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyActivityText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  emptyActivitySubtext: {
    fontSize: 12,
    color: '#cbd5e0',
    marginTop: 4,
  },
  paymentProgress: {
    fontSize: 12,
    color: '#3182ce',
    fontWeight: '500',
    marginTop: 2,
  },
  completedBadge: {
    backgroundColor: '#48bb78',
    color: '#ffffff',
  },
  progressIndicator: {
    width: 60,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3182ce',
    borderRadius: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginTop: 2,
  },
});

export default DashboardScreenTS;