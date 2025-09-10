import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AppContext';
import LatePaymentMonitor from '../../services/business/latePaymentMonitor';
import PaymentTrackingService from '../../services/business/paymentTracking';
import { LatePaymentMember, LatePaymentSummary } from '../../services/business/latePaymentMonitor';

interface LatePaymentDashboardProps {
  navigation: any;
  route: {
    params: {
      groupId?: string;
    };
  };
}

const LatePaymentDashboard: React.FC<LatePaymentDashboardProps> = ({ 
  navigation, 
  route 
}) => {
  const { user } = useAuth();
  const { groupId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<LatePaymentSummary | null>(null);
  const [lateMembers, setLateMembers] = useState<LatePaymentMember[]>([]);
  const [selectedTab, setSelectedTab] = useState<'summary' | 'members'>('summary');

  useEffect(() => {
    loadLatePaymentData();
  }, [groupId]);

  const loadLatePaymentData = async () => {
    try {
      setLoading(true);
      
      const [summaryResult, membersResult] = await Promise.all([
        LatePaymentMonitor.getLatePaymentSummary(groupId),
        LatePaymentMonitor.getLatePaymentMembers(groupId),
      ]);

      if (summaryResult.success) {
        setSummary(summaryResult.data);
      }

      if (membersResult.success) {
        setLateMembers(membersResult.data);
      }
    } catch (error) {
      console.error('Error loading late payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLatePaymentData();
    setRefreshing(false);
  };

  const handleTakeAction = async (member: LatePaymentMember, actionType: 'warning' | 'penalty' | 'suspension') => {
    if (!user) return;

    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${actionType === 'warning' ? 'send a warning to' : actionType === 'penalty' ? 'apply a penalty to' : 'suspend'} ${member.memberName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const result = await PaymentTrackingService.handleLatePayment({
                contributionId: member.contributionId,
                adminId: user.uid,
                action: actionType,
                notes: `Manual ${actionType} applied by admin for ${member.daysLate} days late payment`,
              });

              if (result.success) {
                Alert.alert('Success', `${actionType} has been applied successfully`);
                await loadLatePaymentData();
              } else {
                Alert.alert('Error', result.error || 'Failed to apply action');
              }
            } catch (error) {
              console.error('Error applying action:', error);
              Alert.alert('Error', 'Failed to apply action');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Icon name="schedule" size={32} color="#FF9800" />
          <Text style={styles.summaryValue}>{summary.totalLateMembers}</Text>
          <Text style={styles.summaryLabel}>Late Members</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Icon name="money-off" size={32} color="#F44336" />
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalOverdueAmount)}</Text>
          <Text style={styles.summaryLabel}>Overdue Amount</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Icon name="warning" size={32} color="#FF5722" />
          <Text style={styles.summaryValue}>{summary.criticalCases.length}</Text>
          <Text style={styles.summaryLabel}>Critical Cases</Text>
        </View>
      </View>
    );
  };

  const renderActionButtons = (member: LatePaymentMember) => {
    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.warningButton]}
          onPress={() => handleTakeAction(member, 'warning')}
        >
          <Icon name="warning" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Warning</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.penaltyButton]}
          onPress={() => handleTakeAction(member, 'penalty')}
          disabled={member.penaltyAmount > 0}
        >
          <Icon name="money-off" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Penalty</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.suspensionButton]}
          onPress={() => handleTakeAction(member, 'suspension')}
        >
          <Icon name="block" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Suspend</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMemberItem = ({ item }: { item: LatePaymentMember }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.memberName}</Text>
          <Text style={styles.memberGroup}>{item.groupName}</Text>
        </View>
        <View style={styles.daysLateContainer}>
          <Text style={[
            styles.daysLateText,
            { color: item.daysLate > 7 ? '#F44336' : item.daysLate > 3 ? '#FF9800' : '#666' }
          ]}>
            {item.daysLate} days late
          </Text>
        </View>
      </View>
      
      <View style={styles.memberDetails}>
        <Text style={styles.amountText}>
          Amount: {formatCurrency(item.amount)}
        </Text>
        <Text style={styles.dueDateText}>
          Due: {item.dueDate.toLocaleDateString()}
        </Text>
        {item.penaltyAmount > 0 && (
          <Text style={styles.penaltyText}>
            Penalty: {formatCurrency(item.penaltyAmount)}
          </Text>
        )}
        <Text style={styles.warningsText}>
          Warnings: {item.warningsCount}
        </Text>
      </View>
      
      {renderActionButtons(item)}
    </View>
  );

  const renderTabContent = () => {
    if (selectedTab === 'summary') {
      return (
        <ScrollView style={styles.tabContent}>
          {renderSummaryCards()}
          
          {summary && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Late Payment Statistics</Text>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average Days Late:</Text>
                <Text style={styles.statValue}>{summary.averageDaysLate} days</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Warnings Issued:</Text>
                <Text style={styles.statValue}>{summary.warningsIssued}</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Penalties Applied:</Text>
                <Text style={styles.statValue}>{summary.penaltiesApplied}</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Suspended Members:</Text>
                <Text style={styles.statValue}>{summary.suspendedMembers}</Text>
              </View>
            </View>
          )}
          
          {summary && summary.criticalCases.length > 0 && (
            <View style={styles.criticalSection}>
              <Text style={styles.criticalTitle}>Critical Cases ({'>'}7 days late)</Text>
              {summary.criticalCases.map((member, index) => (
                <View key={index} style={styles.criticalItem}>
                  <Text style={styles.criticalMemberName}>{member.memberName}</Text>
                  <Text style={styles.criticalDays}>{member.daysLate} days late</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={lateMembers}
        renderItem={renderMemberItem}
        keyExtractor={(item) => `${item.memberId}_${item.contributionId}`}
        contentContainerStyle={styles.membersList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading late payment data...</Text>
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
        <Text style={styles.headerTitle}>Late Payments</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'summary' && styles.activeTab]}
          onPress={() => setSelectedTab('summary')}
        >
          <Text style={[styles.tabText, selectedTab === 'summary' && styles.activeTabText]}>
            Summary
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'members' && styles.activeTab]}
          onPress={() => setSelectedTab('members')}
        >
          <Text style={[styles.tabText, selectedTab === 'members' && styles.activeTabText]}>
            Members ({lateMembers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  refreshButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  statsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  criticalSection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  criticalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginBottom: 12,
  },
  criticalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  criticalMemberName: {
    fontSize: 14,
    color: '#333',
  },
  criticalDays: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '500',
  },
  membersList: {
    padding: 16,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberGroup: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  daysLateContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  daysLateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberDetails: {
    marginBottom: 16,
  },
  amountText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  dueDateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  penaltyText: {
    fontSize: 14,
    color: '#F44336',
    marginBottom: 4,
  },
  warningsText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  penaltyButton: {
    backgroundColor: '#F44336',
  },
  suspensionButton: {
    backgroundColor: '#757575',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
});

export default LatePaymentDashboard;