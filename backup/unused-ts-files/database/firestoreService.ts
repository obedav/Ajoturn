/**
 * Complete Firestore Database Service for Ajoturn
 * CRUD operations for all collections
 */

import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { getFirestore } from '../../config/firebase';
import {
  User, Group, GroupMember, Contribution, Payout,
  DatabaseResult, PaginatedResult, QueryOptions, FilterOptions,
  UserStatus, GroupStatus, MemberStatus, ContributionStatus, PayoutStatus
} from '../../types/database';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  GROUPS: 'groups',
  GROUP_MEMBERS: 'group_members',
  CONTRIBUTIONS: 'contributions',
  PAYOUTS: 'payouts',
} as const;

class FirestoreService {
  private db: FirebaseFirestoreTypes.Module;

  constructor() {
    this.db = getFirestore();
  }

  // ========================
  // USERS COLLECTION CRUD
  // ========================

  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseResult<User>> {
    try {
      const now = new Date();
      const userDoc = this.db.collection(COLLECTIONS.USERS).doc();
      
      const user: User = {
        ...userData,
        id: userDoc.id,
        created_at: now,
        updated_at: now,
      };

      await userDoc.set(user);
      
      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getUserById(userId: string): Promise<DatabaseResult<User>> {
    try {
      const userDoc = await this.db.collection(COLLECTIONS.USERS).doc(userId).get();
      
      if (!userDoc.exists) {
        return {
          success: false,
          error: 'User not found',
          code: 'user-not-found',
        };
      }

      return {
        success: true,
        data: userDoc.data() as User,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getUserByPhone(phone: string): Promise<DatabaseResult<User>> {
    try {
      const querySnapshot = await this.db
        .collection(COLLECTIONS.USERS)
        .where('phone', '==', phone)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return {
          success: false,
          error: 'User not found',
          code: 'user-not-found',
        };
      }

      const userDoc = querySnapshot.docs[0];
      return {
        success: true,
        data: userDoc.data() as User,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<DatabaseResult<User>> {
    try {
      const userRef = this.db.collection(COLLECTIONS.USERS).doc(userId);
      
      const updateData = {
        ...updates,
        updated_at: new Date(),
      };
      
      await userRef.update(updateData);
      
      // Get updated user
      const updatedUser = await this.getUserById(userId);
      return updatedUser;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // ========================
  // GROUPS COLLECTION CRUD
  // ========================

  async createGroup(groupData: Omit<Group, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseResult<Group>> {
    try {
      const now = new Date();
      const groupDoc = this.db.collection(COLLECTIONS.GROUPS).doc();
      
      const group: Group = {
        ...groupData,
        id: groupDoc.id,
        created_at: now,
        updated_at: now,
      };

      await groupDoc.set(group);
      
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

  async getGroupById(groupId: string): Promise<DatabaseResult<Group>> {
    try {
      const groupDoc = await this.db.collection(COLLECTIONS.GROUPS).doc(groupId).get();
      
      if (!groupDoc.exists) {
        return {
          success: false,
          error: 'Group not found',
          code: 'group-not-found',
        };
      }

      return {
        success: true,
        data: groupDoc.data() as Group,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getGroupsByUserId(userId: string, options?: QueryOptions): Promise<DatabaseResult<Group[]>> {
    try {
      // First get group memberships
      const membershipQuery = this.db
        .collection(COLLECTIONS.GROUP_MEMBERS)
        .where('user_id', '==', userId)
        .where('status', '==', MemberStatus.ACTIVE);

      const membershipSnapshot = await membershipQuery.get();
      const groupIds = membershipSnapshot.docs.map(doc => doc.data().group_id);

      if (groupIds.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get groups in batches (Firestore 'in' query limit is 10)
      const groups: Group[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < groupIds.length; i += batchSize) {
        const batch = groupIds.slice(i, i + batchSize);
        const groupQuery = this.db
          .collection(COLLECTIONS.GROUPS)
          .where(firestore.FieldPath.documentId(), 'in', batch);

        const snapshot = await groupQuery.get();
        const batchGroups = snapshot.docs.map(doc => doc.data() as Group);
        groups.push(...batchGroups);
      }

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

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<DatabaseResult<Group>> {
    try {
      const groupRef = this.db.collection(COLLECTIONS.GROUPS).doc(groupId);
      
      const updateData = {
        ...updates,
        updated_at: new Date(),
      };
      
      await groupRef.update(updateData);
      
      // Get updated group
      const updatedGroup = await this.getGroupById(groupId);
      return updatedGroup;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // ========================
  // GROUP_MEMBERS COLLECTION CRUD
  // ========================

  async addGroupMember(memberData: Omit<GroupMember, 'id' | 'joined_at' | 'updated_at'>): Promise<DatabaseResult<GroupMember>> {
    try {
      const now = new Date();
      const memberDoc = this.db.collection(COLLECTIONS.GROUP_MEMBERS).doc();
      
      const member: GroupMember = {
        ...memberData,
        id: memberDoc.id,
        joined_at: now,
        updated_at: now,
      };

      await memberDoc.set(member);
      
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

  async getGroupMembers(groupId: string): Promise<DatabaseResult<GroupMember[]>> {
    try {
      const querySnapshot = await this.db
        .collection(COLLECTIONS.GROUP_MEMBERS)
        .where('group_id', '==', groupId)
        .where('status', '==', MemberStatus.ACTIVE)
        .orderBy('join_order', 'asc')
        .get();

      const members = querySnapshot.docs.map(doc => doc.data() as GroupMember);
      
      return {
        success: true,
        data: members,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async updateGroupMember(memberId: string, updates: Partial<GroupMember>): Promise<DatabaseResult<GroupMember>> {
    try {
      const memberRef = this.db.collection(COLLECTIONS.GROUP_MEMBERS).doc(memberId);
      
      const updateData = {
        ...updates,
        updated_at: new Date(),
      };
      
      await memberRef.update(updateData);
      
      // Get updated member
      const memberDoc = await memberRef.get();
      return {
        success: true,
        data: memberDoc.data() as GroupMember,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // ========================
  // CONTRIBUTIONS COLLECTION CRUD
  // ========================

  async createContribution(contributionData: Omit<Contribution, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseResult<Contribution>> {
    try {
      const now = new Date();
      const contributionDoc = this.db.collection(COLLECTIONS.CONTRIBUTIONS).doc();
      
      const contribution: Contribution = {
        ...contributionData,
        id: contributionDoc.id,
        created_at: now,
        updated_at: now,
      };

      await contributionDoc.set(contribution);
      
      return {
        success: true,
        data: contribution,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getContributionsByGroup(groupId: string, cycleNumber?: number): Promise<DatabaseResult<Contribution[]>> {
    try {
      let query = this.db
        .collection(COLLECTIONS.CONTRIBUTIONS)
        .where('group_id', '==', groupId);

      if (cycleNumber !== undefined) {
        query = query.where('cycle_number', '==', cycleNumber);
      }

      const querySnapshot = await query
        .orderBy('created_at', 'desc')
        .get();

      const contributions = querySnapshot.docs.map(doc => doc.data() as Contribution);
      
      return {
        success: true,
        data: contributions,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getContributionsByUser(userId: string, groupId?: string): Promise<DatabaseResult<Contribution[]>> {
    try {
      let query = this.db
        .collection(COLLECTIONS.CONTRIBUTIONS)
        .where('user_id', '==', userId);

      if (groupId) {
        query = query.where('group_id', '==', groupId);
      }

      const querySnapshot = await query
        .orderBy('created_at', 'desc')
        .get();

      const contributions = querySnapshot.docs.map(doc => doc.data() as Contribution);
      
      return {
        success: true,
        data: contributions,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async updateContribution(contributionId: string, updates: Partial<Contribution>): Promise<DatabaseResult<Contribution>> {
    try {
      const contributionRef = this.db.collection(COLLECTIONS.CONTRIBUTIONS).doc(contributionId);
      
      const updateData = {
        ...updates,
        updated_at: new Date(),
      };
      
      await contributionRef.update(updateData);
      
      // Get updated contribution
      const contributionDoc = await contributionRef.get();
      return {
        success: true,
        data: contributionDoc.data() as Contribution,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // ========================
  // PAYOUTS COLLECTION CRUD
  // ========================

  async createPayout(payoutData: Omit<Payout, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseResult<Payout>> {
    try {
      const now = new Date();
      const payoutDoc = this.db.collection(COLLECTIONS.PAYOUTS).doc();
      
      const payout: Payout = {
        ...payoutData,
        id: payoutDoc.id,
        created_at: now,
        updated_at: now,
      };

      await payoutDoc.set(payout);
      
      return {
        success: true,
        data: payout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getPayoutsByGroup(groupId: string): Promise<DatabaseResult<Payout[]>> {
    try {
      const querySnapshot = await this.db
        .collection(COLLECTIONS.PAYOUTS)
        .where('group_id', '==', groupId)
        .orderBy('cycle_number', 'asc')
        .get();

      const payouts = querySnapshot.docs.map(doc => doc.data() as Payout);
      
      return {
        success: true,
        data: payouts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getPayoutsByUser(userId: string): Promise<DatabaseResult<Payout[]>> {
    try {
      const querySnapshot = await this.db
        .collection(COLLECTIONS.PAYOUTS)
        .where('recipient_id', '==', userId)
        .orderBy('created_at', 'desc')
        .get();

      const payouts = querySnapshot.docs.map(doc => doc.data() as Payout);
      
      return {
        success: true,
        data: payouts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async updatePayout(payoutId: string, updates: Partial<Payout>): Promise<DatabaseResult<Payout>> {
    try {
      const payoutRef = this.db.collection(COLLECTIONS.PAYOUTS).doc(payoutId);
      
      const updateData = {
        ...updates,
        updated_at: new Date(),
      };
      
      await payoutRef.update(updateData);
      
      // Get updated payout
      const payoutDoc = await payoutRef.get();
      return {
        success: true,
        data: payoutDoc.data() as Payout,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // ========================
  // COMPLEX QUERIES & ANALYTICS
  // ========================

  async getGroupDashboard(groupId: string): Promise<DatabaseResult<any>> {
    try {
      // Get group details
      const groupResult = await this.getGroupById(groupId);
      if (!groupResult.success) return groupResult;

      const group = groupResult.data!;

      // Get active members
      const membersResult = await this.getGroupMembers(groupId);
      const members = membersResult.success ? membersResult.data! : [];

      // Get current cycle contributions
      const contributionsResult = await this.getContributionsByGroup(groupId, group.current_cycle);
      const contributions = contributionsResult.success ? contributionsResult.data! : [];

      // Get payouts
      const payoutsResult = await this.getPayoutsByGroup(groupId);
      const payouts = payoutsResult.success ? payoutsResult.data! : [];

      // Calculate statistics
      const totalContributed = contributions
        .filter(c => c.status === ContributionStatus.PAID)
        .reduce((sum, c) => sum + c.amount, 0);

      const pendingContributions = contributions.filter(c => c.status === ContributionStatus.PENDING);
      const overdueContributions = contributions.filter(c => c.status === ContributionStatus.OVERDUE);

      const dashboard = {
        group,
        members,
        current_cycle: {
          cycle_number: group.current_cycle,
          total_contributed: totalContributed,
          expected_total: group.contribution_amount * members.length,
          pending_count: pendingContributions.length,
          overdue_count: overdueContributions.length,
          completion_percentage: (totalContributed / (group.contribution_amount * members.length)) * 100,
        },
        recent_contributions: contributions.slice(0, 10),
        recent_payouts: payouts.slice(0, 5),
        next_payout: {
          recipient_id: members[group.current_cycle % members.length]?.user_id,
          estimated_date: group.cycle_end_date,
          estimated_amount: totalContributed,
        },
      };

      return {
        success: true,
        data: dashboard,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  async getUserDashboard(userId: string): Promise<DatabaseResult<any>> {
    try {
      // Get user groups
      const groupsResult = await this.getGroupsByUserId(userId);
      const groups = groupsResult.success ? groupsResult.data! : [];

      // Get user contributions across all groups
      const contributionsResult = await this.getContributionsByUser(userId);
      const contributions = contributionsResult.success ? contributionsResult.data! : [];

      // Get user payouts
      const payoutsResult = await this.getPayoutsByUser(userId);
      const payouts = payoutsResult.success ? payoutsResult.data! : [];

      // Calculate statistics
      const totalContributed = contributions
        .filter(c => c.status === ContributionStatus.PAID)
        .reduce((sum, c) => sum + c.amount, 0);

      const totalReceived = payouts
        .filter(p => p.status === PayoutStatus.COMPLETED)
        .reduce((sum, p) => sum + p.amount, 0);

      const activeGroups = groups.filter(g => g.status === GroupStatus.ACTIVE);
      const pendingPayments = contributions.filter(c => c.status === ContributionStatus.PENDING);

      const dashboard = {
        active_groups: activeGroups.length,
        total_groups: groups.length,
        total_contributed: totalContributed,
        total_received: totalReceived,
        pending_payments: pendingPayments.length,
        recent_activities: [
          ...contributions.slice(0, 5).map(c => ({ type: 'contribution', ...c })),
          ...payouts.slice(0, 5).map(p => ({ type: 'payout', ...p })),
        ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, 10),
        groups: activeGroups,
      };

      return {
        success: true,
        data: dashboard,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // ========================
  // BATCH OPERATIONS
  // ========================

  async batchCreateContributions(contributions: Omit<Contribution, 'id' | 'created_at' | 'updated_at'>[]): Promise<DatabaseResult<Contribution[]>> {
    try {
      const batch = this.db.batch();
      const now = new Date();
      const createdContributions: Contribution[] = [];

      contributions.forEach((contributionData) => {
        const contributionDoc = this.db.collection(COLLECTIONS.CONTRIBUTIONS).doc();
        const contribution: Contribution = {
          ...contributionData,
          id: contributionDoc.id,
          created_at: now,
          updated_at: now,
        };
        
        batch.set(contributionDoc, contribution);
        createdContributions.push(contribution);
      });

      await batch.commit();

      return {
        success: true,
        data: createdContributions,
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

export default new FirestoreService();