import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { MainStackScreenProps } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { SavingsGroup, GroupMember, Contribution } from '../services/firestore';
import FirestoreService from '../services/firestore';
import { useGroupManagement } from '../hooks/useBusinessLogic';
import { formatNigerianDate, getRelativeTime, getDaysOverdue } from '../utils/dateUtils';


const GroupDetailsScreenTS: React.FC<MainStackScreenProps<'GroupDetails'>> = ({ navigation, route }) => {
  const { groupId, groupName } = route?.params || { groupId: '', groupName: '' };
  const { user } = useAuth();
  const { groups } = useGroup();
  const groupManagement = useGroupManagement(groupId);
  
  const [group, setGroup] = useState<SavingsGroup | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [invitePhone, setInvitePhone] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const loadGroupDetails = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Get group details
      const groupDetails = await FirestoreService.getSavingsGroup(groupId);
      if (groupDetails) {
        setGroup(groupDetails);
        setIsAdmin(groupDetails.adminId === user?.uid);
        
        // Get group contributions for current cycle
        const groupContributions = await FirestoreService.getGroupContributions(groupId, groupDetails.currentCycle);
        setContributions(groupContributions);
        
        // Load business logic data
        await groupManagement.refreshAll();
      } else {
        Alert.alert('Error', 'Group not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading group details:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await loadGroupDetails();
    await groupManagement.refreshAll();
    setRefreshing(false);
  };

  const handleContribute = (): void => {
    if (!group) return;
    navigation.navigate('Payment', { 
      groupId, 
      contributionId: undefined,
      amount: group.contributionAmount,
      dueDate: new Date().toISOString(),
      recipient: undefined
    });
  };

  const handleShowMembers = (): void => {
    Alert.alert('Debug', 'Members button clicked!'); // Debug alert
    setShowMembersModal(true);
  };

  const handleInviteMember = async (): Promise<void> => {
    if (!invitePhone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Success', 'Invitation sent successfully!');
      setInvitePhone('');
      setShowInviteModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'paid':
        return [styles.statusBadge, styles.paidBadge];
      case 'pending':
        return [styles.statusBadge, styles.pendingBadge];
      case 'overdue':
        return [styles.statusBadge, styles.overdueBadge];
      default:
        return [styles.statusBadge, styles.pendingBadge];
    }
  };

  const getMemberStatusColor = (missedPayments: number): string => {
    if (missedPayments === 0) return '#22543d';
    if (missedPayments <= 2) return '#d69e2e';
    return '#e53e3e';
  };

  const calculateProgress = (): number => {
    return groupManagement.paymentCompletion || 0;
  };
  
  const getNextRecipient = (): GroupMember | null => {
    return groupManagement.nextRecipient;
  };
  
  const getCurrentRecipient = (): GroupMember | null => {
    return groupManagement.currentRecipient;
  };
  
  const handleProcessCycle = async (): void => {
    if (!user || !isAdmin) {
      Alert.alert('Error', 'Only group admin can process cycles');
      return;
    }
    
    Alert.alert(
      'Process Next Cycle',
      'This will move the group to the next cycle and create a payout. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          style: 'destructive',
          onPress: async () => {
            const result = await groupManagement.processNextCycle(user.uid);
            if (result.success) {
              Alert.alert(
                'Cycle Processed!',
                `Cycle ${result.newCycle} started. Payout of ₦${result.payoutAmount.toLocaleString()} created.`
              );
              await loadGroupDetails();
            } else {
              Alert.alert('Error', result.error || 'Failed to process cycle');
            }
          },
        },
      ]
    );
  };
  
  const handleSendReminders = async (): void => {
    if (!user || !isAdmin) {
      Alert.alert('Error', 'Only group admin can send reminders');
      return;
    }
    
    const result = await groupManagement.sendReminders();
    if (result.success) {
      Alert.alert(
        'Reminders Sent!',
        `${result.remindersSent} payment reminders sent to members.`
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to send reminders');
    }
  };

  useEffect(() => {
    loadGroupDetails();
  }, [groupId]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}
        <View style={styles.groupStats}>
          <TouchableOpacity 
            style={styles.clickableContainer}
            onPress={handleShowMembers}
            activeOpacity={0.7}
          >
            <Text style={[styles.statText, styles.clickableText]}>{group.total_members} Members</Text>
          </TouchableOpacity>
          <Text style={styles.statDivider}>•</Text>
          <Text style={styles.statText}>Cycle {group.current_cycle}</Text>
          <Text style={styles.statDivider}>•</Text>
          <Text style={styles.statText}>₦{group.contribution_amount.toLocaleString()}</Text>
        </View>
      </View>

      {/* Current Cycle Progress */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Current Cycle Progress</Text>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {calculateProgress()}% Complete
          </Text>
          <Text style={styles.progressAmount}>
            ₦{(group.contribution_amount * group.total_members).toLocaleString()} Total
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${calculateProgress()}%` }]} />
        </View>
      </View>

      {/* Next Payout */}
      {group.next_recipient && (
        <View style={styles.payoutCard}>
          <Text style={styles.payoutTitle}>Next Payout Recipient</Text>
          <Text style={styles.recipientName}>{group.next_recipient.name}</Text>
          <Text style={styles.payoutDate}>Expected: {group.next_payout_date}</Text>
        </View>
      )}

      {/* Business Logic Info */}
      {groupManagement.turnOrder.data && (
        <View style={styles.businessLogicCard}>
          <Text style={styles.businessLogicTitle}>Turn Order & Status</Text>
          <View style={styles.businessLogicRow}>
            <Text style={styles.businessLogicLabel}>Current Recipient:</Text>
            <Text style={styles.businessLogicValue}>
              {getCurrentRecipient()?.displayName || 'None'}
            </Text>
          </View>
          <View style={styles.businessLogicRow}>
            <Text style={styles.businessLogicLabel}>Next Recipient:</Text>
            <Text style={styles.businessLogicValue}>
              {getNextRecipient()?.displayName || 'TBD'}
            </Text>
          </View>
          <View style={styles.businessLogicRow}>
            <Text style={styles.businessLogicLabel}>Group Progress:</Text>
            <Text style={styles.businessLogicValue}>
              {groupManagement.cycleProgress.toFixed(1)}% complete
            </Text>
          </View>
          <View style={styles.businessLogicRow}>
            <Text style={styles.businessLogicLabel}>Remaining Cycles:</Text>
            <Text style={styles.businessLogicValue}>
              {groupManagement.remainingCycles} cycles left
            </Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleContribute}>
          <Text style={styles.actionButtonText}>Make Contribution</Text>
        </TouchableOpacity>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.adminButton]}
            onPress={() => setShowAdminModal(true)}
          >
            <Text style={[styles.actionButtonText, styles.adminButtonText]}>
              Admin Controls
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => setShowInviteModal(true)}
          >
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              Invite Member
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Members List */}
      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Members ({group.total_members})</Text>
        {group.members.map((member) => (
          <View key={member.user_id} style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <View style={styles.memberHeader}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberPosition}>#{member.join_order}</Text>
              </View>
              <Text style={styles.memberStats}>
                ₦{member.total_contributions.toLocaleString()} contributed
              </Text>
              <Text style={[styles.memberReliability, { color: getMemberStatusColor(member.missed_payments) }]}>
                {member.missed_payments === 0 ? 'Perfect Record' : `${member.missed_payments} missed payments`}
              </Text>
            </View>
            <View style={styles.memberStatus}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: member.status === 'active' ? '#48bb78' : '#cbd5e0' }
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Payment Status */}
      <View style={styles.paymentsSection}>
        <Text style={styles.sectionTitle}>This Cycle's Payments</Text>
        {group.contributions
          .filter(c => c.cycle_number === group.current_cycle)
          .map((contribution) => {
            const member = group.members.find(m => m.user_id === contribution.user_id);
            return (
              <View key={contribution.id} style={styles.paymentCard}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentMember}>{member?.name || 'Unknown'}</Text>
                  <Text style={styles.paymentAmount}>₦{contribution.amount.toLocaleString()}</Text>
                  <Text style={styles.paymentDate}>
                    Due: {contribution.due_date}
                    {contribution.paid_date && ` • Paid: ${contribution.paid_date}`}
                  </Text>
                </View>
                <View style={getStatusBadgeStyle(contribution.status)}>
                  <Text style={styles.statusBadgeText}>{contribution.status.toUpperCase()}</Text>
                </View>
              </View>
            );
          })
        }
      </View>

      {/* Members List Modal */}
      <Modal
        visible={showMembersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Group Members ({group.total_members})</Text>
            <Text style={styles.modalSubtitle}>All members in payout order</Text>
            
            <ScrollView style={styles.membersListContainer} showsVerticalScrollIndicator={false}>
              {group.members.map((member, index) => (
                <View key={member.user_id} style={styles.memberListItem}>
                  <View style={styles.memberListInfo}>
                    <View style={styles.memberListHeader}>
                      <Text style={styles.memberListName}>
                        {member.name}
                        {member.user_id === '1' && ' (You)'}
                      </Text>
                      <View style={styles.memberListPosition}>
                        <Text style={styles.positionNumber}>#{member.join_order}</Text>
                      </View>
                    </View>
                    <Text style={styles.memberListContribution}>
                      ₦{member.total_contributions.toLocaleString()} contributed
                    </Text>
                    <View style={styles.memberListStatus}>
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: member.status === 'active' ? '#48bb78' : '#cbd5e0' }
                        ]}
                      />
                      <Text style={[
                        styles.memberListReliability,
                        { color: getMemberStatusColor(member.missed_payments) }
                      ]}>
                        {member.missed_payments === 0 ? 'Perfect Record' : `${member.missed_payments} missed`}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMembersModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite New Member</Text>
            <Text style={styles.modalSubtitle}>Enter phone number to send invitation</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Phone number (e.g., +2348012345678)"
              placeholderTextColor="#9ca3af"
              value={invitePhone}
              onChangeText={setInvitePhone}
              keyboardType="phone-pad"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowInviteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.sendButton]}
                onPress={handleInviteMember}
              >
                <Text style={styles.sendButtonText}>Send Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin Controls Modal */}
      <Modal
        visible={showAdminModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAdminModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Admin Controls</Text>
            <Text style={styles.modalSubtitle}>Group management options</Text>
            
            <View style={styles.adminControlsContainer}>
              <TouchableOpacity
                style={styles.adminControlButton}
                onPress={handleSendReminders}
                disabled={groupManagement.isLoading}
              >
                <Text style={styles.adminControlButtonText}>📧 Send Payment Reminders</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.adminControlButton, styles.processButton]}
                onPress={handleProcessCycle}
                disabled={groupManagement.isLoading || groupManagement.paymentCompletion < 100}
              >
                <Text style={[styles.adminControlButtonText, { color: '#ffffff' }]}>
                  ⚡ Process Next Cycle
                </Text>
                <Text style={styles.adminControlSubtext}>
                  {groupManagement.paymentCompletion < 100 
                    ? `Wait for ${100 - groupManagement.paymentCompletion}% more payments`
                    : 'Ready to process'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.adminControlButton}
                onPress={() => {
                  setShowAdminModal(false);
                  setShowInviteModal(true);
                }}
              >
                <Text style={styles.adminControlButtonText}>👥 Invite New Member</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAdminModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 12,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '600',
  },
  clickableText: {
    textDecorationLine: 'underline',
  },
  clickableContainer: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(49, 130, 206, 0.1)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(49, 130, 206, 0.3)',
  },
  statDivider: {
    fontSize: 14,
    color: '#cbd5e0',
    marginHorizontal: 8,
  },
  progressCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '600',
  },
  progressAmount: {
    fontSize: 16,
    color: '#718096',
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3182ce',
    borderRadius: 4,
  },
  payoutCard: {
    backgroundColor: '#3182ce',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  payoutTitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 14,
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
  membersSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  memberCard: {
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
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  memberPosition: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '600',
  },
  memberStats: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 2,
  },
  memberReliability: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberStatus: {
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  paymentsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#3182ce',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMember: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  paymentAmount: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '600',
    marginTop: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  paidBadge: {
    backgroundColor: '#48bb78',
  },
  pendingBadge: {
    backgroundColor: '#ed8936',
  },
  overdueBadge: {
    backgroundColor: '#e53e3e',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2d3748',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#e2e8f0',
  },
  sendButton: {
    backgroundColor: '#3182ce',
  },
  cancelButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  membersListContainer: {
    maxHeight: 400,
    marginVertical: 15,
  },
  memberListItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3182ce',
  },
  memberListInfo: {
    flex: 1,
  },
  memberListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  memberListName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  memberListPosition: {
    backgroundColor: '#3182ce',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  positionNumber: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  memberListContribution: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  memberListStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  memberListReliability: {
    fontSize: 12,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#3182ce',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  businessLogicCard: {
    backgroundColor: '#f0f9ff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  businessLogicTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d4ed8',
    marginBottom: 12,
  },
  businessLogicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  businessLogicLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  businessLogicValue: {
    fontSize: 14,
    color: '#1d4ed8',
    fontWeight: 'bold',
  },
  adminButton: {
    backgroundColor: '#dc2626',
  },
  adminButtonText: {
    color: '#ffffff',
  },
  adminControlsContainer: {
    marginBottom: 20,
  },
  adminControlButton: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  processButton: {
    backgroundColor: '#059669',
  },
  adminControlButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  adminControlSubtext: {
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.9,
  },
});

export default GroupDetailsScreenTS;