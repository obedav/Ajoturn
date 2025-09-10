/**
 * Usage Examples for Firestore Database Service
 * How to use the CRUD operations in your Ajoturn app
 */

import FirestoreService from './firestoreService';
import { User, Group, GroupMember, Contribution, Payout } from '../../types/database';

// ========================
// USER OPERATIONS EXAMPLES
// ========================

export const userExamples = {
  // Create a new user
  async createUser() {
    const userData = {
      phone: '+2348012345678',
      email: 'john@example.com',
      name: 'John Doe',
      bvn_verified: false,
      profile_picture: undefined,
      date_of_birth: undefined,
      address: undefined,
      occupation: 'Software Developer',
      phone_verified: true,
      email_verified: false,
      identity_verified: false,
      total_groups: 0,
      total_contributions: 0,
      total_payouts_received: 0,
      reliability_score: 100,
      notification_preferences: {
        push_enabled: true,
        email_enabled: true,
        contribution_reminders: true,
        payout_alerts: true,
      },
    };

    const result = await FirestoreService.createUser(userData);
    if (result.success) {
      console.log('User created:', result.data);
      return result.data;
    } else {
      console.error('Failed to create user:', result.error);
      return null;
    }
  },

  // Get user by ID
  async getUser(userId: string) {
    const result = await FirestoreService.getUserById(userId);
    if (result.success) {
      console.log('User found:', result.data);
      return result.data;
    } else {
      console.error('User not found:', result.error);
      return null;
    }
  },

  // Update user profile
  async updateUser(userId: string) {
    const updates = {
      bvn_verified: true,
      identity_verified: true,
      occupation: 'Senior Software Developer',
    };

    const result = await FirestoreService.updateUser(userId, updates);
    if (result.success) {
      console.log('User updated:', result.data);
      return result.data;
    } else {
      console.error('Failed to update user:', result.error);
      return null;
    }
  },
};

// ========================
// GROUP OPERATIONS EXAMPLES
// ========================

export const groupExamples = {
  // Create a new group
  async createGroup(adminId: string) {
    const groupData = {
      name: 'Monthly Savers',
      description: 'Save ₦5,000 monthly for 12 months',
      contribution_amount: 5000,
      total_members: 1,
      admin_id: adminId,
      status: 'active' as const,
      max_members: 12,
      contribution_frequency: 'monthly' as const,
      payout_schedule: 'monthly' as const,
      start_date: new Date(),
      estimated_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      current_cycle: 1,
      total_cycles: 12,
      cycle_start_date: new Date(),
      cycle_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      late_payment_penalty: 500,
      grace_period_days: 3,
      minimum_reliability_score: 70,
      total_contributions_collected: 0,
      total_payouts_made: 0,
      successful_cycles: 0,
      theme_color: '#3182ce',
    };

    const result = await FirestoreService.createGroup(groupData);
    if (result.success) {
      console.log('Group created:', result.data);
      return result.data;
    } else {
      console.error('Failed to create group:', result.error);
      return null;
    }
  },

  // Get user's groups
  async getUserGroups(userId: string) {
    const result = await FirestoreService.getGroupsByUserId(userId);
    if (result.success) {
      console.log('User groups:', result.data);
      return result.data;
    } else {
      console.error('Failed to get user groups:', result.error);
      return [];
    }
  },
};

// ========================
// GROUP MEMBER OPERATIONS
// ========================

export const memberExamples = {
  // Add member to group
  async addMember(groupId: string, userId: string, joinOrder: number) {
    const memberData = {
      group_id: groupId,
      user_id: userId,
      join_order: joinOrder,
      status: 'active' as const,
      role: 'member' as const,
      can_invite_members: false,
      can_view_all_contributions: true,
      total_contributions_made: 0,
      missed_contributions: 0,
      late_contributions: 0,
      on_time_contributions: 0,
      reliability_percentage: 100,
      payout_received: false,
      notification_enabled: true,
      auto_contribute: false,
    };

    const result = await FirestoreService.addGroupMember(memberData);
    if (result.success) {
      console.log('Member added:', result.data);
      return result.data;
    } else {
      console.error('Failed to add member:', result.error);
      return null;
    }
  },

  // Get group members
  async getGroupMembers(groupId: string) {
    const result = await FirestoreService.getGroupMembers(groupId);
    if (result.success) {
      console.log('Group members:', result.data);
      return result.data;
    } else {
      console.error('Failed to get group members:', result.error);
      return [];
    }
  },
};

// ========================
// CONTRIBUTION OPERATIONS
// ========================

export const contributionExamples = {
  // Create a contribution
  async createContribution(groupId: string, userId: string, cycleNumber: number) {
    const contributionData = {
      group_id: groupId,
      user_id: userId,
      amount: 5000,
      cycle_number: cycleNumber,
      status: 'pending' as const,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      payment_method: undefined,
      transaction_reference: undefined,
      is_late: false,
      grace_period_used: false,
      verified_by_admin: false,
    };

    const result = await FirestoreService.createContribution(contributionData);
    if (result.success) {
      console.log('Contribution created:', result.data);
      return result.data;
    } else {
      console.error('Failed to create contribution:', result.error);
      return null;
    }
  },

  // Mark contribution as paid
  async markContributionPaid(contributionId: string, transactionRef: string) {
    const updates = {
      status: 'paid' as const,
      paid_date: new Date(),
      payment_method: 'bank_transfer' as const,
      transaction_reference: transactionRef,
      verified_by_admin: true,
      verification_date: new Date(),
    };

    const result = await FirestoreService.updateContribution(contributionId, updates);
    if (result.success) {
      console.log('Contribution marked as paid:', result.data);
      return result.data;
    } else {
      console.error('Failed to update contribution:', result.error);
      return null;
    }
  },

  // Get group contributions for current cycle
  async getGroupContributions(groupId: string, cycleNumber: number) {
    const result = await FirestoreService.getContributionsByGroup(groupId, cycleNumber);
    if (result.success) {
      console.log('Group contributions:', result.data);
      return result.data;
    } else {
      console.error('Failed to get contributions:', result.error);
      return [];
    }
  },
};

// ========================
// PAYOUT OPERATIONS
// ========================

export const payoutExamples = {
  // Create a payout
  async createPayout(groupId: string, recipientId: string, cycleNumber: number) {
    const payoutData = {
      group_id: groupId,
      recipient_id: recipientId,
      amount: 60000, // 12 members * 5000
      cycle_number: cycleNumber,
      status: 'scheduled' as const,
      scheduled_date: new Date(),
      payout_method: 'bank_transfer' as const,
      bank_details: {
        account_number: '1234567890',
        bank_name: 'First Bank',
        account_name: 'John Doe',
      },
      approved_by_admin: false,
      processing_fee: 100,
      penalty_deductions: 0,
      net_amount: 59900,
      retry_count: 0,
      max_retries: 3,
    };

    const result = await FirestoreService.createPayout(payoutData);
    if (result.success) {
      console.log('Payout created:', result.data);
      return result.data;
    } else {
      console.error('Failed to create payout:', result.error);
      return null;
    }
  },

  // Mark payout as completed
  async completePayout(payoutId: string, transactionRef: string) {
    const updates = {
      status: 'completed' as const,
      processed_date: new Date(),
      completed_date: new Date(),
      transaction_reference: transactionRef,
      approved_by_admin: true,
      approval_date: new Date(),
    };

    const result = await FirestoreService.updatePayout(payoutId, updates);
    if (result.success) {
      console.log('Payout completed:', result.data);
      return result.data;
    } else {
      console.error('Failed to complete payout:', result.error);
      return null;
    }
  },
};

// ========================
// DASHBOARD OPERATIONS
// ========================

export const dashboardExamples = {
  // Get group dashboard data
  async getGroupDashboard(groupId: string) {
    const result = await FirestoreService.getGroupDashboard(groupId);
    if (result.success) {
      console.log('Group dashboard:', result.data);
      return result.data;
    } else {
      console.error('Failed to get group dashboard:', result.error);
      return null;
    }
  },

  // Get user dashboard data
  async getUserDashboard(userId: string) {
    const result = await FirestoreService.getUserDashboard(userId);
    if (result.success) {
      console.log('User dashboard:', result.data);
      return result.data;
    } else {
      console.error('Failed to get user dashboard:', result.error);
      return null;
    }
  },
};

// ========================
// COMPLETE WORKFLOW EXAMPLE
// ========================

export const workflowExample = {
  // Complete flow: Create group, add members, create contributions, process payout
  async completeGroupCycle() {
    try {
      // 1. Create a user (group admin)
      const admin = await userExamples.createUser();
      if (!admin) throw new Error('Failed to create admin user');

      // 2. Create a group
      const group = await groupExamples.createGroup(admin.id);
      if (!group) throw new Error('Failed to create group');

      // 3. Add members to group
      const member1 = await memberExamples.addMember(group.id, admin.id, 1);
      if (!member1) throw new Error('Failed to add admin as member');

      // 4. Create contributions for cycle 1
      const contribution = await contributionExamples.createContribution(
        group.id,
        admin.id,
        1
      );
      if (!contribution) throw new Error('Failed to create contribution');

      // 5. Mark contribution as paid
      const paidContribution = await contributionExamples.markContributionPaid(
        contribution.id,
        'TXN123456789'
      );
      if (!paidContribution) throw new Error('Failed to mark contribution as paid');

      // 6. Create payout for recipient
      const payout = await payoutExamples.createPayout(group.id, admin.id, 1);
      if (!payout) throw new Error('Failed to create payout');

      // 7. Complete the payout
      const completedPayout = await payoutExamples.completePayout(
        payout.id,
        'PAYOUT123456789'
      );
      if (!completedPayout) throw new Error('Failed to complete payout');

      console.log('✅ Complete group cycle workflow successful!');
      return {
        admin,
        group,
        member: member1,
        contribution: paidContribution,
        payout: completedPayout,
      };
    } catch (error) {
      console.error('❌ Workflow failed:', error);
      return null;
    }
  },
};

// Export all examples
export default {
  userExamples,
  groupExamples,
  memberExamples,
  contributionExamples,
  payoutExamples,
  dashboardExamples,
  workflowExample,
};