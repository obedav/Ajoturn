import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Group, 
  DatabaseResult, 
  PaginatedResult, 
  QueryOptions, 
  FilterOptions,
  GroupStatistics,
  CycleInfo
} from '../../types/database';

class GroupService {
  private collection = db.collection('groups');

  // Create a new group
  async createGroup(groupData: Omit<Group, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseResult<Group>> {
    try {
      const groupDoc: Omit<Group, 'id'> = {
        ...groupData,
        created_at: new Date(),
        updated_at: new Date(),
        
        // Set default values
        total_members: 1, // Creator is the first member
        current_cycle: 1,
        cycle_start_date: groupData.start_date,
        cycle_end_date: this.calculateCycleEndDate(
          groupData.start_date, 
          groupData.contribution_frequency
        ),
        
        // Default group settings
        grace_period_days: groupData.grace_period_days || 3,
        
        // Initialize stats
        total_contributions_collected: 0,
        total_payouts_made: 0,
        successful_cycles: 0,
      };

      const docRef = await this.collection.add({
        ...groupDoc,
        created_at: firestore.FieldValue.serverTimestamp(),
        updated_at: firestore.FieldValue.serverTimestamp(),
        start_date: firestore.Timestamp.fromDate(groupDoc.start_date),
        estimated_end_date: firestore.Timestamp.fromDate(groupDoc.estimated_end_date),
        cycle_start_date: firestore.Timestamp.fromDate(groupDoc.cycle_start_date),
        cycle_end_date: firestore.Timestamp.fromDate(groupDoc.cycle_end_date),
      });

      const createdGroup: Group = {
        id: docRef.id,
        ...groupDoc,
      };

      return {
        success: true,
        data: createdGroup,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get group by ID
  async getGroupById(groupId: string): Promise<DatabaseResult<Group | null>> {
    try {
      const doc = await this.collection.doc(groupId).get();
      
      if (!doc.exists) {
        return {
          success: true,
          data: null,
        };
      }

      const groupData = doc.data() as any;
      const group: Group = {
        id: doc.id,
        ...groupData,
        created_at: groupData.created_at?.toDate?.() || new Date(),
        updated_at: groupData.updated_at?.toDate?.() || new Date(),
        start_date: groupData.start_date?.toDate?.() || new Date(),
        estimated_end_date: groupData.estimated_end_date?.toDate?.() || new Date(),
        cycle_start_date: groupData.cycle_start_date?.toDate?.() || new Date(),
        cycle_end_date: groupData.cycle_end_date?.toDate?.() || new Date(),
      };

      return {
        success: true,
        data: group,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update group
  async updateGroup(groupId: string, updates: Partial<Omit<Group, 'id' | 'created_at'>>): Promise<DatabaseResult<Group>> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      // Convert dates to Firestore timestamps
      if (updates.start_date) {
        updateData.start_date = firestore.Timestamp.fromDate(updates.start_date);
      }
      if (updates.estimated_end_date) {
        updateData.estimated_end_date = firestore.Timestamp.fromDate(updates.estimated_end_date);
      }
      if (updates.cycle_start_date) {
        updateData.cycle_start_date = firestore.Timestamp.fromDate(updates.cycle_start_date);
      }
      if (updates.cycle_end_date) {
        updateData.cycle_end_date = firestore.Timestamp.fromDate(updates.cycle_end_date);
      }

      await this.collection.doc(groupId).update(updateData);
      
      // Get updated group
      const result = await this.getGroupById(groupId);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Delete group (soft delete by marking as cancelled)
  async deleteGroup(groupId: string, adminId: string): Promise<DatabaseResult<boolean>> {
    try {
      // Verify admin permission
      const groupResult = await this.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      if (groupResult.data.admin_id !== adminId) {
        return {
          success: false,
          error: 'Only group admin can delete the group',
        };
      }

      await this.collection.doc(groupId).update({
        status: 'cancelled',
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

  // Get groups by admin
  async getGroupsByAdmin(adminId: string): Promise<DatabaseResult<Group[]>> {
    try {
      const snapshot = await this.collection
        .where('admin_id', '==', adminId)
        .orderBy('created_at', 'desc')
        .get();

      const groups: Group[] = snapshot.docs.map(doc => {
        const groupData = doc.data() as any;
        return {
          id: doc.id,
          ...groupData,
          created_at: groupData.created_at?.toDate?.() || new Date(),
          updated_at: groupData.updated_at?.toDate?.() || new Date(),
          start_date: groupData.start_date?.toDate?.() || new Date(),
          estimated_end_date: groupData.estimated_end_date?.toDate?.() || new Date(),
          cycle_start_date: groupData.cycle_start_date?.toDate?.() || new Date(),
          cycle_end_date: groupData.cycle_end_date?.toDate?.() || new Date(),
        };
      });

      return {
        success: true,
        data: groups,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get active groups
  async getActiveGroups(
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<Group>>> {
    try {
      const { limit = 20, offset = 0 } = options;
      
      const snapshot = await this.collection
        .where('status', '==', 'active')
        .where('total_members', '<', firestore.FieldPath.documentId()) // Groups with available slots
        .orderBy('created_at', 'desc')
        .limit(limit + 1)
        .offset(offset)
        .get();

      const groups: Group[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const groupData = doc.data() as any;
        groups.push({
          id: doc.id,
          ...groupData,
          created_at: groupData.created_at?.toDate?.() || new Date(),
          updated_at: groupData.updated_at?.toDate?.() || new Date(),
          start_date: groupData.start_date?.toDate?.() || new Date(),
          estimated_end_date: groupData.estimated_end_date?.toDate?.() || new Date(),
          cycle_start_date: groupData.cycle_start_date?.toDate?.() || new Date(),
          cycle_end_date: groupData.cycle_end_date?.toDate?.() || new Date(),
        });
      });

      return {
        success: true,
        data: {
          items: groups,
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

  // Search groups by name
  async searchGroups(
    searchQuery: string,
    options: QueryOptions = {}
  ): Promise<DatabaseResult<PaginatedResult<Group>>> {
    try {
      const { limit = 20, offset = 0 } = options;
      
      const snapshot = await this.collection
        .where('name', '>=', searchQuery)
        .where('name', '<=', searchQuery + '\uf8ff')
        .where('status', '==', 'active')
        .limit(limit + 1)
        .offset(offset)
        .get();

      const groups: Group[] = [];
      
      snapshot.docs.slice(0, limit).forEach(doc => {
        const groupData = doc.data() as any;
        groups.push({
          id: doc.id,
          ...groupData,
          created_at: groupData.created_at?.toDate?.() || new Date(),
          updated_at: groupData.updated_at?.toDate?.() || new Date(),
          start_date: groupData.start_date?.toDate?.() || new Date(),
          estimated_end_date: groupData.estimated_end_date?.toDate?.() || new Date(),
          cycle_start_date: groupData.cycle_start_date?.toDate?.() || new Date(),
          cycle_end_date: groupData.cycle_end_date?.toDate?.() || new Date(),
        });
      });

      return {
        success: true,
        data: {
          items: groups,
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

  // Increment member count
  async incrementMemberCount(groupId: string): Promise<DatabaseResult<boolean>> {
    try {
      await this.collection.doc(groupId).update({
        total_members: firestore.FieldValue.increment(1),
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

  // Decrement member count
  async decrementMemberCount(groupId: string): Promise<DatabaseResult<boolean>> {
    try {
      await this.collection.doc(groupId).update({
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

  // Start next cycle
  async startNextCycle(groupId: string): Promise<DatabaseResult<Group>> {
    try {
      const groupResult = await this.getGroupById(groupId);
      
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;
      const nextCycle = group.current_cycle + 1;
      
      if (nextCycle > group.total_cycles) {
        // Group completed
        await this.collection.doc(groupId).update({
          status: 'completed',
          updated_at: firestore.FieldValue.serverTimestamp(),
        });
        
        return await this.getGroupById(groupId);
      }

      const newCycleStartDate = new Date();
      const newCycleEndDate = this.calculateCycleEndDate(newCycleStartDate, group.contribution_frequency);

      await this.collection.doc(groupId).update({
        current_cycle: nextCycle,
        cycle_start_date: firestore.Timestamp.fromDate(newCycleStartDate),
        cycle_end_date: firestore.Timestamp.fromDate(newCycleEndDate),
        successful_cycles: firestore.FieldValue.increment(1),
        updated_at: firestore.FieldValue.serverTimestamp(),
      });

      return await this.getGroupById(groupId);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Update group statistics
  async updateGroupStatistics(
    groupId: string, 
    stats: {
      contributionAmount?: number;
      payoutAmount?: number;
    }
  ): Promise<DatabaseResult<boolean>> {
    try {
      const updates: any = {
        updated_at: firestore.FieldValue.serverTimestamp(),
      };

      if (stats.contributionAmount !== undefined) {
        updates.total_contributions_collected = firestore.FieldValue.increment(stats.contributionAmount);
      }

      if (stats.payoutAmount !== undefined) {
        updates.total_payouts_made = firestore.FieldValue.increment(stats.payoutAmount);
      }

      await this.collection.doc(groupId).update(updates);

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

  // Get group statistics
  async getGroupStatistics(groupId: string): Promise<DatabaseResult<GroupStatistics | null>> {
    try {
      const groupResult = await this.getGroupById(groupId);
      
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;

      // Get active members count
      const activeMembersSnapshot = await db.collection('group_members')
        .where('group_id', '==', groupId)
        .where('status', '==', 'active')
        .get();

      // Calculate completion rate
      const totalExpectedContributions = group.current_cycle * activeMembersSnapshot.size;
      const contributionsSnapshot = await db.collection('contributions')
        .where('group_id', '==', groupId)
        .where('status', '==', 'paid')
        .get();

      const completionRate = totalExpectedContributions > 0 
        ? (contributionsSnapshot.size / totalExpectedContributions) * 100 
        : 0;

      // Get next payout info
      const nextPayoutSnapshot = await db.collection('payouts')
        .where('group_id', '==', groupId)
        .where('status', '==', 'scheduled')
        .orderBy('scheduled_date', 'asc')
        .limit(1)
        .get();

      let nextPayoutDate = new Date();
      let nextRecipientId = '';

      if (!nextPayoutSnapshot.empty) {
        const nextPayout = nextPayoutSnapshot.docs[0].data();
        nextPayoutDate = nextPayout.scheduled_date?.toDate() || new Date();
        nextRecipientId = nextPayout.recipient_id;
      }

      // Calculate average reliability score
      const membersReliabilitySnapshot = await db.collection('group_members')
        .where('group_id', '==', groupId)
        .where('status', '==', 'active')
        .get();

      let totalReliabilityScore = 0;
      membersReliabilitySnapshot.docs.forEach(doc => {
        totalReliabilityScore += doc.data().reliability_percentage || 100;
      });

      const averageReliabilityScore = activeMembersSnapshot.size > 0 
        ? totalReliabilityScore / activeMembersSnapshot.size 
        : 100;

      const statistics: GroupStatistics = {
        group_id: groupId,
        total_contributions: group.total_contributions_collected,
        total_payouts: group.total_payouts_made,
        active_members: activeMembersSnapshot.size,
        completion_rate: completionRate,
        average_reliability_score: averageReliabilityScore,
        cycles_completed: group.successful_cycles,
        cycles_remaining: group.total_cycles - group.current_cycle,
        next_payout_date: nextPayoutDate,
        next_recipient_id: nextRecipientId,
      };

      return {
        success: true,
        data: statistics,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get current cycle info
  async getCurrentCycleInfo(groupId: string): Promise<DatabaseResult<CycleInfo | null>> {
    try {
      const groupResult = await this.getGroupById(groupId);
      
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;

      // Get contributions for current cycle
      const contributionsSnapshot = await db.collection('contributions')
        .where('group_id', '==', groupId)
        .where('cycle_number', '==', group.current_cycle)
        .get();

      const contributions = contributionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      // Get payout for current cycle
      const payoutSnapshot = await db.collection('payouts')
        .where('group_id', '==', groupId)
        .where('cycle_number', '==', group.current_cycle)
        .limit(1)
        .get();

      let payout = null;
      if (!payoutSnapshot.empty) {
        const payoutDoc = payoutSnapshot.docs[0];
        payout = { id: payoutDoc.id, ...payoutDoc.data() };
      }

      // Calculate expected vs actual contributions
      const expectedTotal = group.contribution_amount * group.total_members;
      const actualTotal = contributions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0);

      // Get recipient (member with current join_order)
      const recipientSnapshot = await db.collection('group_members')
        .where('group_id', '==', groupId)
        .where('join_order', '==', group.current_cycle)
        .limit(1)
        .get();

      let recipientId = '';
      if (!recipientSnapshot.empty) {
        recipientId = recipientSnapshot.docs[0].data().user_id;
      }

      const cycleInfo: CycleInfo = {
        group_id: groupId,
        cycle_number: group.current_cycle,
        start_date: group.cycle_start_date,
        end_date: group.cycle_end_date,
        recipient_id: recipientId,
        expected_total_contributions: expectedTotal,
        actual_total_contributions: actualTotal,
        payout_amount: payout?.amount || actualTotal,
        status: group.status === 'active' ? 'active' : 'completed',
        contributions,
        payout,
      };

      return {
        success: true,
        data: cycleInfo,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Real-time listener for group updates
  onGroupUpdates(groupId: string, callback: (group: Group | null) => void): () => void {
    return this.collection.doc(groupId).onSnapshot(
      (doc) => {
        if (doc.exists) {
          const groupData = doc.data() as any;
          const group: Group = {
            id: doc.id,
            ...groupData,
            created_at: groupData.created_at?.toDate?.() || new Date(),
            updated_at: groupData.updated_at?.toDate?.() || new Date(),
            start_date: groupData.start_date?.toDate?.() || new Date(),
            estimated_end_date: groupData.estimated_end_date?.toDate?.() || new Date(),
            cycle_start_date: groupData.cycle_start_date?.toDate?.() || new Date(),
            cycle_end_date: groupData.cycle_end_date?.toDate?.() || new Date(),
          };
          callback(group);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to group updates:', error);
        callback(null);
      }
    );
  }

  // Helper function to calculate cycle end date
  private calculateCycleEndDate(startDate: Date, frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const endDate = new Date(startDate);
    
    switch (frequency) {
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
    }
    
    return endDate;
  }
}

export default new GroupService();