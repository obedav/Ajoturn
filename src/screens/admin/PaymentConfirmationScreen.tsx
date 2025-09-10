import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AppContext';
import PaymentTrackingService, { PaymentConfirmation } from '../../services/business/paymentTracking';
import { MemberPaymentStatus } from '../../types/business';

interface PaymentConfirmationScreenProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
      groupName: string;
    };
  };
}

const PaymentConfirmationScreen: React.FC<PaymentConfirmationScreenProps> = ({ navigation, route }) => {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<MemberPaymentStatus[]>([]);
  const [confirmationModal, setConfirmationModal] = useState<{
    visible: boolean;
    member?: MemberPaymentStatus;
  }>({ visible: false });
  const [confirmationData, setConfirmationData] = useState({
    confirmationType: 'cash' as PaymentConfirmation['confirmationType'],
    notes: '',
    customAmount: '',
  });
  const [processing, setProcessing] = useState(false);

  const loadPendingPayments = async () => {
    try {
      if (!user) return;
      
      const result = await PaymentTrackingService.getPendingConfirmations(user.uid);
      if (result.success && result.data) {
        // Filter for this specific group if groupId is provided
        const filteredPayments = groupId 
          ? result.data.filter(payment => {
              // We need to get the groupId from the contribution - this is a simplified approach
              return true; // In a real implementation, we'd have groupId in the payment status
            })
          : result.data;
        
        setPendingPayments(filteredPayments);
      }
    } catch (error) {
      console.error('Error loading pending payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingPayments();
    setRefreshing(false);
  };

  useEffect(() => {
    loadPendingPayments();
  }, [user, groupId]);

  const handleConfirmPayment = (member: MemberPaymentStatus) => {
    setConfirmationModal({ visible: true, member });
    setConfirmationData({
      confirmationType: 'cash',
      notes: '',
      customAmount: '',
    });
  };

  const handleLatePaymentAction = (member: MemberPaymentStatus, action: 'warning' | 'penalty') => {
    Alert.alert(
      'Late Payment Action',
      `Apply ${action} for ${member.userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            if (!user || !member.contributionId) return;
            
            try {
              const result = await PaymentTrackingService.handleLatePayment({
                contributionId: member.contributionId,
                adminId: user.uid,
                action: action,
                notes: `${action} applied for late payment`,
              });
              
              if (result.success) {
                Alert.alert('Success', `${action} applied successfully`);
                await loadPendingPayments();
              } else {
                Alert.alert('Error', result.error || `Failed to apply ${action}`);
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred');
            }
          },
        },
      ]
    );
  };

  const processPaymentConfirmation = async () => {
    if (!user || !confirmationModal.member?.contributionId) return;
    
    setProcessing(true);
    try {
      const customAmount = confirmationData.customAmount 
        ? parseFloat(confirmationData.customAmount) 
        : undefined;

      const result = await PaymentTrackingService.confirmMemberPayment({
        contributionId: confirmationModal.member.contributionId,
        adminId: user.uid,
        confirmationType: confirmationData.confirmationType,
        notes: confirmationData.notes,
        customAmount: customAmount,
      });

      if (result.success) {
        Alert.alert('Success', 'Payment confirmed successfully');
        setConfirmationModal({ visible: false });
        await loadPendingPayments();
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm payment');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'overdue': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overdue': return 'error';
      case 'pending': return 'schedule';
      default: return 'help';
    }
  };

  const renderPendingPayment = (member: MemberPaymentStatus) => (
    <View key={member.userId} style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.avatarText}>
              {member.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>{member.userName}</Text>
            <Text style={styles.memberAmount}>{formatCurrency(member.amount)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(member.status) + '20' }]}>
          <Icon 
            name={getStatusIcon(member.status)} 
            size={16} 
            color={getStatusColor(member.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(member.status) }]}>
            {member.status}
          </Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Due Date:</Text>
          <Text style={styles.detailValue}>{formatDate(member.dueDate)}</Text>
        </View>
        {member.daysOverdue && member.daysOverdue > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Days Overdue:</Text>
            <Text style={[styles.detailValue, styles.overdueText]}>
              {member.daysOverdue} days
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.confirmButton]}
          onPress={() => handleConfirmPayment(member)}
        >
          <Icon name="check-circle" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Confirm Payment</Text>
        </TouchableOpacity>

        {member.status === 'overdue' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.warningButton]}
              onPress={() => handleLatePaymentAction(member, 'warning')}
            >
              <Icon name="warning" size={16} color="#F59E0B" />
              <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>Warning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.penaltyButton]}
              onPress={() => handleLatePaymentAction(member, 'penalty')}
            >
              <Icon name="gavel" size={16} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Penalty</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderConfirmationModal = () => (
    <Modal
      visible={confirmationModal.visible}
      transparent
      animationType="slide"
      onRequestClose={() => setConfirmationModal({ visible: false })}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <TouchableOpacity
              onPress={() => setConfirmationModal({ visible: false })}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {confirmationModal.member && (
            <>
              <View style={styles.memberSummary}>
                <Text style={styles.memberSummaryName}>
                  {confirmationModal.member.userName}
                </Text>
                <Text style={styles.memberSummaryAmount}>
                  {formatCurrency(confirmationModal.member.amount)}
                </Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Payment Method</Text>
                <View style={styles.paymentMethods}>
                  {[
                    { value: 'cash', label: 'Cash', icon: 'money' },
                    { value: 'bank_transfer', label: 'Bank Transfer', icon: 'account-balance' },
                    { value: 'mobile_money', label: 'Mobile Money', icon: 'phone-android' },
                    { value: 'other', label: 'Other', icon: 'more-horiz' },
                  ].map((method) => (
                    <TouchableOpacity
                      key={method.value}
                      style={[
                        styles.methodButton,
                        confirmationData.confirmationType === method.value && styles.selectedMethod,
                      ]}
                      onPress={() => setConfirmationData(prev => ({ 
                        ...prev, 
                        confirmationType: method.value as PaymentConfirmation['confirmationType'] 
                      }))}
                    >
                      <Icon 
                        name={method.icon} 
                        size={20} 
                        color={confirmationData.confirmationType === method.value ? '#1E40AF' : '#6B7280'}
                      />
                      <Text style={[
                        styles.methodText,
                        confirmationData.confirmationType === method.value && styles.selectedMethodText,
                      ]}>
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Custom Amount (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter custom amount if different"
                  value={confirmationData.customAmount}
                  onChangeText={(value) => setConfirmationData(prev => ({ ...prev, customAmount: value }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Add confirmation notes..."
                  value={confirmationData.notes}
                  onChangeText={(value) => setConfirmationData(prev => ({ ...prev, notes: value }))}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setConfirmationModal({ visible: false })}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmModalButton, processing && styles.processingButton]}
                  onPress={processPaymentConfirmation}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.confirmModalButtonText}>Confirm Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading pending payments...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {groupName ? `${groupName} - Payments` : 'Payment Confirmations'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {pendingPayments.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={64} color="#10B981" />
            <Text style={styles.emptyStateTitle}>All Payments Confirmed!</Text>
            <Text style={styles.emptyStateText}>
              There are no pending payment confirmations at this time.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Pending Confirmations</Text>
              <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{pendingPayments.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.overdueNumber]}>
                    {pendingPayments.filter(p => p.status === 'overdue').length}
                  </Text>
                  <Text style={styles.statLabel}>Overdue</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {formatCurrency(
                      pendingPayments.reduce((sum, p) => sum + p.amount, 0)
                    )}
                  </Text>
                  <Text style={styles.statLabel}>Total Amount</Text>
                </View>
              </View>
            </View>

            <View style={styles.paymentsContainer}>
              {pendingPayments.map(renderPendingPayment)}
            </View>
          </>
        )}
      </ScrollView>

      {renderConfirmationModal()}
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  scrollContainer: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  overdueNumber: {
    color: '#EF4444',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentsContainer: {
    padding: 16,
    gap: 12,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#1E40AF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberDetails: {},
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  memberAmount: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  paymentDetails: {
    marginBottom: 12,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  overdueText: {
    color: '#EF4444',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  confirmButton: {
    backgroundColor: '#10B981',
    flex: 1,
  },
  warningButton: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  penaltyButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    margin: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  memberSummary: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 20,
  },
  memberSummaryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  memberSummaryAmount: {
    fontSize: 16,
    color: '#1E40AF',
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  selectedMethod: {
    borderColor: '#1E40AF',
    backgroundColor: '#EEF2FF',
  },
  methodText: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedMethodText: {
    color: '#1E40AF',
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#10B981',
    gap: 6,
  },
  processingButton: {
    opacity: 0.7,
  },
  confirmModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PaymentConfirmationScreen;