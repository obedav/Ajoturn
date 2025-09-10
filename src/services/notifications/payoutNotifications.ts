import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import NotificationService from '../notifications';
import NotificationScheduler from './scheduler';
import { TemplateData } from './templates';

export interface PayoutNotificationData {
  recipientId: string;
  recipientName: string;
  groupId: string;
  groupName: string;
  cycle: number;
  payoutAmount: number;
  processingDate: Date;
  completionDate?: Date;
  payoutMethod: 'bank_transfer' | 'mobile_money' | 'cash' | 'cheque';
  accountDetails?: {
    accountNumber?: string;
    bankName?: string;
    mobileNumber?: string;
  };
}

export interface PayoutTimeline {
  announcement: Date;     // When recipient is notified they're next
  preparation: Date;      // When recipient should prepare account details
  processing: Date;       // When payout begins processing
  completion: Date;       // Expected completion date
  followUp: Date;         // Follow-up confirmation
}

class PayoutNotificationService {

  // Announce next recipient in rotation
  async announceNextRecipient(params: {
    recipientId: string;
    recipientName: string;
    groupId: string;
    groupName: string;
    cycle: number;
    expectedPayoutAmount: number;
    expectedDate: Date;
    sendToGroup?: boolean;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        recipientId, 
        recipientName, 
        groupId, 
        groupName, 
        cycle, 
        expectedPayoutAmount, 
        expectedDate,
        sendToGroup = true 
      } = params;

      // Send notification to the recipient
      await NotificationService.sendToUser({
        templateId: 'payout_recipient_next',
        userId: recipientId,
        data: {
          recipientName,
          groupName,
          payoutAmount: expectedPayoutAmount,
          cycle,
        },
        sendSMS: true,
        groupId,
      });

      // Send to all group members if requested
      if (sendToGroup) {
        await this.notifyGroupMembers({
          groupId,
          templateId: 'cycle_completed',
          excludeUserId: recipientId,
          data: {
            recipientName,
            groupName,
            cycle,
            payoutAmount: expectedPayoutAmount,
          },
        });
      }

      console.log(`✅ Announced ${recipientName} as next recipient for ${groupName} cycle ${cycle}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error announcing next recipient:', error);
      return {
        success: false,
        error: 'Failed to announce next recipient',
        code: 'ANNOUNCE_ERROR',
      };
    }
  }

  // Setup complete payout notification timeline
  async setupPayoutTimeline(params: PayoutNotificationData): Promise<BusinessLogicResult<PayoutTimeline>> {
    try {
      const { 
        recipientId, 
        recipientName, 
        groupId, 
        groupName, 
        cycle, 
        payoutAmount, 
        processingDate 
      } = params;

      // Calculate timeline dates
      const timeline: PayoutTimeline = {
        announcement: new Date(), // Now
        preparation: new Date(processingDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
        processing: processingDate,
        completion: new Date(processingDate.getTime() + 2 * 60 * 60 * 1000), // 2 hours after processing
        followUp: new Date(processingDate.getTime() + 24 * 60 * 60 * 1000), // 1 day after processing
      };

      const commonData: TemplateData = {
        recipientName,
        groupName,
        payoutAmount,
        cycle,
      };

      // Schedule preparation reminder (2 days before)
      if (timeline.preparation > new Date()) {
        await NotificationScheduler.scheduleNotification({
          templateId: 'payout_recipient_next',
          userId: recipientId,
          data: {
            ...commonData,
            memberName: recipientName, // For template compatibility
          },
          scheduledFor: timeline.preparation,
          sendSMS: true,
          groupId,
        });
      }

      // Schedule processing notification (day of processing)
      const processingNotificationTime = new Date(timeline.processing);
      processingNotificationTime.setHours(9, 0, 0, 0); // 9 AM

      await NotificationScheduler.scheduleNotification({
        templateId: 'payout_processing',
        userId: recipientId,
        data: commonData,
        scheduledFor: processingNotificationTime,
        sendSMS: true,
        groupId,
      });

      console.log(`✅ Setup payout timeline for ${recipientName} - ${groupName} cycle ${cycle}`);

      return {
        success: true,
        data: timeline,
      };
    } catch (error) {
      console.error('Error setting up payout timeline:', error);
      return {
        success: false,
        error: 'Failed to setup payout timeline',
        code: 'TIMELINE_ERROR',
      };
    }
  }

  // Send payout processing notification
  async notifyPayoutProcessing(params: PayoutNotificationData): Promise<BusinessLogicResult<boolean>> {
    try {
      const { recipientId, recipientName, groupName, payoutAmount, payoutMethod } = params;

      await NotificationService.sendToUser({
        templateId: 'payout_processing',
        userId: recipientId,
        data: {
          recipientName,
          groupName,
          payoutAmount,
        },
        sendSMS: true,
      });

      // Log payout processing start
      await this.logPayoutEvent(params, 'processing_started');

      console.log(`✅ Notified ${recipientName} about payout processing via ${payoutMethod}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying payout processing:', error);
      return {
        success: false,
        error: 'Failed to notify payout processing',
        code: 'PROCESSING_ERROR',
      };
    }
  }

  // Send payout completion notification
  async notifyPayoutCompleted(params: PayoutNotificationData & { 
    transactionId?: string; 
    actualAmount?: number; 
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        recipientId, 
        recipientName, 
        groupName, 
        payoutAmount, 
        actualAmount,
        transactionId,
        payoutMethod 
      } = params;

      const finalAmount = actualAmount || payoutAmount;

      await NotificationService.sendToUser({
        templateId: 'payout_completed',
        userId: recipientId,
        data: {
          recipientName,
          groupName,
          payoutAmount: finalAmount,
        },
        sendSMS: true,
      });

      // Log payout completion
      await this.logPayoutEvent({
        ...params,
        completionDate: new Date(),
      }, 'completed', transactionId);

      console.log(`✅ Notified ${recipientName} about payout completion (${finalAmount} via ${payoutMethod})`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying payout completion:', error);
      return {
        success: false,
        error: 'Failed to notify payout completion',
        code: 'COMPLETION_ERROR',
      };
    }
  }

  // Send payout failure notification
  async notifyPayoutFailed(params: PayoutNotificationData & { 
    reason: string; 
    retryDate?: Date; 
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { recipientId, recipientName, groupName, payoutAmount, reason, retryDate } = params;

      // Use a custom template for payout failures
      await NotificationService.sendToUser({
        templateId: 'admin_member_needs_help', // Repurpose admin template
        userId: recipientId,
        data: {
          memberName: recipientName,
          groupName,
          // Custom message for payout failure
        },
        sendSMS: true,
      });

      // Send detailed SMS with failure reason
      const failureMessage = `Payout failed for ${groupName}: ${reason}. ${
        retryDate ? `We'll retry on ${retryDate.toLocaleDateString()}.` : 'Please contact admin.'
      } Amount: UGX ${payoutAmount.toLocaleString()}`;

      // This would use the SMS service directly for custom message
      console.log(`📱 Payout failure SMS: ${failureMessage}`);

      // Log payout failure
      await this.logPayoutEvent(params, 'failed', undefined, reason);

      console.log(`❌ Notified ${recipientName} about payout failure: ${reason}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying payout failure:', error);
      return {
        success: false,
        error: 'Failed to notify payout failure',
        code: 'FAILURE_ERROR',
      };
    }
  }

  // Notify group about cycle completion and payout
  async notifyCycleCompletion(params: {
    groupId: string;
    groupName: string;
    cycle: number;
    recipientId: string;
    recipientName: string;
    payoutAmount: number;
    nextRecipientId?: string;
    nextRecipientName?: string;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        groupId, 
        groupName, 
        cycle, 
        recipientName, 
        payoutAmount, 
        nextRecipientId,
        nextRecipientName 
      } = params;

      // Notify all group members about cycle completion
      await this.notifyGroupMembers({
        groupId,
        templateId: 'cycle_completed',
        data: {
          groupName,
          cycle,
          recipientName,
          payoutAmount,
        },
      });

      // If there's a next recipient, announce them
      if (nextRecipientId && nextRecipientName) {
        await this.announceNextRecipient({
          recipientId: nextRecipientId,
          recipientName: nextRecipientName,
          groupId,
          groupName,
          cycle: cycle + 1,
          expectedPayoutAmount: payoutAmount, // Assuming same amount
          expectedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          sendToGroup: false, // Already notified above
        });
      }

      console.log(`✅ Notified group ${groupName} about cycle ${cycle} completion`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying cycle completion:', error);
      return {
        success: false,
        error: 'Failed to notify cycle completion',
        code: 'CYCLE_COMPLETION_ERROR',
      };
    }
  }

  // Send payout status update to admin
  async notifyAdminPayoutStatus(params: {
    adminId: string;
    groupName: string;
    recipientName: string;
    payoutAmount: number;
    status: 'initiated' | 'processing' | 'completed' | 'failed';
    details?: string;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { adminId, groupName, recipientName, payoutAmount, status, details } = params;

      await NotificationService.sendToUser({
        templateId: 'admin_payment_confirmed', // Repurpose admin template
        userId: adminId,
        data: {
          memberName: recipientName,
          groupName,
          amount: payoutAmount,
        },
        sendSMS: false, // Don't SMS admin for status updates
      });

      console.log(`✅ Notified admin about payout ${status} for ${recipientName}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying admin payout status:', error);
      return {
        success: false,
        error: 'Failed to notify admin',
        code: 'ADMIN_NOTIFICATION_ERROR',
      };
    }
  }

  // Get payout notification history for a user
  async getPayoutNotificationHistory(userId: string, limit?: number): Promise<BusinessLogicResult<any[]>> {
    try {
      // Mock implementation - in production, query from database
      const history = [
        {
          id: '1',
          type: 'payout_completed',
          groupName: 'Savings Circle A',
          amount: 500000,
          date: new Date('2024-01-15'),
          status: 'delivered',
        },
        {
          id: '2',
          type: 'payout_recipient_next',
          groupName: 'Investment Group B',
          amount: 750000,
          date: new Date('2024-02-01'),
          status: 'delivered',
        },
      ];

      return {
        success: true,
        data: limit ? history.slice(0, limit) : history,
      };
    } catch (error) {
      console.error('Error getting payout notification history:', error);
      return {
        success: false,
        error: 'Failed to get notification history',
        code: 'HISTORY_ERROR',
      };
    }
  }

  // Helper: Notify all group members
  private async notifyGroupMembers(params: {
    groupId: string;
    templateId: string;
    data: TemplateData;
    excludeUserId?: string;
  }): Promise<void> {
    try {
      const { groupId, templateId, data, excludeUserId } = params;

      // Get group members
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) return;

      const members = membersResult.data.items.filter(
        member => member.user_id !== excludeUserId
      );

      // Send notifications to all members
      const notifications = members.map(member =>
        NotificationService.sendToUser({
          templateId,
          userId: member.user_id,
          data,
          sendSMS: false, // Group notifications usually don't need SMS
          groupId,
        })
      );

      await Promise.all(notifications);
      console.log(`Sent ${templateId} to ${members.length} group members`);
    } catch (error) {
      console.error('Error notifying group members:', error);
    }
  }

  // Helper: Log payout events
  private async logPayoutEvent(
    params: PayoutNotificationData, 
    event: string, 
    transactionId?: string,
    details?: string
  ): Promise<void> {
    try {
      const logEntry = {
        recipientId: params.recipientId,
        groupId: params.groupId,
        cycle: params.cycle,
        payoutAmount: params.payoutAmount,
        event,
        transactionId,
        details,
        timestamp: new Date(),
      };

      console.log('Payout Event Log:', logEntry);
      
      // In production, save to database
    } catch (error) {
      console.error('Error logging payout event:', error);
    }
  }

  // Get payout statistics for analytics
  async getPayoutStats(params: {
    groupId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<BusinessLogicResult<{
    totalPayouts: number;
    completedPayouts: number;
    failedPayouts: number;
    averageProcessingTime: number; // in hours
    totalAmount: number;
  }>> {
    try {
      // Mock implementation
      const stats = {
        totalPayouts: 45,
        completedPayouts: 42,
        failedPayouts: 3,
        averageProcessingTime: 4.5,
        totalAmount: 22500000,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error getting payout stats:', error);
      return {
        success: false,
        error: 'Failed to get payout statistics',
        code: 'STATS_ERROR',
      };
    }
  }
}

export default new PayoutNotificationService();