import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import NotificationScheduler from './scheduler';
import NotificationService from '../notifications';
import { TemplateData } from './templates';

export interface PaymentReminderConfig {
  enabledReminderTypes: ('3_days_before' | 'due_date' | '2_days_overdue')[];
  sendSMS: boolean;
  sendPush: boolean;
  sendEmail: boolean;
  customMessage?: string;
}

export interface ReminderStats {
  totalReminders: number;
  remindersSent: number;
  paymentsReceived: number;
  conversionRate: number;
}

class PaymentReminderService {
  private defaultConfig: PaymentReminderConfig = {
    enabledReminderTypes: ['3_days_before', 'due_date', '2_days_overdue'],
    sendSMS: true,
    sendPush: true,
    sendEmail: false,
  };

  // Set up payment reminders when a contribution is created
  async setupPaymentReminders(params: {
    contributionId: string;
    memberId: string;
    memberName: string;
    memberPhone?: string;
    groupId: string;
    groupName: string;
    amount: number;
    dueDate: Date;
    cycle: number;
    config?: Partial<PaymentReminderConfig>;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        contributionId, 
        memberId, 
        memberName, 
        groupId, 
        groupName, 
        amount, 
        dueDate, 
        cycle,
        config = {}
      } = params;

      const reminderConfig = { ...this.defaultConfig, ...config };
      
      console.log(`Setting up payment reminders for ${memberName} - ${groupName} Cycle ${cycle}`);

      // Schedule payment reminders
      const scheduleResult = await NotificationScheduler.schedulePaymentReminders({
        contributionId,
        memberId,
        groupId,
        memberName,
        groupName,
        amount,
        dueDate,
        sendSMS: reminderConfig.sendSMS,
      });

      if (!scheduleResult.success) {
        return {
          success: false,
          error: 'Failed to schedule payment reminders',
          code: 'SCHEDULE_ERROR',
        };
      }

      // Store reminder configuration for this contribution
      await this.saveReminderConfig(contributionId, reminderConfig);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error setting up payment reminders:', error);
      return {
        success: false,
        error: 'Failed to setup payment reminders',
        code: 'SETUP_ERROR',
      };
    }
  }

  // Send immediate payment reminder
  async sendImmediateReminder(params: {
    contributionId: string;
    memberId: string;
    memberName: string;
    groupName: string;
    amount: number;
    dueDate: Date;
    daysLate?: number;
    adminMessage?: string;
    sendSMS?: boolean;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        contributionId, 
        memberId, 
        memberName, 
        groupName, 
        amount, 
        dueDate, 
        daysLate = 0,
        adminMessage,
        sendSMS = true 
      } = params;

      // Determine template based on payment status
      let templateId: string;
      const templateData: TemplateData = {
        memberName,
        groupName,
        amount,
        dueDate: dueDate.toLocaleDateString(),
        daysLate,
      };

      if (daysLate > 0) {
        templateId = 'payment_overdue_2_days';
      } else if (this.isDueToday(dueDate)) {
        templateId = 'payment_due_today';
      } else {
        templateId = 'payment_reminder_3_days';
      }

      // Send notification
      const success = await NotificationService.sendToUser({
        templateId,
        userId: memberId,
        data: templateData,
        sendSMS,
      });

      if (success) {
        // Log the manual reminder
        await this.logManualReminder(contributionId, templateId, adminMessage);
        console.log(`✅ Manual reminder sent to ${memberName}`);
      }

      return {
        success,
        data: success,
      };
    } catch (error) {
      console.error('Error sending immediate reminder:', error);
      return {
        success: false,
        error: 'Failed to send reminder',
        code: 'SEND_ERROR',
      };
    }
  }

  // Setup bulk reminders for multiple contributions
  async setupBulkReminders(contributions: Array<{
    contributionId: string;
    memberId: string;
    memberName: string;
    groupId: string;
    groupName: string;
    amount: number;
    dueDate: Date;
    cycle: number;
  }>): Promise<BusinessLogicResult<ReminderStats>> {
    try {
      let successful = 0;
      let failed = 0;

      for (const contribution of contributions) {
        const result = await this.setupPaymentReminders(contribution);
        if (result.success) {
          successful++;
        } else {
          failed++;
          console.error(`Failed to setup reminders for ${contribution.memberName}:`, result.error);
        }
      }

      const stats: ReminderStats = {
        totalReminders: contributions.length,
        remindersSent: successful,
        paymentsReceived: 0, // Would be calculated from actual payments
        conversionRate: 0, // Would be calculated later
      };

      console.log(`Bulk reminder setup completed: ${successful} successful, ${failed} failed`);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error setting up bulk reminders:', error);
      return {
        success: false,
        error: 'Failed to setup bulk reminders',
        code: 'BULK_ERROR',
      };
    }
  }

  // Cancel payment reminders (when payment is received)
  async cancelReminders(contributionId: string): Promise<BusinessLogicResult<boolean>> {
    try {
      const result = await NotificationScheduler.cancelPaymentReminders(contributionId);
      
      if (result.success) {
        console.log(`Cancelled reminders for contribution ${contributionId}`);
        
        // Update reminder status in database
        await this.updateReminderStatus(contributionId, 'cancelled_payment_received');
      }

      return result;
    } catch (error) {
      console.error('Error cancelling reminders:', error);
      return {
        success: false,
        error: 'Failed to cancel reminders',
        code: 'CANCEL_ERROR',
      };
    }
  }

  // Get reminder effectiveness statistics
  async getReminderStats(params: {
    groupId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<BusinessLogicResult<ReminderStats>> {
    try {
      const { groupId, startDate, endDate } = params;

      // Mock implementation - in production, query from database
      const stats: ReminderStats = {
        totalReminders: 320,
        remindersSent: 314,
        paymentsReceived: 287,
        conversionRate: 91.4,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error getting reminder stats:', error);
      return {
        success: false,
        error: 'Failed to get reminder statistics',
        code: 'STATS_ERROR',
      };
    }
  }

  // Send overdue payment notifications with escalating urgency
  async sendOverdueNotifications(params: {
    contributionId: string;
    memberId: string;
    memberName: string;
    groupName: string;
    amount: number;
    dueDate: Date;
    daysLate: number;
    previousWarnings: number;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { memberId, memberName, groupName, amount, daysLate, previousWarnings } = params;

      let templateId: string;
      const templateData: TemplateData = {
        memberName,
        groupName,
        amount,
        daysLate,
        warningCount: previousWarnings + 1,
      };

      // Escalate based on days late and previous warnings
      if (daysLate >= 7 || previousWarnings >= 2) {
        templateId = 'penalty_applied';
        // Calculate penalty amount (5% of contribution)
        templateData.penaltyAmount = amount * 0.05;
      } else {
        templateId = 'late_payment_warning';
      }

      const success = await NotificationService.sendToUser({
        templateId,
        userId: memberId,
        data: templateData,
        sendSMS: true, // Always send SMS for overdue notifications
      });

      if (success) {
        // Log the overdue notification
        await this.logOverdueNotification(params.contributionId, daysLate, previousWarnings + 1);
      }

      return {
        success,
        data: success,
      };
    } catch (error) {
      console.error('Error sending overdue notification:', error);
      return {
        success: false,
        error: 'Failed to send overdue notification',
        code: 'OVERDUE_ERROR',
      };
    }
  }

  // Setup reminder preferences for a user
  async updateUserReminderPreferences(userId: string, preferences: PaymentReminderConfig): Promise<BusinessLogicResult<boolean>> {
    try {
      // Store user preferences in database
      const result = await DatabaseService.users.updateUserPreferences(userId, {
        notificationPreferences: {
          paymentReminders: preferences,
        },
      });

      return result;
    } catch (error) {
      console.error('Error updating reminder preferences:', error);
      return {
        success: false,
        error: 'Failed to update preferences',
        code: 'PREFERENCES_ERROR',
      };
    }
  }

  // Get user's reminder preferences
  async getUserReminderPreferences(userId: string): Promise<BusinessLogicResult<PaymentReminderConfig>> {
    try {
      const userResult = await DatabaseService.users.getUserById(userId);
      
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        };
      }

      const preferences = userResult.data.notificationPreferences?.paymentReminders || this.defaultConfig;

      return {
        success: true,
        data: preferences,
      };
    } catch (error) {
      console.error('Error getting reminder preferences:', error);
      return {
        success: false,
        error: 'Failed to get preferences',
        code: 'GET_PREFERENCES_ERROR',
      };
    }
  }

  // Process late payment escalation
  async processLatePaymentEscalation(params: {
    contributionId: string;
    memberId: string;
    memberName: string;
    groupId: string;
    groupName: string;
    adminId: string;
    daysLate: number;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { memberId, memberName, groupName, adminId, daysLate } = params;

      // Notify admin about persistent late payment
      if (daysLate >= 5) {
        await NotificationService.sendToUser({
          templateId: 'admin_member_needs_help',
          userId: adminId,
          data: {
            memberName,
            groupName,
            daysLate,
          },
          sendSMS: false, // Don't SMS admin for this
        });
      }

      // Send escalated notification to member
      await NotificationService.sendToUser({
        templateId: daysLate >= 10 ? 'account_suspended' : 'penalty_applied',
        userId: memberId,
        data: {
          memberName,
          groupName,
          daysLate,
          penaltyAmount: params.amount * 0.05 * Math.min(daysLate, 30), // Max 150% penalty
        },
        sendSMS: true,
      });

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error processing late payment escalation:', error);
      return {
        success: false,
        error: 'Failed to process escalation',
        code: 'ESCALATION_ERROR',
      };
    }
  }

  // Helper methods
  private isDueToday(dueDate: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return today.getTime() === due.getTime();
  }

  private async saveReminderConfig(contributionId: string, config: PaymentReminderConfig): Promise<void> {
    try {
      // Store configuration in database
      console.log(`Saved reminder config for contribution ${contributionId}:`, config);
    } catch (error) {
      console.error('Error saving reminder config:', error);
    }
  }

  private async logManualReminder(contributionId: string, templateId: string, message?: string): Promise<void> {
    try {
      // Log manual reminder in database
      console.log(`Manual reminder logged:`, {
        contributionId,
        templateId,
        message,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging manual reminder:', error);
    }
  }

  private async updateReminderStatus(contributionId: string, status: string): Promise<void> {
    try {
      // Update reminder status in database
      console.log(`Updated reminder status for ${contributionId}: ${status}`);
    } catch (error) {
      console.error('Error updating reminder status:', error);
    }
  }

  private async logOverdueNotification(contributionId: string, daysLate: number, warningCount: number): Promise<void> {
    try {
      // Log overdue notification in database
      console.log(`Overdue notification logged:`, {
        contributionId,
        daysLate,
        warningCount,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging overdue notification:', error);
    }
  }
}

export default new PaymentReminderService();