import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import PaymentTrackingService from './paymentTracking';
import NotificationService from '../notifications';

export interface LatePaymentMember {
  memberId: string;
  memberName: string;
  groupId: string;
  groupName: string;
  contributionId: string;
  amount: number;
  dueDate: Date;
  daysLate: number;
  cycle: number;
  warningsCount: number;
  penaltyAmount: number;
  lastActionDate?: Date;
  lastActionType?: 'warning' | 'penalty' | 'suspension' | 'removal';
}

export interface LatePaymentSummary {
  totalLateMembers: number;
  totalOverdueAmount: number;
  averageDaysLate: number;
  warningsIssued: number;
  penaltiesApplied: number;
  suspendedMembers: number;
  criticalCases: LatePaymentMember[]; // > 7 days late
}

class LatePaymentMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  async startMonitoring(intervalMinutes: number = 60): Promise<void> {
    if (this.isMonitoring) {
      console.log('Late payment monitoring already running');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting late payment monitoring (checking every ${intervalMinutes} minutes)`);

    // Initial check
    await this.checkLatePayments();

    // Set up recurring checks
    this.monitoringInterval = setInterval(async () => {
      await this.checkLatePayments();
    }, intervalMinutes * 60 * 1000);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Late payment monitoring stopped');
  }

  async checkLatePayments(): Promise<BusinessLogicResult<LatePaymentSummary>> {
    try {
      console.log('Checking for late payments...');

      const lateMembers = await this.getLatePaymentMembers();
      if (!lateMembers.success) {
        return lateMembers;
      }

      const summary = await this.processLatePayments(lateMembers.data);

      console.log(`Late payment check complete: ${summary.totalLateMembers} late members found`);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('Error checking late payments:', error);
      return {
        success: false,
        error: 'Failed to check late payments',
        code: 'CHECK_ERROR',
      };
    }
  }

  async getLatePaymentMembers(groupId?: string): Promise<BusinessLogicResult<LatePaymentMember[]>> {
    try {
      // Get all pending/overdue contributions
      const contributionsResult = groupId 
        ? await DatabaseService.contributions.getGroupContributions(groupId)
        : await DatabaseService.contributions.getAllPendingContributions();

      if (!contributionsResult.success) {
        return {
          success: false,
          error: 'Failed to fetch contributions',
          code: 'FETCH_ERROR',
        };
      }

      const now = new Date();
      const lateMembers: LatePaymentMember[] = [];

      for (const contribution of contributionsResult.data.items) {
        const dueDate = new Date(contribution.due_date);
        const daysLate = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLate > 0 && contribution.status !== 'paid') {
          // Get member details
          const memberResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(
            contribution.user_id,
            contribution.group_id
          );

          let memberName = 'Unknown Member';
          if (memberResult.success && memberResult.data) {
            // Get user profile for display name
            const userResult = await DatabaseService.users.getUserById(contribution.user_id);
            if (userResult.success && userResult.data) {
              memberName = userResult.data.displayName || userResult.data.email;
            }
          }

          // Get group name
          const groupResult = await DatabaseService.groups.getGroupById(contribution.group_id);
          const groupName = groupResult.success && groupResult.data 
            ? groupResult.data.name 
            : 'Unknown Group';

          // Check warning history and penalties
          const warningsCount = await this.getWarningsCount(
            contribution.user_id, 
            contribution.group_id, 
            contribution.cycle_number
          );

          lateMembers.push({
            memberId: contribution.user_id,
            memberName,
            groupId: contribution.group_id,
            groupName,
            contributionId: contribution.id,
            amount: contribution.amount,
            dueDate,
            daysLate,
            cycle: contribution.cycle_number,
            warningsCount,
            penaltyAmount: contribution.late_penalty_amount || 0,
            lastActionDate: contribution.last_reminder_sent || undefined,
          });
        }
      }

      // Sort by days late (most critical first)
      lateMembers.sort((a, b) => b.daysLate - a.daysLate);

      return {
        success: true,
        data: lateMembers,
      };
    } catch (error) {
      console.error('Error getting late payment members:', error);
      return {
        success: false,
        error: 'Failed to get late payment members',
        code: 'GET_LATE_MEMBERS_ERROR',
      };
    }
  }

  private async processLatePayments(lateMembers: LatePaymentMember[]): Promise<LatePaymentSummary> {
    let warningsIssued = 0;
    let penaltiesApplied = 0;
    let suspendedMembers = 0;
    const criticalCases: LatePaymentMember[] = [];

    for (const member of lateMembers) {
      try {
        // Determine action based on days late and previous actions
        const action = this.determineAction(member);
        
        if (action) {
          const result = await this.executeAction(member, action);
          if (result.success) {
            switch (action.type) {
              case 'warning':
                warningsIssued++;
                break;
              case 'penalty':
                penaltiesApplied++;
                break;
              case 'suspension':
                suspendedMembers++;
                break;
            }
          }
        }

        // Track critical cases (>7 days late)
        if (member.daysLate > 7) {
          criticalCases.push(member);
        }
      } catch (error) {
        console.error(`Error processing late payment for member ${member.memberId}:`, error);
      }
    }

    const totalOverdueAmount = lateMembers.reduce((sum, member) => sum + member.amount, 0);
    const averageDaysLate = lateMembers.length > 0 
      ? lateMembers.reduce((sum, member) => sum + member.daysLate, 0) / lateMembers.length 
      : 0;

    return {
      totalLateMembers: lateMembers.length,
      totalOverdueAmount,
      averageDaysLate: Math.round(averageDaysLate * 10) / 10,
      warningsIssued,
      penaltiesApplied,
      suspendedMembers,
      criticalCases: criticalCases.slice(0, 10), // Top 10 critical cases
    };
  }

  private determineAction(member: LatePaymentMember): { type: 'warning' | 'penalty' | 'suspension' | null; notes: string } | null {
    const { daysLate, warningsCount, penaltyAmount, lastActionDate } = member;
    
    // Don't take action if we've already taken action today
    if (lastActionDate && this.isSameDay(lastActionDate, new Date())) {
      return null;
    }

    // Progressive escalation
    if (daysLate >= 1 && daysLate <= 3 && warningsCount === 0) {
      return {
        type: 'warning',
        notes: `First warning: Payment is ${daysLate} day(s) overdue. Please pay as soon as possible to avoid penalties.`,
      };
    }

    if (daysLate >= 4 && daysLate <= 7 && warningsCount <= 1) {
      return {
        type: 'warning',
        notes: `Second warning: Payment is ${daysLate} days overdue. A penalty may be applied if payment is not received soon.`,
      };
    }

    if (daysLate >= 8 && penaltyAmount === 0) {
      return {
        type: 'penalty',
        notes: `Penalty applied: Payment is ${daysLate} days overdue. A 5% late fee has been added to your contribution.`,
      };
    }

    if (daysLate >= 14) {
      return {
        type: 'suspension',
        notes: `Account suspended: Payment is ${daysLate} days overdue. Your account has been suspended until payment is received.`,
      };
    }

    return null;
  }

  private async executeAction(
    member: LatePaymentMember, 
    action: { type: 'warning' | 'penalty' | 'suspension'; notes: string }
  ): Promise<BusinessLogicResult<any>> {
    try {
      // Get group admin for the action
      const groupResult = await DatabaseService.groups.getGroupById(member.groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const adminId = groupResult.data.admin_id;

      // Execute the action through PaymentTrackingService
      const actionResult = await PaymentTrackingService.handleLatePayment({
        contributionId: member.contributionId,
        adminId,
        action: action.type,
        notes: action.notes,
      });

      if (actionResult.success) {
        // Send notification to member
        await this.sendActionNotification(member, action);
        
        // Send summary to admin if it's a critical action
        if (action.type === 'suspension') {
          await this.sendAdminNotification(adminId, member, action);
        }
      }

      return actionResult;
    } catch (error) {
      console.error('Error executing late payment action:', error);
      return {
        success: false,
        error: 'Failed to execute action',
        code: 'ACTION_ERROR',
      };
    }
  }

  private async sendActionNotification(
    member: LatePaymentMember, 
    action: { type: string; notes: string }
  ): Promise<void> {
    try {
      const title = this.getActionTitle(action.type);
      
      await NotificationService.sendToUser(member.memberId, {
        type: 'late_payment_action',
        title,
        message: action.notes,
        data: {
          groupId: member.groupId,
          contributionId: member.contributionId,
          actionType: action.type,
          daysLate: member.daysLate,
          amount: member.amount,
        },
      });
    } catch (error) {
      console.error('Error sending action notification:', error);
    }
  }

  private async sendAdminNotification(
    adminId: string, 
    member: LatePaymentMember, 
    action: { type: string; notes: string }
  ): Promise<void> {
    try {
      await NotificationService.sendToUser(adminId, {
        type: 'member_suspended',
        title: 'Member Suspended for Late Payment',
        message: `${member.memberName} has been suspended for being ${member.daysLate} days late on their payment.`,
        data: {
          groupId: member.groupId,
          memberId: member.memberId,
          contributionId: member.contributionId,
          daysLate: member.daysLate,
          amount: member.amount,
        },
      });
    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }

  private getActionTitle(actionType: string): string {
    switch (actionType) {
      case 'warning': return 'Payment Reminder';
      case 'penalty': return 'Late Payment Penalty Applied';
      case 'suspension': return 'Account Suspended';
      default: return 'Payment Notice';
    }
  }

  private async getWarningsCount(memberId: string, groupId: string, cycle: number): Promise<number> {
    // In a real implementation, this would query a late payment actions log table
    // For now, return 0 as placeholder
    return 0;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  async getLatePaymentSummary(groupId?: string): Promise<BusinessLogicResult<LatePaymentSummary>> {
    const lateMembers = await this.getLatePaymentMembers(groupId);
    if (!lateMembers.success) {
      return lateMembers as BusinessLogicResult<LatePaymentSummary>;
    }

    const summary = await this.processLatePayments(lateMembers.data);
    
    return {
      success: true,
      data: summary,
    };
  }

  // Cleanup method
  cleanup(): void {
    this.stopMonitoring();
  }
}

export default new LatePaymentMonitorService();