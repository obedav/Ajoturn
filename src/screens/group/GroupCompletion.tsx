import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import GroupManagementService, { GroupCompletionOptions, GroupSettings } from '../../services/business/groupManagement';

interface GroupCompletionProps {
  groupId: string;
  userId: string;
  currentSettings: GroupSettings;
  onCompletion: (success: boolean) => void;
}

interface CompletionStatus {
  isComplete: boolean;
  completionRate: number;
  remainingMembers: string[];
  totalCycles: number;
  completedCycles: number;
}

const GroupCompletion: React.FC<GroupCompletionProps> = ({
  groupId,
  userId,
  currentSettings,
  onCompletion,
}) => {
  const [loading, setLoading] = useState(true);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);
  const [selectedAction, setSelectedAction] = useState<'restart' | 'dissolve' | 'pause' | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Option states
  const [redistributeFunds, setRedistributeFunds] = useState(false);
  const [retainMembers, setRetainMembers] = useState(true);
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [newContributionAmount, setNewContributionAmount] = useState(currentSettings.contributionAmount.toString());
  const [newPaymentDeadline, setNewPaymentDeadline] = useState(currentSettings.paymentDeadlineDays.toString());

  useEffect(() => {
    checkCompletionStatus();
  }, []);

  const checkCompletionStatus = async () => {
    try {
      setLoading(true);
      const result = await GroupManagementService.checkGroupCompletion(groupId);
      
      if (result.success && result.data) {
        setCompletionStatus(result.data);
      } else {
        Alert.alert('Error', result.error || 'Failed to check completion status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load completion status');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSelect = (action: 'restart' | 'dissolve' | 'pause') => {
    setSelectedAction(action);
    setShowConfirmationModal(true);
  };

  const executeAction = async () => {
    if (!selectedAction) return;

    try {
      setProcessing(true);

      const options: GroupCompletionOptions = {
        action: selectedAction,
        redistributeFunds,
        retainMembers,
        notifyMembers,
      };

      // Add new settings for restart action
      if (selectedAction === 'restart') {
        const newAmount = parseFloat(newContributionAmount);
        const newDeadline = parseInt(newPaymentDeadline);

        if (newAmount !== currentSettings.contributionAmount || 
            newDeadline !== currentSettings.paymentDeadlineDays) {
          options.newSettings = {
            contributionAmount: newAmount,
            paymentDeadlineDays: newDeadline,
          };
        }
      }

      const result = await GroupManagementService.handleGroupCompletion({
        adminId: userId,
        groupId,
        options,
      });

      if (result.success) {
        Alert.alert(
          'Success', 
          result.data?.message || 'Action completed successfully',
          [{ text: 'OK', onPress: () => onCompletion(true) }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to execute action');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to execute action');
    } finally {
      setProcessing(false);
      setShowConfirmationModal(false);
    }
  };

  const renderCompletionStatus = () => {
    if (!completionStatus) return null;

    return (
      <View style={styles.statusContainer}>
        <View style={styles.statusHeader}>
          <Icon name="check-circle" size={24} color="#4CAF50" />
          <Text style={styles.statusTitle}>Group Cycle Complete!</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${completionStatus.completionRate}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {completionStatus.completedCycles} of {completionStatus.totalCycles} members have received payouts
          </Text>
        </View>

        <Text style={styles.statusDescription}>
          All members have completed their turn and received their payout. 
          Choose what you'd like to do next:
        </Text>
      </View>
    );
  };

  const renderActionOptions = () => (
    <View style={styles.actionsContainer}>
      <Text style={styles.sectionTitle}>Choose Next Action</Text>

      <TouchableOpacity
        style={[styles.actionButton, styles.restartButton]}
        onPress={() => handleActionSelect('restart')}
      >
        <Icon name="refresh" size={24} color="#fff" />
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Restart Group</Text>
          <Text style={styles.actionDescription}>
            Start a new cycle with the same members
          </Text>
        </View>
        <Icon name="arrow-forward-ios" size={16} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.pauseButton]}
        onPress={() => handleActionSelect('pause')}
      >
        <Icon name="pause-circle-filled" size={24} color="#fff" />
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Pause Group</Text>
          <Text style={styles.actionDescription}>
            Temporarily pause until ready to resume
          </Text>
        </View>
        <Icon name="arrow-forward-ios" size={16} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.dissolveButton]}
        onPress={() => handleActionSelect('dissolve')}
      >
        <Icon name="cancel" size={24} color="#fff" />
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Dissolve Group</Text>
          <Text style={styles.actionDescription}>
            Permanently end the group
          </Text>
        </View>
        <Icon name="arrow-forward-ios" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderConfirmationModal = () => {
    if (!selectedAction) return null;

    const actionConfig = {
      restart: {
        title: 'Restart Group',
        icon: 'refresh',
        color: '#4CAF50',
        description: 'Start a new savings cycle with the current members',
      },
      pause: {
        title: 'Pause Group',
        icon: 'pause-circle-filled',
        color: '#FF9800',
        description: 'Temporarily suspend group activities',
      },
      dissolve: {
        title: 'Dissolve Group',
        icon: 'cancel',
        color: '#F44336',
        description: 'Permanently end this savings group',
      },
    };

    const config = actionConfig[selectedAction];

    return (
      <Modal
        visible={showConfirmationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Icon name={config.icon} size={32} color={config.color} />
              <Text style={styles.modalTitle}>{config.title}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowConfirmationModal(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalDescription}>{config.description}</Text>

              {/* Options */}
              <View style={styles.optionsContainer}>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Notify all members</Text>
                  <Switch
                    value={notifyMembers}
                    onValueChange={setNotifyMembers}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={notifyMembers ? '#007AFF' : '#f4f3f4'}
                  />
                </View>

                {selectedAction === 'restart' && (
                  <>
                    <View style={styles.optionRow}>
                      <Text style={styles.optionLabel}>Retain current members</Text>
                      <Switch
                        value={retainMembers}
                        onValueChange={setRetainMembers}
                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                        thumbColor={retainMembers ? '#007AFF' : '#f4f3f4'}
                      />
                    </View>

                    <Text style={styles.subsectionTitle}>Update Settings (Optional)</Text>
                    
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Contribution Amount</Text>
                      <View style={styles.settingInput}>
                        <Text style={styles.currency}>UGX</Text>
                        <Text style={styles.settingValue}>
                          {parseFloat(newContributionAmount).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Payment Deadline</Text>
                      <View style={styles.settingInput}>
                        <Text style={styles.settingValue}>{newPaymentDeadline}</Text>
                        <Text style={styles.unit}>days</Text>
                      </View>
                    </View>
                  </>
                )}

                {(selectedAction === 'dissolve' || selectedAction === 'restart') && (
                  <View style={styles.optionRow}>
                    <Text style={styles.optionLabel}>Redistribute remaining funds</Text>
                    <Switch
                      value={redistributeFunds}
                      onValueChange={setRedistributeFunds}
                      trackColor={{ false: '#767577', true: '#81b0ff' }}
                      thumbColor={redistributeFunds ? '#007AFF' : '#f4f3f4'}
                    />
                  </View>
                )}
              </View>

              {/* Warning for dissolve */}
              {selectedAction === 'dissolve' && (
                <View style={styles.warningContainer}>
                  <Icon name="warning" size={20} color="#F44336" />
                  <Text style={styles.warningText}>
                    This action cannot be undone. All group data will be archived.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowConfirmationModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: config.color }]}
                onPress={executeAction}
                disabled={processing}
              >
                <Text style={styles.confirmButtonText}>
                  {processing ? 'Processing...' : config.title}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="hourglass-empty" size={48} color="#007AFF" />
        <Text style={styles.loadingText}>Checking completion status...</Text>
      </View>
    );
  }

  if (!completionStatus?.isComplete) {
    return (
      <View style={styles.notCompleteContainer}>
        <Icon name="schedule" size={48} color="#FF9800" />
        <Text style={styles.notCompleteTitle}>Group Not Yet Complete</Text>
        <Text style={styles.notCompleteText}>
          {completionStatus?.completedCycles || 0} of {completionStatus?.totalCycles || 0} members 
          have received their payout. Completion options will be available when all cycles are finished.
        </Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${completionStatus?.completionRate || 0}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(completionStatus?.completionRate || 0)}% Complete
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {renderCompletionStatus()}
      {renderActionOptions()}
      {renderConfirmationModal()}
    </ScrollView>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  notCompleteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  notCompleteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  notCompleteText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  statusContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 12,
  },
  statusDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  actionsContainer: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  restartButton: {
    backgroundColor: '#4CAF50',
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  dissolveButton: {
    backgroundColor: '#F44336',
  },
  actionContent: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    maxHeight: 400,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    margin: 20,
    marginBottom: 16,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  currency: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  unit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    margin: 20,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default GroupCompletion;