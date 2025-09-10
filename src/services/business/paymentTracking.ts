import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import BusinessLogicService from '../business';
import { MemberPaymentStatus } from '../../types/business';
import TurnRotationScheduler from './turnRotationScheduler';
import PaymentReminderService from '../notifications/paymentReminders';
import PayoutNotificationService from '../notifications/payoutNotifications';


export interface PaymentConfirmation {
  contributionId: string;
  memberId: string;
  groupId: string;
  cycle: number;
  amount: number;
  confirmationType: 'cash' | 'bank_transfer' | 'mobile_money' | 'other';
  confirmationMethod: 'admin_manual' | 'receipt_upload' | 'bank_verification';
  confirmedBy: string; // Admin user ID
  confirmedAt: Date;
  notes?: string;
  receiptUrl?: string;
}

export interface PaymentProgress {
  groupId: string;
  cycle: number;
  totalMembers: number;
  paidMembers: number;
  pendingMembers: number;
  overdueMembers: number;
  totalExpected: number;
  totalCollected: number;
  completionPercentage: number;
  canProcessCycle: boolean;
  nextRecipient?: {
    userId: string;
    name: string;
    expectedAmount: number;
  };
}

export interface PaymentHistoryItem {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  cycle: number;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidDate?: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
  confirmationType?: string;
  lateDays?: number;
  penaltyAmount?: number;
}

export interface LatePaymentAction {
  type: 'warning' | 'penalty' | 'suspension' | 'removal';
  memberId: string;
  groupId: string;
  cycle: number;
  daysLate: number;
  actionTaken: string;
  actionDate: Date;
  actionBy: string;
  notes?: string;
}

class PaymentTrackingService {
  /**
   * Admin function to mark member payment as confirmed
   * @param params - Payment confirmation details
   * @returns Confirmation result
   */
  async confirmMemberPayment(params: {
    contributionId: string;
    adminId: string;
    confirmationType: PaymentConfirmation['confirmationType'];
    notes?: string;
    receiptUrl?: string;
    customAmount?: number;
  }): Promise<BusinessLogicResult<PaymentConfirmation>> {
    try {
      const { contributionId, adminId, confirmationType, notes, receiptUrl, customAmount } = params;

      // Get contribution details
      const contributionResult = await DatabaseService.contributions.getContributionById(contributionId);
      if (!contributionResult.success || !contributionResult.data) {
        return {
          success: false,
          error: 'Contribution not found',
          code: 'CONTRIBUTION_NOT_FOUND',
        };
      }

      const contribution = contributionResult.data;

      // Verify admin permissions
      const groupResult = await DatabaseService.groups.getGroupById(contribution.group_id);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      if (groupResult.data.admin_id !== adminId) {
        return {
          success: false,
          error: 'Only group admin can confirm payments',
          code: 'PERMISSION_DENIED',
        };
      }

      // Check if payment is already confirmed
      if (contribution.status === 'paid') {
        return {
          success: false,
          error: 'Payment already confirmed',
          code: 'ALREADY_CONFIRMED',
        };
      }

      const now = new Date();
      const finalAmount = customAmount || contribution.amount;

      // Create payment confirmation record
      const confirmation: PaymentConfirmation = {
        contributionId: contributionId,
        memberId: contribution.user_id,
        groupId: contribution.group_id,
        cycle: contribution.cycle_number,
        amount: finalAmount,
        confirmationType: confirmationType,
        confirmationMethod: 'admin_manual',
        confirmedBy: adminId,
        confirmedAt: now,
        notes: notes,
        receiptUrl: receiptUrl,
      };

      // Calculate late penalty if applicable
      let penaltyAmount = 0;
      const daysLate = Math.max(0, Math.ceil((now.getTime() - new Date(contribution.due_date).getTime()) / (1000 * 60 * 60 * 24)));
      if (daysLate > 0) {
        penaltyAmount = finalAmount * 0.01 * Math.min(daysLate, 30); // 1% per day, max 30%
      }

      // Update contribution status
      const updateResult = await DatabaseService.contributions.updateContribution(contributionId, {
        status: 'paid',
        paid_date: now,
        paid_amount: finalAmount,
        late_penalty_amount: penaltyAmount,
        confirmed_by: adminId,
        confirmation_type: confirmationType,
        confirmation_notes: notes,
      });

      if (!updateResult.success) {
        return {
          success: false,
          error: 'Failed to update contribution status',
          code: 'UPDATE_FAILED',
        };
      }

      // Cancel payment reminders since payment is confirmed
      await PaymentReminderService.cancelReminders(contributionId);

      // Update group statistics
      await this.updateGroupPaymentStats(contribution.group_id, contribution.cycle_number);

      // Check if cycle can be processed (all payments collected)
      await this.checkCycleCompletion(contribution.group_id, contribution.cycle_number);

      // Log the confirmation for audit
      console.log(`Payment confirmed: ${contributionId} by admin ${adminId}`);

      return {
        success: true,
        data: confirmation,
      };
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        success: false,
        error: 'Failed to confirm payment',
        code: 'CONFIRMATION_ERROR',
      };
    }
  }

  /**
   * Get payment progress for a group and cycle
   * @param groupId - Group ID
   * @param cycle - Cycle number
   * @returns Payment progress summary
   */
  async getPaymentProgress(groupId: string, cycle: number): Promise<BusinessLogicResult<PaymentProgress>> {
    try {
      // Get payment status using existing business logic
      const paymentStatusResult = await BusinessLogicService.checkPaymentStatus({
        groupId: groupId,
        cycle: cycle,
      });

      if (!paymentStatusResult.success || !paymentStatusResult.data) {
        return {
          success: false,
          error: 'Failed to get payment status',
          code: 'PAYMENT_STATUS_ERROR',
        };
      }

      const paymentStatus = paymentStatusResult.data;

      // Get turn order to find next recipient
      const turnOrderResult = await BusinessLogicService.calculateTurnOrder({
        group: await this.getGroupData(groupId),
        members: await this.getGroupMembers(groupId),
        currentCycle: cycle,
      });

      let nextRecipient;
      if (turnOrderResult.success && turnOrderResult.data) {
        const currentTurn = turnOrderResult.data.find(turn => turn.status === 'current');
        if (currentTurn) {
          nextRecipient = {
            userId: currentTurn.recipientId,
            name: currentTurn.recipientName,
            expectedAmount: paymentStatus.totalExpected,
          };
        }
      }

      const progress: PaymentProgress = {
        groupId: groupId,
        cycle: cycle,
        totalMembers: paymentStatus.totalMembers,
        paidMembers: paymentStatus.paidMembers,
        pendingMembers: paymentStatus.pendingMembers,
        overdueMembers: paymentStatus.overdueMembers,
        totalExpected: paymentStatus.totalExpected,
        totalCollected: paymentStatus.totalCollected,
        completionPercentage: paymentStatus.completionRate,
        canProcessCycle: paymentStatus.completionRate >= 100,
        nextRecipient: nextRecipient,
      };

      return {
        success: true,
        data: progress,
      };
    } catch (error) {
      console.error('Error getting payment progress:', error);
      return {
        success: false,
        error: 'Failed to get payment progress',
        code: 'PROGRESS_ERROR',
      };
    }
  }

  /**
   * Get payment history for a member across all cycles
   * @param memberId - Member user ID
   * @param groupId - Group ID
   * @returns Payment history
   */
  async getMemberPaymentHistory(memberId: string, groupId: string): Promise<BusinessLogicResult<PaymentHistoryItem[]>> {
    try {
      // Get member's contributions for this group
      const contributionsResult = await DatabaseService.contributions.getUserContributions(
        memberId,
        { group_id: groupId }
      );

      if (!contributionsResult.success) {
        return {
          success: false,
          error: 'Failed to fetch payment history',
          code: 'HISTORY_FETCH_ERROR',
        };
      }

      const contributions = contributionsResult.data.items;
      
      // Convert to payment history format
      const history: PaymentHistoryItem[] = contributions.map(contribution => {
        const daysLate = contribution.paid_date ? 
          Math.max(0, Math.ceil((new Date(contribution.paid_date).getTime() - new Date(contribution.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 
          Math.max(0, Math.ceil((new Date().getTime() - new Date(contribution.due_date).getTime()) / (1000 * 60 * 60 * 24)));

        return {
          id: contribution.id,
          groupId: contribution.group_id,
          memberId: contribution.user_id,
          memberName: `User ${contribution.user_id}`, // Would fetch actual name
          cycle: contribution.cycle_number,
          amount: contribution.amount,
          status: contribution.status as 'paid' | 'pending' | 'overdue' | 'cancelled',
          dueDate: contribution.due_date,
          paidDate: contribution.paid_date || undefined,
          confirmedBy: contribution.confirmed_by || undefined,
          confirmedAt: contribution.paid_date || undefined,
          confirmationType: contribution.confirmation_type || undefined,
          lateDays: daysLate > 0 ? daysLate : undefined,
          penaltyAmount: contribution.late_penalty_amount || undefined,
        };
      });

      // Sort by cycle number (most recent first)
      history.sort((a, b) => b.cycle - a.cycle);

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error('Error getting member payment history:', error);
      return {
        success: false,
        error: 'Failed to get payment history',
        code: 'HISTORY_ERROR',
      };
    }
  }

  /**
   * Get group-wide payment history
   * @param groupId - Group ID
   * @param fromCycle - Starting cycle (optional)
   * @param toCycle - Ending cycle (optional)
   * @returns Group payment history
   */
  async getGroupPaymentHistory(
    groupId: string, 
    fromCycle?: number, 
    toCycle?: number
  ): Promise<BusinessLogicResult<PaymentHistoryItem[]>> {
    try {
      const contributionsResult = await DatabaseService.contributions.getGroupContributions(groupId);
      
      if (!contributionsResult.success) {
        return {
          success: false,
          error: 'Failed to fetch group payment history',
          code: 'GROUP_HISTORY_ERROR',
        };
      }

      let contributions = contributionsResult.data.items;

      // Filter by cycle range if specified
      if (fromCycle !== undefined) {
        contributions = contributions.filter(c => c.cycle_number >= fromCycle);
      }
      if (toCycle !== undefined) {
        contributions = contributions.filter(c => c.cycle_number <= toCycle);
      }

      // Convert to payment history format
      const history: PaymentHistoryItem[] = contributions.map(contribution => {
        const daysLate = contribution.paid_date ? 
          Math.max(0, Math.ceil((new Date(contribution.paid_date).getTime() - new Date(contribution.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 
          Math.max(0, Math.ceil((new Date().getTime() - new Date(contribution.due_date).getTime()) / (1000 * 60 * 60 * 24)));

        return {
          id: contribution.id,
          groupId: contribution.group_id,
          memberId: contribution.user_id,
          memberName: `User ${contribution.user_id}`,
          cycle: contribution.cycle_number,
          amount: contribution.amount,
          status: contribution.status as 'paid' | 'pending' | 'overdue' | 'cancelled',
          dueDate: contribution.due_date,
          paidDate: contribution.paid_date || undefined,
          confirmedBy: contribution.confirmed_by || undefined,
          confirmedAt: contribution.paid_date || undefined,
          confirmationType: contribution.confirmation_type || undefined,
          lateDays: daysLate > 0 ? daysLate : undefined,
          penaltyAmount: contribution.late_penalty_amount || undefined,
        };
      });

      // Sort by cycle and then by member
      history.sort((a, b) => {
        if (a.cycle !== b.cycle) return b.cycle - a.cycle;
        return a.memberName.localeCompare(b.memberName);
      });

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error('Error getting group payment history:', error);
      return {
        success: false,
        error: 'Failed to get group payment history',
        code: 'GROUP_HISTORY_ERROR',
      };
    }
  }

  /**
   * Handle late payment actions (warnings, penalties, etc.)
   * @param params - Late payment action parameters
   * @returns Action result
   */
  async handleLatePayment(params: {
    contributionId: string;
    adminId: string;
    action: LatePaymentAction['type'];
    notes?: string;
  }): Promise<BusinessLogicResult<LatePaymentAction>> {
    try {
      const { contributionId, adminId, action, notes } = params;

      // Get contribution details
      const contributionResult = await DatabaseService.contributions.getContributionById(contributionId);
      if (!contributionResult.success || !contributionResult.data) {
        return {
          success: false,
          error: 'Contribution not found',
          code: 'CONTRIBUTION_NOT_FOUND',
        };
      }

      const contribution = contributionResult.data;

      // Verify admin permissions
      const groupResult = await DatabaseService.groups.getGroupById(contribution.group_id);
      if (!groupResult.success || !groupResult.data || groupResult.data.admin_id !== adminId) {
        return {
          success: false,
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
        };
      }

      const now = new Date();
      const daysLate = Math.ceil((now.getTime() - new Date(contribution.due_date).getTime()) / (1000 * 60 * 60 * 24));

      let actionTaken = '';
      
      switch (action) {
        case 'warning':
          actionTaken = `Warning sent for ${daysLate} days late payment`;
          // Would send notification to member
          break;
        case 'penalty':
          const penaltyAmount = contribution.amount * 0.05; // 5% penalty
          actionTaken = `Penalty applied: ${penaltyAmount}`;
          // Update contribution with penalty
          await DatabaseService.contributions.updateContribution(contributionId, {
            late_penalty_amount: penaltyAmount,
          });
          break;
        case 'suspension':
          actionTaken = `Member suspended for late payment`;
          // Update member status
          const memberResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(
            contribution.user_id, 
            contribution.group_id
          );
          if (memberResult.success && memberResult.data) {
            await DatabaseService.groupMembers.updateMemberStatus(memberResult.data.id, 'suspended');
          }
          break;
        case 'removal':
          actionTaken = `Member removed for chronic late payments`;
          // This would require more complex logic to handle ongoing cycles
          break;
      }

      const latePaymentAction: LatePaymentAction = {
        type: action,
        memberId: contribution.user_id,
        groupId: contribution.group_id,
        cycle: contribution.cycle_number,
        daysLate: daysLate,
        actionTaken: actionTaken,
        actionDate: now,
        actionBy: adminId,
        notes: notes,
      };

      // Log the action
      console.log(`Late payment action taken:`, latePaymentAction);

      return {
        success: true,
        data: latePaymentAction,
      };
    } catch (error) {
      console.error('Error handling late payment:', error);
      return {
        success: false,
        error: 'Failed to handle late payment',
        code: 'LATE_PAYMENT_ERROR',
      };
    }
  }

  /**
   * Process automatic turn rotation after cycle completion
   * @param groupId - Group ID
   * @param completedCycle - Completed cycle number
   * @returns Turn rotation result
   */
  async processAutomaticTurnRotation(groupId: string, completedCycle: number): Promise<BusinessLogicResult<any>> {
    try {
      // Check if cycle is actually complete
      const progressResult = await this.getPaymentProgress(groupId, completedCycle);
      if (!progressResult.success || !progressResult.data) {
        return {
          success: false,
          error: 'Failed to check cycle completion',
          code: 'PROGRESS_CHECK_ERROR',
        };
      }

      if (!progressResult.data.canProcessCycle) {
        return {
          success: false,
          error: 'Cycle is not complete yet',
          code: 'CYCLE_INCOMPLETE',
        };
      }

      // Get group admin for processing
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const group = groupResult.data;

      // Process the cycle using business logic
      const cycleProcessResult = await BusinessLogicService.processGroupCycle({
        groupId: groupId,
        adminId: group.admin_id,
        forceProcess: false,
        skipValidation: false,
      });

      if (!cycleProcessResult.success) {
        return {
          success: false,
          error: cycleProcessResult.error || 'Failed to process cycle',
          code: 'CYCLE_PROCESS_ERROR',
        };
      }

      // Send notifications about cycle completion and new cycle start
      // This would integrate with the notification system

      console.log(`Automatic turn rotation completed for group ${groupId}, cycle ${completedCycle}`);

      return {
        success: true,
        data: {
          completedCycle: completedCycle,
          newCycle: completedCycle + 1,
          processedAt: new Date(),
          result: cycleProcessResult.data,
        },
      };
    } catch (error) {
      console.error('Error processing automatic turn rotation:', error);
      return {
        success: false,
        error: 'Failed to process turn rotation',
        code: 'ROTATION_ERROR',
      };
    }
  }

  /**
   * Get pending confirmations for admin (payments awaiting confirmation)
   * @param adminId - Admin user ID
   * @returns Pending confirmations
   */
  async getPendingConfirmations(adminId: string): Promise<BusinessLogicResult<MemberPaymentStatus[]>> {
    try {
      // Get groups where user is admin
      const adminGroupsResult = await DatabaseService.groupMembers.getUserMemberships(adminId, {
        role: 'admin',
      });

      if (!adminGroupsResult.success) {
        return {
          success: false,
          error: 'Failed to fetch admin groups',
          code: 'ADMIN_GROUPS_ERROR',
        };
      }

      const adminGroups = adminGroupsResult.data.items;
      let allPendingPayments: MemberPaymentStatus[] = [];

      // Get pending payments for each admin group
      for (const membership of adminGroups) {
        const groupResult = await DatabaseService.groups.getGroupById(membership.group_id);
        if (groupResult.success && groupResult.data) {
          const group = groupResult.data;
          
          const paymentStatusResult = await BusinessLogicService.checkPaymentStatus({
            groupId: group.id,
            cycle: group.current_cycle,
          });

          if (paymentStatusResult.success && paymentStatusResult.data) {
            const pendingPayments = paymentStatusResult.data.membersStatus.filter(
              member => member.status === 'pending' || member.status === 'overdue'
            );
            allPendingPayments.push(...pendingPayments);
          }
        }
      }

      // Sort by overdue status and days overdue
      allPendingPayments.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        return (b.daysOverdue || 0) - (a.daysOverdue || 0);
      });

      return {
        success: true,
        data: allPendingPayments,
      };
    } catch (error) {
      console.error('Error getting pending confirmations:', error);
      return {
        success: false,
        error: 'Failed to get pending confirmations',
        code: 'PENDING_CONFIRMATIONS_ERROR',
      };
    }
  }

  // Helper methods

  private async updateGroupPaymentStats(groupId: string, cycle: number): Promise<void> {
    try {
      const progressResult = await this.getPaymentProgress(groupId, cycle);
      if (progressResult.success && progressResult.data) {
        const progress = progressResult.data;
        
        // Update group statistics
        await DatabaseService.groups.updateGroup(groupId, {
          total_contributions_collected: progress.totalCollected,
        });
      }
    } catch (error) {
      console.error('Error updating group payment stats:', error);
    }
  }

  private async checkCycleCompletion(groupId: string, cycle: number): Promise<void> {
    try {
      const progressResult = await this.getPaymentProgress(groupId, cycle);
      if (progressResult.success && progressResult.data) {
        const progress = progressResult.data;
        
        // If cycle is 100% complete, schedule automatic turn rotation
        if (progress.canProcessCycle && progress.completionPercentage === 100) {
          console.log(`Cycle ${cycle} complete for group ${groupId}. Scheduling automatic turn rotation.`);
          
          // Use the scheduler service for better reliability and retry logic
          const scheduleResult = await TurnRotationScheduler.scheduleAutomaticRotation({
            groupId,
            cycle,
            delayMinutes: 5, // 5-minute delay to allow for any final updates
          });
          
          if (!scheduleResult.success) {
            console.error('Failed to schedule automatic turn rotation:', scheduleResult.error);
            // Fallback to immediate processing if scheduling fails
            setTimeout(() => {
              this.processAutomaticTurnRotation(groupId, cycle);
            }, 5000);
          }
        }
      }
    } catch (error) {
      console.error('Error checking cycle completion:', error);
    }
  }

  private async getGroupData(groupId: string): Promise<any> {
    const result = await DatabaseService.groups.getGroupById(groupId);
    return result.success ? result.data : null;
  }

  private async getGroupMembers(groupId: string): Promise<any[]> {
    const result = await DatabaseService.groupMembers.getGroupMembers(groupId);
    return result.success ? result.data.items : [];
  }
}

export default new PaymentTrackingService();