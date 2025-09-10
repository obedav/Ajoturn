import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { MainStackScreenProps } from '../../navigation/types';

type Props = MainStackScreenProps<'Help'>;

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const HelpScreen: React.FC<Props> = ({ navigation }) => {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: 'What is Ajoturn and how does it work?',
      answer: 'Ajoturn is a digital savings group app that helps you participate in traditional thrift/susu savings groups. Members contribute a fixed amount regularly, and each member receives the full pool amount in turns according to a predetermined schedule.',
    },
    {
      id: '2',
      question: 'How do I create a savings group?',
      answer: 'Tap the "Create Group" button on your dashboard, fill in the group details including contribution amount, frequency, and member limit. Once created, you can invite members using the invite code or sharing the link.',
    },
    {
      id: '3',
      question: 'How do I join an existing group?',
      answer: 'You can join a group by entering an invite code on the "Join Group" screen, or by clicking on an invitation link shared by a group admin.',
    },
    {
      id: '4',
      question: 'When will I receive my payout?',
      answer: 'Payout order is determined when you join the group. You can check your position in the payout queue on the group details screen. You\'ll receive notifications when it\'s your turn.',
    },
    {
      id: '5',
      question: 'What payment methods are accepted?',
      answer: 'We support bank transfers, card payments, and mobile money. All transactions are secured and encrypted for your safety.',
    },
    {
      id: '6',
      question: 'What happens if someone misses a payment?',
      answer: 'Late payments may affect the group\'s schedule. We track reliability scores for all members. Persistent defaulters may be removed from the group by the admin.',
    },
    {
      id: '7',
      question: 'How is my money protected?',
      answer: 'All funds are held in secure, regulated financial institutions. We use bank-level encryption and security measures to protect your money and personal information.',
    },
    {
      id: '8',
      question: 'Can I leave a group early?',
      answer: 'You can leave a group, but this may affect other members. If you haven\'t received your payout yet, you\'ll forfeit future payouts. If you\'ve already received a payout, you must continue contributing until the cycle completes.',
    },
  ];

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you\'d like to reach us:',
      [
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@ajoturn.app'),
        },
        {
          text: 'WhatsApp',
          onPress: () => Linking.openURL('https://wa.me/2348012345678'),
        },
        {
          text: 'Call',
          onPress: () => Linking.openURL('tel:+2348012345678'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report an Issue',
      'Please describe the issue you\'re experiencing. We\'ll get back to you within 24 hours.',
      [
        {
          text: 'Send Email',
          onPress: () => Linking.openURL('mailto:issues@ajoturn.app?subject=Issue Report'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleVisitWebsite = () => {
    Linking.openURL('https://ajoturn.app');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://ajoturn.app/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://ajoturn.app/terms');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {faqData.map((faq) => (
          <View key={faq.id} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqQuestion}
              onPress={() => toggleFAQ(faq.id)}
            >
              <Text style={styles.questionText}>{faq.question}</Text>
              <Text style={styles.expandIcon}>
                {expandedFAQ === faq.id ? '−' : '+'}
              </Text>
            </TouchableOpacity>
            {expandedFAQ === faq.id && (
              <View style={styles.faqAnswer}>
                <Text style={styles.answerText}>{faq.answer}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Getting Started</Text>
        <TouchableOpacity style={styles.helpItem}>
          <Text style={styles.helpItemText}>📱 Setting up your account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpItem}>
          <Text style={styles.helpItemText}>👥 Creating your first group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpItem}>
          <Text style={styles.helpItemText}>💰 Making your first payment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.helpItem}>
          <Text style={styles.helpItemText}>🔔 Understanding notifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Support</Text>
        
        <TouchableOpacity style={styles.contactButton} onPress={handleContactSupport}>
          <Text style={styles.contactButtonText}>💬 Chat with Support</Text>
          <Text style={styles.contactSubtext}>Available 24/7</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactButton} onPress={handleReportIssue}>
          <Text style={styles.contactButtonText}>🐛 Report an Issue</Text>
          <Text style={styles.contactSubtext}>Help us improve the app</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL('mailto:feedback@ajoturn.app')}>
          <Text style={styles.contactButtonText}>💡 Send Feedback</Text>
          <Text style={styles.contactSubtext}>Share your suggestions</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal & Policies</Text>
        
        <TouchableOpacity style={styles.linkItem} onPress={handlePrivacyPolicy}>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkItem} onPress={handleTermsOfService}>
          <Text style={styles.linkText}>Terms of Service</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkItem} onPress={handleVisitWebsite}>
          <Text style={styles.linkText}>Visit Our Website</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Ajoturn v1.0.0</Text>
        <Text style={styles.footerSubtext}>
          Made with ❤️ for Nigerian savers
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
  faqItem: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
    marginRight: 12,
  },
  expandIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3182ce',
    width: 20,
    textAlign: 'center',
  },
  faqAnswer: {
    paddingLeft: 0,
    paddingBottom: 12,
  },
  answerText: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
  helpItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  helpItemText: {
    fontSize: 16,
    color: '#2d3748',
  },
  contactButton: {
    padding: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  contactSubtext: {
    fontSize: 12,
    color: '#718096',
  },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  linkText: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '500',
  },
  linkArrow: {
    fontSize: 16,
    color: '#718096',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 4,
  },
});

export default HelpScreen;