import UserService from './users';
import GroupService from './groups';
import GroupMemberService from './groupMembers';
import ContributionService from './contributions';
import PayoutService from './payouts';

import {
  User,
  Group,
  GroupMember,
  Contribution,
  Payout,
  DatabaseResult,
  PaginatedResult,
  QueryOptions,
  FilterOptions,
  UserStatistics,
  GroupStatistics,
  CycleInfo,
  BatchOperation,
  BatchResult
} from '../../types/database';

class DatabaseService {
  // Service instances
  public users = UserService;
  public groups = GroupService;
  public groupMembers = GroupMemberService;
  public contributions = ContributionService;
  public payouts = PayoutService;

  // Complex operations that involve multiple collections

  // Create a complete new group with admin as first member
  async createGroupWithAdmin(
    groupData: Omit<Group, 'id' | 'created_at' | 'updated_at'>,
    adminUser: User
  ): Promise<DatabaseResult<{ group: Group; membership: GroupMember }>> {
    try {
      // Create the group
      const groupResult = await this.groups.createGroup(groupData);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: groupResult.error || 'Failed to create group',
        };
      }

      const group = groupResult.data;

      // Add admin as first member
      const membershipResult = await this.groupMembers.addMember({
        group_id: group.id,
        user_id: adminUser.id,
        status: 'active',
        role: 'admin',
        can_invite_members: true,
        can_view_all_contributions: true,
        notification_enabled: true,
        auto_contribute: false,
        join_order: 1,
      });

      if (!membershipResult.success || !membershipResult.data) {
        // Rollback: delete the group if member creation failed
        await this.groups.deleteGroup(group.id, adminUser.id);
        return {
          success: false,
          error: membershipResult.error || 'Failed to add admin as member',
        };
      }

      return {
        success: true,
        data: {
          group,
          membership: membershipResult.data,
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

  // Join a group (user perspective)
  async joinGroup(
    groupId: string,
    userId: string,
    userDisplayName: string
  ): Promise<DatabaseResult<{ group: Group; membership: GroupMember }>> {
    try {
      // Get group details
      const groupResult = await this.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;

      // Check if group is accepting new members
      if (group.status !== 'active') {
        return {
          success: false,
          error: 'Group is not accepting new members',
        };
      }

      if (group.total_members >= group.max_members) {
        return {
          success: false,
          error: 'Group is full',
        };
      }

      // Add member to group
      const membershipResult = await this.groupMembers.addMember({
        group_id: groupId,
        user_id: userId,
        status: 'active',
        role: 'member',
        can_invite_members: false,
        can_view_all_contributions: false,
        notification_enabled: true,
        auto_contribute: false,
        join_order: group.total_members + 1, // Will be updated by the service
      });

      if (!membershipResult.success || !membershipResult.data) {
        return {
          success: false,
          error: membershipResult.error || 'Failed to join group',
        };
      }

      // Get updated group info
      const updatedGroupResult = await this.groups.getGroupById(groupId);
      
      return {
        success: true,
        data: {
          group: updatedGroupResult.data || group,
          membership: membershipResult.data,
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

  // Leave a group
  async leaveGroup(
    groupId: string,
    userId: string
  ): Promise<DatabaseResult<boolean>> {
    try {
      // Get user's membership
      const membershipResult = await this.groupMembers.getMemberByUserAndGroup(userId, groupId);
      if (!membershipResult.success || !membershipResult.data) {
        return {
          success: false,
          error: 'Membership not found',
        };
      }

      const membership = membershipResult.data;

      // Check if user is admin
      if (membership.role === 'admin') {
        // Check if there are other members
        const membersResult = await this.groupMembers.getGroupMembers(groupId, { status: 'active' });
        if (membersResult.success && membersResult.data.items.length > 1) {
          return {
            success: false,
            error: 'Admin cannot leave group with active members. Transfer admin role first.',
          };
        }
      }

      // Check if user has pending contributions
      const contributionsResult = await this.contributions.getUserContributions(
        userId,
        { status: 'pending', group_id: groupId }
      );

      if (contributionsResult.success && contributionsResult.data.items.length > 0) {
        return {
          success: false,
          error: 'Cannot leave group with pending contributions',
        };
      }

      // Remove member
      return await this.groupMembers.removeMember(membership.id);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Create contributions for all active members in a cycle
  async createCycleContributions(
    groupId: string,
    cycleNumber: number,
    dueDate: Date
  ): Promise<DatabaseResult<Contribution[]>> {
    try {
      // Get group details
      const groupResult = await this.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;

      // Get active members
      const membersResult = await this.groupMembers.getGroupMembers(
        groupId,
        { status: 'active' }
      );

      if (!membersResult.success || !membersResult.data.items.length) {
        return {
          success: false,
          error: 'No active members found',
        };
      }

      const members = membersResult.data.items;

      // Create contributions for each member
      const contributionsToCreate: Array<Omit<Contribution, 'id' | 'created_at' | 'updated_at'>> = 
        members.map(member => ({
          group_id: groupId,
          user_id: member.user_id,
          amount: group.contribution_amount,
          cycle_number: cycleNumber,
          status: 'pending',
          due_date: dueDate,
          is_late: false,
          grace_period_used: false,
          verified_by_admin: false,
        }));

      // Batch create contributions
      const batchResult = await this.contributions.batchCreateContributions(contributionsToCreate);
      if (!batchResult.success) {
        return {
          success: false,
          error: batchResult.error || 'Failed to create contributions',
        };
      }

      // Get created contributions
      const cycleContributionsResult = await this.contributions.getCycleContributions(
        groupId,
        cycleNumber
      );

      return cycleContributionsResult;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Create payout for current cycle
  async createCyclePayout(
    groupId: string,
    cycleNumber: number,
    scheduledDate: Date
  ): Promise<DatabaseResult<Payout>> {
    try {
      // Get group details
      const groupResult = await this.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;

      // Get recipient for this cycle
      const recipientResult = await this.groupMembers.getNextRecipient(groupId, cycleNumber);
      if (!recipientResult.success || !recipientResult.data) {
        return {
          success: false,
          error: 'No recipient found for this cycle',
        };
      }

      const recipient = recipientResult.data;

      // Calculate total contributions collected for this cycle
      const contributionsResult = await this.contributions.getCycleContributions(groupId, cycleNumber);
      if (!contributionsResult.success) {
        return {
          success: false,
          error: 'Failed to get cycle contributions',
        };
      }

      const contributions = contributionsResult.data;
      const totalCollected = contributions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount + (c.late_penalty_amount || 0), 0);

      // Calculate processing fee (if any)
      const processingFeeRate = 0.01; // 1% processing fee
      const processingFee = totalCollected * processingFeeRate;
      const netAmount = totalCollected - processingFee;

      // Create payout
      return await this.payouts.createPayout({
        group_id: groupId,
        recipient_id: recipient.user_id,
        amount: totalCollected,
        cycle_number: cycleNumber,
        status: 'scheduled',
        scheduled_date: scheduledDate,
        payout_method: 'bank_transfer', // Default method
        processing_fee: processingFee,
        net_amount: netAmount,
        approved_by_admin: false,
        retry_count: 0,
        max_retries: 3,
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }

  // Get complete user dashboard data
  async getUserDashboard(userId: string): Promise<DatabaseResult<{
    user: User;
    groups: GroupMember[];
    recentContributions: Contribution[];
    upcomingPayouts: Payout[];
    statistics: UserStatistics;
  }>> {
    try {
      // Get user profile
      const userResult = await this.users.getUserById(userId);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Get user groups
      const groupsResult = await this.groupMembers.getUserGroups(
        userId,
        { status: 'active' },
        { limit: 10 }
      );

      // Get recent contributions
      const contributionsResult = await this.contributions.getUserContributions(
        userId,
        {},
        { limit: 5, order_by: 'created_at', order_direction: 'desc' }
      );

      // Get upcoming payouts
      const payoutsResult = await this.payouts.getUserPayouts(
        userId,
        { status: 'scheduled' },
        { limit: 5, order_by: 'scheduled_date', order_direction: 'asc' }
      );

      // Get user statistics
      const statisticsResult = await this.users.getUserStatistics(userId);

      return {
        success: true,
        data: {
          user: userResult.data,
          groups: groupsResult.success ? groupsResult.data.items : [],
          recentContributions: contributionsResult.success ? contributionsResult.data.items : [],
          upcomingPayouts: payoutsResult.success ? payoutsResult.data.items : [],
          statistics: statisticsResult.success && statisticsResult.data ? statisticsResult.data : {
            user_id: userId,
            groups_joined: 0,
            groups_completed: 0,
            total_contributed: 0,
            total_received: 0,
            reliability_score: 100,
            on_time_payment_rate: 100,
            current_active_groups: 0,
          },
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

  // Get complete group dashboard data
  async getGroupDashboard(groupId: string): Promise<DatabaseResult<{
    group: Group;
    members: GroupMember[];
    currentCycle: CycleInfo;
    statistics: GroupStatistics;
  }>> {
    try {
      // Get group details
      const groupResult = await this.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
        };
      }

      const group = groupResult.data;

      // Get group members
      const membersResult = await this.groupMembers.getGroupMembers(groupId);

      // Get current cycle info
      const cycleInfoResult = await this.groups.getCurrentCycleInfo(groupId);

      // Get group statistics
      const statisticsResult = await this.groups.getGroupStatistics(groupId);

      return {
        success: true,
        data: {
          group,
          members: membersResult.success ? membersResult.data.items : [],
          currentCycle: cycleInfoResult.success && cycleInfoResult.data ? cycleInfoResult.data : {
            group_id: groupId,
            cycle_number: group.current_cycle,
            start_date: group.cycle_start_date,
            end_date: group.cycle_end_date,
            recipient_id: '',
            expected_total_contributions: 0,
            actual_total_contributions: 0,
            payout_amount: 0,
            status: 'active',
            contributions: [],
          },
          statistics: statisticsResult.success && statisticsResult.data ? statisticsResult.data : {
            group_id: groupId,
            total_contributions: 0,
            total_payouts: 0,
            active_members: 0,
            completion_rate: 0,
            average_reliability_score: 100,
            cycles_completed: 0,
            cycles_remaining: 0,
            next_payout_date: new Date(),
            next_recipient_id: '',
          },
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

  // Batch operations
  async performBatchOperations(operations: BatchOperation[]): Promise<BatchResult> {
    const results: Array<{
      success: boolean;
      document_id?: string;
      error?: string;
    }> = [];

    try {
      for (const operation of operations) {
        let result;

        switch (operation.operation) {
          case 'create':
            if (operation.collection === 'users') {
              result = await this.users.createUser(operation.data);
            } else if (operation.collection === 'groups') {
              result = await this.groups.createGroup(operation.data);
            } else if (operation.collection === 'group_members') {
              result = await this.groupMembers.addMember(operation.data);
            } else if (operation.collection === 'contributions') {
              result = await this.contributions.createContribution(operation.data);
            } else if (operation.collection === 'payouts') {
              result = await this.payouts.createPayout(operation.data);
            } else {
              result = { success: false, error: 'Unknown collection' };
            }
            break;

          case 'update':
            if (!operation.document_id) {
              result = { success: false, error: 'Document ID required for update' };
              break;
            }

            if (operation.collection === 'users') {
              result = await this.users.updateUser(operation.document_id, operation.data);
            } else if (operation.collection === 'groups') {
              result = await this.groups.updateGroup(operation.document_id, operation.data);
            } else if (operation.collection === 'group_members') {
              result = await this.groupMembers.updateMember(operation.document_id, operation.data);
            } else if (operation.collection === 'contributions') {
              result = await this.contributions.updateContribution(operation.document_id, operation.data);
            } else if (operation.collection === 'payouts') {
              result = await this.payouts.updatePayout(operation.document_id, operation.data);
            } else {
              result = { success: false, error: 'Unknown collection' };
            }
            break;

          case 'delete':
            if (!operation.document_id) {
              result = { success: false, error: 'Document ID required for delete' };
              break;
            }

            if (operation.collection === 'users') {
              result = await this.users.deleteUser(operation.document_id);
            } else if (operation.collection === 'groups') {
              result = await this.groups.deleteGroup(operation.document_id, operation.data?.admin_id);
            } else if (operation.collection === 'group_members') {
              result = await this.groupMembers.removeMember(operation.document_id);
            } else if (operation.collection === 'contributions') {
              result = await this.contributions.deleteContribution(operation.document_id);
            } else if (operation.collection === 'payouts') {
              result = await this.payouts.deletePayout(operation.document_id);
            } else {
              result = { success: false, error: 'Unknown collection' };
            }
            break;

          default:
            result = { success: false, error: 'Unknown operation' };
        }

        results.push({
          success: result.success,
          document_id: result.data?.id || operation.document_id,
          error: result.error,
        });
      }

      const allSuccessful = results.every(r => r.success);

      return {
        success: allSuccessful,
        results,
      };
    } catch (error: any) {
      return {
        success: false,
        results: results.concat([{
          success: false,
          error: error.message,
        }]),
      };
    }
  }
}

export default new DatabaseService();
export * from '../../types/database';