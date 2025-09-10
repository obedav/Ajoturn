import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { MainStackScreenProps } from '../../navigation/types';

type Props = MainStackScreenProps<'GroupSettings'>;

const GroupSettingsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId } = route.params;
  const [allowInvites, setAllowInvites] = useState(true);
  const [publicGroup, setPublicGroup] = useState(false);
  const [autoPayouts, setAutoPayouts] = useState(true);

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            navigation.goBack();
          }
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: () => {
            navigation.navigate('MainTabs');
          }
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group Preferences</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Allow member invites</Text>
          <Switch
            value={allowInvites}
            onValueChange={setAllowInvites}
            trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
            thumbColor={allowInvites ? '#ffffff' : '#f4f4f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Public group</Text>
          <Switch
            value={publicGroup}
            onValueChange={setPublicGroup}
            trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
            thumbColor={publicGroup ? '#ffffff' : '#f4f4f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Automatic payouts</Text>
          <Switch
            value={autoPayouts}
            onValueChange={setAutoPayouts}
            trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
            thumbColor={autoPayouts ? '#ffffff' : '#f4f4f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group Management</Text>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('GroupInvite', { groupId })}
        >
          <Text style={styles.actionButtonText}>Invite Members</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Export Group Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Group Rules</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.warningButton]}
          onPress={handleLeaveGroup}
        >
          <Text style={[styles.actionButtonText, styles.warningText]}>Leave Group</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleDeleteGroup}
        >
          <Text style={[styles.actionButtonText, styles.dangerText]}>Delete Group</Text>
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#4a5568',
  },
  actionButton: {
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
  },
  warningButton: {
    backgroundColor: '#fff5f5',
    borderColor: '#fed7d7',
  },
  warningText: {
    color: '#c53030',
  },
  dangerButton: {
    backgroundColor: '#fed7d7',
    borderColor: '#f56565',
  },
  dangerText: {
    color: '#c53030',
    fontWeight: 'bold',
  },
});

export default GroupSettingsScreen;