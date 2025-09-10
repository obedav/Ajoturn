import { 
  PaymentReminderConfig, 
  ReminderResult, 
  SendPaymentRemindersParams, 
  BusinessLogicResult, 
  NotificationError,
  NotificationPriority,
  BUSINESS_CONSTANTS
} from '../../types/business';
import { MemberPaymentStatus } from '../../types/business';
import DatabaseService from '../database';
import NotificationService from '../notifications';
import PaymentStatusService from './paymentStatus';

class PaymentReminderService {
  /**
   * Send payment reminders to members who haven't paid
   * @param params - Reminder configuration parameters
   * @returns Reminder sending results
   */
  async sendPaymentReminders(params: SendPaymentRemindersParams): Promise<BusinessLogicResult<ReminderResult>> {
    try {
      const { groupId, cycle, reminderConfig, testMode = false } = params;

      // Validate inputs
      if (!groupId || !cycle) {
        throw new NotificationError('Group ID and cycle are required');
      }

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new NotificationError('Group not found');
      }

      const group = groupResult.data;

      // Get payment status for the cycle
      const paymentStatusResult = await PaymentStatusService.checkPaymentStatus({
        groupId,
        cycle,
      });

      if (!paymentStatusResult.success || !paymentStatusResult.data) {
        throw new NotificationError('Failed to get payment status');
      }

      const paymentStatus = paymentStatusResult.data;
      
      // Filter members who need reminders
      const membersNeedingReminders = paymentStatus.membersStatus.filter(member => 
        member.status === 'pending' || member.status === 'overdue'
      );

      if (membersNeedingReminders.length === 0) {
        return {
          success: true,
          data: {
            success: true,
            totalSent: 0,
            failedSends: 0,
            results: [],
          },
        };
      }

      // Use provided config or create default
      const config = reminderConfig || this.createDefaultReminderConfig(groupId, group);

      const reminderResult: ReminderResult = {
        success: true,
        totalSent: 0,
        failedSends: 0,
        results: [],
      };

      // Send reminders to each member
      for (const member of membersNeedingReminders) {
        const memberReminders = await this.sendMemberReminders(
          member,
          group,
          cycle,
          config,
          testMode
        );
        
        reminderResult.results.push(...memberReminders);
        reminderResult.totalSent += memberReminders.filter(r => r.success).length;
        reminderResult.failedSends += memberReminders.filter(r => !r.success).length;
      }

      // Log reminder batch
      if (!testMode) {
        await this.logReminderBatch(groupId, cycle, reminderResult);
      }

      console.log(`Sent ${reminderResult.totalSent} payment reminders for group ${groupId}, cycle ${cycle}`);

      return {
        success: true,
        data: reminderResult,
      };
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      return {
        success: false,
        error: error instanceof NotificationError ? error.message : 'Failed to send payment reminders',
        code: error instanceof NotificationError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Send reminders to a specific member via multiple channels
   * @param member - Member payment status
   * @param group - Group details
   * @param cycle - Current cycle
   * @param config - Reminder configuration
   * @param testMode - Whether in test mode
   * @returns Individual reminder results
   */
  private async sendMemberReminders(
    member: MemberPaymentStatus,
    group: any,
    cycle: number,
    config: PaymentReminderConfig,
    testMode: boolean
  ): Promise<ReminderResult['results']> {
    const results: ReminderResult['results'] = [];

    // Get user details for contact information
    const userResult = await DatabaseService.users.getUserById(member.userId);
    if (!userResult.success || !userResult.data) {
      results.push({
        userId: member.userId,
        reminderType: 'push',
        success: false,
        error: 'User not found',
      });
      return results;
    }

    const user = userResult.data;

    // Determine reminder urgency
    const priority = this.calculateReminderPriority(member);
    const daysOverdue = member.daysOverdue || 0;

    // Prepare reminder message
    const message = this.createReminderMessage(member, group, cycle, config, daysOverdue);

    // Send via enabled channels
    for (const reminderType of config.reminderTypes) {
      if (!reminderType.enabled) continue;

      try {
        let success = false;
        
        if (testMode) {
          console.log(`[TEST MODE] Would send ${reminderType.type} reminder to ${user.name}`);
          success = true;
        } else {
          switch (reminderType.type) {
            case 'push':
              success = await this.sendPushNotification(user, message, priority);
              break;
            case 'email':
              success = await this.sendEmailReminder(user, message, group, cycle);
              break;
            case 'sms':
              success = await this.sendSMSReminder(user, message);
              break;
          }
        }

        results.push({
          userId: member.userId,
          reminderType: reminderType.type,
          success,
        });
      } catch (error) {
        results.push({
          userId: member.userId,
          reminderType: reminderType.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Send push notification reminder
   * @param user - User to notify
   * @param message - Notification message
   * @param priority - Notification priority
   * @returns Success status
   */
  private async sendPushNotification(
    user: any,
    message: string,
    priority: NotificationPriority
  ): Promise<boolean> {
    try {
      if (!user.fcm_token) {
        console.warn(`No FCM token for user ${user.id}`);
        return false;
      }

      await NotificationService.sendToUser(user.id, {
        title: 'Payment Reminder - Ajoturn',
        body: message,
        data: {
          type: 'payment_reminder',
          userId: user.id,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  /**
   * Send email reminder
   * @param user - User to notify
   * @param message - Email message
   * @param group - Group details
   * @param cycle - Current cycle
   * @returns Success status
   */
  private async sendEmailReminder(
    user: any,
    message: string,
    group: any,
    cycle: number
  ): Promise<boolean> {
    try {
      if (!user.email) {
        console.warn(`No email address for user ${user.id}`);
        return false;
      }

      // This would integrate with an email service like SendGrid, AWS SES, etc.
      // For now, we'll simulate the email sending
      console.log(`[EMAIL] To: ${user.email}, Subject: Payment Reminder - ${group.name}`);
      console.log(`[EMAIL] Message: ${message}`);

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return true;
    } catch (error) {
      console.error('Failed to send email reminder:', error);
      return false;
    }
  }

  /**
   * Send SMS reminder
   * @param user - User to notify
   * @param message - SMS message
   * @returns Success status
   */
  private async sendSMSReminder(user: any, message: string): Promise<boolean> {
    try {
      if (!user.phone) {
        console.warn(`No phone number for user ${user.id}`);
        return false;
      }

      // This would integrate with an SMS service like Twilio, AWS SNS, etc.
      // For now, we'll simulate the SMS sending
      console.log(`[SMS] To: ${user.phone}, Message: ${message.substring(0, 160)}...`);

      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 50));

      return true;
    } catch (error) {
      console.error('Failed to send SMS reminder:', error);
      return false;
    }
  }

  /**
   * Create reminder message based on member status and group details
   * @param member - Member payment status
   * @param group - Group details
   * @param cycle - Current cycle
   * @param config - Reminder configuration
   * @param daysOverdue - Days overdue
   * @returns Formatted reminder message
   */
  private createReminderMessage(
    member: MemberPaymentStatus,
    group: any,
    cycle: number,
    config: PaymentReminderConfig,
    daysOverdue: number
  ): string {
    if (config.customMessage) {
      return config.customMessage
        .replace('{memberName}', member.userName)
        .replace('{groupName}', group.name)
        .replace('{amount}', new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(member.amount))
        .replace('{cycle}', cycle.toString())
        .replace('{daysOverdue}', daysOverdue.toString());
    }

    let message = '';
    const formattedAmount = new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 0 
    }).format(member.amount);

    if (member.status === 'overdue') {
      message = `Hi ${member.userName}! Your payment of ${formattedAmount} for ${group.name} (Cycle ${cycle}) is ${daysOverdue} days overdue. `;
      
      if (config.includePenaltyWarning) {
        const penaltyAmount = member.amount * BUSINESS_CONSTANTS.PENALTY_RATE;
        const formattedPenalty = new Intl.NumberFormat('en-NG', { 
          style: 'currency', 
          currency: 'NGN',
          minimumFractionDigits: 0 
        }).format(penaltyAmount);
        message += `A penalty of ${formattedPenalty} may apply. `;
      }
      
      message += 'Please make your payment as soon as possible to avoid further delays.';
    } else {
      const dueDate = new Date(member.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 1) {
        message = `Hi ${member.userName}! Your payment of ${formattedAmount} for ${group.name} (Cycle ${cycle}) is due ${daysUntilDue === 0 ? 'today' : 'tomorrow'}. Please make your payment to stay on track.`;
      } else {
        message = `Hi ${member.userName}! Friendly reminder: Your payment of ${formattedAmount} for ${group.name} (Cycle ${cycle}) is due in ${daysUntilDue} days.`;
      }
    }

    return message;
  }

  /**
   * Calculate reminder priority based on member status
   * @param member - Member payment status
   * @returns Notification priority
   */
  private calculateReminderPriority(member: MemberPaymentStatus): NotificationPriority {
    if (member.status === 'overdue') {
      const daysOverdue = member.daysOverdue || 0;
      if (daysOverdue > 7) return NotificationPriority.URGENT;
      if (daysOverdue > 3) return NotificationPriority.HIGH;
      return NotificationPriority.NORMAL;
    }

    // For pending payments, check how close to due date
    const daysUntilDue = Math.ceil((new Date(member.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 0) return NotificationPriority.HIGH;
    if (daysUntilDue <= 1) return NotificationPriority.NORMAL;
    return NotificationPriority.LOW;
  }

  /**
   * Create default reminder configuration
   * @param groupId - Group ID
   * @param group - Group details
   * @returns Default reminder config
   */
  private createDefaultReminderConfig(groupId: string, group: any): PaymentReminderConfig {
    return {
      groupId,
      reminderTypes: [
        { type: 'push', enabled: true, template: 'default' },
        { type: 'email', enabled: true, template: 'default' },
        { type: 'sms', enabled: false, template: 'default' }, // SMS disabled by default due to cost
      ],
      daysBeforeDue: BUSINESS_CONSTANTS.REMINDER_DAYS,
      includePenaltyWarning: true,
    };
  }

  /**
   * Schedule automatic payment reminders
   * @param groupId - Group ID
   * @param cycle - Cycle number
   * @returns Scheduling result
   */
  async schedulePaymentReminders(groupId: string, cycle: number): Promise<BusinessLogicResult<boolean>> {
    try {
      // This would typically integrate with a job scheduler like Agenda, Bull, or AWS Lambda
      // For now, we'll simulate the scheduling logic
      
      const group = await DatabaseService.groups.getGroupById(groupId);
      if (!group.success || !group.data) {
        throw new NotificationError('Group not found');
      }

      // Calculate reminder dates based on cycle due date
      const cycleEndDate = new Date(group.data.cycle_end_date);
      const reminderDates = BUSINESS_CONSTANTS.REMINDER_DAYS.map(days => {
        const reminderDate = new Date(cycleEndDate);
        reminderDate.setDate(reminderDate.getDate() - days);
        return reminderDate;
      });

      console.log(`Scheduled payment reminders for group ${groupId}, cycle ${cycle}:`);
      reminderDates.forEach((date, index) => {
        console.log(`- Reminder ${index + 1}: ${date.toISOString()}`);
      });

      // In a real implementation, you would:
      // 1. Store reminder jobs in a database
      // 2. Use a job scheduler to execute them at the right time
      // 3. Handle job failures and retries

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error scheduling payment reminders:', error);
      return {
        success: false,
        error: 'Failed to schedule payment reminders',
      };
    }
  }

  /**
   * Log reminder batch for audit purposes
   * @param groupId - Group ID
   * @param cycle - Cycle number
   * @param result - Reminder results
   */
  private async logReminderBatch(
    groupId: string,
    cycle: number,
    result: ReminderResult
  ): Promise<void> {
    try {
      // In a real implementation, this would log to an audit table
      const logEntry = {
        groupId,
        cycle,
        timestamp: new Date(),
        totalSent: result.totalSent,
        failedSends: result.failedSends,
        successRate: result.totalSent / (result.totalSent + result.failedSends) * 100,
      };

      console.log('Payment reminder batch logged:', logEntry);
    } catch (error) {
      console.error('Failed to log reminder batch:', error);
    }
  }

  /**
   * Get reminder history for a group
   * @param groupId - Group ID
   * @param limit - Number of records to return
   * @returns Reminder history
   */
  async getReminderHistory(groupId: string, limit: number = 50): Promise<BusinessLogicResult<any[]>> {
    try {
      // In a real implementation, this would query the reminder audit table
      // For now, we'll return a simulated history
      
      const history = [
        {
          id: '1',
          groupId,
          cycle: 1,
          sentAt: new Date(Date.now() - 86400000), // 1 day ago
          totalSent: 3,
          failedSends: 0,
          successRate: 100,
        },
        {
          id: '2',
          groupId,
          cycle: 2,
          sentAt: new Date(Date.now() - 86400000 * 8), // 8 days ago
          totalSent: 2,
          failedSends: 1,
          successRate: 66.7,
        },
      ];

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error('Error getting reminder history:', error);
      return {
        success: false,
        error: 'Failed to get reminder history',
      };
    }
  }
}

export default new PaymentReminderService();