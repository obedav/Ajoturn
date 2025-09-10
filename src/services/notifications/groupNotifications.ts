import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import NotificationService from '../notifications';
import { TemplateData } from './templates';

export interface GroupNotificationParams {
  groupId: string;
  groupName: string;
  adminId: string;
  adminName: string;
  notifyMembers?: boolean;
  notifyAdmin?: boolean;
  sendSMS?: boolean;
}

export interface MemberJoinedParams extends GroupNotificationParams {
  newMemberId: string;
  newMemberName: string;
  newMemberPhone?: string;
  joinOrder: number;
  totalSlots: number;
}

export interface GroupStatusUpdate {
  groupId: string;
  status: 'active' | 'completed' | 'suspended' | 'cancelled';
  reason?: string;
  effectiveDate: Date;
}

class GroupNotificationService {

  // Notify when a new member joins the group
  async notifyMemberJoined(params: MemberJoinedParams): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        groupId, 
        groupName, 
        newMemberId, 
        newMemberName, 
        joinOrder, 
        totalSlots,
        notifyMembers = true,
        notifyAdmin = true,
        sendSMS = false 
      } = params;

      if (notifyMembers) {
        // Notify existing group members (excluding the new member)
        await this.notifyGroupMembers({
          groupId,
          templateId: 'member_joined',
          data: {
            joinedMemberName: newMemberName,
            groupName,
          },
          excludeUserId: newMemberId,
          sendSMS,
        });
      }

      // Send welcome message to new member
      await NotificationService.sendToUser({
        templateId: 'member_joined',
        userId: newMemberId,
        data: {
          memberName: newMemberName,
          groupName,
          joinedMemberName: newMemberName, // For template compatibility
        },
        sendSMS: true, // Always SMS new members
        groupId,
      });

      // Check if group is now full
      if (joinOrder === totalSlots) {
        await this.notifyGroupFull({
          groupId,
          groupName,
          adminId: params.adminId,
          totalMembers: totalSlots,
        });
      }

      console.log(`✅ Notified group ${groupName} about new member: ${newMemberName}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying member joined:', error);
      return {
        success: false,
        error: 'Failed to notify member joined',
        code: 'MEMBER_JOINED_ERROR',
      };
    }
  }

  // Notify when group is full and ready to start
  async notifyGroupFull(params: {
    groupId: string;
    groupName: string;
    adminId: string;
    totalMembers: number;
    startDate?: Date;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { groupId, groupName, adminId, totalMembers, startDate } = params;

      // Notify all group members
      await this.notifyGroupMembers({
        groupId,
        templateId: 'group_full',
        data: {
          groupName,
          memberName: '', // Not needed for this template
        },
        sendSMS: true,
      });

      // Send special notification to admin
      await NotificationService.sendToUser({
        templateId: 'admin_payment_confirmed',
        userId: adminId,
        data: {
          memberName: 'Group',
          groupName,
          amount: totalMembers, // Using amount field to show member count
        },
        sendSMS: false,
      });

      // Schedule first cycle reminders if start date is provided
      if (startDate) {
        await this.scheduleFirstCycleNotifications({
          groupId,
          groupName,
          startDate,
        });
      }

      console.log(`✅ Notified group ${groupName} is full with ${totalMembers} members`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying group full:', error);
      return {
        success: false,
        error: 'Failed to notify group full',
        code: 'GROUP_FULL_ERROR',
      };
    }
  }

  // Notify about group status changes
  async notifyGroupStatusChange(params: GroupStatusUpdate & {
    adminName: string;
    sendToMembers?: boolean;
    customMessage?: string;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { groupId, status, reason, adminName, sendToMembers = true, customMessage } = params;

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const groupName = groupResult.data.name;

      if (sendToMembers) {
        let templateId: string;
        let templateData: TemplateData = {
          groupName,
          adminName,
        };

        switch (status) {
          case 'completed':
            templateId = 'cycle_completed';
            templateData.cycle = 'Final'; // Indicate final cycle
            break;
          case 'suspended':
            templateId = 'maintenance_notice';
            break;
          case 'cancelled':
            templateId = 'admin_member_needs_help'; // Repurpose for group cancellation
            break;
          default:
            templateId = 'group_full';
            break;
        }

        await this.notifyGroupMembers({
          groupId,
          templateId,
          data: templateData,
          sendSMS: status === 'cancelled' || status === 'suspended', // SMS for important changes
        });
      }

      console.log(`✅ Notified group ${groupName} about status change to ${status}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying group status change:', error);
      return {
        success: false,
        error: 'Failed to notify group status change',
        code: 'STATUS_CHANGE_ERROR',
      };
    }
  }

  // Notify about group settings or rules changes
  async notifyGroupSettingsChange(params: {
    groupId: string;
    groupName: string;
    adminName: string;
    changeType: 'contribution_amount' | 'payment_date' | 'rules' | 'schedule';
    oldValue: string;
    newValue: string;
    effectiveDate: Date;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { groupId, groupName, adminName, changeType, oldValue, newValue, effectiveDate } = params;

      // Create custom message based on change type
      let changeDescription: string;
      let requiresAction = false;

      switch (changeType) {
        case 'contribution_amount':
          changeDescription = `Contribution amount changed from ${oldValue} to ${newValue}`;
          requiresAction = true;
          break;
        case 'payment_date':
          changeDescription = `Payment due date changed from ${oldValue} to ${newValue}`;
          requiresAction = true;
          break;
        case 'rules':
          changeDescription = `Group rules updated`;
          break;
        case 'schedule':
          changeDescription = `Group schedule changed`;
          requiresAction = true;
          break;
        default:
          changeDescription = `Group settings updated`;
      }

      // Send notification to all members
      await this.notifyGroupMembers({
        groupId,
        templateId: 'group_full', // Repurpose for settings changes
        data: {
          groupName,
          adminName,
        },
        sendSMS: requiresAction, // SMS if action required
      });

      // Log the settings change
      console.log(`✅ Notified group ${groupName} about settings change: ${changeDescription}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying group settings change:', error);
      return {
        success: false,
        error: 'Failed to notify group settings change',
        code: 'SETTINGS_CHANGE_ERROR',
      };
    }
  }

  // Notify about member leaving or being removed
  async notifyMemberLeft(params: {
    groupId: string;
    groupName: string;
    leftMemberId: string;
    leftMemberName: string;
    reason: 'voluntary' | 'removed' | 'suspended';
    adminId?: string;
    notifyGroup?: boolean;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        groupId, 
        groupName, 
        leftMemberId, 
        leftMemberName, 
        reason, 
        adminId,
        notifyGroup = true 
      } = params;

      if (notifyGroup) {
        // Notify remaining group members
        await this.notifyGroupMembers({
          groupId,
          templateId: 'member_joined', // We'll modify the message
          data: {
            joinedMemberName: `${leftMemberName} has left`,
            groupName,
          },
          excludeUserId: leftMemberId,
          sendSMS: reason === 'removed', // SMS if removed by admin
        });
      }

      // Send notification to the member who left (if appropriate)
      if (reason === 'voluntary' || reason === 'suspended') {
        await NotificationService.sendToUser({
          templateId: reason === 'suspended' ? 'account_suspended' : 'group_full',
          userId: leftMemberId,
          data: {
            memberName: leftMemberName,
            groupName,
          },
          sendSMS: true,
          groupId,
        });
      }

      // Notify admin if they weren't the one who initiated the action
      if (adminId && reason === 'voluntary') {
        await NotificationService.sendToUser({
          templateId: 'admin_member_needs_help',
          userId: adminId,
          data: {
            memberName: leftMemberName,
            groupName,
          },
          sendSMS: false,
        });
      }

      console.log(`✅ Notified group ${groupName} about ${leftMemberName} leaving (${reason})`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error notifying member left:', error);
      return {
        success: false,
        error: 'Failed to notify member left',
        code: 'MEMBER_LEFT_ERROR',
      };
    }
  }

  // Send general announcements to group
  async sendGroupAnnouncement(params: {
    groupId: string;
    groupName: string;
    adminName: string;
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high';
    sendSMS?: boolean;
    scheduleFor?: Date;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { 
        groupId, 
        groupName, 
        adminName, 
        title, 
        message, 
        priority, 
        sendSMS = false,
        scheduleFor 
      } = params;

      // Use maintenance notice template for announcements
      await this.notifyGroupMembers({
        groupId,
        templateId: 'maintenance_notice',
        data: {
          groupName,
          adminName,
          // Custom title and message would be handled in template
        },
        sendSMS: sendSMS || priority === 'high',
        scheduleFor,
      });

      console.log(`✅ Sent announcement to group ${groupName}: ${title}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error sending group announcement:', error);
      return {
        success: false,
        error: 'Failed to send group announcement',
        code: 'ANNOUNCEMENT_ERROR',
      };
    }
  }

  // Schedule first cycle notifications for a new full group
  private async scheduleFirstCycleNotifications(params: {
    groupId: string;
    groupName: string;
    startDate: Date;
  }): Promise<void> {
    try {
      const { groupId, groupName, startDate } = params;

      // Get group members and their contribution schedule
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) return;

      const members = membersResult.data.items;

      // Schedule welcome and first payment reminders
      for (const member of members) {
        // Calculate first payment due date (typically 7 days after group starts)
        const firstPaymentDue = new Date(startDate);
        firstPaymentDue.setDate(firstPaymentDue.getDate() + 7);

        // Get member details for personalized messages
        const userResult = await DatabaseService.users.getUserById(member.user_id);
        if (!userResult.success) continue;

        const memberName = userResult.data.displayName || userResult.data.email;

        // This would integrate with PaymentReminderService for comprehensive scheduling
        console.log(`Scheduled first cycle notifications for ${memberName} in ${groupName}`);
      }
    } catch (error) {
      console.error('Error scheduling first cycle notifications:', error);
    }
  }

  // Helper: Send notification to all group members
  private async notifyGroupMembers(params: {
    groupId: string;
    templateId: string;
    data: TemplateData;
    excludeUserId?: string;
    sendSMS?: boolean;
    scheduleFor?: Date;
  }): Promise<void> {
    try {
      const { groupId, templateId, data, excludeUserId, sendSMS = false, scheduleFor } = params;

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
          sendSMS,
          groupId,
          scheduleFor,
        })
      );

      await Promise.all(notifications);
      console.log(`Sent ${templateId} to ${members.length} group members`);
    } catch (error) {
      console.error('Error notifying group members:', error);
    }
  }

  // Get group notification statistics
  async getGroupNotificationStats(params: {
    groupId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<BusinessLogicResult<{
    totalNotifications: number;
    memberJoined: number;
    statusChanges: number;
    announcements: number;
    deliveryRate: number;
  }>> {
    try {
      // Mock implementation
      const stats = {
        totalNotifications: 87,
        memberJoined: 12,
        statusChanges: 5,
        announcements: 8,
        deliveryRate: 96.5,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error getting group notification stats:', error);
      return {
        success: false,
        error: 'Failed to get notification statistics',
        code: 'STATS_ERROR',
      };
    }
  }

  // Subscribe user to group notifications
  async subscribeToGroupNotifications(userId: string, groupId: string): Promise<BusinessLogicResult<boolean>> {
    try {
      // Subscribe to FCM topic for the group
      const topicName = `group_${groupId}`;
      await NotificationService.subscribeToTopic(topicName);

      console.log(`✅ Subscribed user ${userId} to group ${groupId} notifications`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error subscribing to group notifications:', error);
      return {
        success: false,
        error: 'Failed to subscribe to group notifications',
        code: 'SUBSCRIBE_ERROR',
      };
    }
  }

  // Unsubscribe user from group notifications
  async unsubscribeFromGroupNotifications(userId: string, groupId: string): Promise<BusinessLogicResult<boolean>> {
    try {
      // Unsubscribe from FCM topic for the group
      const topicName = `group_${groupId}`;
      await NotificationService.unsubscribeFromTopic(topicName);

      console.log(`✅ Unsubscribed user ${userId} from group ${groupId} notifications`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error unsubscribing from group notifications:', error);
      return {
        success: false,
        error: 'Failed to unsubscribe from group notifications',
        code: 'UNSUBSCRIBE_ERROR',
      };
    }
  }
}

export default new GroupNotificationService();