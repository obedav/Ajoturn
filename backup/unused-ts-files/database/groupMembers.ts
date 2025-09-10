import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { 
  GroupMember, 
  DatabaseResult, 
  PaginatedResult, 
  QueryOptions, 
  FilterOptions 
} from '../../types/database';

class GroupMemberService {
  private collection = db.collection('group_members');

  // Add a member to a group
  async addMember(memberData: Omit<GroupMember, 'id' | 'joined_at' | 'updated_at'>): Promise<DatabaseResult<GroupMember>> {
    try {
      // Check if user is already a member
      const existingMemberSnapshot = await this.collection
        .where('group_id', '==', memberData.group_id)
        .where('user_id', '==', memberData.user_id)
        .limit(1)
        .get();

      if (!existingMemberSnapshot.empty) {
        const existingMember = existingMemberSnapshot.docs[0].data();
        if (existingMember.status === 'active') {
          return {
            success: false,
            error: 'User is already an active member of this group',
          };
        } else if (existingMember.status === 'pending') {
          return {
            success: false,
            error: 'User already has a pending request to join this group',
          };
        }
      }

      // Get the next join order for this group
      const nextJoinOrder = await this.getNextJoinOrder(memberData.group_id);

      const memberDoc: Omit<GroupMember, 'id'> = {
        ...memberData,
        join_order: nextJoinOrder,
        joined_at: new Date(),
        updated_at: new Date(),
        
        // Set default values
        role: memberData.role || 'member',
        can_invite_members: memberData.can_invite_members || false,
        can_view_all_contributions: memberData.can_view_all_contributions || false,
        total_contributions_made: 0,
        missed_contributions: 0,
        late_contributions: 0,
        on_time_contributions: 0,
        reliability_percentage: 100,
        payout_received: false,
        notification_enabled: true,
        auto_contribute: false,
      };

      const docRef = await this.collection.add({
        ...memberDoc,
        joined_at: firestore.FieldValue.serverTimestamp(),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      const createdMember: GroupMember = {
        id: docRef.id,
        ...memberDoc,
      };

      // Update group member count
      await db.collection('groups').doc(memberData.group_id).update({
        total_members: firestore.FieldValue.increment(1),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: createdMember,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get member by ID
  async getMemberById(memberId: string): Promise<DatabaseResult<GroupMember | null>> {
    try {
      const doc = await this.collection.doc(memberId).get();
      
      if (!doc.exists) {
        return {
          success: true,
          data: null,
        };
      }

      const memberData = doc.data() as any;
      const member: GroupMember = {
        id: doc.id,
        ...memberData,
        joined_at: memberData.joined_at?.toDate?.() || new Date(),
        updated_at: memberData.updated_at?.toDate?.() || new Date(),
        payout_date: memberData.payout_date?.toDate?.(),
      };

      return {
        success: true,
        data: member,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get specific user's membership in a group
  async getMemberByUserAndGroup(userId: string, groupId: string): Promise<DatabaseResult<GroupMember | null>> {
    try {
      const snapshot = await this.collection
        .where('user_id', '==', userId)
        .where('group_id', '==', groupId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return {
          success: true,
          data: null,
        };
      }

      const doc = snapshot.docs[0];
      const memberData = doc.data() as any;
      const member: GroupMember = {
        id: doc.id,
        ...memberData,
        joined_at: memberData.joined_at?.toDate?.() || new Date(),
        updated_at: memberData.updated_at?.toDate?.() || new Date(),
        payout_date: memberData.payout_date?.toDate?.(),
      };

      return {
        success: true,
        data: member,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get all members of a group
  async getGroupMembers(
    groupId: string, 
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<GroupMember>>> {
    try {
      const { limit = 50, offset = 0, order_by = 'join_order', order_direction = 'asc' } = options;
      
      let query = this.collection
        .where('group_id', '==', groupId)
        .limit(limit + 1)
        .offset(offset);

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const members: GroupMember[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const memberData = doc.data() as any;
        members.push({
          id: doc.id,
          ...memberData,
          joined_at: memberData.joined_at?.toDate?.() || new Date(),
          updated_at: memberData.updated_at?.toDate?.() || new Date(),
          payout_date: memberData.payout_date?.toDate?.(),
        });
      });

      return {
        success: true,
        data: {
          items: members,
          total_count: snapshot.size,
          has_more: snapshot.docs.length > limit,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get all groups a user is a member of
  async getUserGroups(
    userId: string,
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<GroupMember>>> {
    try {
      const { limit = 20, offset = 0, order_by = 'joined_at', order_direction = 'desc' } = options;
      
      let query = this.collection
        .where('user_id', '==', userId)
        .limit(limit + 1)
        .offset(offset);

      // Apply filters
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }

      // Apply ordering
      query = query.orderBy(order_by, order_direction);

      const snapshot = await query.get();
      const memberships: GroupMember[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const memberData = doc.data() as any;
        memberships.push({
          id: doc.id,
          ...memberData,
          joined_at: memberData.joined_at?.toDate?.() || new Date(),
          updated_at: memberData.updated_at?.toDate?.() || new Date(),
          payout_date: memberData.payout_date?.toDate?.(),
        });
      });

      return {
        success: true,
        data: {
          items: memberships,
          total_count: snapshot.size,
          has_more: snapshot.docs.length > limit,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update member information
  async updateMember(
    memberId: string, 
    updates: Partial<Omit<GroupMember, 'id' | 'joined_at'>>
  ): Promise<DatabaseResult<GroupMember>> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      // Convert date fields
      if (updates.payout_date) {
        updateData.payout_date = firestore.Timestamp.fromDate(updates.payout_date);
      }

      await this.collection.doc(memberId).update(updateData);
      
      // Get updated member
      const result = await this.getMemberById(memberId);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Remove member from group (soft delete)
  async removeMember(memberId: string, adminId?: string): Promise<DatabaseResult<boolean>> {
    try {
      const memberResult = await this.getMemberById(memberId);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: 'Member not found',
        };
      }

      const member = memberResult.data;

      // If adminId is provided, verify admin permission
      if (adminId) {
        const groupDoc = await db.collection('groups').doc(member.group_id).get();
        if (!groupDoc.exists || groupDoc.data()?.admin_id !== adminId) {
          return {
            success: false,
            error: 'Only group admin can remove members',
          };
        }
      }

      await this.collection.doc(memberId).update({
        status: 'removed',
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      // Update group member count
      await db.collection('groups').doc(member.group_id).update({
        total_members: firestore.FieldValue.increment(-1),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update member statistics
  async updateMemberStatistics(
    memberId: string,
    stats: {
      contributionMade?: boolean;
      isLate?: boolean;
      missed?: boolean;
    }
  ): Promise<DatabaseResult<boolean>> {
    try {
      const updates: any = {
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      if (stats.contributionMade) {
        updates.total_contributions_made = firestore.FieldValue.increment(1);
        
        if (stats.isLate) {
          updates.late_contributions = firestore.FieldValue.increment(1);
        } else {
          updates.on_time_contributions = firestore.FieldValue.increment(1);
        }
      }

      if (stats.missed) {
        updates.missed_contributions = firestore.FieldValue.increment(1);
      }

      await this.collection.doc(memberId).update(updates);

      // Recalculate reliability percentage
      await this.updateReliabilityScore(memberId);

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update member reliability score
  async updateReliabilityScore(memberId: string): Promise<DatabaseResult<boolean>> {
    try {
      const memberResult = await this.getMemberById(memberId);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: 'Member not found',
        };
      }

      const member = memberResult.data;
      const totalContributions = member.on_time_contributions + member.late_contributions + member.missed_contributions;
      
      if (totalContributions === 0) {
        return {
          success: true,
          data: true,
        };
      }

      // Calculate reliability: on-time contributions get full points, late get half points, missed get zero
      const reliabilityScore = ((member.on_time_contributions * 1.0 + member.late_contributions * 0.5) / totalContributions) * 100;

      await this.collection.doc(memberId).update({
        reliability_percentage: Math.round(reliabilityScore),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Mark member as having received payout
  async markPayoutReceived(memberId: string, cycleNumber: number): Promise<DatabaseResult<boolean>> {
    try {
      await this.collection.doc(memberId).update({
        payout_received: true,
        payout_cycle: cycleNumber,
        payout_date: firestore.FieldValue.serverTimestamp(),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get next recipient (member whose turn it is to receive payout)
  async getNextRecipient(groupId: string, currentCycle: number): Promise<DatabaseResult<GroupMember | null>> {
    try {
      const snapshot = await this.collection
        .where('group_id', '==', groupId)
        .where('status', '==', 'active')
        .where('join_order', '==', currentCycle)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return {
          success: true,
          data: null,
        };
      }

      const doc = snapshot.docs[0];
      const memberData = doc.data() as any;
      const member: GroupMember = {
        id: doc.id,
        ...memberData,
        joined_at: memberData.joined_at?.toDate?.() || new Date(),
        updated_at: memberData.updated_at?.toDate?.() || new Date(),
        payout_date: memberData.payout_date?.toDate?.(),
      };

      return {
        success: true,
        data: member,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update member role (admin only)
  async updateMemberRole(
    memberId: string, 
    newRole: 'admin' | 'member' | 'treasurer',
    adminId: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      const memberResult = await this.getMemberById(memberId);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: 'Member not found',
        };
      }

      const member = memberResult.data;

      // Verify admin permission
      const groupDoc = await db.collection('groups').doc(member.group_id).get();
      if (!groupDoc.exists || groupDoc.data()?.admin_id !== adminId) {
        return {
          success: false,
          error: 'Only group admin can update member roles',
        };
      }

      // Set permissions based on role
      let permissions = {
        can_invite_members: false,
        can_view_all_contributions: false,
      };

      switch (newRole) {
        case 'admin':
          permissions = {
            can_invite_members: true,
            can_view_all_contributions: true,
          };
          break;
        case 'treasurer':
          permissions = {
            can_invite_members: false,
            can_view_all_contributions: true,
          };
          break;
        case 'member':
        default:
          permissions = {
            can_invite_members: false,
            can_view_all_contributions: false,
          };
          break;
      }

      await this.collection.doc(memberId).update({
        role: newRole,
        ...permissions,
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Real-time listener for group member updates
  onGroupMembersUpdates(groupId: string, callback: (members: GroupMember[]) => void): () => void {
    return this.collection
      .where('group_id', '==', groupId)
      .orderBy('join_order', 'asc')
      .onSnapshot(
        (snapshot) => {
          const members: GroupMember[] = snapshot.docs.map(doc => {
            const memberData = doc.data() as any;
            return {
              id: doc.id,
              ...memberData,
              joined_at: memberData.joined_at?.toDate?.() || new Date(),
              updated_at: memberData.updated_at?.toDate?.() || new Date(),
              payout_date: memberData.payout_date?.toDate?.(),
            };
          });
          callback(members);
        },
        (error) => {
          console.error('Error listening to group members updates:', error);
          callback([]);
        }
      );
  }

  // Get next available join order for a group
  private async getNextJoinOrder(groupId: string): Promise<number> {
    try {
      const snapshot = await this.collection
        .where('group_id', '==', groupId)
        .orderBy('join_order', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return 1;
      }

      const lastMember = snapshot.docs[0].data();
      return (lastMember.join_order || 0) + 1;
    } catch (error) {
      console.error('Error getting next join order:', error);
      return 1;
    }
  }

  // Batch update multiple members
  async batchUpdateMembers(
    updates: Array<{ memberId: string; data: Partial<GroupMember> }>
  ): Promise<DatabaseResult<boolean>> {
    try {
      const batch = db.batch();

      updates.forEach(({ memberId, data }) => {
        const memberRef = this.collection.doc(memberId);
        batch.update(memberRef, {
          ...data,
          updated_at: firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }
}

export default new GroupMemberService();