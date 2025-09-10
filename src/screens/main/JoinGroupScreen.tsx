import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainStackScreenProps } from '../../navigation/types';
// import DatabaseService from '../../services/database';
import AuthService from '../../services/auth';
import GroupInviteService from '../../services/groupInvites';

const JoinGroupScreen: React.FC<MainStackScreenProps<'JoinGroup'>> = ({ navigation, route }) => {
  const [groupCode, setGroupCode] = useState(route.params?.groupCode || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<NavigationGroup[]>([]);
  const [searchResults, setSearchResults] = useState<NavigationGroup[]>([]);
  const [validatedGroup, setValidatedGroup] = useState<any>(null);
  const [codeError, setCodeError] = useState<string>('');

  const loadAvailableGroups = async () => {
    setIsLoading(true);
    try {
      const result = await DatabaseService.groups.getActiveGroups({ limit: 10 });
      if (result.success && result.data) {
        const groups = result.data.items.map(group => ({
          ...group,
          memberCount: group.total_members,
        }));
        setAvailableGroups(groups);
        setSearchResults(groups);
      }
    } catch (error) {
      console.error('Error loading available groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateInviteCode = async (code: string) => {
    if (!code || code.length !== 6) {
      setValidatedGroup(null);
      setCodeError('');
      return;
    }

    try {
      const result = await GroupInviteService.validateInviteCode(code);
      if (result.success && result.data?.isValid && result.data.group) {
        setValidatedGroup(result.data.group);
        setCodeError('');
      } else {
        setValidatedGroup(null);
        setCodeError(result.data?.error || 'Invalid invite code');
      }
    } catch (error) {
      setValidatedGroup(null);
      setCodeError('Failed to validate invite code');
    }
  };

  const searchGroups = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(availableGroups);
      return;
    }

    setIsLoading(true);
    try {
      const result = await DatabaseService.groups.searchGroups(query, { limit: 10 });
      if (result.success && result.data) {
        const groups = result.data.items.map(group => ({
          ...group,
          memberCount: group.total_members,
        }));
        setSearchResults(groups);
      }
    } catch (error) {
      console.error('Error searching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!groupCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    if (!validatedGroup) {
      Alert.alert('Error', codeError || 'Please enter a valid invite code');
      return;
    }

    setIsJoining(true);
    try {
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'Please log in to join a group');
        return;
      }

      const result = await GroupInviteService.useInviteCode(groupCode.trim().toUpperCase(), currentUser.uid);
      
      if (result.success && result.data) {
        Alert.alert(
          'Success!',
          result.data.message || 'Successfully joined the group!',
          [
            {
              text: 'Go to Group',
              onPress: () => navigation.replace('GroupDetails', { groupId: result.data.group.id }),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group by code:', error);
      Alert.alert('Error', 'An error occurred while joining the group');
    } finally {
      setIsJoining(false);
    }
  };

  const joinGroup = async (group: any) => {
    try {
      const currentUser = AuthService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const userProfile = await AuthService.getUserProfile(currentUser.uid);
      if (!userProfile) {
        Alert.alert('Error', 'User profile not found');
        return;
      }

      // Check if group is full
      if (group.total_members >= group.max_members) {
        Alert.alert('Group Full', 'This group has reached its maximum capacity.');
        return;
      }

      // Check if user is already a member
      const existingMembership = await DatabaseService.groupMembers.getMemberByUserAndGroup(
        currentUser.uid,
        group.id
      );

      if (existingMembership.success && existingMembership.data) {
        Alert.alert('Already a Member', 'You are already a member of this group.');
        return;
      }

      const result = await DatabaseService.joinGroup(
        group.id,
        currentUser.uid,
        userProfile.name
      );

      if (result.success && result.data) {
        Alert.alert(
          'Success',
          'You have successfully joined the group!',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.replace('GroupDetails', { groupId: group.id });
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  useEffect(() => {
    loadAvailableGroups();
  }, []);

  useEffect(() => {
    if (groupCode && groupCode.length >= 6) {
      validateInviteCode(groupCode);
    } else {
      setValidatedGroup(null);
      setCodeError('');
    }
  }, [groupCode]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchGroups(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderGroupCard = ({ item }: { item: NavigationGroup }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => {
        Alert.alert(
          'Join Group',
          `Do you want to join "${item.name}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Join', 
              onPress: () => joinGroup(item),
              style: 'default'
            },
          ]
        );
      }}
    >
      <View style={styles.groupCardHeader}>
        <View style={styles.groupIcon}>
          <Text style={styles.groupIconText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.groupDetails}>
            {formatCurrency(item.contribution_amount)} • {item.contribution_frequency}
          </Text>
          <Text style={styles.groupMembers}>
            {item.memberCount}/{item.max_members} members
          </Text>
        </View>
        <Icon name="add-circle-outline" size={24} color="#1E40AF" />
      </View>
      
      {item.description && (
        <Text style={styles.groupDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      
      <View style={styles.groupCardFooter}>
        <View style={styles.groupTags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Active</Text>
          </View>
          {item.memberCount < item.max_members && (
            <View style={[styles.tag, styles.openTag]}>
              <Text style={[styles.tagText, styles.openTagText]}>Open</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Join by Code Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="qr-code" size={24} color="#1E40AF" />
            <Text style={styles.sectionTitle}>Join by Code</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Enter the group code shared by your group admin
          </Text>
          
          <View style={styles.codeInputContainer}>
            <View style={styles.inputContainer}>
              <Icon name="vpn-key" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter group code"
                value={groupCode}
                onChangeText={setGroupCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.joinButton, (!groupCode.trim() || isJoining) && styles.joinButtonDisabled]}
              onPress={handleJoinByCode}
              disabled={!groupCode.trim() || isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.joinButtonText}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Invite Code Validation */}
          {groupCode.length > 0 && (
            <View style={styles.validationContainer}>
              {codeError ? (
                <View style={styles.errorContainer}>
                  <Icon name="error" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{codeError}</Text>
                </View>
              ) : validatedGroup ? (
                <View style={styles.groupPreview}>
                  <View style={styles.successContainer}>
                    <Icon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.successText}>Valid invite code!</Text>
                  </View>
                  <View style={styles.previewCard}>
                    <View style={styles.previewHeader}>
                      <View style={styles.previewIcon}>
                        <Text style={styles.previewIconText}>
                          {validatedGroup.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.previewInfo}>
                        <Text style={styles.previewName}>{validatedGroup.name}</Text>
                        <Text style={styles.previewDetails}>
                          {formatCurrency(validatedGroup.contribution_amount)} • {validatedGroup.contribution_frequency}
                        </Text>
                        <Text style={styles.previewMembers}>
                          {validatedGroup.total_members}/{validatedGroup.max_members} members
                        </Text>
                      </View>
                    </View>
                    {validatedGroup.description && (
                      <Text style={styles.previewDescription} numberOfLines={2}>
                        {validatedGroup.description}
                      </Text>
                    )}
                  </View>
                </View>
              ) : groupCode.length >= 6 ? (
                <View style={styles.validatingContainer}>
                  <ActivityIndicator size="small" color="#6B7280" />
                  <Text style={styles.validatingText}>Validating code...</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Browse Groups Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="search" size={24} color="#1E40AF" />
            <Text style={styles.sectionTitle}>Browse Groups</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Discover and join public savings groups
          </Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Search groups by name"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Groups List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1E40AF" />
              <Text style={styles.loadingText}>Loading groups...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderGroupCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.groupsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Icon name="group" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No groups found' : 'No available groups'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery 
                  ? 'Try searching with different keywords'
                  : 'Check back later for new groups or create your own'
                }
              </Text>
            </View>
          )}
        </View>

        {/* Create Group CTA */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Don't see the right group?</Text>
          <Text style={styles.ctaSubtitle}>
            Create your own savings group and invite your friends
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('CreateGroup')}
          >
            <Icon name="add" size={20} color="#1E40AF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    padding: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  codeInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  joinButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  groupsList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  groupDetails: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 12,
    color: '#6B7280',
  },
  groupDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  groupCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  openTag: {
    backgroundColor: '#D1FAE5',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  openTagText: {
    color: '#065F46',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  // Validation Styles
  validationContainer: {
    marginTop: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  successText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '500',
  },
  validatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  validatingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  groupPreview: {
    // Container for the success message and preview card
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  previewDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  previewMembers: {
    fontSize: 12,
    color: '#6B7280',
  },
  previewDescription: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
});

export default JoinGroupScreen;