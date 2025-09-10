import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import NotificationService from '../notifications';
import { TemplateData } from './templates';

export interface ScheduledNotification {
  id: string;
  templateId: string;
  userId: string;
  groupId?: string;
  data: TemplateData;
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sendSMS: boolean;
  sendEmail: boolean;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentReminderSchedule {
  contributionId: string;
  memberId: string;
  groupId: string;
  amount: number;
  dueDate: Date;
  reminderDates: {
    threeDaysBefore: Date;
    oneDayBefore: Date;
    dueDate: Date;
    twoDaysAfter: Date;
  };
}

class NotificationScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // Check every minute

  // Start the scheduler
  start(): void {
    if (this.isRunning) {
      console.log('Notification scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting notification scheduler...');
    
    // Process immediately, then set interval
    this.processScheduledNotifications();
    this.intervalId = setInterval(() => {
      this.processScheduledNotifications();
    }, this.CHECK_INTERVAL);
  }

  // Stop the scheduler
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Notification scheduler stopped');
  }

  // Schedule a single notification
  async scheduleNotification(params: {
    templateId: string;
    userId: string;
    data: TemplateData;
    scheduledFor: Date;
    sendSMS?: boolean;
    sendEmail?: boolean;
    groupId?: string;
  }): Promise<BusinessLogicResult<ScheduledNotification>> {
    try {
      const notification: Omit<ScheduledNotification, 'id'> = {
        templateId: params.templateId,
        userId: params.userId,
        groupId: params.groupId,
        data: params.data,
        scheduledFor: params.scheduledFor,
        status: 'pending',
        sendSMS: params.sendSMS || false,
        sendEmail: params.sendEmail || false,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const result = await DatabaseService.notifications.scheduleNotification(notification);
      
      if (result.success && result.data) {
        console.log(`Notification scheduled for ${params.scheduledFor}: ${params.templateId}`);
        return {
          success: true,
          data: result.data as ScheduledNotification,
        };
      }

      return {
        success: false,
        error: 'Failed to schedule notification',
        code: 'SCHEDULE_ERROR',
      };
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return {
        success: false,
        error: 'Failed to schedule notification',
        code: 'SCHEDULE_ERROR',
      };
    }
  }

  // Schedule payment reminders for a contribution
  async schedulePaymentReminders(params: {
    contributionId: string;
    memberId: string;
    groupId: string;
    memberName: string;
    groupName: string;
    amount: number;
    dueDate: Date;
    sendSMS?: boolean;
  }): Promise<BusinessLogicResult<PaymentReminderSchedule>> {
    try {
      const { contributionId, memberId, groupId, memberName, groupName, amount, dueDate, sendSMS = false } = params;

      // Calculate reminder dates
      const threeDaysBefore = new Date(dueDate);
      threeDaysBefore.setDate(dueDate.getDate() - 3);
      threeDaysBefore.setHours(10, 0, 0, 0); // 10 AM

      const oneDayBefore = new Date(dueDate);
      oneDayBefore.setDate(dueDate.getDate() - 1);
      oneDayBefore.setHours(15, 0, 0, 0); // 3 PM

      const dueDateReminder = new Date(dueDate);
      dueDateReminder.setHours(9, 0, 0, 0); // 9 AM on due date

      const twoDaysAfter = new Date(dueDate);
      twoDaysAfter.setDate(dueDate.getDate() + 2);
      twoDaysAfter.setHours(16, 0, 0, 0); // 4 PM

      const commonData: TemplateData = {
        memberName,
        groupName,
        amount,
        dueDate: dueDate.toLocaleDateString(),
      };

      const reminderSchedule: PaymentReminderSchedule = {
        contributionId,
        memberId,
        groupId,
        amount,
        dueDate,
        reminderDates: {
          threeDaysBefore,
          oneDayBefore,
          dueDate: dueDateReminder,
          twoDaysAfter,
        },
      };

      // Schedule all reminders
      const reminders = [
        {
          templateId: 'payment_reminder_3_days',
          scheduledFor: threeDaysBefore,
          data: commonData,
        },
        {
          templateId: 'payment_due_today',
          scheduledFor: dueDateReminder,
          data: commonData,
        },
        {
          templateId: 'payment_overdue_2_days',
          scheduledFor: twoDaysAfter,
          data: {
            ...commonData,
            daysLate: 2,
          },
        },
      ];

      // Only schedule future reminders
      const now = new Date();
      const futureReminders = reminders.filter(reminder => reminder.scheduledFor > now);

      for (const reminder of futureReminders) {
        await this.scheduleNotification({
          templateId: reminder.templateId,
          userId: memberId,
          data: reminder.data,
          scheduledFor: reminder.scheduledFor,
          sendSMS,
          groupId,
        });
      }

      console.log(`Scheduled ${futureReminders.length} payment reminders for ${memberName}`);

      return {
        success: true,
        data: reminderSchedule,
      };
    } catch (error) {
      console.error('Error scheduling payment reminders:', error);
      return {
        success: false,
        error: 'Failed to schedule payment reminders',
        code: 'SCHEDULE_ERROR',
      };
    }
  }

  // Schedule payout notifications
  async schedulePayoutNotifications(params: {
    recipientId: string;
    recipientName: string;
    groupId: string;
    groupName: string;
    payoutAmount: number;
    processingDate: Date;
    sendSMS?: boolean;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { recipientId, recipientName, groupId, groupName, payoutAmount, processingDate, sendSMS = true } = params;

      // Schedule "You're next" notification (send now if payout is today, otherwise 1 day before)
      const nextNotificationDate = processingDate <= new Date() 
        ? new Date() 
        : new Date(processingDate.getTime() - 24 * 60 * 60 * 1000);

      await this.scheduleNotification({
        templateId: 'payout_recipient_next',
        userId: recipientId,
        data: {
          recipientName,
          groupName,
          payoutAmount,
        },
        scheduledFor: nextNotificationDate,
        sendSMS,
        groupId,
      });

      // Schedule processing notification (on processing date)
      const processingNotificationDate = new Date(processingDate);
      processingNotificationDate.setHours(9, 0, 0, 0);

      await this.scheduleNotification({
        templateId: 'payout_processing',
        userId: recipientId,
        data: {
          recipientName,
          groupName,
          payoutAmount,
        },
        scheduledFor: processingNotificationDate,
        sendSMS,
        groupId,
      });

      console.log(`Scheduled payout notifications for ${recipientName}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error scheduling payout notifications:', error);
      return {
        success: false,
        error: 'Failed to schedule payout notifications',
        code: 'SCHEDULE_ERROR',
      };
    }
  }

  // Cancel scheduled notifications for a specific contribution
  async cancelPaymentReminders(contributionId: string): Promise<BusinessLogicResult<boolean>> {
    try {
      const result = await DatabaseService.notifications.cancelScheduledNotifications({
        contributionId,
      });

      if (result.success) {
        console.log(`Cancelled payment reminders for contribution ${contributionId}`);
      }

      return result;
    } catch (error) {
      console.error('Error cancelling payment reminders:', error);
      return {
        success: false,
        error: 'Failed to cancel payment reminders',
        code: 'CANCEL_ERROR',
      };
    }
  }

  // Process scheduled notifications (called by the scheduler)
  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all pending notifications that are due
      const result = await DatabaseService.notifications.getDueNotifications(now);
      
      if (!result.success || !result.data) {
        return;
      }

      const dueNotifications = result.data as ScheduledNotification[];
      
      if (dueNotifications.length === 0) {
        return;
      }

      console.log(`Processing ${dueNotifications.length} due notifications`);

      // Process each notification
      for (const notification of dueNotifications) {
        await this.sendScheduledNotification(notification);
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    }
  }

  // Send a scheduled notification
  private async sendScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      // Update attempts count
      const updatedNotification = {
        ...notification,
        attempts: notification.attempts + 1,
        lastAttempt: new Date(),
        updatedAt: new Date(),
      };

      // Send the notification
      const success = await NotificationService.sendToUser({
        templateId: notification.templateId,
        userId: notification.userId,
        data: notification.data,
        sendSMS: notification.sendSMS,
        sendEmail: notification.sendEmail,
        groupId: notification.groupId,
      });

      if (success) {
        // Mark as sent
        updatedNotification.status = 'sent';
        await DatabaseService.notifications.updateScheduledNotification(notification.id, updatedNotification);
        console.log(`✅ Sent scheduled notification: ${notification.templateId} to ${notification.userId}`);
      } else {
        // Check if we should retry
        if (updatedNotification.attempts >= notification.maxAttempts) {
          updatedNotification.status = 'failed';
          updatedNotification.error = 'Max attempts reached';
          console.log(`❌ Failed to send notification after ${notification.maxAttempts} attempts: ${notification.id}`);
        } else {
          // Will retry next time
          updatedNotification.error = 'Send failed, will retry';
          console.log(`⚠️ Failed to send notification, will retry: ${notification.id}`);
        }
        
        await DatabaseService.notifications.updateScheduledNotification(notification.id, updatedNotification);
      }
    } catch (error) {
      console.error('Error sending scheduled notification:', error);
      
      // Mark as failed
      await DatabaseService.notifications.updateScheduledNotification(notification.id, {
        ...notification,
        status: 'failed',
        error: error.message,
        attempts: notification.attempts + 1,
        lastAttempt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Get scheduled notifications for a user
  async getUserScheduledNotifications(userId: string): Promise<BusinessLogicResult<ScheduledNotification[]>> {
    try {
      return await DatabaseService.notifications.getUserScheduledNotifications(userId);
    } catch (error) {
      console.error('Error getting user scheduled notifications:', error);
      return {
        success: false,
        error: 'Failed to get scheduled notifications',
        code: 'GET_ERROR',
      };
    }
  }

  // Get notification statistics
  async getNotificationStatistics(startDate: Date, endDate: Date): Promise<{
    totalScheduled: number;
    totalSent: number;
    totalFailed: number;
    sendRate: number;
  }> {
    try {
      // Mock implementation - in production, query from database
      return {
        totalScheduled: 450,
        totalSent: 423,
        totalFailed: 27,
        sendRate: 94.0,
      };
    } catch (error) {
      console.error('Error getting notification statistics:', error);
      return {
        totalScheduled: 0,
        totalSent: 0,
        totalFailed: 0,
        sendRate: 0,
      };
    }
  }

  // Cleanup method
  cleanup(): void {
    this.stop();
  }
}

export default new NotificationScheduler();