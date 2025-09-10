import React, { useState } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainStackScreenProps } from '../../navigation/types';
import AuthService from '../../services/auth';
import GroupInviteService from '../../services/groupInvites';

const CreateGroupScreen: React.FC<MainStackScreenProps<'CreateGroup'>> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    maxMembers: '10',
    contributionFrequency: 'monthly' as 'daily' | 'weekly' | 'monthly',
    gracePeriodDays: '3',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdGroup, setCreatedGroup] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState<string>('');

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { name, contributionAmount, maxMembers } = formData;

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return false;
    }

    if (!contributionAmount.trim() || isNaN(Number(contributionAmount))) {
      Alert.alert('Error', 'Please enter a valid contribution amount');
      return false;
    }

    if (Number(contributionAmount) < 1000) {
      Alert.alert('Error', 'Minimum contribution amount is ₦1,000');
      return false;
    }

    if (!maxMembers.trim() || isNaN(Number(maxMembers))) {
      Alert.alert('Error', 'Please enter a valid number of maximum members');
      return false;
    }

    if (Number(maxMembers) < 2) {
      Alert.alert('Error', 'Group must have at least 2 members');
      return false;
    }

    if (Number(maxMembers) > 50) {
      Alert.alert('Error', 'Maximum 50 members allowed per group');
      return false;
    }

    return true;
  };

  const calculateEstimatedEndDate = () => {
    const startDate = new Date();
    const maxMembersCount = Number(formData.maxMembers);
    const endDate = new Date(startDate);

    switch (formData.contributionFrequency) {
      case 'daily':
        endDate.setDate(endDate.getDate() + maxMembersCount);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + (maxMembersCount * 7));
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + maxMembersCount);
        break;
    }

    return endDate;
  };

  const handleCreateGroup = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const userProfile = await AuthService.getUserProfile(currentUser.uid);
      if (!userProfile) {
        Alert.alert('Error', 'User profile not found');
        return;
      }

      const startDate = new Date();
      const estimatedEndDate = calculateEstimatedEndDate();

      const groupData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        contribution_amount: Number(formData.contributionAmount),
        total_members: 1, // Will be set by the service
        admin_id: currentUser.uid,
        status: 'active' as const,
        max_members: Number(formData.maxMembers),
        contribution_frequency: formData.contributionFrequency,
        payout_schedule: formData.contributionFrequency, // Same as contribution frequency for now
        start_date: startDate,
        estimated_end_date: estimatedEndDate,
        current_cycle: 1,
        total_cycles: Number(formData.maxMembers),
        cycle_start_date: startDate,
        cycle_end_date: new Date(startDate.getTime() + (24 * 60 * 60 * 1000)), // Add 1 day for now
        grace_period_days: Number(formData.gracePeriodDays),
        total_contributions_collected: 0,
        total_payouts_made: 0,
        successful_cycles: 0,
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const group = {
        id: 'group_' + Date.now(),
        name: groupData.name,
        description: groupData.description,
        contribution_amount: groupData.contribution_amount,
        max_members: groupData.max_members,
        admin_id: currentUser.uid,
        status: 'active',
        invite_code: 'AJT' + Math.random().toString(36).substr(2, 6).toUpperCase()
      };
      
      setCreatedGroup(group);

      // Simulate invite code generation
      const inviteResult = {
        success: true,
        data: {
          code: group.invite_code,
          link: `https://ajoturn.app/join/${group.id}?code=${group.invite_code}`
        }
      };

      if (inviteResult.success && inviteResult.data) {
        setInviteCode(inviteResult.data.code);
      }

      setStep('success');
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    
    return new Intl.NumberFormat('en-NG').format(Number(numericValue));
  };

  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const copyInviteCode = () => {
    // In a real app, you'd use Clipboard.setString(inviteCode)
    Alert.alert('Copied!', `Invite code ${inviteCode} copied to clipboard`);
  };

  const shareInviteCode = () => {
    const shareMessage = `Join my savings group "${createdGroup?.name}" on Ajoturn!\\n\\nUse invite code: ${inviteCode}\\n\\nDownload Ajoturn and start saving with us!`;
    // In a real app, you'd use Share.share({ message: shareMessage })
    Alert.alert('Share Invite', shareMessage);
  };

  const goToGroupDetails = () => {
    navigation.replace('GroupDetails', { groupId: createdGroup.id });
  };

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          {/* Success Icon */}
          <View style={styles.successIconContainer}>
            <Icon name="check-circle" size={80} color="#10B981" />
          </View>

          {/* Success Message */}
          <Text style={styles.successTitle}>Group Created Successfully!</Text>
          <Text style={styles.successSubtitle}>
            Your savings group "{createdGroup?.name}" is ready to go.
          </Text>

          {/* Invite Code Section */}
          <View style={styles.inviteSection}>
            <Text style={styles.inviteSectionTitle}>Invite Members</Text>
            <Text style={styles.inviteSectionSubtitle}>
              Share this code with friends to invite them to your group
            </Text>
            
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeText}>{inviteCode || 'Loading...'}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={copyInviteCode}>
                <Icon name="content-copy" size={20} color="#1E40AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.shareButton} onPress={shareInviteCode}>
                <Icon name="share" size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share Invite</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Group Details Summary */}
          <View style={styles.groupSummary}>
            <Text style={styles.groupSummaryTitle}>Group Details</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Contribution Amount:</Text>
              <Text style={styles.summaryValue}>
                {new Intl.NumberFormat('en-NG', { 
                  style: 'currency', 
                  currency: 'NGN',
                  minimumFractionDigits: 0 
                }).format(Number(formData.contributionAmount))}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Max Members:</Text>
              <Text style={styles.summaryValue}>{formData.maxMembers}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frequency:</Text>
              <Text style={styles.summaryValue}>
                {formData.contributionFrequency.charAt(0).toUpperCase() + formData.contributionFrequency.slice(1)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.successActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={goToGroupDetails}>
              <Text style={styles.primaryButtonText}>Go to Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={styles.secondaryButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create New Group</Text>
            <Text style={styles.subtitle}>
              Set up your savings group and start building wealth together
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Group Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Group Name *</Text>
              <View style={styles.inputContainer}>
                <Icon name="group" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Tech Professionals Ajo"
                  value={formData.name}
                  onChangeText={(value) => updateFormData('name', value)}
                  maxLength={50}
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Tell members about your group's purpose and goals"
                  value={formData.description}
                  onChangeText={(value) => updateFormData('description', value)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={200}
                />
              </View>
            </View>

            {/* Contribution Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contribution Amount *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="10,000"
                  value={formatCurrency(formData.contributionAmount)}
                  onChangeText={(value) => {
                    const numericValue = value.replace(/[^0-9]/g, '');
                    updateFormData('contributionAmount', numericValue);
                  }}
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.helpText}>
                Amount each member contributes per cycle
              </Text>
            </View>

            {/* Contribution Frequency */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contribution Frequency *</Text>
              <View style={styles.frequencyContainer}>
                {frequencyOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.frequencyButton,
                      formData.contributionFrequency === option.value && styles.frequencyButtonActive,
                    ]}
                    onPress={() => updateFormData('contributionFrequency', option.value)}
                  >
                    <Text
                      style={[
                        styles.frequencyButtonText,
                        formData.contributionFrequency === option.value && styles.frequencyButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Maximum Members */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Maximum Members *</Text>
              <View style={styles.inputContainer}>
                <Icon name="people" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="10"
                  value={formData.maxMembers}
                  onChangeText={(value) => updateFormData('maxMembers', value)}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <Text style={styles.helpText}>
                Total number of members including yourself (2-50)
              </Text>
            </View>

            {/* Grace Period */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Grace Period (Days)</Text>
              <View style={styles.inputContainer}>
                <Icon name="schedule" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="3"
                  value={formData.gracePeriodDays}
                  onChangeText={(value) => updateFormData('gracePeriodDays', value)}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              <Text style={styles.helpText}>
                Days allowed for late payments without penalty
              </Text>
            </View>

            {/* Group Summary */}
            {formData.name && formData.contributionAmount && formData.maxMembers && (
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>Group Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Pool Amount:</Text>
                  <Text style={styles.summaryValue}>
                    ₦{formatCurrency((Number(formData.contributionAmount) * Number(formData.maxMembers)).toString())}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Estimated Duration:</Text>
                  <Text style={styles.summaryValue}>
                    {formData.maxMembers} {formData.contributionFrequency === 'monthly' ? 'months' : 
                     formData.contributionFrequency === 'weekly' ? 'weeks' : 'days'}
                  </Text>
                </View>
              </View>
            )}

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, isLoading && styles.createButtonDisabled]}
              onPress={handleCreateGroup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Create Group</Text>
              )}
            </TouchableOpacity>
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
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  formContainer: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
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
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 16,
  },
  frequencyContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  frequencyButtonActive: {
    backgroundColor: '#1E40AF',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  frequencyButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#0369A1',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C4A6E',
  },
  createButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Success Screen Styles
  successContainer: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: 40,
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inviteSection: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  inviteSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  inviteSectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    width: '100%',
  },
  inviteCodeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    textAlign: 'center',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
  },
  inviteActions: {
    width: '100%',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  groupSummary: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  groupSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  successActions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateGroupScreen;