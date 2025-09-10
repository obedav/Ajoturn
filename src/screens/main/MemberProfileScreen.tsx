import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { MainStackScreenProps } from '../../navigation/types';

type Props = MainStackScreenProps<'MemberProfile'>;

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  paymentHistory: Array<{
    amount: number;
    date: string;
    status: 'completed' | 'pending' | 'failed';
  }>;
  reliability: number;
  totalContributions: number;
}

const MemberProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId, groupId } = route.params;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading member data
    setTimeout(() => {
      setMember({
        id: userId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+234 801 234 5678',
        joinDate: '2024-01-15',
        paymentHistory: [
          { amount: 50000, date: '2024-03-01', status: 'completed' },
          { amount: 50000, date: '2024-02-01', status: 'completed' },
          { amount: 50000, date: '2024-01-01', status: 'completed' },
        ],
        reliability: 98,
        totalContributions: 150000,
      });
      setLoading(false);
    }, 1000);
  }, [userId]);

  const handleRemoveMember = () => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleSendMessage = () => {
    Alert.alert('Send Message', 'Message feature coming soon!');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading member profile...</Text>
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Member not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {member.name.split(' ').map(n => n[0]).join('')}
          </Text>
        </View>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberEmail}>{member.email}</Text>
        <Text style={styles.memberPhone}>{member.phone}</Text>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>₦{member.totalContributions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Contributions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{member.reliability}%</Text>
          <Text style={styles.statLabel}>Reliability Score</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{member.paymentHistory.length}</Text>
          <Text style={styles.statLabel}>Payments Made</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Member Information</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Join Date</Text>
          <Text style={styles.infoValue}>{member.joinDate}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Member ID</Text>
          <Text style={styles.infoValue}>{member.id}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Payment History</Text>
        {member.paymentHistory.map((payment, index) => (
          <View key={index} style={styles.paymentItem}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentAmount}>₦{payment.amount.toLocaleString()}</Text>
              <Text style={styles.paymentDate}>{payment.date}</Text>
            </View>
            <View style={[styles.paymentStatus, styles[`status${payment.status}`]]}>
              <Text style={styles.paymentStatusText}>{payment.status}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.actionButton} onPress={handleSendMessage}>
          <Text style={styles.actionButtonText}>Send Message</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleRemoveMember}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>Remove Member</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
  },
  profileSection: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    padding: 24,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  memberName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 2,
  },
  memberPhone: {
    fontSize: 14,
    color: '#718096',
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#718096',
  },
  infoValue: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  paymentDate: {
    fontSize: 12,
    color: '#718096',
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statuscompleted: {
    backgroundColor: '#c6f6d5',
  },
  statuspending: {
    backgroundColor: '#fbd38d',
  },
  statusfailed: {
    backgroundColor: '#fed7d7',
  },
  actionsSection: {
    margin: 16,
    marginTop: 0,
  },
  actionButton: {
    backgroundColor: '#3182ce',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: '#e53e3e',
  },
  dangerText: {
    color: '#ffffff',
  },
});

export default MemberProfileScreen;