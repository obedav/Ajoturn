import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AppContext';
import GroupManagementService, { GroupMemberDetailed } from '../../services/business/groupManagement';
import DatabaseService from '../../services/database';

interface LeaveGroupProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
      groupName: string;
      userRole: 'admin' | 'member';
      joinOrder: number;
    };
  };
}

const LeaveGroup: React.FC<LeaveGroupProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { groupId, groupName, userRole, joinOrder } = route.params;

  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [members, setMembers] = useState<GroupMemberDetailed[]>([]);
  const [userContributions, setUserContributions] = useState({
    totalPaid: 0,
    pendingAmount: 0,
    eligibleRefund: 0,
    cycles: 0,
  });
  
  // Form state
  const [reason, setReason] = useState('');
  const [requestRefund, setRequestRefund] = useState(true);
  const [transferAdminTo, setTransferAdminTo] = useState('');
  const [confirmationModal, setConfirmationModal] = useState(false);
  const [impactAnalysisModal, setImpactAnalysisModal] = useState(false);

  useEffect(() => {
    loadLeaveGroupData();
  }, [groupId]);

  const loadLeaveGroupData = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // Get group members
      const membersResult = await GroupManagementService.getGroupMembersDetailed({
        userId: user.uid,
        groupId,
        includeFinancials: true,
      });

      if (membersResult.success) {
        setMembers(membersResult.data);
      }

      // Get user's contributions
      const contributionsResult = await DatabaseService.contributions.getUserContributions(user.uid, groupId);
      if (contributionsResult.success) {
        const contributions = contributionsResult.data.items;
        const paidContributions = contributions.filter(c => c.status === 'paid');
        const pendingContributions = contributions.filter(c => c.status === 'pending');
        
        const totalPaid = paidContributions.reduce((sum, c) => sum + c.amount, 0);
        const pendingAmount = pendingContributions.reduce((sum, c) => sum + c.amount, 0);
        
        // Calculate eligible refund (example: 90% of total paid)
        const eligibleRefund = totalPaid * 0.9;

        setUserContributions({
          totalPaid,
          pendingAmount,
          eligibleRefund,
          cycles: contributions.length,
        });
      }
    } catch (error) {
      console.error('Error loading leave group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;

    // Show impact analysis first
    setImpactAnalysisModal(true);
  };

  const confirmLeaveGroup = async () => {
    try {
      setLeaving(true);
      setImpactAnalysisModal(false);

      if (!user) return;

      // If user is admin and there are other members, must transfer admin first
      if (userRole === 'admin' && members.length > 1) {
        if (!transferAdminTo) {
          Alert.alert('Error', 'You must transfer admin rights before leaving');
          return;
        }

        const transferResult = await GroupManagementService.transferAdmin({
          currentAdminId: user.uid,
          groupId,
          newAdminId: transferAdminTo,
          reason: 'Admin leaving group',
        });

        if (!transferResult.success) {
          Alert.alert('Error', transferResult.error || 'Failed to transfer admin rights');
          return;
        }
      }

      // Leave the group
      const leaveResult = await GroupManagementService.leaveGroup({
        userId: user.uid,
        groupId,
        reason,
        requestRefund,
      });

      if (leaveResult.success) {
        Alert.alert(
          'Left Group Successfully',
          `You have left ${groupName}. ${
            leaveResult.data.refundAmount 
              ? `A refund of UGX ${leaveResult.data.refundAmount.toLocaleString()} will be processed.`
              : ''
          }`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('Dashboard');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', leaveResult.error || 'Failed to leave group');
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      Alert.alert('Error', 'Failed to leave group');
    } finally {
      setLeaving(false);
    }
  };

  const getTurnOrderImpact = () => {
    const affectedMembers = members.filter(m => m.joinOrder > joinOrder);
    return affectedMembers;
  };

  const getRefundPolicy = () => {
    return {
      title: 'Refund Policy',
      items: [
        'You are eligible for 90% refund of your total contributions',
        'Processing fee of 10% will be deducted',
        'Refunds are processed within 5-7 business days',
        'Pending payments will be cancelled',
        'Any received payouts will be deducted from refund',
      ],
    };
  };

  const getAdminTransferOptions = () => {
    return members.filter(m => m.userId !== user?.uid && m.role !== 'admin' && m.status === 'active');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Leave Group</Text>
          <Text style={styles.headerSubtitle}>{groupName}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Warning Section */}
        <View style={styles.warningContainer}>
          <Icon name="warning" size={24} color="#F44336" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Are you sure?</Text>
            <Text style={styles.warningText}>
              Leaving this group will affect the turn order and may impact other members' payout schedule.
            </Text>
          </View>
        </View>

        {/* Financial Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Financial Summary</Text>
          
          <View style={styles.financialGrid}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Total Contributed</Text>
              <Text style={styles.financialValue}>
                UGX {userContributions.totalPaid.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Pending Payments</Text>
              <Text style={styles.financialValue}>
                UGX {userContributions.pendingAmount.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Cycles Participated</Text>
              <Text style={styles.financialValue}>
                {userContributions.cycles}
              </Text>
            </View>
            
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Eligible Refund</Text>
              <Text style={[styles.financialValue, styles.refundAmount]}>
                UGX {userContributions.eligibleRefund.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Refund Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Options</Text>
          
          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Request Refund</Text>
              <Text style={styles.switchDescription}>
                Request 90% refund of your contributions (10% processing fee)
              </Text>
            </View>
            <Switch
              value={requestRefund}
              onValueChange={setRequestRefund}
            />
          </View>

          {requestRefund && (
            <View style={styles.refundPolicy}>
              <Text style={styles.refundPolicyTitle}>{getRefundPolicy().title}</Text>
              {getRefundPolicy().items.map((item, index) => (
                <View key={index} style={styles.policyItem}>
                  <Icon name="check-circle" size={16} color="#4CAF50" />
                  <Text style={styles.policyText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Admin Transfer (if admin) */}
        {userRole === 'admin' && members.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transfer Admin Rights</Text>
            <Text style={styles.sectionDescription}>
              As the group admin, you must transfer admin rights to another member before leaving.
            </Text>
            
            <View style={styles.memberSelector}>
              {getAdminTransferOptions().map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.memberOption,
                    transferAdminTo === member.userId && styles.selectedMember
                  ]}
                  onPress={() => setTransferAdminTo(member.userId)}
                >
                  <View style={styles.memberOptionInfo}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.memberName}>{member.displayName}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                      <Text style={styles.memberReliability}>
                        {member.reliabilityScore}% reliability
                      </Text>
                    </View>
                  </View>
                  {transferAdminTo === member.userId && (
                    <Icon name="check-circle" size={24} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Leaving (Optional)</Text>
          <TextInput
            style={styles.textArea}
            value={reason}
            onChangeText={setReason}
            placeholder="Let us know why you're leaving..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Impact Analysis Button */}
        <TouchableOpacity
          style={styles.impactButton}
          onPress={() => setImpactAnalysisModal(true)}
        >
          <Icon name="assessment" size={20} color="#2196F3" />
          <Text style={styles.impactButtonText}>View Impact Analysis</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Leave Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.leaveButton,
            leaving && styles.leavingButton,
            (userRole === 'admin' && members.length > 1 && !transferAdminTo) && styles.disabledButton,
          ]}
          onPress={handleLeaveGroup}
          disabled={leaving || (userRole === 'admin' && members.length > 1 && !transferAdminTo)}
        >
          <Icon name={leaving ? "sync" : "exit-to-app"} size={20} color="#fff" />
          <Text style={styles.leaveButtonText}>
            {leaving ? 'Leaving...' : 'Leave Group'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Impact Analysis Modal */}
      <Modal
        visible={impactAnalysisModal}
        transparent
        animationType="slide"
        onRequestClose={() => setImpactAnalysisModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Impact Analysis</Text>
              <TouchableOpacity onPress={() => setImpactAnalysisModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Turn Order Impact */}
              <View style={styles.impactSection}>
                <Text style={styles.impactTitle}>Turn Order Changes</Text>
                <Text style={styles.impactDescription}>
                  Your position #{joinOrder} will be removed and the following members will move up:
                </Text>
                
                {getTurnOrderImpact().map(member => (
                  <View key={member.id} style={styles.impactItem}>
                    <Text style={styles.impactMember}>{member.displayName}</Text>
                    <View style={styles.turnChange}>
                      <Text style={styles.oldTurn}>#{member.joinOrder}</Text>
                      <Icon name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.newTurn}>#{member.joinOrder - 1}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Financial Impact */}
              <View style={styles.impactSection}>
                <Text style={styles.impactTitle}>Financial Impact</Text>
                
                <View style={styles.impactFinancial}>
                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Your Contributions</Text>
                    <Text style={styles.financialAmount}>
                      UGX {userContributions.totalPaid.toLocaleString()}
                    </Text>
                  </View>
                  
                  {requestRefund ? (
                    <>
                      <View style={styles.financialRow}>
                        <Text style={styles.financialLabel}>Processing Fee (10%)</Text>
                        <Text style={styles.financialFee}>
                          -UGX {(userContributions.totalPaid * 0.1).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.financialRow}>
                        <Text style={styles.financialLabel}>Refund Amount</Text>
                        <Text style={styles.financialRefund}>
                          UGX {userContributions.eligibleRefund.toLocaleString()}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Forfeited Amount</Text>
                      <Text style={styles.financialForfeit}>
                        UGX {userContributions.totalPaid.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Group Impact */}
              <View style={styles.impactSection}>
                <Text style={styles.impactTitle}>Group Impact</Text>
                <View style={styles.groupImpactList}>
                  <Text style={styles.groupImpactItem}>
                    • Group size will reduce from {members.length} to {members.length - 1} members
                  </Text>
                  <Text style={styles.groupImpactItem}>
                    • Cycle duration may be affected
                  </Text>
                  <Text style={styles.groupImpactItem}>
                    • Other members' turn schedule will advance
                  </Text>
                  {userRole === 'admin' && (
                    <Text style={styles.groupImpactItem}>
                      • Admin rights will be transferred to {
                        members.find(m => m.userId === transferAdminTo)?.displayName || 'selected member'
                      }
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setImpactAnalysisModal(false)}
              >
                <Text style={styles.cancelButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLeaveButton}
                onPress={() => {
                  setImpactAnalysisModal(false);
                  setConfirmationModal(true);
                }}
              >
                <Text style={styles.confirmLeaveButtonText}>Confirm Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Final Confirmation Modal */}
      <Modal
        visible={confirmationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.confirmationModalContent}>
            <View style={styles.confirmationIcon}>
              <Icon name="warning" size={48} color="#F44336" />
            </View>
            
            <Text style={styles.confirmationTitle}>Final Confirmation</Text>
            <Text style={styles.confirmationMessage}>
              This action cannot be undone. Are you absolutely sure you want to leave {groupName}?
            </Text>
            
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.cancelConfirmButton}
                onPress={() => setConfirmationModal(false)}
              >
                <Text style={styles.cancelConfirmButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.finalConfirmButton}
                onPress={confirmLeaveGroup}
              >
                <Text style={styles.finalConfirmButtonText}>Yes, Leave Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFEBEE',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D32F2F',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#D32F2F',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  financialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  financialItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  financialLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  refundAmount: {
    color: '#4CAF50',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
  },
  refundPolicy: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  refundPolicyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  policyText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 8,
  },
  memberSelector: {
    marginTop: 12,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  selectedMember: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  memberOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  memberReliability: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    height: 100,
  },
  impactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
  },
  impactButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  actionContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  leavingButton: {
    backgroundColor: '#D32F2F',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    maxHeight: 400,
    padding: 20,
  },
  impactSection: {
    marginBottom: 20,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  impactDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  impactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 4,
  },
  impactMember: {
    fontSize: 14,
    color: '#333',
  },
  turnChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  oldTurn: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newTurn: {
    fontSize: 14,
    color: '#2196F3',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  impactFinancial: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  financialAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  financialFee: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F44336',
  },
  financialRefund: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  financialForfeit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F44336',
  },
  groupImpactList: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
  },
  groupImpactItem: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmLeaveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F44336',
  },
  confirmLeaveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  confirmationModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 20,
    padding: 24,
    alignItems: 'center',
  },
  confirmationIcon: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cancelConfirmButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  finalConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F44336',
  },
  finalConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default LeaveGroup;