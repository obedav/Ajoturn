import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabScreenProps } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useGroup } from '../../contexts/GroupContext';
import { SavingsGroup, GroupMember } from '../../services/firestore';
import { useGroupManagement, useTurnOrder, usePaymentStatus, useGroupCompletion } from '../../hooks/useBusinessLogic';
import { formatNigerianDate, getRelativeTime } from '../../utils/dateUtils';

interface DashboardGroup extends SavingsGroup {
  businessLogic: {
    currentRecipient: GroupMember | null;
    nextRecipient: GroupMember | null;
    cycleProgress: number;
    paymentCompletion: number;
    isCompleted: boolean;
    remainingCycles: number;
    totalPaid: number;
    paidMembers: GroupMember[];
    pendingMembers: GroupMember[];
    overdueMembers: GroupMember[];
  };
}

const RealTimeDashboard: React.FC<MainTabScreenProps<'Dashboard'>> = ({ navigation }) => {
  const { user } = useAuth();
  const { groups, loading: groupsLoading, refreshGroups } = useGroup();
  
  const [dashboardGroups, setDashboardGroups] = useState<DashboardGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nextPaymentDeadline, setNextPaymentDeadline] = useState<Date | null>(null);

  // Load business logic data for all groups
  const loadBusinessLogicData = async () => {
    if (!groups.length) return;
    
    setLoading(true);
    const enrichedGroups: DashboardGroup[] = [];

    for (const group of groups) {
      try {
        // Use business logic hooks for each group
        const turnOrderHook = useTurnOrder();
        const paymentStatusHook = usePaymentStatus();
        const completionHook = useGroupCompletion();
        
        // Get business logic data
        const [turnOrderResult, paymentStatusResult, completionResult] = await Promise.all([
          turnOrderHook.calculateTurnOrder(group.id),
          paymentStatusHook.checkPaymentStatus(group.id),
          completionHook.validateGroupCompletion(group.id)
        ]);

        // Create enriched group with business logic
        const enrichedGroup: DashboardGroup = {
          ...group,
          businessLogic: {
            currentRecipient: turnOrderResult.data?.currentRecipient || null,
            nextRecipient: turnOrderResult.data?.nextRecipient || null,
            cycleProgress: turnOrderResult.data?.cycleProgress || 0,
            paymentCompletion: paymentStatusResult.data?.completionPercentage || 0,
            isCompleted: completionResult.data?.isCompleted || false,
            remainingCycles: completionResult.data?.remainingCycles || 0,
            totalPaid: paymentStatusResult.data?.totalPaid || 0,
            paidMembers: paymentStatusResult.data?.paidMembers || [],
            pendingMembers: paymentStatusResult.data?.pendingMembers || [],
            overdueMembers: paymentStatusResult.data?.overdueMembers || [],
          }
        };

        enrichedGroups.push(enrichedGroup);

        // Calculate next payment deadline
        if (!nextPaymentDeadline && group.status === 'active') {
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + 7); // Example: 7 days from now
          setNextPaymentDeadline(deadline);
        }
      } catch (error) {
        console.error(`Error loading business logic for group ${group.id}:`, error);
      }
    }

    setDashboardGroups(enrichedGroups);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshGroups();
      await loadBusinessLogicData();
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!groupsLoading && groups.length > 0) {
      loadBusinessLogicData();
    }
  }, [groups, groupsLoading]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentStatusColor = (member: GroupMember, group: DashboardGroup) => {
    if (group.businessLogic.paidMembers.find(m => m.userId === member.userId)) {
      return '#10B981'; // Green for paid
    }
    if (group.businessLogic.overdueMembers.find(m => m.userId === member.userId)) {
      return '#EF4444'; // Red for overdue
    }
    return '#F59E0B'; // Yellow for pending
  };

  const getPaymentStatusIcon = (member: GroupMember, group: DashboardGroup) => {
    if (group.businessLogic.paidMembers.find(m => m.userId === member.userId)) {
      return 'check-circle';
    }
    if (group.businessLogic.overdueMembers.find(m => m.userId === member.userId)) {
      return 'cancel';
    }
    return 'schedule';
  };

  const renderGroupCard = (group: DashboardGroup) => (
    <TouchableOpacity
      key={group.id}
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetails', { groupId: group.id, groupName: group.name })}
    >
      {/* Group Header */}
      <View style={styles.groupHeader}>
        <View style={styles.groupIcon}>
          <Text style={styles.groupIconText}>{group.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupDetails}>
            {group.members.length} members • Cycle {group.currentCycle}/{group.totalCycles}
          </Text>
          <Text style={styles.groupAmount}>
            {formatCurrency(group.contributionAmount)}/{group.contributionFrequency}
          </Text>
        </View>
        <View style={[
          styles.statusBadge, 
          group.businessLogic.isCompleted ? styles.completedBadge : styles.activeBadge
        ]}>
          <Text style={styles.statusText}>
            {group.businessLogic.isCompleted ? 'COMPLETED' : 'ACTIVE'}
          </Text>
        </View>
      </View>

      {/* Current Cycle Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Current Cycle Progress</Text>
          <Text style={styles.progressPercentage}>
            {group.businessLogic.paymentCompletion}%
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${group.businessLogic.paymentCompletion}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressDetails}>
          {formatCurrency(group.businessLogic.totalPaid)} of {formatCurrency(group.contributionAmount * group.members.length)} collected
        </Text>
      </View>

      {/* Turn Order */}
      {group.businessLogic.currentRecipient && (
        <View style={styles.turnSection}>
          <Text style={styles.turnTitle}>🎯 Current Payout Recipient</Text>
          <Text style={styles.turnRecipient}>
            {group.businessLogic.currentRecipient.displayName}
          </Text>
          {group.businessLogic.nextRecipient && (
            <Text style={styles.turnNext}>
              Next: {group.businessLogic.nextRecipient.displayName}
            </Text>
          )}
        </View>
      )}

      {/* Payment Status */}
      <View style={styles.paymentSection}>
        <Text style={styles.paymentTitle}>Payment Status ({group.contributionFrequency})</Text>
        <View style={styles.membersList}>
          {group.members.slice(0, 6).map((member, index) => (
            <View key={member.userId} style={styles.memberPaymentStatus}>
              <Icon 
                name={getPaymentStatusIcon(member, group)}
                size={16}
                color={getPaymentStatusColor(member, group)}
              />
              <Text style={styles.memberName} numberOfLines={1}>
                {member.displayName}
                {member.userId === user?.uid && ' (You)'}
              </Text>
            </View>
          ))}
          {group.members.length > 6 && (
            <Text style={styles.moreMembers}>+{group.members.length - 6} more</Text>
          )}
        </View>
      </View>

      {/* Next Payment Deadline */}
      {nextPaymentDeadline && !group.businessLogic.isCompleted && (
        <View style={styles.deadlineSection}>
          <View style={styles.deadlineHeader}>
            <Icon name="schedule" size={16} color="#F59E0B" />
            <Text style={styles.deadlineTitle}>Next Payment Due</Text>
          </View>
          <Text style={styles.deadlineDate}>
            {formatNigerianDate(nextPaymentDeadline)}
          </Text>
          <Text style={styles.deadlineTime}>
            {getRelativeTime(nextPaymentDeadline)}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.payButton]}
          onPress={() => navigation.navigate('Payment', { 
            groupId: group.id, 
            amount: group.contributionAmount,
            contributionId: undefined,
            dueDate: new Date().toISOString(),
            recipient: undefined
          })}
        >
          <Icon name="payment" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Pay</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => navigation.navigate('GroupDetails', { groupId: group.id, groupName: group.name })}
        >
          <Icon name="visibility" size={16} color="#1E40AF" />
          <Text style={[styles.actionButtonText, { color: '#1E40AF' }]}>View</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading || groupsLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>{user?.displayName || 'User'}!</Text>
        <Text style={styles.headerSubtitle}>Here's your real-time savings overview</Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="savings" size={24} color="#10B981" />
          <Text style={styles.statValue}>{dashboardGroups.length}</Text>
          <Text style={styles.statLabel}>Active Groups</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="account-balance-wallet" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>
            {dashboardGroups.reduce((total, group) => 
              total + group.businessLogic.totalPaid, 0
            ).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Total Paid (₦)</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="schedule" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>
            {dashboardGroups.reduce((total, group) => 
              total + group.businessLogic.pendingMembers.length + group.businessLogic.overdueMembers.length, 0
            )}
          </Text>
          <Text style={styles.statLabel}>Pending Payments</Text>
        </View>
      </View>

      {/* Groups List */}
      <View style={styles.groupsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Icon name="refresh" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {dashboardGroups.length > 0 ? (
          dashboardGroups.map(renderGroupCard)
        ) : (
          <View style={styles.emptyState}>
            <Icon name="group" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Groups Yet</Text>
            <Text style={styles.emptyStateText}>
              Create or join a group to start your savings journey
            </Text>
            <TouchableOpacity
              style={styles.createGroupButton}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Text style={styles.createGroupButtonText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.bottomActionButton}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Icon name="add-circle" size={20} color="#10B981" />
          <Text style={styles.bottomActionText}>Create Group</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bottomActionButton}
          onPress={() => navigation.navigate('JoinGroup', {})}
        >
          <Icon name="group-add" size={20} color="#3B82F6" />
          <Text style={styles.bottomActionText}>Join Group</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  groupsSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  groupDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  groupAmount: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  completedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#065F46',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1E40AF',
    borderRadius: 3,
  },
  progressDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  turnSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  turnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  turnRecipient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 2,
  },
  turnNext: {
    fontSize: 12,
    color: '#6B7280',
  },
  paymentSection: {
    marginBottom: 16,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberPaymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: '48%',
  },
  memberName: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 4,
    flex: 1,
  },
  moreMembers: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  deadlineSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  deadlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deadlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 6,
  },
  deadlineDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  deadlineTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  payButton: {
    backgroundColor: '#10B981',
  },
  viewButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createGroupButton: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createGroupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 16,
  },
  bottomActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bottomActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

export default RealTimeDashboard;