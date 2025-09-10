import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AppContext';
import PaymentTrackingService from '../../services/business/paymentTracking';
import { PaymentProgress, PaymentHistoryItem } from '../../services/business/paymentTracking';

interface PaymentStatusScreenProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
    };
  };
}

const PaymentStatusScreen: React.FC<PaymentStatusScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { groupId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState<PaymentProgress | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentData();
  }, [groupId]);

  const loadPaymentData = async () => {
    if (!user) return;

    try {
      setError(null);
      
      const [progressResult, historyResult] = await Promise.all([
        PaymentTrackingService.getPaymentProgress(groupId),
        PaymentTrackingService.getMemberPaymentHistory(user.uid, groupId)
      ]);

      if (progressResult.success && progressResult.data) {
        setPaymentProgress(progressResult.data);
      } else {
        setError(progressResult.error || 'Failed to load payment progress');
      }

      if (historyResult.success && historyResult.data) {
        setPaymentHistory(historyResult.data);
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPaymentData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'overdue': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return 'check-circle';
      case 'pending': return 'schedule';
      case 'overdue': return 'error';
      default: return 'help';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getCurrentMemberPayment = () => {
    if (!paymentProgress?.memberPayments || !user) return null;
    return paymentProgress.memberPayments.find(p => p.memberId === user.uid);
  };

  const currentPayment = getCurrentMemberPayment();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading payment status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPaymentData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Status</Text>
        </View>

        {/* Current Payment Status */}
        {currentPayment && (
          <View style={styles.currentPaymentCard}>
            <View style={styles.statusHeader}>
              <Icon
                name={getStatusIcon(currentPayment.status)}
                size={24}
                color={getStatusColor(currentPayment.status)}
              />
              <Text style={[styles.statusText, { color: getStatusColor(currentPayment.status) }]}>
                {currentPayment.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.amountText}>
              {formatCurrency(currentPayment.amount)}
            </Text>
            <Text style={styles.dueDateText}>
              Due: {formatDate(currentPayment.dueDate)}
            </Text>
            {currentPayment.status === 'pending' && (
              <Text style={styles.pendingNote}>
                Your payment is awaiting admin confirmation
              </Text>
            )}
            {currentPayment.status === 'overdue' && (
              <Text style={styles.overdueNote}>
                Payment is overdue. Please contact admin.
              </Text>
            )}
          </View>
        )}

        {/* Group Progress */}
        {paymentProgress && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Group Progress</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(paymentProgress.confirmedCount / paymentProgress.totalMembers) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {paymentProgress.confirmedCount} of {paymentProgress.totalMembers} members paid
            </Text>
            <Text style={styles.progressAmount}>
              Total: {formatCurrency(paymentProgress.totalAmount)}
            </Text>
          </View>
        )}

        {/* Payment History */}
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Payment History</Text>
          {paymentHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="history" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No payment history yet</Text>
            </View>
          ) : (
            paymentHistory.map((payment) => (
              <View key={payment.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Icon
                    name={getStatusIcon(payment.status)}
                    size={20}
                    color={getStatusColor(payment.status)}
                  />
                  <Text style={styles.historyAmount}>
                    {formatCurrency(payment.amount)}
                  </Text>
                </View>
                <Text style={styles.historyDate}>
                  {formatDate(payment.paidDate)}
                </Text>
                <Text style={styles.historyMethod}>
                  Method: {payment.paymentMethod}
                </Text>
                {payment.confirmedBy && (
                  <Text style={styles.historyConfirmed}>
                    Confirmed by: {payment.confirmedBy}
                  </Text>
                )}
                {payment.notes && (
                  <Text style={styles.historyNotes}>
                    Notes: {payment.notes}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            • Payments are confirmed by group admins{'\n'}
            • Contact your group admin if you have questions{'\n'}
            • Keep receipts for your records{'\n'}
            • Report any discrepancies immediately
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  currentPaymentCard: {
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
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  amountText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  dueDateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pendingNote: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  overdueNote: {
    fontSize: 12,
    color: '#F44336',
    fontStyle: 'italic',
  },
  progressCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
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
    marginBottom: 4,
  },
  progressAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  historyCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  historyItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  historyMethod: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  historyConfirmed: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  helpCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default PaymentStatusScreen;