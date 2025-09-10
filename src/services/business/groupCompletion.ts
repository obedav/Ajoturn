import { 
  GroupCompletionStatus, 
  ValidateGroupCompletionParams, 
  BusinessLogicResult, 
  GroupCompletionError,
  BUSINESS_CONSTANTS
} from '../../types/business';
import { Group, GroupMember, Contribution, Payout } from '../../types/database';
import DatabaseService from '../database';

class GroupCompletionService {
  /**
   * Validate if group has completed all cycles successfully
   * @param params - Group, members, contributions, and payouts data
   * @returns Group completion status
   */
  async validateGroupCompletion(params: ValidateGroupCompletionParams): Promise<BusinessLogicResult<GroupCompletionStatus>> {
    try {
      const { group, members, contributions, payouts } = params;

      // Validate inputs
      if (!group || !members || !contributions || !payouts) {
        throw new GroupCompletionError('All group data is required for validation');
      }

      const activeMembers = members.filter(member => member.status === 'active');
      const completionStatus: GroupCompletionStatus = {
        isCompleted: false,
        groupId: group.id,
        totalCycles: group.total_cycles,
        completedCycles: group.successful_cycles || 0,
        remainingCycles: Math.max(0, group.total_cycles - (group.successful_cycles || 0)),
        allMembersReceived: false,
        completionRate: 0,
        issues: [],
      };

      // Check if group has reached total cycles
      const hasReachedTotalCycles = group.current_cycle > group.total_cycles;
      
      // Check if all members have received payouts
      const memberPayoutStatus = await this.checkMemberPayoutStatus(group.id, activeMembers, payouts);
      completionStatus.allMembersReceived = memberPayoutStatus.allReceived;

      if (!memberPayoutStatus.allReceived) {
        completionStatus.issues.push(
          `${memberPayoutStatus.membersWithoutPayout} members have not received payouts`
        );
      }

      // Calculate completion rate
      const expectedPayouts = Math.min(group.total_cycles, activeMembers.length);
      const completedPayouts = payouts.filter(p => p.status === 'completed').length;
      completionStatus.completionRate = expectedPayouts > 0 ? (completedPayouts / expectedPayouts) * 100 : 0;

      // Check payment completion across all cycles
      const paymentAnalysis = await this.analyzePaymentCompleteness(group, contributions);
      if (paymentAnalysis.incompleteCycles.length > 0) {
        completionStatus.issues.push(
          `Incomplete payments in cycles: ${paymentAnalysis.incompleteCycles.join(', ')}`
        );
      }

      // Check for any outstanding contributions
      const overdueContributions = contributions.filter(c => 
        c.status === 'pending' && new Date(c.due_date) < new Date()
      );
      
      if (overdueContributions.length > 0) {
        completionStatus.issues.push(
          `${overdueContributions.length} overdue contributions remaining`
        );
      }

      // Determine if group is completed
      completionStatus.isCompleted = 
        hasReachedTotalCycles && 
        memberPayoutStatus.allReceived && 
        paymentAnalysis.incompleteCycles.length === 0 &&
        overdueContributions.length === 0;

      // Set final payout date if completed
      if (completionStatus.isCompleted && payouts.length > 0) {
        const lastPayout = payouts
          .filter(p => p.status === 'completed')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        if (lastPayout) {
          completionStatus.finalPayoutDate = lastPayout.created_at;
        }
      }

      // Add warnings for near-completion
      if (!completionStatus.isCompleted) {
        if (completionStatus.completionRate > 90) {
          completionStatus.issues.push('Group is near completion - review remaining items');
        }
        
        if (hasReachedTotalCycles && !memberPayoutStatus.allReceived) {
          completionStatus.issues.push('All cycles completed but payouts pending');
        }
      }

      return {
        success: true,
        data: completionStatus,
      };
    } catch (error) {
      console.error('Error validating group completion:', error);
      return {
        success: false,
        error: error instanceof GroupCompletionError ? error.message : 'Failed to validate group completion',
        code: error instanceof GroupCompletionError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Check if all members have received their payouts
   * @param groupId - Group ID
   * @param members - Active group members
   * @param payouts - All group payouts
   * @returns Payout status summary
   */
  private async checkMemberPayoutStatus(
    groupId: string,
    members: GroupMember[],
    payouts: Payout[]
  ): Promise<{ allReceived: boolean; membersWithoutPayout: number; memberDetails: any[] }> {
    const memberDetails: any[] = [];
    let membersWithoutPayout = 0;

    for (const member of members) {
      const memberPayouts = payouts.filter(p => 
        p.recipient_id === member.user_id && p.status === 'completed'
      );

      const hasReceivedPayout = memberPayouts.length > 0;
      
      if (!hasReceivedPayout) {
        membersWithoutPayout++;
      }

      memberDetails.push({
        userId: member.user_id,
        hasReceivedPayout,
        payoutCount: memberPayouts.length,
        totalReceived: memberPayouts.reduce((sum, p) => sum + p.net_amount, 0),
      });
    }

    return {
      allReceived: membersWithoutPayout === 0,
      membersWithoutPayout,
      memberDetails,
    };
  }

  /**
   * Analyze payment completeness across all cycles
   * @param group - Group data
   * @param contributions - All group contributions
   * @returns Payment analysis
   */
  private async analyzePaymentCompleteness(
    group: Group,
    contributions: Contribution[]
  ): Promise<{ incompleteCycles: number[]; averageCompletionRate: number }> {
    const incompleteCycles: number[] = [];
    const cycleCompletionRates: number[] = [];

    for (let cycle = 1; cycle <= group.current_cycle; cycle++) {
      const cycleContributions = contributions.filter(c => c.cycle_number === cycle);
      const paidContributions = cycleContributions.filter(c => c.status === 'paid');
      
      const completionRate = cycleContributions.length > 0 
        ? (paidContributions.length / cycleContributions.length) * 100 
        : 0;

      cycleCompletionRates.push(completionRate);

      // Consider cycle incomplete if less than 90% paid
      if (completionRate < 90) {
        incompleteCycles.push(cycle);
      }
    }

    const averageCompletionRate = cycleCompletionRates.length > 0
      ? cycleCompletionRates.reduce((sum, rate) => sum + rate, 0) / cycleCompletionRates.length
      : 0;

    return {
      incompleteCycles,
      averageCompletionRate,
    };
  }

  /**
   * Get detailed group completion report
   * @param groupId - Group ID
   * @returns Detailed completion report
   */
  async getGroupCompletionReport(groupId: string): Promise<BusinessLogicResult<GroupCompletionStatus>> {
    try {
      // Fetch all required data
      const [groupResult, membersResult, contributionsResult, payoutsResult] = await Promise.all([
        DatabaseService.groups.getGroupById(groupId),
        DatabaseService.groupMembers.getGroupMembers(groupId),
        DatabaseService.contributions.getGroupContributions(groupId),
        DatabaseService.payouts.getGroupPayouts(groupId)
      ]);

      // Validate all data was fetched successfully
      if (!groupResult.success || !groupResult.data) {
        throw new GroupCompletionError('Failed to fetch group data');
      }
      if (!membersResult.success) {
        throw new GroupCompletionError('Failed to fetch group members');
      }
      if (!contributionsResult.success) {
        throw new GroupCompletionError('Failed to fetch contributions');
      }
      if (!payoutsResult.success) {
        throw new GroupCompletionError('Failed to fetch payouts');
      }

      // Validate completion
      return await this.validateGroupCompletion({
        group: groupResult.data,
        members: membersResult.data.items,
        contributions: contributionsResult.data.items,
        payouts: payoutsResult.data.items,
      });
    } catch (error) {
      console.error('Error generating completion report:', error);
      return {
        success: false,
        error: 'Failed to generate completion report',
        code: 'COMPLETION_REPORT_ERROR',
      };
    }
  }

  /**
   * Finalize group completion
   * @param groupId - Group ID
   * @param adminId - Admin performing the action
   * @returns Finalization result
   */
  async finalizeGroupCompletion(
    groupId: string,
    adminId: string
  ): Promise<BusinessLogicResult<boolean>> {
    try {
      // Get completion status first
      const completionReport = await this.getGroupCompletionReport(groupId);
      
      if (!completionReport.success || !completionReport.data) {
        throw new GroupCompletionError('Failed to validate group completion status');
      }

      const status = completionReport.data;
      
      if (!status.isCompleted) {
        throw new GroupCompletionError(
          `Cannot finalize incomplete group. Issues: ${status.issues.join('; ')}`
        );
      }

      // Verify admin permissions
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new GroupCompletionError('Group not found');
      }

      if (groupResult.data.admin_id !== adminId) {
        throw new GroupCompletionError('Only group admin can finalize completion');
      }

      // Mark group as completed
      const updateResult = await DatabaseService.groups.updateGroup(groupId, {
        status: 'completed',
        completion_date: new Date(),
        final_completion_rate: status.completionRate,
      });

      if (!updateResult.success) {
        throw new GroupCompletionError('Failed to mark group as completed');
      }

      // Update member statistics
      await this.updateMemberCompletionStatistics(groupId);

      console.log(`Group ${groupId} has been finalized as completed`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error finalizing group completion:', error);
      return {
        success: false,
        error: error instanceof GroupCompletionError ? error.message : 'Failed to finalize group completion',
        code: error instanceof GroupCompletionError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Update member statistics upon group completion
   * @param groupId - Group ID
   */
  private async updateMemberCompletionStatistics(groupId: string): Promise<void> {
    try {
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      
      if (membersResult.success && membersResult.data) {
        for (const member of membersResult.data.items) {
          // Update member's completed group count
          await DatabaseService.groupMembers.updateMemberStatistics(member.id, {
            groupCompleted: true,
            completionDate: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Error updating member completion statistics:', error);
    }
  }

  /**
   * Check if group can be marked as completed
   * @param groupId - Group ID
   * @returns Whether group can be completed
   */
  async canCompleteGroup(groupId: string): Promise<BusinessLogicResult<boolean>> {
    try {
      const completionReport = await this.getGroupCompletionReport(groupId);
      
      if (!completionReport.success || !completionReport.data) {
        return {
          success: false,
          error: 'Failed to check group completion eligibility',
        };
      }

      return {
        success: true,
        data: completionReport.data.isCompleted,
        warnings: completionReport.data.issues.length > 0 ? completionReport.data.issues : undefined,
      };
    } catch (error) {
      console.error('Error checking group completion eligibility:', error);
      return {
        success: false,
        error: 'Failed to check completion eligibility',
      };
    }
  }
}

export default new GroupCompletionService();