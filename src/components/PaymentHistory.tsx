import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PaymentTrackingService from '../services/business/paymentTracking';
import { PaymentHistoryItem } from '../services/business/paymentTracking';

interface PaymentHistoryProps {
  userId?: string;
  groupId?: string;
  limit?: number;
  showHeader?: boolean;
  onPaymentPress?: (payment: PaymentHistoryItem) => void;
}

const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  userId,
  groupId,
  limit,
  showHeader = true,
  onPaymentPress,
}) => {
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistoryItem | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    loadPaymentHistory();
  }, [userId, groupId]);

  const loadPaymentHistory = async () => {
    try {
      let result;
      
      if (userId && groupId) {
        result = await PaymentTrackingService.getMemberPaymentHistory(userId, groupId);
      } else if (groupId) {
        result = await PaymentTrackingService.getGroupPaymentHistory(groupId);
      } else {
        setLoading(false);
        return;
      }

      if (result.success && result.data) {
        const limitedData = limit ? result.data.slice(0, limit) : result.data;
        setPayments(limitedData);
      }
    } catch (error) {
      console.error('Error loading payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPaymentHistory();
    setRefreshing(false);
  };

  const handlePaymentPress = (payment: PaymentHistoryItem) => {
    if (onPaymentPress) {
      onPaymentPress(payment);
    } else {
      setSelectedPayment(payment);
      setDetailsModalVisible(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'overdue': return '#F44336';
      case 'cancelled': return '#757575';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return 'check-circle';
      case 'pending': return 'schedule';
      case 'overdue': return 'error';
      case 'cancelled': return 'cancel';
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

  const renderPaymentItem = ({ item }: { item: PaymentHistoryItem }) => (
    <TouchableOpacity
      style={styles.paymentItem}
      onPress={() => handlePaymentPress(item)}
    >
      <View style={styles.paymentHeader}>
        <View style={styles.statusContainer}>
          <Icon
            name={getStatusIcon(item.status)}
            size={20}
            color={getStatusColor(item.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.amountText}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      
      <Text style={styles.dateText}>
        {formatDate(item.paidDate)}
      </Text>
      
      <View style={styles.paymentDetails}>
        <Text style={styles.methodText}>
          {item.paymentMethod}
        </Text>
        {item.confirmedBy && (
          <Text style={styles.confirmedByText}>
            Confirmed by: {item.confirmedBy}
          </Text>
        )}
      </View>
      
      {item.notes && (
        <Text style={styles.notesText} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="history" size={48} color="#ccc" />
      <Text style={styles.emptyText}>No payment history</Text>
      <Text style={styles.emptySubtext}>
        Payments will appear here once they are made
      </Text>
    </View>
  );

  const renderPaymentDetails = () => {
    if (!selectedPayment) return null;

    return (
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={styles.detailValue}>
                  <Icon
                    name={getStatusIcon(selectedPayment.status)}
                    size={20}
                    color={getStatusColor(selectedPayment.status)}
                  />
                  <Text style={[styles.detailText, { color: getStatusColor(selectedPayment.status) }]}>
                    {selectedPayment.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Amount</Text>
                <Text style={styles.detailAmount}>
                  {formatCurrency(selectedPayment.amount)}
                </Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Payment Date</Text>
                <Text style={styles.detailText}>
                  {formatDate(selectedPayment.paidDate)}
                </Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailText}>
                  {selectedPayment.paymentMethod}
                </Text>
              </View>
              
              {selectedPayment.confirmedBy && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Confirmed By</Text>
                  <Text style={styles.detailText}>
                    {selectedPayment.confirmedBy}
                  </Text>
                </View>
              )}
              
              {selectedPayment.confirmedAt && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Confirmed At</Text>
                  <Text style={styles.detailText}>
                    {formatDate(selectedPayment.confirmedAt)}
                  </Text>
                </View>
              )}
              
              {selectedPayment.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailText}>
                    {selectedPayment.notes}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading payment history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <Text style={styles.headerTitle}>Payment History</Text>
      )}
      
      <FlatList
        data={payments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
      
      {renderPaymentDetails()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  paymentItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  methodText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  confirmedByText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  notesText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
    maxHeight: '80%',
    width: '90%',
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
  closeButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
  },
  detailSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 6,
  },
  detailAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default PaymentHistory;