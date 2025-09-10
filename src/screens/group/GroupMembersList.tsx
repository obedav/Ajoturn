import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../context/AppContext';
import GroupManagementService, { GroupMemberDetailed } from '../../services/business/groupManagement';

interface GroupMembersListProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
      groupName: string;
      userRole: 'admin' | 'member';
    };
  };
}

const GroupMembersList: React.FC<GroupMembersListProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { groupId, groupName, userRole } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<GroupMemberDetailed[]>([]);
  const [selectedMember, setSelectedMember] = useState<GroupMemberDetailed | null>(null);
  const [memberDetailsModal, setMemberDetailsModal] = useState(false);
  const [sortBy, setSortBy] = useState<'joinOrder' | 'name' | 'reliability'>('joinOrder');
  const [showFinancials, setShowFinancials] = useState(false);

  // Animation for turn order visualization
  const [turnAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    loadMembers();
    startTurnAnimation();
  }, [groupId]);

  const loadMembers = async () => {
    try {
      if (!user) return;

      const result = await GroupManagementService.getGroupMembersDetailed({
        userId: user.uid,
        groupId,
        includeFinancials: userRole === 'admin' || showFinancials,
      });

      if (result.success) {
        setMembers(result.data);
      } else {
        Alert.alert('Error', result.error || 'Failed to load members');
      }
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const startTurnAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(turnAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(turnAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const getSortedMembers = () => {
    const sortedMembers = [...members];
    
    switch (sortBy) {
      case 'name':
        return sortedMembers.sort((a, b) => a.displayName.localeCompare(b.displayName));
      case 'reliability':
        return sortedMembers.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
      case 'joinOrder':
      default:
        return sortedMembers.sort((a, b) => a.joinOrder - b.joinOrder);
    }
  };

  const getCurrentRecipient = () => {
    // Mock current cycle recipient (in production, this would be calculated)
    return members.find(m => m.joinOrder === 3); // Assuming member 3 is current
  };

  const getNextRecipient = () => {
    const current = getCurrentRecipient();
    if (!current) return members[0];
    
    const nextOrder = current.joinOrder + 1;
    const next = members.find(m => m.joinOrder === nextOrder);
    return next || members.find(m => m.joinOrder === 1); // Cycle back to first
  };

  const handleMemberPress = (member: GroupMemberDetailed) => {
    setSelectedMember(member);
    setMemberDetailsModal(true);
  };

  const handleRemoveMember = async (member: GroupMemberDetailed) => {
    if (userRole !== 'admin' || !user) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.displayName}? This will adjust the turn order for all subsequent members.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await GroupManagementService.removeMember({
                adminId: user.uid,
                groupId,
                memberId: member.userId,
                reason: 'other',
                redistributeTurn: true,
                refundContributions: false,
              });

              if (result.success) {
                Alert.alert('Success', 'Member removed successfully');
                await loadMembers();
              } else {
                Alert.alert('Error', result.error || 'Failed to remove member');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const renderTurnOrderVisualization = () => {
    const currentRecipient = getCurrentRecipient();
    const nextRecipient = getNextRecipient();

    return (
      <View style={styles.turnOrderContainer}>
        <Text style={styles.turnOrderTitle}>Turn Order Progress</Text>
        
        <View style={styles.progressVisualization}>
          {members.slice(0, 8).map((member, index) => {
            const isCurrent = member.id === currentRecipient?.id;
            const isNext = member.id === nextRecipient?.id;
            const isPast = member.joinOrder < (currentRecipient?.joinOrder || 1);
            
            const animatedScale = turnAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, isCurrent ? 1.2 : 1],
            });

            return (
              <View key={member.id} style={styles.turnPositionContainer}>
                <Animated.View
                  style={[
                    styles.turnPosition,
                    isPast && styles.completedTurn,
                    isCurrent && styles.currentTurn,
                    isNext && styles.nextTurn,
                    { transform: [{ scale: animatedScale }] },
                  ]}
                >
                  <Text style={[
                    styles.turnPositionText,
                    (isCurrent || isNext) && styles.activeTurnText,
                  ]}>
                    {member.joinOrder}
                  </Text>
                </Animated.View>
                <Text style={[
                  styles.memberTurnName,
                  isCurrent && styles.currentMemberName,
                  isNext && styles.nextMemberName,
                ]}>
                  {member.displayName.split(' ')[0]}
                </Text>
                {isCurrent && (
                  <Text style={styles.currentLabel}>Current</Text>
                )}
                {isNext && (
                  <Text style={styles.nextLabel}>Next</Text>
                )}
              </View>
            );
          })}
        </View>

        {members.length > 8 && (
          <Text style={styles.moreMembers}>
            +{members.length - 8} more members
          </Text>
        )}
      </View>
    );
  };

  const renderSortButtons = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.sortLabel}>Sort by:</Text>
      <TouchableOpacity
        style={[styles.sortButton, sortBy === 'joinOrder' && styles.activeSortButton]}
        onPress={() => setSortBy('joinOrder')}
      >
        <Icon name="format-list-numbered" size={16} color={sortBy === 'joinOrder' ? '#fff' : '#666'} />
        <Text style={[
          styles.sortButtonText,
          sortBy === 'joinOrder' && styles.activeSortText
        ]}>
          Turn Order
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.sortButton, sortBy === 'name' && styles.activeSortButton]}
        onPress={() => setSortBy('name')}
      >
        <Icon name="sort-by-alpha" size={16} color={sortBy === 'name' ? '#fff' : '#666'} />
        <Text style={[
          styles.sortButtonText,
          sortBy === 'name' && styles.activeSortText
        ]}>
          Name
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.sortButton, sortBy === 'reliability' && styles.activeSortButton]}
        onPress={() => setSortBy('reliability')}
      >
        <Icon name="star" size={16} color={sortBy === 'reliability' ? '#fff' : '#666'} />
        <Text style={[
          styles.sortButtonText,
          sortBy === 'reliability' && styles.activeSortText
        ]}>
          Reliability
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderMemberCard = (member: GroupMemberDetailed, index: number) => {
    const isCurrent = getCurrentRecipient()?.id === member.id;
    const isNext = getNextRecipient()?.id === member.id;

    return (
      <TouchableOpacity
        key={member.id}
        style={[
          styles.memberCard,
          isCurrent && styles.currentMemberCard,
          isNext && styles.nextMemberCard,
        ]}
        onPress={() => handleMemberPress(member)}
      >
        <View style={styles.memberCardHeader}>
          <View style={styles.memberMainInfo}>
            <View style={[
              styles.memberAvatar,
              isCurrent && styles.currentMemberAvatar,
              isNext && styles.nextMemberAvatar,
            ]}>
              <Text style={styles.memberAvatarText}>
                {member.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.memberInfo}>
              <View style={styles.memberNameContainer}>
                <Text style={styles.memberName}>{member.displayName}</Text>
                {member.role === 'admin' && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.memberEmail}>{member.email}</Text>
              
              <View style={styles.memberStats}>
                <View style={styles.statItem}>
                  <Icon name="format-list-numbered" size={14} color="#666" />
                  <Text style={styles.statText}>Turn #{member.joinOrder}</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="star" size={14} color="#FF9800" />
                  <Text style={styles.statText}>{member.reliabilityScore}%</Text>
                </View>
                {member.status !== 'active' && (
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: member.status === 'suspended' ? '#F44336' : '#FF9800' }
                  ]}>
                    <Text style={styles.statusText}>
                      {member.status.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.memberActions}>
            {isCurrent && (
              <View style={styles.currentIndicator}>
                <Icon name="play-circle-filled" size={20} color="#4CAF50" />
                <Text style={styles.currentText}>Current</Text>
              </View>
            )}
            {isNext && (
              <View style={styles.nextIndicator}>
                <Icon name="schedule" size={20} color="#2196F3" />
                <Text style={styles.nextText}>Next</Text>
              </View>
            )}
            
            {userRole === 'admin' && member.role !== 'admin' && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveMember(member)}
              >
                <Icon name="more-vert" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Financial Summary (if enabled) */}
        {(showFinancials || userRole === 'admin') && (
          <View style={styles.financialSummary}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Contributed</Text>
              <Text style={styles.financialValue}>
                UGX {member.totalContributions.toLocaleString()}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Received</Text>
              <Text style={styles.financialValue}>
                UGX {member.totalReceived.toLocaleString()}
              </Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>Last Payment</Text>
              <Text style={styles.financialValue}>
                {member.lastPaymentDate 
                  ? member.lastPaymentDate.toLocaleDateString()
                  : 'None'
                }
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading members...</Text>
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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Members</Text>
          <Text style={styles.headerSubtitle}>
            {groupName} • {members.length} members
          </Text>
        </View>
        {userRole === 'admin' && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => navigation.navigate('GroupAdminControls', {
              groupId,
              groupName,
            })}
          >
            <Icon name="admin-panel-settings" size={24} color="#FF9800" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Turn Order Visualization */}
        {renderTurnOrderVisualization()}

        {/* Controls */}
        <View style={styles.controls}>
          {renderSortButtons()}
          
          {userRole === 'admin' && (
            <TouchableOpacity
              style={styles.toggleFinancialsButton}
              onPress={() => setShowFinancials(!showFinancials)}
            >
              <Icon 
                name={showFinancials ? 'visibility-off' : 'visibility'} 
                size={16} 
                color="#666" 
              />
              <Text style={styles.toggleText}>
                {showFinancials ? 'Hide' : 'Show'} Financials
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Members List */}
        <View style={styles.membersList}>
          {getSortedMembers().map((member, index) => renderMemberCard(member, index))}
        </View>
      </ScrollView>

      {/* Member Details Modal */}
      <Modal
        visible={memberDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setMemberDetailsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedMember && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalMemberInfo}>
                    <View style={styles.modalAvatar}>
                      <Text style={styles.modalAvatarText}>
                        {selectedMember.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.modalMemberName}>
                        {selectedMember.displayName}
                      </Text>
                      <Text style={styles.modalMemberEmail}>
                        {selectedMember.email}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setMemberDetailsModal(false)}>
                    <Icon name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Turn Position</Text>
                    <Text style={styles.detailValue}>#{selectedMember.joinOrder}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Joined Date</Text>
                    <Text style={styles.detailValue}>
                      {selectedMember.joinDate.toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={[
                      styles.detailValue,
                      { color: selectedMember.status === 'active' ? '#4CAF50' : '#FF9800' }
                    ]}>
                      {selectedMember.status.toUpperCase()}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reliability Score</Text>
                    <Text style={styles.detailValue}>
                      {selectedMember.reliabilityScore}%
                    </Text>
                  </View>

                  {(showFinancials || userRole === 'admin') && (
                    <>
                      <View style={styles.detailDivider} />
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Contributed</Text>
                        <Text style={styles.detailValue}>
                          UGX {selectedMember.totalContributions.toLocaleString()}
                        </Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Received</Text>
                        <Text style={styles.detailValue}>
                          UGX {selectedMember.totalReceived.toLocaleString()}
                        </Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Has Received Payout</Text>
                        <Text style={[
                          styles.detailValue,
                          { color: selectedMember.hasReceivedPayout ? '#4CAF50' : '#666' }
                        ]}>
                          {selectedMember.hasReceivedPayout ? 'Yes' : 'Not yet'}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  adminButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  turnOrderContainer: {
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
  turnOrderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressVisualization: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  turnPositionContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  turnPosition: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  completedTurn: {
    backgroundColor: '#4CAF50',
  },
  currentTurn: {
    backgroundColor: '#2196F3',
  },
  nextTurn: {
    backgroundColor: '#FF9800',
  },
  turnPositionText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  activeTurnText: {
    color: '#fff',
  },
  memberTurnName: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    maxWidth: 50,
  },
  currentMemberName: {
    color: '#2196F3',
    fontWeight: '600',
  },
  nextMemberName: {
    color: '#FF9800',
    fontWeight: '600',
  },
  currentLabel: {
    fontSize: 8,
    color: '#2196F3',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  nextLabel: {
    fontSize: 8,
    color: '#FF9800',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  moreMembers: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  controls: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    gap: 4,
  },
  activeSortButton: {
    backgroundColor: '#2196F3',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeSortText: {
    color: '#fff',
  },
  toggleFinancialsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
  },
  membersList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  currentMemberCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  nextMemberCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberMainInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentMemberAvatar: {
    backgroundColor: '#4CAF50',
  },
  nextMemberAvatar: {
    backgroundColor: '#FF9800',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  adminBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  memberStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  memberActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  currentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  currentText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  nextIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  nextText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  financialSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  financialItem: {
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    width: '90%',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalMemberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalMemberEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
});

export default GroupMembersList;