import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainStackScreenProps } from '../../navigation/types';
// import DatabaseService from '../../services/database';
import AuthService from '../../services/auth';
// import BusinessLogicService from '../../services/business';
// import { PaymentStatusSummary, TurnOrder } from '../../types/business';

interface GroupMember {
  id: string;
  name: string;
  role: string;
  joinOrder: number;
  status: string;
  reliabilityScore: number;
  hasReceivedPayout: boolean;
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  currentTurnNumber?: number | null;
}

interface ContributionItem {
  id: string;
  userStatus: 'paid' | 'pending' | 'overdue';
  amount: number;
  dueDate: Date;
  paidDate?: Date;
}

const GroupDetailsScreen: React.FC<MainStackScreenProps<'GroupDetails'>> = ({ navigation, route }) => {
  const { groupId } = route.params;
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'payments'>('overview');
  const [groupData, setGroupData] = useState({
    group: null as any,
    members: [] as GroupMember[],
    currentCycle: null as any,
    statistics: null as any,
    userRole: 'member',
    userContributions: [] as ContributionItem[],
    paymentStatus: null as PaymentStatusSummary | null,
    turnOrder: [] as TurnOrder[],
    currentRecipient: null as TurnOrder | null,
    nextPaymentDeadline: null as Date | null,
  });

  const loadGroupData = async () => {
    try {
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) return;

      // Load multiple data sources in parallel for real-time dashboard
      const [
        groupResult,
        membersResult,
        userMembershipResult,
      ] = await Promise.all([
        DatabaseService.groups.getGroupById(groupId),
        DatabaseService.groupMembers.getGroupMembers(groupId),
        DatabaseService.groupMembers.getMemberByUserAndGroup(currentUser.uid, groupId),
      ]);

      if (!groupResult.success || !groupResult.data) {
        Alert.alert('Error', 'Group not found');
        navigation.goBack();
        return;
      }

      const group = groupResult.data;
      const members = membersResult.success ? membersResult.data.items : [];
      const userRole = userMembershipResult.success && userMembershipResult.data ? 
        userMembershipResult.data.role : 'member';

      // Get payment status for current cycle using business logic
      const paymentStatusResult = await BusinessLogicService.checkPaymentStatus({
        groupId: groupId,
        cycle: group.current_cycle,
      });

      // Get turn order using business logic
      const turnOrderResult = await BusinessLogicService.calculateTurnOrder({
        group: group,
        members: members,
        currentCycle: group.current_cycle,
      });

      // Find current recipient and next payment deadline
      let currentRecipient: TurnOrder | null = null;
      let nextPaymentDeadline: Date | null = null;

      if (turnOrderResult.success && turnOrderResult.data) {
        currentRecipient = turnOrderResult.data.find(turn => turn.status === 'current') || null;
      }

      // Calculate next payment deadline (cycle end date)
      if (group.cycle_end_date) {
        nextPaymentDeadline = new Date(group.cycle_end_date);
      }

      // Map members with enhanced data
      const enhancedMembers: GroupMember[] = members.map(member => {
        // Find payment status for this member
        const memberPaymentStatus = paymentStatusResult.success && paymentStatusResult.data ?
          paymentStatusResult.data.membersStatus.find(ms => ms.userId === member.user_id) : null;

        return {
          id: member.id,
          name: member.user_id, // In real app, would fetch actual user names
          role: member.role,
          joinOrder: member.join_order,
          status: member.status,
          reliabilityScore: member.reliability_percentage || 100,
          hasReceivedPayout: member.payout_received || false,
          paymentStatus: memberPaymentStatus?.status || 'pending',
          currentTurnNumber: turnOrderResult.success && turnOrderResult.data ?
            turnOrderResult.data.find(turn => turn.recipientId === member.user_id && turn.status === 'current')?.cycle : null,
        };
      });

      // Get user's contributions
      const userContributions: ContributionItem[] = [];
      if (paymentStatusResult.success && paymentStatusResult.data) {
        const userPaymentStatus = paymentStatusResult.data.membersStatus.find(ms => ms.userId === currentUser.uid);
        if (userPaymentStatus) {
          userContributions.push({
            id: userPaymentStatus.contributionId || 'current',
            userStatus: userPaymentStatus.status as 'paid' | 'pending' | 'overdue',
            amount: userPaymentStatus.amount,
            dueDate: userPaymentStatus.dueDate,
            paidDate: userPaymentStatus.paidDate,
          });
        }
      }

      setGroupData({
        group: group,
        members: enhancedMembers,
        currentCycle: {
          number: group.current_cycle,
          startDate: group.cycle_start_date,
          endDate: group.cycle_end_date,
          status: group.status,
        },
        statistics: {
          totalCollected: group.total_contributions_collected || 0,
          totalPaid: group.total_payouts_made || 0,
          completionRate: paymentStatusResult.success && paymentStatusResult.data ? 
            paymentStatusResult.data.completionRate : 0,
        },
        userRole: userRole,
        userContributions: userContributions,
        paymentStatus: paymentStatusResult.success ? paymentStatusResult.data : null,
        turnOrder: turnOrderResult.success ? turnOrderResult.data : [],
        currentRecipient: currentRecipient,
        nextPaymentDeadline: nextPaymentDeadline,
      });
    } catch (error) {
      console.error('Error loading group data:', error);
      Alert.alert('Error', 'Failed to load group data');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroupData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleMakePayment = () => {
    // Find pending contribution for current user
    const pendingContribution = groupData.userContributions.find(c => c.userStatus === 'pending');
    
    if (pendingContribution) {
      navigation.navigate('Payment', {
        contributionId: pendingContribution.id,
        groupId: groupId,
        amount: pendingContribution.amount,
      });
    } else {
      Alert.alert('Info', 'No pending payments found.');
    }
  };

  const renderMemberItem = ({ item }: { item: GroupMember }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{item.name}</Text>
          <View style={styles.memberMeta}>
            <Text style={styles.memberRole}>{item.role}</Text>
            <Text style={styles.memberDot}>•</Text>
            <Text style={styles.memberOrder}>#{item.joinOrder}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.memberStats}>
        <View style={styles.reliabilityBadge}>
          <Icon name="star" size={12} color="#F59E0B" />
          <Text style={styles.reliabilityText}>{item.reliabilityScore}%</Text>
        </View>
        {item.hasReceivedPayout && (
          <View style={styles.payoutBadge}>
            <Icon name="check-circle" size={12} color="#10B981" />
            <Text style={styles.payoutText}>Paid</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View style={styles.tabContent}>
            {/* Real-time Payment Status */}
            {groupData.paymentStatus && (
              <View style={styles.paymentStatusCard}>
                <View style={styles.statusHeader}>
                  <Text style={styles.statusTitle}>This Month's Payments</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                      {groupData.paymentStatus.paidMembers}/{groupData.paymentStatus.totalMembers} Paid
                    </Text>
                  </View>
                </View>
                
                <View style={styles.paymentGrid}>
                  {groupData.paymentStatus.membersStatus.map((member, index) => (
                    <View key={index} style={styles.paymentItem}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.avatarText}>
                          {member.userName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {member.userName}
                        </Text>
                        <View style={[
                          styles.paymentStatusBadge,
                          member.status === 'paid' && styles.paidBadge,
                          member.status === 'pending' && styles.pendingBadge,
                          member.status === 'overdue' && styles.overdueBadge,
                        ]}>
                          <Icon 
                            name={
                              member.status === 'paid' ? 'check-circle' :
                              member.status === 'overdue' ? 'error' : 'schedule'
                            }
                            size={12}
                            color={
                              member.status === 'paid' ? '#10B981' :
                              member.status === 'overdue' ? '#EF4444' : '#F59E0B'
                            }
                          />
                          <Text style={[
                            styles.statusText,
                            member.status === 'paid' && styles.paidText,
                            member.status === 'pending' && styles.pendingText,
                            member.status === 'overdue' && styles.overdueText,
                          ]}>
                            {member.status === 'paid' ? 'Paid' :
                             member.status === 'overdue' ? 'Overdue' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
                
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${groupData.paymentStatus.completionRate}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {Math.round(groupData.paymentStatus.completionRate)}% Complete
                  </Text>
                </View>
              </View>
            )}

            {/* Current Recipient Info */}
            {groupData.currentRecipient && (
              <View style={styles.recipientCard}>
                <View style={styles.recipientHeader}>
                  <Icon name="account-balance-wallet" size={24} color="#10B981" />
                  <Text style={styles.recipientTitle}>This Month's Recipient</Text>
                </View>
                <View style={styles.recipientInfo}>
                  <View style={styles.recipientAvatar}>
                    <Text style={styles.recipientAvatarText}>
                      {groupData.currentRecipient.recipientName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.recipientName}>
                      {groupData.currentRecipient.recipientName}
                    </Text>
                    <Text style={styles.recipientDetails}>
                      Turn #{groupData.currentRecipient.joinOrder} • Expected: {formatCurrency(groupData.group?.contribution_amount * groupData.group?.total_members || 0)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.recipientDate}>
                  Scheduled payout: {new Date(groupData.currentRecipient.scheduledDate).toLocaleDateString()}
                </Text>
              </View>
            )}

            {/* Payment Deadline */}
            {groupData.nextPaymentDeadline && (
              <View style={styles.deadlineCard}>
                <View style={styles.deadlineHeader}>
                  <Icon name="schedule" size={20} color="#F59E0B" />
                  <Text style={styles.deadlineTitle}>Next Payment Deadline</Text>
                </View>
                <Text style={styles.deadlineDate}>
                  {groupData.nextPaymentDeadline.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.deadlineCountdown}>
                  {Math.ceil((groupData.nextPaymentDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                </Text>
              </View>
            )}

            {/* Group Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Icon name="people" size={24} color="#3B82F6" />
                <Text style={styles.statValue}>{groupData.group?.total_members || 0}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="refresh" size={24} color="#10B981" />
                <Text style={styles.statValue}>
                  {groupData.group?.current_cycle || 0}/{groupData.group?.total_cycles || 0}
                </Text>
                <Text style={styles.statLabel}>Cycles</Text>
              </View>
              <View style={styles.statCard}>
                <Icon name="savings" size={24} color="#F59E0B" />
                <Text style={styles.statValue}>
                  {formatCurrency(groupData.statistics?.totalCollected || 0)}
                </Text>
                <Text style={styles.statLabel}>Total Collected</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.actionButton} onPress={handleMakePayment}>
                <Icon name="payment" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Make Payment</Text>
              </TouchableOpacity>
              
              {groupData.userRole === 'admin' && (
                <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
                  <Icon name="settings" size={20} color="#1E40AF" />
                  <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                    Manage
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
        
      case 'members':
        return (
          <View style={styles.tabContent}>
            <FlatList
              data={groupData.members}
              renderItem={renderMemberItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.membersList}
            />
          </View>
        );
        
      case 'payments':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoon}>Payment history coming soon!</Text>
          </View>
        );
        
      default:
        return null;
    }
  };

  if (isLoading || !groupData.group) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading group details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Group Header */}
        <View style={styles.header}>
          <View style={styles.groupIcon}>
            <Text style={styles.groupIconText}>
              {groupData.group.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.groupName}>{groupData.group.name}</Text>
          {groupData.group.description && (
            <Text style={styles.groupDescription}>{groupData.group.description}</Text>
          )}
          
          <View style={styles.groupMeta}>
            <View style={styles.metaItem}>
              <Icon name="attach-money" size={16} color="#6B7280" />
              <Text style={styles.metaText}>
                {formatCurrency(groupData.group.contribution_amount)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="schedule" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{groupData.group.contribution_frequency}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="group" size={16} color="#6B7280" />
              <Text style={styles.metaText}>
                {groupData.group.total_members}/{groupData.group.max_members}
              </Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {[
            { key: 'overview', label: 'Overview', icon: 'dashboard' },
            { key: 'members', label: 'Members', icon: 'people' },
            { key: 'payments', label: 'Payments', icon: 'payment' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? '#1E40AF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1E40AF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#1E40AF',
  },
  tabContent: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    padding: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  cycleCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cycleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C4A6E',
  },
  cycleBadge: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cycleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cycleProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#BAE6FD',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#0C4A6E',
    fontWeight: '500',
  },
  cycleDescription: {
    fontSize: 14,
    color: '#0369A1',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1E40AF',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#1E40AF',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRole: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  memberDot: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 6,
  },
  memberOrder: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  memberStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  reliabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  reliabilityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  payoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  payoutText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
  },
  comingSoon: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  // Real-time Dashboard Styles
  paymentStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  paymentGrid: {
    marginBottom: 16,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paidBadge: {
    backgroundColor: '#D1FAE5',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  overdueBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  paidText: {
    color: '#065F46',
  },
  pendingText: {
    color: '#92400E',
  },
  overdueText: {
    color: '#DC2626',
  },
  progressContainer: {
    gap: 8,
  },
  recipientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  recipientTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#10B981',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipientAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  recipientDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  recipientDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  deadlineCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  deadlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  deadlineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
  },
  deadlineDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  deadlineCountdown: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '500',
  },
});

export default GroupDetailsScreen;