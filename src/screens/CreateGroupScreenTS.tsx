import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { MainStackScreenProps } from '../navigation/types';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { SavingsGroup, GroupMember } from '../services/firestore';

interface CreateGroupForm {
  name: string;
  description: string;
  contributionAmount: string;
  maxMembers: string;
  contributionFrequency: 'daily' | 'weekly' | 'monthly';
  payoutSchedule: 'weekly' | 'monthly';
  startDate: string;
  isPrivate: boolean;
}

const CreateGroupScreenTS: React.FC<MainStackScreenProps<'CreateGroup'>> = ({ navigation }) => {
  const { user } = useAuth();
  const { createGroup, loading: groupLoading } = useGroup();
  const [form, setForm] = useState<CreateGroupForm>({
    name: '',
    description: '',
    contributionAmount: '',
    maxMembers: '',
    contributionFrequency: 'monthly',
    payoutSchedule: 'monthly',
    startDate: '',
    isPrivate: false,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Partial<CreateGroupForm>>({});

  // Update form field
  const updateForm = (field: keyof CreateGroupForm, value: string | boolean): void => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<CreateGroupForm> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (form.name.length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    }

    if (!form.contributionAmount.trim()) {
      newErrors.contributionAmount = 'Contribution amount is required';
    } else if (isNaN(Number(form.contributionAmount)) || Number(form.contributionAmount) <= 0) {
      newErrors.contributionAmount = 'Please enter a valid amount';
    }

    if (!form.maxMembers.trim()) {
      newErrors.maxMembers = 'Maximum members is required';
    } else if (isNaN(Number(form.maxMembers)) || Number(form.maxMembers) < 2) {
      newErrors.maxMembers = 'Minimum 2 members required';
    } else if (Number(form.maxMembers) > 50) {
      newErrors.maxMembers = 'Maximum 50 members allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleCreateGroup = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a group');
      return;
    }

    try {
      setLoading(true);

      // Create admin member
      const adminMember: GroupMember = {
        userId: user.uid,
        displayName: user.displayName || user.email || 'Admin',
        joinedAt: new Date(),
        role: 'admin',
        isActive: true,
        totalContributions: 0,
        missedPayments: 0,
      };

      // Create group data
      const newGroup: Omit<SavingsGroup, 'id' | 'createdAt' | 'updatedAt'> = {
        name: form.name,
        description: form.description,
        adminId: user.uid,
        members: [adminMember],
        contributionAmount: Number(form.contributionAmount),
        contributionFrequency: form.contributionFrequency,
        payoutSchedule: form.payoutSchedule,
        status: 'active',
        startDate: new Date(),
        currentCycle: 1,
        totalCycles: Number(form.maxMembers),
      };

      const groupId = await createGroup(newGroup);
      
      if (groupId) {
        Alert.alert(
          'Success',
          'Group created successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to create group. Please try again.');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.title}>Create New Group</Text>
        <Text style={styles.subtitle}>Set up your thrift savings group</Text>

        {/* Group Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Group Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="e.g., Monthly Savers, Family Circle"
            placeholderTextColor="#9ca3af"
            value={form.name}
            onChangeText={(value) => updateForm('name', value)}
            maxLength={50}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Description */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your group's purpose and goals"
            placeholderTextColor="#9ca3af"
            value={form.description}
            onChangeText={(value) => updateForm('description', value)}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        {/* Contribution Amount */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contribution Amount (₦) *</Text>
          <TextInput
            style={[styles.input, errors.contributionAmount && styles.inputError]}
            placeholder="5000"
            placeholderTextColor="#9ca3af"
            value={form.contributionAmount}
            onChangeText={(value) => updateForm('contributionAmount', value)}
            keyboardType="numeric"
            maxLength={10}
          />
          {errors.contributionAmount && <Text style={styles.errorText}>{errors.contributionAmount}</Text>}
        </View>

        {/* Maximum Members */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Maximum Members *</Text>
          <TextInput
            style={[styles.input, errors.maxMembers && styles.inputError]}
            placeholder="12"
            placeholderTextColor="#9ca3af"
            value={form.maxMembers}
            onChangeText={(value) => updateForm('maxMembers', value)}
            keyboardType="numeric"
            maxLength={2}
          />
          {errors.maxMembers && <Text style={styles.errorText}>{errors.maxMembers}</Text>}
          <Text style={styles.helpText}>Each member will receive a payout in turn</Text>
        </View>

        {/* Contribution Frequency */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contribution Frequency</Text>
          <View style={styles.frequencyContainer}>
            {(['daily', 'weekly', 'monthly'] as const).map((frequency) => (
              <TouchableOpacity
                key={frequency}
                style={[
                  styles.frequencyOption,
                  form.contributionFrequency === frequency && styles.frequencyOptionSelected,
                ]}
                onPress={() => updateForm('contributionFrequency', frequency)}
              >
                <Text
                  style={[
                    styles.frequencyText,
                    form.contributionFrequency === frequency && styles.frequencyTextSelected,
                  ]}
                >
                  {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy Setting */}
        <View style={styles.inputContainer}>
          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <Text style={styles.label}>Private Group</Text>
              <Text style={styles.helpText}>Only invited members can join</Text>
            </View>
            <Switch
              value={form.isPrivate}
              onValueChange={(value) => updateForm('isPrivate', value)}
              trackColor={{ false: '#d1d5db', true: '#3182ce' }}
              thumbColor={form.isPrivate ? '#ffffff' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Payout Pool:</Text>
            <Text style={styles.summaryValue}>
              ₦{form.contributionAmount && form.maxMembers 
                ? (Number(form.contributionAmount) * Number(form.maxMembers)).toLocaleString()
                : '0'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Duration:</Text>
            <Text style={styles.summaryValue}>
              {form.maxMembers || '0'} {form.contributionFrequency} cycles
            </Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, (loading || groupLoading) && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={loading || groupLoading}
        >
          <Text style={styles.createButtonText}>
            {(loading || groupLoading) ? 'Creating Group...' : 'Create Group'}
          </Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.termsText}>
          By creating a group, you agree to act as the administrator and ensure fair distribution of payouts.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2d3748',
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    color: '#e53e3e',
    marginTop: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  frequencyOptionSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#3182ce',
  },
  frequencyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#718096',
  },
  frequencyTextSelected: {
    color: '#ffffff',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchInfo: {
    flex: 1,
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#718096',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  createButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  termsText: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default CreateGroupScreenTS;