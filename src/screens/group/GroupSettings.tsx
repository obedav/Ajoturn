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
import GroupManagementService, { GroupSettings as GroupSettingsType } from '../../services/business/groupManagement';
import DatabaseService from '../../services/database';

interface GroupSettingsProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
      groupName: string;
      userRole: 'admin' | 'member';
    };
  };
}

const GroupSettings: React.FC<GroupSettingsProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { groupId, groupName, userRole } = route.params;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GroupSettingsType | null>(null);
  const [originalSettings, setOriginalSettings] = useState<GroupSettingsType | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [contributionAmount, setContributionAmount] = useState('');
  const [paymentDeadlineDays, setPaymentDeadlineDays] = useState('');
  const [latePenaltyRate, setLatePenaltyRate] = useState('');
  const [maxLatePaymentDays, setMaxLatePaymentDays] = useState('');
  const [autoProcessCycles, setAutoProcessCycles] = useState(false);
  const [requirePaymentProof, setRequirePaymentProof] = useState(false);
  const [allowMemberInvites, setAllowMemberInvites] = useState(false);
  const [groupVisibility, setGroupVisibility] = useState<'private' | 'public' | 'invite_only'>('private');

  // Modals
  const [confirmationModal, setConfirmationModal] = useState(false);
  const [changesPreviewModal, setChangesPreviewModal] = useState(false);

  useEffect(() => {
    loadGroupSettings();
  }, [groupId]);

  useEffect(() => {
    checkForChanges();
  }, [
    contributionAmount,
    paymentDeadlineDays,
    latePenaltyRate,
    maxLatePaymentDays,
    autoProcessCycles,
    requirePaymentProof,
    allowMemberInvites,
    groupVisibility,
  ]);

  const loadGroupSettings = async () => {
    try {
      setLoading(true);

      // Get group details to extract current settings
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        Alert.alert('Error', 'Group not found');
        return;
      }

      const group = groupResult.data;

      // Create settings object from group data
      const currentSettings: GroupSettingsType = {
        contributionAmount: group.contribution_amount || 50000,
        paymentFrequency: 'monthly',
        paymentDeadlineDays: group.payment_deadline_days || 7,
        latePenaltyRate: group.late_penalty_rate || 5,
        maxLatePaymentDays: group.max_late_days || 14,
        autoProcessCycles: group.auto_process_cycles || false,
        requirePaymentProof: group.require_payment_proof || false,
        allowMemberInvites: group.allow_member_invites || false,
        groupVisibility: (group.group_visibility as any) || 'private',
      };

      setSettings(currentSettings);
      setOriginalSettings({ ...currentSettings });

      // Set form values
      setContributionAmount(currentSettings.contributionAmount.toString());
      setPaymentDeadlineDays(currentSettings.paymentDeadlineDays.toString());
      setLatePenaltyRate(currentSettings.latePenaltyRate.toString());
      setMaxLatePaymentDays(currentSettings.maxLatePaymentDays.toString());
      setAutoProcessCycles(currentSettings.autoProcessCycles);
      setRequirePaymentProof(currentSettings.requirePaymentProof);
      setAllowMemberInvites(currentSettings.allowMemberInvites);
      setGroupVisibility(currentSettings.groupVisibility);

    } catch (error) {
      console.error('Error loading group settings:', error);
      Alert.alert('Error', 'Failed to load group settings');
    } finally {
      setLoading(false);
    }
  };

  const checkForChanges = () => {
    if (!originalSettings) return;

    const currentFormSettings: GroupSettingsType = {
      contributionAmount: parseFloat(contributionAmount) || 0,
      paymentFrequency: 'monthly',
      paymentDeadlineDays: parseInt(paymentDeadlineDays) || 0,
      latePenaltyRate: parseFloat(latePenaltyRate) || 0,
      maxLatePaymentDays: parseInt(maxLatePaymentDays) || 0,
      autoProcessCycles,
      requirePaymentProof,
      allowMemberInvites,
      groupVisibility,
    };

    const hasChanged = JSON.stringify(currentFormSettings) !== JSON.stringify(originalSettings);
    setHasChanges(hasChanged);
  };

  const handleSave = async () => {
    if (!user || userRole !== 'admin') {
      Alert.alert('Error', 'Only admins can modify group settings');
      return;
    }

    // Validate inputs
    const validation = validateSettings();
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.message);
      return;
    }

    setChangesPreviewModal(true);
  };

  const confirmSave = async () => {
    try {
      setSaving(true);
      setChangesPreviewModal(false);

      const updatedSettings: Partial<GroupSettingsType> = {
        contributionAmount: parseFloat(contributionAmount),
        paymentDeadlineDays: parseInt(paymentDeadlineDays),
        latePenaltyRate: parseFloat(latePenaltyRate),
        maxLatePaymentDays: parseInt(maxLatePaymentDays),
        autoProcessCycles,
        requirePaymentProof,
        allowMemberInvites,
        groupVisibility,
      };

      const result = await GroupManagementService.updateGroupSettings({
        adminId: user!.uid,
        groupId,
        settings: updatedSettings,
        effectiveDate: new Date(),
        notifyMembers: true,
      });

      if (result.success) {
        Alert.alert('Success', 'Group settings updated successfully');
        setOriginalSettings(result.data);
        setHasChanges(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const validateSettings = (): { isValid: boolean; message: string } => {
    if (!contributionAmount || parseFloat(contributionAmount) < 1000) {
      return {
        isValid: false,
        message: 'Contribution amount must be at least UGX 1,000',
      };
    }

    if (!paymentDeadlineDays || parseInt(paymentDeadlineDays) < 1 || parseInt(paymentDeadlineDays) > 30) {
      return {
        isValid: false,
        message: 'Payment deadline must be between 1 and 30 days',
      };
    }

    if (!latePenaltyRate || parseFloat(latePenaltyRate) < 0 || parseFloat(latePenaltyRate) > 50) {
      return {
        isValid: false,
        message: 'Late penalty rate must be between 0% and 50%',
      };
    }

    if (!maxLatePaymentDays || parseInt(maxLatePaymentDays) < 1 || parseInt(maxLatePaymentDays) > 90) {
      return {
        isValid: false,
        message: 'Maximum late payment days must be between 1 and 90',
      };
    }

    return { isValid: true, message: '' };
  };

  const handleReset = () => {
    if (!originalSettings) return;

    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all changes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            setContributionAmount(originalSettings.contributionAmount.toString());
            setPaymentDeadlineDays(originalSettings.paymentDeadlineDays.toString());
            setLatePenaltyRate(originalSettings.latePenaltyRate.toString());
            setMaxLatePaymentDays(originalSettings.maxLatePaymentDays.toString());
            setAutoProcessCycles(originalSettings.autoProcessCycles);
            setRequirePaymentProof(originalSettings.requirePaymentProof);
            setAllowMemberInvites(originalSettings.allowMemberInvites);
            setGroupVisibility(originalSettings.groupVisibility);
          },
        },
      ]
    );
  };

  const getChangeSummary = () => {
    if (!originalSettings) return [];
    
    const changes = [];
    
    if (parseFloat(contributionAmount) !== originalSettings.contributionAmount) {
      changes.push({
        setting: 'Contribution Amount',
        from: `UGX ${originalSettings.contributionAmount.toLocaleString()}`,
        to: `UGX ${parseFloat(contributionAmount).toLocaleString()}`,
      });
    }
    
    if (parseInt(paymentDeadlineDays) !== originalSettings.paymentDeadlineDays) {
      changes.push({
        setting: 'Payment Deadline',
        from: `${originalSettings.paymentDeadlineDays} days`,
        to: `${paymentDeadlineDays} days`,
      });
    }
    
    if (parseFloat(latePenaltyRate) !== originalSettings.latePenaltyRate) {
      changes.push({
        setting: 'Late Penalty Rate',
        from: `${originalSettings.latePenaltyRate}%`,
        to: `${latePenaltyRate}%`,
      });
    }
    
    if (autoProcessCycles !== originalSettings.autoProcessCycles) {
      changes.push({
        setting: 'Auto Process Cycles',
        from: originalSettings.autoProcessCycles ? 'Enabled' : 'Disabled',
        to: autoProcessCycles ? 'Enabled' : 'Disabled',
      });
    }

    return changes;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
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
          <Text style={styles.headerTitle}>Group Settings</Text>
          <Text style={styles.headerSubtitle}>{groupName}</Text>
        </View>
        <View style={styles.headerRight}>
          {userRole === 'admin' && hasChanges && (
            <View style={styles.changeIndicator} />
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Payment Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Contribution Amount (UGX)</Text>
            <Text style={styles.settingDescription}>
              Amount each member contributes per cycle
            </Text>
            <TextInput
              style={[
                styles.textInput,
                userRole !== 'admin' && styles.disabledInput
              ]}
              value={contributionAmount}
              onChangeText={setContributionAmount}
              placeholder="50000"
              keyboardType="numeric"
              editable={userRole === 'admin'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Payment Deadline (Days)</Text>
            <Text style={styles.settingDescription}>
              Number of days from cycle start to payment deadline
            </Text>
            <TextInput
              style={[
                styles.textInput,
                userRole !== 'admin' && styles.disabledInput
              ]}
              value={paymentDeadlineDays}
              onChangeText={setPaymentDeadlineDays}
              placeholder="7"
              keyboardType="numeric"
              editable={userRole === 'admin'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Late Penalty Rate (%)</Text>
            <Text style={styles.settingDescription}>
              Percentage penalty applied per day for late payments
            </Text>
            <TextInput
              style={[
                styles.textInput,
                userRole !== 'admin' && styles.disabledInput
              ]}
              value={latePenaltyRate}
              onChangeText={setLatePenaltyRate}
              placeholder="5"
              keyboardType="decimal-pad"
              editable={userRole === 'admin'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Max Late Payment Days</Text>
            <Text style={styles.settingDescription}>
              Maximum days allowed for late payments before suspension
            </Text>
            <TextInput
              style={[
                styles.textInput,
                userRole !== 'admin' && styles.disabledInput
              ]}
              value={maxLatePaymentDays}
              onChangeText={setMaxLatePaymentDays}
              placeholder="14"
              keyboardType="numeric"
              editable={userRole === 'admin'}
            />
          </View>
        </View>

        {/* Automation Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automation Settings</Text>
          
          <View style={styles.switchItem}>
            <View style={styles.switchInfo}>
              <Text style={styles.settingLabel}>Auto Process Cycles</Text>
              <Text style={styles.settingDescription}>
                Automatically process cycle completion when all payments are received
              </Text>
            </View>
            <Switch
              value={autoProcessCycles}
              onValueChange={setAutoProcessCycles}
              disabled={userRole !== 'admin'}
            />
          </View>

          <View style={styles.switchItem}>
            <View style={styles.switchInfo}>
              <Text style={styles.settingLabel}>Require Payment Proof</Text>
              <Text style={styles.settingDescription}>
                Members must upload proof of payment (receipts, screenshots)
              </Text>
            </View>
            <Switch
              value={requirePaymentProof}
              onValueChange={setRequirePaymentProof}
              disabled={userRole !== 'admin'}
            />
          </View>
        </View>

        {/* Group Access Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Access</Text>
          
          <View style={styles.switchItem}>
            <View style={styles.switchInfo}>
              <Text style={styles.settingLabel}>Allow Member Invites</Text>
              <Text style={styles.settingDescription}>
                Members can invite others to join the group
              </Text>
            </View>
            <Switch
              value={allowMemberInvites}
              onValueChange={setAllowMemberInvites}
              disabled={userRole !== 'admin'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Group Visibility</Text>
            <Text style={styles.settingDescription}>
              Who can find and join this group
            </Text>
            <View style={styles.radioGroup}>
              {[
                { key: 'private', label: 'Private (Invite only)' },
                { key: 'invite_only', label: 'Invite Only (Searchable)' },
                { key: 'public', label: 'Public (Anyone can join)' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.radioOption}
                  onPress={() => userRole === 'admin' && setGroupVisibility(option.key as any)}
                  disabled={userRole !== 'admin'}
                >
                  <View style={[
                    styles.radioCircle,
                    groupVisibility === option.key && styles.radioSelected,
                    userRole !== 'admin' && styles.disabledRadio,
                  ]}>
                    {groupVisibility === option.key && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text style={[
                    styles.radioLabel,
                    userRole !== 'admin' && styles.disabledText,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <View style={styles.infoItem}>
            <Icon name="info" size={20} color="#2196F3" />
            <Text style={styles.infoText}>
              Settings changes will take effect immediately and all members will be notified.
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Icon name="warning" size={20} color="#FF9800" />
            <Text style={styles.infoText}>
              Changing contribution amounts may affect ongoing cycles. Members will need to adjust their payments accordingly.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {userRole === 'admin' && (
        <View style={styles.actionContainer}>
          {hasChanges && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Icon name="refresh" size={20} color="#FF9800" />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.saveButton,
              !hasChanges && styles.disabledButton,
              saving && styles.savingButton,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            <Icon 
              name={saving ? "sync" : "save"} 
              size={20} 
              color="#fff" 
            />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Changes Preview Modal */}
      <Modal
        visible={changesPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setChangesPreviewModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Changes</Text>
              <TouchableOpacity onPress={() => setChangesPreviewModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                The following settings will be updated:
              </Text>
              
              {getChangeSummary().map((change, index) => (
                <View key={index} style={styles.changeItem}>
                  <Text style={styles.changeSetting}>{change.setting}</Text>
                  <View style={styles.changeValues}>
                    <Text style={styles.changeFrom}>{change.from}</Text>
                    <Icon name="arrow-forward" size={16} color="#666" />
                    <Text style={styles.changeTo}>{change.to}</Text>
                  </View>
                </View>
              ))}
              
              <View style={styles.warningContainer}>
                <Icon name="warning" size={20} color="#FF9800" />
                <Text style={styles.warningText}>
                  All group members will be notified of these changes.
                </Text>
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setChangesPreviewModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmSave}
              >
                <Text style={styles.confirmButtonText}>Confirm Changes</Text>
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
    alignItems: 'center',
  },
  changeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  radioGroup: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#2196F3',
  },
  disabledRadio: {
    borderColor: '#ccc',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  disabledText: {
    color: '#999',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF9800',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  savingButton: {
    backgroundColor: '#1976D2',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
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
    maxHeight: '70%',
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
  modalDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  changeItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  changeSetting: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  changeFrom: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  changeTo: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9800',
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
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});

export default GroupSettings;