import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { MainStackScreenProps } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { SavingsGroup, Contribution } from '../services/firestore';
import FirestoreService from '../services/firestore';

interface PaymentDetails {
  groupId: string;
  amount: number;
  dueDate: string;
  cycleNumber: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: 'bank_transfer' | 'card' | 'mobile_money' | 'cash';
  icon: string;
}

const paymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Bank Transfer', type: 'bank_transfer', icon: '🏦' },
  { id: '2', name: 'Debit Card', type: 'card', icon: '💳' },
  { id: '3', name: 'Mobile Money', type: 'mobile_money', icon: '📱' },
  { id: '4', name: 'Cash Payment', type: 'cash', icon: '💵' },
];


const PaymentScreenTS: React.FC<MainStackScreenProps<'Payment'>> = ({ navigation, route }) => {
  const { groupId, contributionId, amount, dueDate, recipient } = route?.params || { 
    groupId: '', 
    contributionId: undefined,
    amount: 0, 
    dueDate: '',
    recipient: undefined
  };
  
  const { user } = useAuth();
  const { groups } = useGroup();
  const [group, setGroup] = useState<SavingsGroup | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    groupId,
    amount,
    dueDate: dueDate || new Date().toISOString(),
    cycleNumber: 1,
  });
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showProofModal, setShowProofModal] = useState<boolean>(false);
  const [proofText, setProofText] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');

  const loadPaymentDetails = async (): Promise<void> => {
    try {
      // Find group from context first, then fetch if not found
      let groupData = groups.find(g => g.id === groupId);
      
      if (!groupData) {
        groupData = await FirestoreService.getSavingsGroup(groupId);
      }
      
      if (groupData) {
        setGroup(groupData);
        setPaymentDetails(prev => ({
          ...prev,
          cycleNumber: groupData.currentCycle,
        }));
      } else {
        Alert.alert('Error', 'Group not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading payment details:', error);
      Alert.alert('Error', 'Failed to load payment details');
    }
  };

  const handleMethodSelect = (method: PaymentMethod): void => {
    setSelectedMethod(method);
  };

  const handlePayment = async (): Promise<void> => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    try {
      setLoading(true);
      
      if (selectedMethod.type === 'cash') {
        setShowProofModal(true);
      } else {
        await processElectronicPayment();
      }
    } catch (error) {
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processElectronicPayment = async (): Promise<void> => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to make a payment');
      return;
    }

    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newContribution: Omit<Contribution, 'id' | 'createdAt'> = {
        groupId: paymentDetails.groupId,
        userId: user.uid,
        amount: paymentDetails.amount,
        dueDate: new Date(paymentDetails.dueDate),
        paidDate: new Date(),
        status: 'paid',
        paymentMethod: selectedMethod?.name,
        transactionId: `TXN${Date.now()}`,
        cycle: paymentDetails.cycleNumber,
      };

      const contributionId = await FirestoreService.createContribution(newContribution);
      
      if (contributionId) {
        // Navigate to confirmation screen
        navigation.navigate('PaymentConfirmation', {
          paymentId: contributionId,
          amount: paymentDetails.amount,
          recipient: group?.name || 'Group',
        });
      } else {
        Alert.alert('Error', 'Failed to process payment. Please try again.');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    }
  };

  const handleCashPaymentSubmit = async (): Promise<void> => {
    if (!transactionRef.trim()) {
      Alert.alert('Error', 'Please provide payment reference or details');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to make a payment');
      return;
    }

    try {
      setLoading(true);
      
      const newContribution: Omit<Contribution, 'id' | 'createdAt'> = {
        groupId: paymentDetails.groupId,
        userId: user.uid,
        amount: paymentDetails.amount,
        dueDate: new Date(paymentDetails.dueDate),
        status: 'pending',
        paymentMethod: 'Cash',
        transactionId: transactionRef,
        cycle: paymentDetails.cycleNumber,
      };

      const contributionId = await FirestoreService.createContribution(newContribution);
      
      if (contributionId) {
        setShowProofModal(false);
        Alert.alert(
          'Payment Submitted!',
          'Your cash payment has been submitted for verification by the group admin.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to submit payment proof');
      }
    } catch (error) {
      console.error('Error submitting cash payment:', error);
      Alert.alert('Error', 'Failed to submit payment proof');
    } finally {
      setLoading(false);
    }
  };

  const calculateLateFee = (): number => {
    const today = new Date();
    const dueDate = new Date(paymentDetails.dueDate);
    const daysLate = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    return daysLate > 0 ? Math.min(daysLate * 100, 1000) : 0;
  };

  const getTotalAmount = (): number => {
    return paymentDetails.amount + calculateLateFee();
  };

  useEffect(() => {
    loadPaymentDetails();
  }, [groupId]);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Make Payment</Text>
        <Text style={styles.subtitle}>{group?.name || 'Loading...'}</Text>
      </View>

      {/* Payment Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Payment Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Contribution Amount:</Text>
          <Text style={styles.summaryValue}>₦{paymentDetails.amount.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Cycle Number:</Text>
          <Text style={styles.summaryValue}>{paymentDetails.cycleNumber}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Due Date:</Text>
          <Text style={styles.summaryValue}>{paymentDetails.dueDate}</Text>
        </View>
        {calculateLateFee() > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.lateLabel]}>Late Fee:</Text>
            <Text style={[styles.summaryValue, styles.lateValue]}>
              ₦{calculateLateFee().toLocaleString()}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalValue}>₦{getTotalAmount().toLocaleString()}</Text>
        </View>
      </View>

      {calculateLateFee() > 0 && (
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Late Payment</Text>
            <Text style={styles.warningText}>
              Your payment is overdue. A late fee of ₦{calculateLateFee().toLocaleString()} has been added.
            </Text>
          </View>
        </View>
      )}

      {/* Payment Methods */}
      <View style={styles.methodsSection}>
        <Text style={styles.sectionTitle}>Select Payment Method</Text>
        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.methodCard,
              selectedMethod?.id === method.id && styles.methodCardSelected,
            ]}
            onPress={() => handleMethodSelect(method)}
          >
            <View style={styles.methodInfo}>
              <Text style={styles.methodIcon}>{method.icon}</Text>
              <Text style={styles.methodName}>{method.name}</Text>
            </View>
            <View style={[
              styles.methodRadio,
              selectedMethod?.id === method.id && styles.methodRadioSelected,
            ]}>
              {selectedMethod?.id === method.id && <View style={styles.methodRadioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Payment Instructions */}
      {selectedMethod && (
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Payment Instructions</Text>
          {selectedMethod.type === 'bank_transfer' && (
            <View>
              <Text style={styles.instructionText}>
                • Transfer ₦{getTotalAmount().toLocaleString()} to the group's bank account
              </Text>
              <Text style={styles.instructionText}>
                • Use your name and "{group?.name || 'Group'} - Cycle {paymentDetails.cycleNumber}" as reference
              </Text>
              <Text style={styles.instructionText}>
                • Save your transaction receipt for verification
              </Text>
            </View>
          )}
          {selectedMethod.type === 'card' && (
            <View>
              <Text style={styles.instructionText}>
                • You will be redirected to a secure payment page
              </Text>
              <Text style={styles.instructionText}>
                • Enter your card details to complete the payment
              </Text>
              <Text style={styles.instructionText}>
                • Payment will be processed immediately
              </Text>
            </View>
          )}
          {selectedMethod.type === 'mobile_money' && (
            <View>
              <Text style={styles.instructionText}>
                • Dial your mobile money USSD code
              </Text>
              <Text style={styles.instructionText}>
                • Send ₦{getTotalAmount().toLocaleString()} to the group's registered number
              </Text>
              <Text style={styles.instructionText}>
                • Keep the transaction SMS for verification
              </Text>
            </View>
          )}
          {selectedMethod.type === 'cash' && (
            <View>
              <Text style={styles.instructionText}>
                • Pay ₦{getTotalAmount().toLocaleString()} in cash to the group admin
              </Text>
              <Text style={styles.instructionText}>
                • Get a written receipt from the admin
              </Text>
              <Text style={styles.instructionText}>
                • Upload photo of receipt for verification
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Pay Button */}
      <TouchableOpacity
        style={[styles.payButton, (!selectedMethod || loading) && styles.payButtonDisabled]}
        onPress={handlePayment}
        disabled={!selectedMethod || loading}
      >
        <Text style={styles.payButtonText}>
          {loading ? 'Processing...' : `Pay ₦${getTotalAmount().toLocaleString()}`}
        </Text>
      </TouchableOpacity>

      {/* Cash Payment Modal */}
      <Modal
        visible={showProofModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowProofModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cash Payment Verification</Text>
            <Text style={styles.modalSubtitle}>
              Please provide payment details for verification
            </Text>
            
            <Text style={styles.inputLabel}>Payment Reference/Receipt Number:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter receipt number or reference"
              placeholderTextColor="#9ca3af"
              value={transactionRef}
              onChangeText={setTransactionRef}
            />
            
            <Text style={styles.inputLabel}>Additional Notes (Optional):</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              placeholder="Any additional payment details..."
              placeholderTextColor="#9ca3af"
              value={proofText}
              onChangeText={setProofText}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowProofModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCashPaymentSubmit}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Submitting...' : 'Submit Payment'}
                </Text>
              </TouchableOpacity>
            </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
  },
  summaryCard: {
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
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#718096',
  },
  summaryValue: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  lateLabel: {
    color: '#e53e3e',
  },
  lateValue: {
    color: '#e53e3e',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 10,
    paddingTop: 15,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3182ce',
  },
  warningCard: {
    backgroundColor: '#fef5e7',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#d69e2e',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d69e2e',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#b7791f',
    lineHeight: 20,
  },
  methodsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  methodCard: {
    backgroundColor: '#ffffff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodCardSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#f0f9ff',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  methodName: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
  },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodRadioSelected: {
    borderColor: '#3182ce',
  },
  methodRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3182ce',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3182ce',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 5,
  },
  payButton: {
    backgroundColor: '#3182ce',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2d3748',
    marginBottom: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
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
  submitButton: {
    backgroundColor: '#3182ce',
  },
  cancelButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentScreenTS;