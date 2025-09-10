import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MainStackScreenProps } from '../../navigation/types';

type Props = MainStackScreenProps<'PaymentConfirmation'>;

const PaymentConfirmationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { paymentId, amount, recipient } = route.params;
  const scaleValue = new Animated.Value(0);
  const fadeValue = new Animated.Value(0);

  useEffect(() => {
    // Animation sequence
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGoToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  const handleViewPaymentHistory = () => {
    navigation.navigate('PaymentHistory', {});
  };

  const handleShareReceipt = () => {
    // Implement share functionality
    console.log('Share receipt');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.successIcon,
            { transform: [{ scale: scaleValue }] }
          ]}
        >
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>

        <Animated.View style={[styles.details, { opacity: fadeValue }]}>
          <Text style={styles.title}>Payment Successful!</Text>
          <Text style={styles.subtitle}>Your contribution has been recorded</Text>

          <View style={styles.paymentInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment ID</Text>
              <Text style={styles.infoValue}>{paymentId}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount</Text>
              <Text style={styles.amountValue}>₦{amount.toLocaleString()}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recipient</Text>
              <Text style={styles.infoValue}>{recipient}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date & Time</Text>
              <Text style={styles.infoValue}>
                {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Completed</Text>
              </View>
            </View>
          </View>

          <View style={styles.messageBox}>
            <Text style={styles.messageText}>
              🎉 Great job! Your payment has been successfully processed and added to the group fund. 
              You'll receive a notification when it's your turn to receive the payout.
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryButton]} 
              onPress={handleGoToDashboard}
            >
              <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]} 
              onPress={handleViewPaymentHistory}
            >
              <Text style={styles.secondaryButtonText}>View Payment History</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.tertiaryButton]} 
              onPress={handleShareReceipt}
            >
              <Text style={styles.tertiaryButtonText}>Share Receipt</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#38a169',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#38a169',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkmark: {
    fontSize: 48,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  details: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 32,
    textAlign: 'center',
  },
  paymentInfo: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#718096',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: 18,
    color: '#38a169',
    fontWeight: 'bold',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    backgroundColor: '#c6f6d5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#38a169',
    fontWeight: 'bold',
  },
  messageBox: {
    backgroundColor: '#e6fffa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#38a169',
  },
  messageText: {
    fontSize: 14,
    color: '#2d3748',
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3182ce',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#3182ce',
  },
  secondaryButtonText: {
    color: '#3182ce',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
  },
  tertiaryButtonText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PaymentConfirmationScreen;