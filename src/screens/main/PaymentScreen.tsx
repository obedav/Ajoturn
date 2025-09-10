import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainStackScreenProps } from '../../navigation/types';
// import DatabaseService from '../../services/database';

const PaymentScreen: React.FC<MainStackScreenProps<'Payment'>> = ({ navigation, route }) => {
  const { contributionId, groupId, amount } = route.params;
  
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'card' | 'mobile_money'>('bank_transfer');
  const [contributionData, setContributionData] = useState<any>(null);
  const [groupData, setGroupData] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState({
    transactionReference: '',
    paymentProof: '',
    notes: '',
  });

  const loadPaymentData = async () => {
    setIsLoading(true);
    try {
      // Load contribution details
      const contributionResult = await DatabaseService.contributions.getContributionById(contributionId);
      if (contributionResult.success && contributionResult.data) {
        setContributionData(contributionResult.data);
      }

      // Load group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (groupResult.success && groupResult.data) {
        setGroupData(groupResult.data);
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentData();
  }, [contributionId, groupId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-NG', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const handlePayment = async () => {
    if (!paymentDetails.transactionReference.trim()) {
      Alert.alert('Error', 'Please enter the transaction reference');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await DatabaseService.contributions.markAsPaid(contributionId, {
        paid_date: new Date(),
        payment_method: paymentMethod,
        transaction_reference: paymentDetails.transactionReference,
        payment_proof_url: paymentDetails.paymentProof || undefined,
      });

      if (result.success) {
        Alert.alert(
          'Payment Recorded',
          'Your payment has been recorded successfully and is pending verification.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadProof = () => {
    // In a real app, this would open image picker or camera
    Alert.alert('Upload Proof', 'Image picker would open here to upload payment proof');
  };

  if (isLoading || !contributionData || !groupData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  const paymentMethods = [
    {
      id: 'bank_transfer',
      title: 'Bank Transfer',
      subtitle: 'Transfer to group account',
      icon: 'account-balance',
      color: '#1E40AF',
    },
    {
      id: 'mobile_money',
      title: 'Mobile Money',
      subtitle: 'Pay via mobile wallet',
      icon: 'phone-android',
      color: '#10B981',
    },
    {
      id: 'card',
      title: 'Debit Card',
      subtitle: 'Pay with your card',
      icon: 'credit-card',
      color: '#F59E0B',
    },
  ];

  const selectedMethod = paymentMethods.find(m => m.id === paymentMethod);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.groupIcon}>
                <Text style={styles.groupIconText}>
                  {groupData.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.groupName}>{groupData.name}</Text>
                <Text style={styles.cycleInfo}>
                  Cycle {contributionData.cycle_number} Payment
                </Text>
              </View>
            </View>
            
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount Due</Text>
              <Text style={styles.amountValue}>{formatCurrency(amount)}</Text>
              <Text style={styles.dueDateText}>
                Due: {formatDate(contributionData.due_date)}
              </Text>
            </View>
          </View>

          {/* Payment Method Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethodCard,
                  paymentMethod === method.id && styles.paymentMethodCardSelected,
                ]}
                onPress={() => setPaymentMethod(method.id as any)}
              >
                <View style={styles.paymentMethodIcon}>
                  <Icon name={method.icon} size={24} color={method.color} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>{method.title}</Text>
                  <Text style={styles.paymentMethodSubtitle}>{method.subtitle}</Text>
                </View>
                <View style={styles.radioButton}>
                  {paymentMethod === method.id && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Instructions</Text>
            
            <View style={styles.instructionCard}>
              <View style={styles.instructionHeader}>
                <Icon name={selectedMethod?.icon || 'info'} size={20} color="#1E40AF" />
                <Text style={styles.instructionTitle}>
                  {selectedMethod?.title} Instructions
                </Text>
              </View>
              
              {paymentMethod === 'bank_transfer' && (
                <View style={styles.bankDetails}>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>Bank Name:</Text>
                    <Text style={styles.bankDetailValue}>First Bank of Nigeria</Text>
                  </View>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>Account Name:</Text>
                    <Text style={styles.bankDetailValue}>Ajoturn Group Account</Text>
                  </View>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>Account Number:</Text>
                    <Text style={styles.bankDetailValue}>1234567890</Text>
                  </View>
                  <Text style={styles.instructionNote}>
                    Please use your name and group name as reference when making the transfer.
                  </Text>
                </View>
              )}
              
              {paymentMethod === 'mobile_money' && (
                <View style={styles.mobileMoneyDetails}>
                  <Text style={styles.instructionNote}>
                    Send money to the group's mobile money account and enter the transaction reference below.
                  </Text>
                </View>
              )}
              
              {paymentMethod === 'card' && (
                <View style={styles.cardDetails}>
                  <Text style={styles.instructionNote}>
                    Card payment integration coming soon! Please use bank transfer for now.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Transaction Reference */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Reference *</Text>
            <View style={styles.inputContainer}>
              <Icon name="receipt" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter transaction reference/ID"
                value={paymentDetails.transactionReference}
                onChangeText={(value) =>
                  setPaymentDetails(prev => ({ ...prev, transactionReference: value }))
                }
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Payment Proof */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Proof (Optional)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadProof}>
              <Icon name="cloud-upload" size={24} color="#6B7280" />
              <Text style={styles.uploadButtonText}>
                {paymentDetails.paymentProof ? 'Change Proof' : 'Upload Receipt/Screenshot'}
              </Text>
            </TouchableOpacity>
            {paymentDetails.paymentProof && (
              <Text style={styles.uploadedFileName}>Receipt uploaded ✓</Text>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Add any notes about this payment..."
                value={paymentDetails.notes}
                onChangeText={(value) =>
                  setPaymentDetails(prev => ({ ...prev, notes: value }))
                }
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handlePayment}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Record Payment</Text>
            )}
          </TouchableOpacity>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Icon name="info" size={16} color="#6B7280" />
            <Text style={styles.disclaimerText}>
              Your payment will be verified by the group admin. Please ensure all details are correct.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  cycleInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  amountContainer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  amountLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  dueDateText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentMethodCardSelected: {
    borderColor: '#1E40AF',
    backgroundColor: '#EFF6FF',
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  paymentMethodSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E40AF',
  },
  instructionCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginLeft: 8,
  },
  bankDetails: {
    gap: 12,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankDetailLabel: {
    fontSize: 14,
    color: '#0369A1',
  },
  bankDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C4A6E',
  },
  instructionNote: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
  mobileMoneyDetails: {
    // Placeholder for mobile money specific styles
  },
  cardDetails: {
    // Placeholder for card specific styles
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 80,
    paddingVertical: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  uploadedFileName: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    marginTop: 0,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
});

export default PaymentScreen;