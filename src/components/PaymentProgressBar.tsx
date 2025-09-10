import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface PaymentProgressBarProps {
  totalMembers: number;
  confirmedCount: number;
  totalAmount: number;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

const PaymentProgressBar: React.FC<PaymentProgressBarProps> = ({
  totalMembers,
  confirmedCount,
  totalAmount,
  showDetails = true,
  size = 'medium',
  style,
}) => {
  const progressPercentage = totalMembers > 0 ? (confirmedCount / totalMembers) * 100 : 0;
  const isComplete = confirmedCount === totalMembers;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getBarHeight = () => {
    switch (size) {
      case 'small': return 6;
      case 'medium': return 8;
      case 'large': return 12;
      default: return 8;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small': return { main: 12, sub: 10 };
      case 'medium': return { main: 14, sub: 12 };
      case 'large': return { main: 16, sub: 14 };
      default: return { main: 14, sub: 12 };
    }
  };

  const textSizes = getTextSize();

  return (
    <View style={[styles.container, style]}>
      {showDetails && (
        <View style={styles.header}>
          <View style={styles.statusContainer}>
            <Icon
              name={isComplete ? 'check-circle' : 'schedule'}
              size={20}
              color={isComplete ? '#4CAF50' : '#FF9800'}
            />
            <Text style={[styles.statusText, { fontSize: textSizes.main }]}>
              {isComplete ? 'Complete' : 'In Progress'}
            </Text>
          </View>
          <Text style={[styles.countText, { fontSize: textSizes.main }]}>
            {confirmedCount}/{totalMembers}
          </Text>
        </View>
      )}
      
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { height: getBarHeight() }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercentage}%`,
                backgroundColor: isComplete ? '#4CAF50' : '#2196F3',
              },
            ]}
          />
        </View>
        <Text style={[styles.percentageText, { fontSize: textSizes.sub }]}>
          {Math.round(progressPercentage)}%
        </Text>
      </View>

      {showDetails && (
        <View style={styles.details}>
          <Text style={[styles.memberText, { fontSize: textSizes.sub }]}>
            {confirmedCount} of {totalMembers} members paid
          </Text>
          {totalAmount > 0 && (
            <Text style={[styles.amountText, { fontSize: textSizes.sub }]}>
              Total: {formatCurrency(totalAmount)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  header: {
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
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  countText: {
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  percentageText: {
    color: '#666',
    fontWeight: '500',
    minWidth: 35,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberText: {
    color: '#666',
  },
  amountText: {
    color: '#333',
    fontWeight: '500',
  },
});

export default PaymentProgressBar;