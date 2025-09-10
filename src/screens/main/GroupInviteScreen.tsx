import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Share,
  ScrollView,
  Clipboard,
} from 'react-native';
import { MainStackScreenProps } from '../../navigation/types';

type Props = MainStackScreenProps<'GroupInvite'>;

const GroupInviteScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId } = route.params;
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // Sample invite code and link
  const inviteCode = 'AJT' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const inviteLink = `https://ajoturn.app/join/${groupId}?code=${inviteCode}`;

  const handlePhoneInvite = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    Alert.alert(
      'Invite Sent',
      `SMS invitation sent to ${phoneNumber}`,
      [{ text: 'OK' }]
    );
    setPhoneNumber('');
  };

  const handleEmailInvite = () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    Alert.alert(
      'Invite Sent',
      `Email invitation sent to ${email}`,
      [{ text: 'OK' }]
    );
    setEmail('');
  };

  const handleShareLink = async () => {
    try {
      const shareMessage = message.trim() || 
        `Join my savings group on Ajoturn! Use this link: ${inviteLink} or enter code: ${inviteCode}`;
      
      await Share.share({
        message: shareMessage,
        url: inviteLink,
        title: 'Join my Ajoturn Savings Group',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share invite link');
    }
  };

  const handleCopyCode = () => {
    Clipboard.setString(inviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard');
  };

  const handleCopyLink = () => {
    Clipboard.setString(inviteLink);
    Alert.alert('Copied', 'Invite link copied to clipboard');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite by Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter phone number (+234...)"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.button} onPress={handlePhoneInvite}>
          <Text style={styles.buttonText}>Send SMS Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite by Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.button} onPress={handleEmailInvite}>
          <Text style={styles.buttonText}>Send Email Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share Invite Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{inviteCode}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          Share this code with people you want to invite to your group
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share Invite Link</Text>
        <View style={styles.linkContainer}>
          <Text style={styles.linkText} numberOfLines={2}>{inviteLink}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink}>
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Message (Optional)</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Add a personal message to your invite..."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <TouchableOpacity style={[styles.button, styles.shareButton]} onPress={handleShareLink}>
          <Text style={styles.buttonText}>Share Invitation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Invitations</Text>
        <View style={styles.pendingItem}>
          <Text style={styles.pendingText}>john.doe@example.com</Text>
          <Text style={styles.pendingStatus}>Pending</Text>
        </View>
        <View style={styles.pendingItem}>
          <Text style={styles.pendingText}>+234 801 234 5678</Text>
          <Text style={styles.pendingStatus}>Sent</Text>
        </View>
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
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  messageInput: {
    height: 100,
  },
  button: {
    backgroundColor: '#3182ce',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButton: {
    backgroundColor: '#38a169',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  codeText: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    fontFamily: 'monospace',
  },
  copyButton: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: '#4a5568',
    marginRight: 8,
  },
  pendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pendingText: {
    fontSize: 14,
    color: '#2d3748',
  },
  pendingStatus: {
    fontSize: 12,
    color: '#ed8936',
    backgroundColor: '#fbd38d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});

export default GroupInviteScreen;