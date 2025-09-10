import { 
  PaymentStatusSummary, 
  MemberPaymentStatus, 
  CheckPaymentStatusParams, 
  BusinessLogicResult, 
  PaymentValidationError,
  PaymentWindow,
  BUSINESS_CONSTANTS
} from '../../types/business';
import { Contribution } from '../../types/database';
import DatabaseService from '../database';

class PaymentStatusService {
  /**
   * Check payment status for all members in a specific cycle
   * @param params - Payment status check parameters
   * @returns Payment status summary
   */
  async checkPaymentStatus(params: CheckPaymentStatusParams): Promise<BusinessLogicResult<PaymentStatusSummary>> {
    try {
      const { groupId, cycle, includeHistory = false } = params;

      // Validate inputs
      if (!groupId || !cycle) {
        throw new PaymentValidationError('Group ID and cycle are required');
      }

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new PaymentValidationError('Group not found');
      }

      const group = groupResult.data;

      // Get active members
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(
        groupId,
        { status: 'active' }
      );
      if (!membersResult.success) {
        throw new PaymentValidationError('Failed to fetch group members');
      }

      const activeMembers = membersResult.data.items;

      // Get contributions for this cycle
      const contributionsResult = await DatabaseService.contributions.getCycleContributions(
        groupId,
        cycle
      );
      if (!contributionsResult.success) {
        throw new PaymentValidationError('Failed to fetch contributions');
      }

      const contributions = contributionsResult.data;

      // Calculate member payment statuses
      const membersStatus: MemberPaymentStatus[] = [];
      let totalCollected = 0;
      let paidCount = 0;
      let pendingCount = 0;
      let overdueCount = 0;

      for (const member of activeMembers) {
        const memberContribution = contributions.find(c => c.user_id === member.user_id);
        
        if (!memberContribution) {
          // No contribution record - create pending status
          membersStatus.push({
            userId: member.user_id,
            userName: `User ${member.user_id}`, // Would fetch actual name
            status: 'pending',
            amount: group.contribution_amount,
            dueDate: new Date(), // Would calculate based on cycle
            contributionId: undefined,
          });
          pendingCount++;
        } else {
          // Analyze contribution status
          const status = this.determinePaymentStatus(memberContribution);
          const daysOverdue = this.calculateDaysOverdue(memberContribution.due_date);
          
          membersStatus.push({
            userId: member.user_id,
            userName: `User ${member.user_id}`,
            status: status as MemberPaymentStatus['status'],
            amount: memberContribution.amount,
            dueDate: memberContribution.due_date,
            paidDate: memberContribution.paid_date,
            daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
            contributionId: memberContribution.id,
          });

          // Update counters
          switch (status) {
            case 'paid':
              paidCount++;
              totalCollected += memberContribution.amount + (memberContribution.late_penalty_amount || 0);
              break;
            case 'overdue':
              overdueCount++;
              break;
            case 'pending':
              pendingCount++;
              break;
          }
        }
      }

      // Calculate summary
      const totalExpected = group.contribution_amount * activeMembers.length;
      const completionRate = (paidCount / activeMembers.length) * 100;

      const summary: PaymentStatusSummary = {
        groupId,
        cycle,
        totalMembers: activeMembers.length,
        paidMembers: paidCount,
        pendingMembers: pendingCount,
        overdueMembers: overdueCount,
        totalExpected,
        totalCollected,
        completionRate,
        membersStatus,
      };

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      return {
        success: false,
        error: error instanceof PaymentValidationError ? error.message : 'Failed to check payment status',
        code: error instanceof PaymentValidationError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get payment status for a specific user across all cycles
   * @param userId - User ID
   * @param groupId - Group ID
   * @returns User's payment history
   */
  async getUserPaymentHistory(
    userId: string, 
    groupId: string
  ): Promise<BusinessLogicResult<MemberPaymentStatus[]>> {
    try {
      // Get user's contributions for this group
      const contributionsResult = await DatabaseService.contributions.getUserContributions(
        userId,
        { group_id: groupId }
      );

      if (!contributionsResult.success) {
        throw new PaymentValidationError('Failed to fetch user contributions');
      }

      const contributions = contributionsResult.data.items;

      // Convert to payment status format
      const paymentHistory: MemberPaymentStatus[] = contributions.map(contribution => {
        const status = this.determinePaymentStatus(contribution);
        const daysOverdue = this.calculateDaysOverdue(contribution.due_date);

        return {
          userId,
          userName: `User ${userId}`,
          status: status as MemberPaymentStatus['status'],
          amount: contribution.amount,
          dueDate: contribution.due_date,
          paidDate: contribution.paid_date,
          daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
          contributionId: contribution.id,
        };
      });

      // Sort by cycle number (assuming it's available in contribution data)
      paymentHistory.sort((a, b) => {
        // Would sort by cycle number if available
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      return {
        success: true,
        data: paymentHistory,
      };
    } catch (error) {
      console.error('Error getting user payment history:', error);
      return {
        success: false,
        error: error instanceof PaymentValidationError ? error.message : 'Failed to get payment history',
        code: error instanceof PaymentValidationError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get overdue payments across all groups
   * @param maxDays - Maximum days overdue to include
   * @returns List of overdue payments
   */
  async getOverduePayments(maxDays: number = 30): Promise<BusinessLogicResult<MemberPaymentStatus[]>> {
    try {
      const overdueContributions = await DatabaseService.contributions.getOverdueContributions();
      
      if (!overdueContributions.success) {
        throw new PaymentValidationError('Failed to fetch overdue contributions');
      }

      const contributions = overdueContributions.data;
      const overduePayments: MemberPaymentStatus[] = [];

      for (const contribution of contributions) {
        const daysOverdue = this.calculateDaysOverdue(contribution.due_date);
        
        // Filter by max days
        if (daysOverdue <= maxDays) {
          overduePayments.push({
            userId: contribution.user_id,
            userName: `User ${contribution.user_id}`,
            status: 'overdue',
            amount: contribution.amount,
            dueDate: contribution.due_date,
            daysOverdue,
            contributionId: contribution.id,
          });
        }
      }

      // Sort by days overdue (most overdue first)
      overduePayments.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

      return {
        success: true,
        data: overduePayments,
      };
    } catch (error) {
      console.error('Error getting overdue payments:', error);
      return {
        success: false,
        error: 'Failed to get overdue payments',
        code: 'OVERDUE_FETCH_ERROR',
      };
    }
  }

  /**
   * Calculate payment window for a contribution
   * @param contribution - Contribution to analyze
   * @returns Payment window status
   */
  getPaymentWindow(contribution: Contribution): PaymentWindow {
    const now = new Date();
    const dueDate = new Date(contribution.due_date);
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + BUSINESS_CONSTANTS.DEFAULT_GRACE_PERIOD);
    
    const expiredDate = new Date(dueDate);
    expiredDate.setDate(expiredDate.getDate() + BUSINESS_CONSTANTS.MAX_OVERDUE_DAYS);

    if (contribution.status === 'paid') {
      const paidDate = new Date(contribution.paid_date!);
      if (paidDate <= dueDate) {
        return PaymentWindow.ON_TIME;
      } else if (paidDate <= gracePeriodEnd) {
        return PaymentWindow.GRACE_PERIOD;
      } else {
        return PaymentWindow.OVERDUE;
      }
    }

    // For unpaid contributions
    if (now < dueDate) {
      // Check if it's early (more than 3 days before due)
      const earlyThreshold = new Date(dueDate);
      earlyThreshold.setDate(earlyThreshold.getDate() - 3);
      
      return now < earlyThreshold ? PaymentWindow.EARLY : PaymentWindow.ON_TIME;
    } else if (now <= gracePeriodEnd) {
      return PaymentWindow.GRACE_PERIOD;
    } else if (now <= expiredDate) {
      return PaymentWindow.OVERDUE;
    } else {
      return PaymentWindow.EXPIRED;
    }
  }

  /**
   * Mark payments as overdue for a specific cycle
   * @param groupId - Group ID
   * @param cycle - Cycle number
   * @returns Number of payments marked as overdue
   */
  async markOverduePayments(groupId: string, cycle: number): Promise<BusinessLogicResult<number>> {
    try {
      const statusResult = await this.checkPaymentStatus({ groupId, cycle });
      
      if (!statusResult.success || !statusResult.data) {
        throw new PaymentValidationError('Failed to check payment status');
      }

      const status = statusResult.data;
      let markedOverdue = 0;

      // Find pending payments that are past grace period
      for (const memberStatus of status.membersStatus) {
        if (memberStatus.status === 'pending' && memberStatus.contributionId) {
          const daysOverdue = this.calculateDaysOverdue(memberStatus.dueDate);
          
          if (daysOverdue > BUSINESS_CONSTANTS.DEFAULT_GRACE_PERIOD) {
            // Mark contribution as overdue
            const updateResult = await DatabaseService.contributions.markAsOverdue(
              memberStatus.contributionId
            );
            
            if (updateResult.success) {
              markedOverdue++;
            }
          }
        }
      }

      return {
        success: true,
        data: markedOverdue,
      };
    } catch (error) {
      console.error('Error marking overdue payments:', error);
      return {
        success: false,
        error: 'Failed to mark overdue payments',
        code: 'OVERDUE_MARKING_ERROR',
      };
    }
  }

  /**
   * Determine payment status from contribution data
   * @param contribution - Contribution to analyze
   * @returns Payment status
   */
  private determinePaymentStatus(contribution: Contribution): string {
    if (contribution.status === 'paid') {
      return 'paid';
    }

    if (contribution.status === 'cancelled') {
      return 'cancelled';
    }

    const daysOverdue = this.calculateDaysOverdue(contribution.due_date);
    
    if (daysOverdue > BUSINESS_CONSTANTS.DEFAULT_GRACE_PERIOD) {
      return 'overdue';
    }

    return 'pending';
  }

  /**
   * Calculate days overdue for a payment
   * @param dueDate - Due date of payment
   * @returns Number of days overdue (0 if not overdue)
   */
  private calculateDaysOverdue(dueDate: Date): number {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Generate payment status report for a group
   * @param groupId - Group ID
   * @param fromCycle - Starting cycle (optional)
   * @param toCycle - Ending cycle (optional)
   * @returns Payment status report
   */
  async generatePaymentReport(
    groupId: string, 
    fromCycle?: number, 
    toCycle?: number
  ): Promise<BusinessLogicResult<PaymentStatusSummary[]>> {
    try {
      // Get group details to determine cycle range
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new PaymentValidationError('Group not found');
      }

      const group = groupResult.data;
      const startCycle = fromCycle || 1;
      const endCycle = toCycle || group.current_cycle;

      const reports: PaymentStatusSummary[] = [];

      // Generate report for each cycle
      for (let cycle = startCycle; cycle <= endCycle; cycle++) {
        const statusResult = await this.checkPaymentStatus({ groupId, cycle });
        
        if (statusResult.success && statusResult.data) {
          reports.push(statusResult.data);
        }
      }

      return {
        success: true,
        data: reports,
      };
    } catch (error) {
      console.error('Error generating payment report:', error);
      return {
        success: false,
        error: 'Failed to generate payment report',
        code: 'REPORT_GENERATION_ERROR',
      };
    }
  }
}

export default new PaymentStatusService();