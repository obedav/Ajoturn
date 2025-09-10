import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AppContext';
import GroupManagementService, { GroupMemberDetailed, GroupSettings } from '../../services/business/groupManagement';
import PaymentTrackingService from '../../services/business/paymentTracking';

interface GroupAdminControlsProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
      groupName: string;
    };
  };
}

const GroupAdminControls: React.FC<GroupAdminControlsProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { groupId, groupName } = route.params;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<GroupMemberDetailed[]>([]);
  const [groupSettings, setGroupSettings] = useState<GroupSettings | null>(null);
  const [selectedTab, setSelectedTab] = useState<'members' | 'settings' | 'payments'>('members');
  
  // Modals
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [transferAdminModal, setTransferAdminModal] = useState(false);
  
  // Form states
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPosition, setNewMemberPosition] = useState('');
  const [transferToUserId, setTransferToUserId] = useState('');
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  useEffect(() => {
    loadAdminData();
  }, [groupId]);

  const loadAdminData = async () => {
    try {
      setLoading(true);

      if (!user) return;

      // Load members with financial details
      const membersResult = await GroupManagementService.getGroupMembersDetailed({
        userId: user.uid,
        groupId,
        includeFinancials: true,
      });

      if (membersResult.success) {
        setMembers(membersResult.data);
      }

      // Load pending payment confirmations
      const paymentsResult = await PaymentTrackingService.getPendingConfirmations(user.uid);
      if (paymentsResult.success) {
        setPendingPayments(paymentsResult.data.filter(p => p.groupId === groupId));
      }

      // Load current group settings (would need to implement this method)
      // const settingsResult = await GroupManagementService.getGroupSettings(groupId);
      // if (settingsResult.success) {
      //   setGroupSettings(settingsResult.data);
      // }

    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!user || !newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      const result = await GroupManagementService.addMember({
        adminId: user.uid,
        groupId,
        userEmail: newMemberEmail.trim(),
        assignedPosition: newMemberPosition ? parseInt(newMemberPosition) : undefined,
      });

      if (result.success) {
        Alert.alert('Success', `Successfully added ${result.data.displayName} to the group`);
        setAddMemberModal(false);
        setNewMemberEmail('');
        setNewMemberPosition('');
        await loadAdminData();
      } else {
        Alert.alert('Error', result.error || 'Failed to add member');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add member');
    }
  };

  const handleRemoveMember = async (member: GroupMemberDetailed) => {
    if (!user) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.displayName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await GroupManagementService.removeMember({
                adminId: user.uid,
                groupId,
                memberId: member.userId,
                reason: 'other',
                redistributeTurn: true,
                refundContributions: false,
              });

              if (result.success) {
                Alert.alert('Success', 'Member removed successfully');
                await loadAdminData();
              } else {
                Alert.alert('Error', result.error || 'Failed to remove member');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleTransferAdmin = async () => {
    if (!user || !transferToUserId) {
      Alert.alert('Error', 'Please select a member to transfer admin rights to');
      return;
    }

    Alert.alert(
      'Transfer Admin Rights',
      'Are you sure you want to transfer admin rights? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            try {
              const result = await GroupManagementService.transferAdmin({
                currentAdminId: user.uid,
                groupId,
                newAdminId: transferToUserId,
              });

              if (result.success) {
                Alert.alert('Success', 'Admin rights transferred successfully');
                setTransferAdminModal(false);
                navigation.goBack(); // Admin is no longer admin
              } else {
                Alert.alert('Error', result.error || 'Failed to transfer admin rights');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to transfer admin rights');
            }
          },
        },
      ]
    );
  };

  const handleMarkPayment = async (payment: any) => {
    if (!user) return;

    try {
      const result = await PaymentTrackingService.confirmMemberPayment({
        contributionId: payment.contributionId,
        adminId: user.uid,
        confirmationType: 'cash',
        notes: 'Payment confirmed by admin',
      });

      if (result.success) {
        Alert.alert('Success', 'Payment marked as confirmed');
        await loadAdminData();
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm payment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm payment');
    }
  };

  const renderMembersTab = () => (
    <View style={styles.tabContent}>
      {/* Add Member Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setAddMemberModal(true)}
      >
        <Icon name="person-add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add Member</Text>
      </TouchableOpacity>

      {/* Members List */}
      <View style={styles.membersList}>
        {members.map((member, index) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.memberInfo}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.displayName}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                  <View style={styles.memberStats}>
                    <Text style={styles.turnOrder}>Turn #{member.joinOrder}</Text>
                    <Text style={styles.reliability}>
                      {member.reliabilityScore}% reliable
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.memberActions}>
                {member.role === 'admin' ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(member)}
                  >
                    <Icon name="remove-circle" size={20} color="#F44336" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Member Financial Summary */}
            <View style={styles.memberFinancials}>
              <View style={styles.financialStat}>
                <Text style={styles.financialLabel}>Contributed</Text>
                <Text style={styles.financialValue}>
                  UGX {member.totalContributions.toLocaleString()}
                </Text>
              </View>
              <View style={styles.financialStat}>
                <Text style={styles.financialLabel}>Received</Text>
                <Text style={styles.financialValue}>
                  UGX {member.totalReceived.toLocaleString()}
                </Text>
              </View>
              <View style={styles.financialStat}>
                <Text style={styles.financialLabel}>Status</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: member.status === 'active' ? '#4CAF50' : '#FF9800' }
                ]}>
                  <Text style={styles.statusText}>
                    {member.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Admin Actions */}
      <View style={styles.adminActions}>
        <TouchableOpacity
          style={styles.transferAdminButton}
          onPress={() => setTransferAdminModal(true)}
        >
          <Icon name="admin-panel-settings" size={20} color="#FF9800" />
          <Text style={styles.transferAdminText}>Transfer Admin Rights</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Pending Payment Confirmations</Text>
      
      {pendingPayments.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="check-circle" size={48} color="#4CAF50" />
          <Text style={styles.emptyText}>All payments are up to date!</Text>
          <Text style={styles.emptySubtext}>
            No pending payment confirmations
          </Text>
        </View>
      ) : (
        <View style={styles.paymentsList}>
          {pendingPayments.map((payment, index) => (
            <View key={index} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentMember}>{payment.memberName}</Text>
                <Text style={styles.paymentAmount}>
                  UGX {payment.amount.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.paymentDue}>
                Due: {new Date(payment.dueDate).toLocaleDateString()}
              </Text>
              {payment.daysLate > 0 && (
                <Text style={styles.paymentOverdue}>
                  {payment.daysLate} days overdue
                </Text>
              )}
              <View style={styles.paymentActions}>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleMarkPayment(payment)}
                >
                  <Icon name="check" size={16} color="#fff" />
                  <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Group Settings</Text>
      
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => setSettingsModal(true)}
      >
        <Icon name="settings" size={20} color="#2196F3" />
        <Text style={styles.settingsButtonText}>Edit Group Settings</Text>
        <Icon name="chevron-right" size={20} color="#666" />
      </TouchableOpacity>

      <View style={styles.settingsList}>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Members</Text>
          <Text style={styles.settingValue}>{members.length} / 12</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Contribution Amount</Text>
          <Text style={styles.settingValue}>UGX 50,000</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Payment Frequency</Text>
          <Text style={styles.settingValue}>Monthly</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Late Penalty</Text>
          <Text style={styles.settingValue}>5% per day</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading admin controls...</Text>
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
          <Text style={styles.headerTitle}>Admin Controls</Text>
          <Text style={styles.headerSubtitle}>{groupName}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Icon name="more-vert" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'members' && styles.activeTab]}
          onPress={() => setSelectedTab('members')}
        >
          <Icon 
            name="people" 
            size={20} 
            color={selectedTab === 'members' ? '#2196F3' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'members' && styles.activeTabText
          ]}>
            Members
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'payments' && styles.activeTab]}
          onPress={() => setSelectedTab('payments')}
        >
          <Icon 
            name="payment" 
            size={20} 
            color={selectedTab === 'payments' ? '#2196F3' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'payments' && styles.activeTabText
          ]}>
            Payments
          </Text>
          {pendingPayments.length > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>{pendingPayments.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'settings' && styles.activeTab]}
          onPress={() => setSelectedTab('settings')}
        >
          <Icon 
            name="settings" 
            size={20} 
            color={selectedTab === 'settings' ? '#2196F3' : '#666'} 
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'settings' && styles.activeTabText
          ]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {selectedTab === 'members' && renderMembersTab()}
        {selectedTab === 'payments' && renderPaymentsTab()}
        {selectedTab === 'settings' && renderSettingsTab()}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={addMemberModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddMemberModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Member</Text>
              <TouchableOpacity onPress={() => setAddMemberModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
                placeholder="member@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <Text style={styles.inputLabel}>Position (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={newMemberPosition}
                onChangeText={setNewMemberPosition}
                placeholder="Leave empty for next available"
                keyboardType="numeric"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setAddMemberModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleAddMember}
                >
                  <Text style={styles.confirmButtonText}>Add Member</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transfer Admin Modal */}
      <Modal
        visible={transferAdminModal}
        transparent
        animationType="slide"
        onRequestClose={() => setTransferAdminModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transfer Admin Rights</Text>
              <TouchableOpacity onPress={() => setTransferAdminModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Select New Admin</Text>
              
              <View style={styles.memberSelector}>
                {members.filter(m => m.role !== 'admin').map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberOption,
                      transferToUserId === member.userId && styles.selectedMember
                    ]}
                    onPress={() => setTransferToUserId(member.userId)}
                  >
                    <Text style={styles.memberOptionName}>{member.displayName}</Text>
                    <Text style={styles.memberOptionEmail}>{member.email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setTransferAdminModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    !transferToUserId && styles.disabledButton
                  ]}
                  onPress={handleTransferAdmin}
                  disabled={!transferToUserId}
                >
                  <Text style={styles.confirmButtonText}>Transfer</Text>
                </TouchableOpacity>
              </View>
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
  moreButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 20,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  membersList: {
    marginBottom: 24,
  },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  turnOrder: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
    marginRight: 12,
  },
  reliability: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  memberActions: {
    alignItems: 'center',
  },
  adminBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  memberFinancials: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  financialStat: {
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  adminActions: {
    marginTop: 16,
  },
  transferAdminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  transferAdminText: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  paymentsList: {
    marginTop: 16,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMember: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  paymentDue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paymentOverdue: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
    marginBottom: 8,
  },
  paymentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingsButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
    marginLeft: 12,
  },
  settingsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
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
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  memberSelector: {
    maxHeight: 200,
  },
  memberOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  selectedMember: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  memberOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  memberOptionEmail: {
    fontSize: 14,
    color: '#666',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
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
  disabledButton: {
    opacity: 0.5,
  },
});

export default GroupAdminControls;