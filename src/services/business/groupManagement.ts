import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import { GroupNotificationService } from '../notifications';
import PaymentReminderService from '../notifications/paymentReminders';

export interface GroupPermissions {
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditSettings: boolean;
  canMarkPayments: boolean;
  canDeleteGroup: boolean;
  canTransferAdmin: boolean;
  canViewFinances: boolean;
  canManageCycles: boolean;
}

export interface GroupMemberDetailed {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  role: 'admin' | 'member';
  joinOrder: number;
  joinDate: Date;
  status: 'active' | 'suspended' | 'left';
  totalContributions: number;
  totalReceived: number;
  reliabilityScore: number;
  lastPaymentDate?: Date;
  nextTurnPosition: number;
  hasReceivedPayout: boolean;
}

export interface GroupSettings {
  contributionAmount: number;
  paymentFrequency: 'weekly' | 'monthly' | 'biweekly';
  paymentDeadlineDays: number; // Days from cycle start
  latePenaltyRate: number; // Percentage
  maxLatePaymentDays: number;
  autoProcessCycles: boolean;
  requirePaymentProof: boolean;
  allowMemberInvites: boolean;
  groupVisibility: 'private' | 'public' | 'invite_only';
}

export interface GroupCompletionOptions {
  action: 'restart' | 'dissolve' | 'pause';
  redistributeFunds: boolean;
  newSettings?: Partial<GroupSettings>;
  retainMembers: boolean;
  notifyMembers: boolean;
}

class GroupManagementService {

  // Check if user has specific permission for a group
  async checkPermission(
    userId: string, 
    groupId: string, 
    permission: keyof GroupPermissions
  ): Promise<BusinessLogicResult<boolean>> {
    try {
      const memberResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(userId, groupId);
      
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: 'User is not a member of this group',
          code: 'NOT_GROUP_MEMBER',
        };
      }

      const member = memberResult.data;
      const permissions = this.getUserPermissions(member.role);

      return {
        success: true,
        data: permissions[permission],
      };
    } catch (error) {
      console.error('Error checking permission:', error);
      return {
        success: false,
        error: 'Failed to check permission',
        code: 'PERMISSION_CHECK_ERROR',
      };
    }
  }

  // Get user's permissions based on role
  private getUserPermissions(role: 'admin' | 'member'): GroupPermissions {
    if (role === 'admin') {
      return {
        canAddMembers: true,
        canRemoveMembers: true,
        canEditSettings: true,
        canMarkPayments: true,
        canDeleteGroup: true,
        canTransferAdmin: true,
        canViewFinances: true,
        canManageCycles: true,
      };
    }

    return {
      canAddMembers: false,
      canRemoveMembers: false,
      canEditSettings: false,
      canMarkPayments: false,
      canDeleteGroup: false,
      canTransferAdmin: false,
      canViewFinances: false,
      canManageCycles: false,
    };
  }

  // Add member to group (admin only)
  async addMember(params: {
    adminId: string;
    groupId: string;
    userEmail: string;
    assignedPosition?: number; // Optional specific position
  }): Promise<BusinessLogicResult<GroupMemberDetailed>> {
    try {
      const { adminId, groupId, userEmail, assignedPosition } = params;

      // Check admin permissions
      const permissionCheck = await this.checkPermission(adminId, groupId, 'canAddMembers');
      if (!permissionCheck.success || !permissionCheck.data) {
        return {
          success: false,
          error: 'Insufficient permissions to add members',
          code: 'INSUFFICIENT_PERMISSIONS',
        };
      }

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const group = groupResult.data;

      // Check if group is full
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) {
        return {
          success: false,
          error: 'Failed to get group members',
          code: 'GET_MEMBERS_ERROR',
        };
      }

      const currentMembers = membersResult.data.items;
      if (currentMembers.length >= group.max_members) {
        return {
          success: false,
          error: 'Group is full',
          code: 'GROUP_FULL',
        };
      }

      // Find user by email
      const userResult = await DatabaseService.users.getUserByEmail(userEmail);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        };
      }

      const newUser = userResult.data;

      // Check if user is already a member
      const existingMember = await DatabaseService.groupMembers.getMemberByUserAndGroup(newUser.id, groupId);
      if (existingMember.success && existingMember.data) {
        return {
          success: false,
          error: 'User is already a member of this group',
          code: 'ALREADY_MEMBER',
        };
      }

      // Determine join order
      let joinOrder: number;
      if (assignedPosition && assignedPosition > 0 && assignedPosition <= group.max_members) {
        // Check if position is available
        const positionTaken = currentMembers.some(m => m.join_order === assignedPosition);
        if (positionTaken) {
          // Shift members to make room
          await this.adjustMemberPositions(groupId, assignedPosition, 'insert');
        }
        joinOrder = assignedPosition;
      } else {
        joinOrder = currentMembers.length + 1;
      }

      // Add member to group
      const memberData = {
        user_id: newUser.id,
        group_id: groupId,
        role: 'member' as const,
        join_order: joinOrder,
        status: 'active' as const,
        joined_at: new Date(),
      };

      const addResult = await DatabaseService.groupMembers.addGroupMember(memberData);
      if (!addResult.success) {
        return {
          success: false,
          error: 'Failed to add member to group',
          code: 'ADD_MEMBER_ERROR',
        };
      }

      // Create detailed member object
      const newMember: GroupMemberDetailed = {
        id: addResult.data.id,
        userId: newUser.id,
        displayName: newUser.displayName || newUser.email,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        profileImageUrl: newUser.profileImageUrl,
        role: 'member',
        joinOrder,
        joinDate: new Date(),
        status: 'active',
        totalContributions: 0,
        totalReceived: 0,
        reliabilityScore: 100,
        nextTurnPosition: joinOrder,
        hasReceivedPayout: false,
      };

      // Send notifications
      await GroupNotificationService.notifyMemberJoined({
        groupId,
        groupName: group.name,
        adminId,
        adminName: '', // Will be fetched in notification service
        newMemberId: newUser.id,
        newMemberName: newMember.displayName,
        newMemberPhone: newUser.phoneNumber,
        joinOrder,
        totalSlots: group.max_members,
        notifyMembers: true,
        sendSMS: true,
      });

      console.log(`✅ Added ${newMember.displayName} to group ${group.name} at position ${joinOrder}`);

      return {
        success: true,
        data: newMember,
      };
    } catch (error) {
      console.error('Error adding member:', error);
      return {
        success: false,
        error: 'Failed to add member',
        code: 'ADD_MEMBER_ERROR',
      };
    }
  }

  // Remove member from group (admin only)
  async removeMember(params: {
    adminId: string;
    groupId: string;
    memberId: string;
    reason: 'violation' | 'request' | 'inactive' | 'other';
    redistributeTurn: boolean;
    refundContributions: boolean;
    adminNotes?: string;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { adminId, groupId, memberId, reason, redistributeTurn, refundContributions, adminNotes } = params;

      // Check admin permissions
      const permissionCheck = await this.checkPermission(adminId, groupId, 'canRemoveMembers');
      if (!permissionCheck.success || !permissionCheck.data) {
        return {
          success: false,
          error: 'Insufficient permissions to remove members',
          code: 'INSUFFICIENT_PERMISSIONS',
        };
      }

      // Prevent admin from removing themselves
      if (adminId === memberId) {
        return {
          success: false,
          error: 'Admin cannot remove themselves. Transfer admin rights first.',
          code: 'CANNOT_REMOVE_ADMIN',
        };
      }

      // Get member details
      const memberResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(memberId, groupId);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: 'Member not found in group',
          code: 'MEMBER_NOT_FOUND',
        };
      }

      const member = memberResult.data;

      // Get user details for notifications
      const userResult = await DatabaseService.users.getUserById(memberId);
      const userName = userResult.success ? userResult.data.displayName || userResult.data.email : 'Unknown User';

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      const groupName = groupResult.success ? groupResult.data.name : 'Unknown Group';

      // Cancel any pending payment reminders for this member
      const contributionsResult = await DatabaseService.contributions.getUserContributions(memberId, groupId);
      if (contributionsResult.success) {
        for (const contribution of contributionsResult.data.items) {
          if (contribution.status === 'pending') {
            await PaymentReminderService.cancelReminders(contribution.id);
          }
        }
      }

      // Handle turn redistribution
      if (redistributeTurn && member.join_order) {
        await this.adjustMemberPositions(groupId, member.join_order, 'remove');
      }

      // Handle contribution refunds (would integrate with payment system)
      if (refundContributions) {
        console.log(`Processing refund for member ${userName} - reason: ${reason}`);
        // This would calculate and process actual refunds
      }

      // Remove member from group
      const removeResult = await DatabaseService.groupMembers.removeGroupMember(member.id);
      if (!removeResult.success) {
        return {
          success: false,
          error: 'Failed to remove member from database',
          code: 'REMOVE_MEMBER_ERROR',
        };
      }

      // Log the removal
      await this.logMemberRemoval({
        groupId,
        memberId,
        memberName: userName,
        adminId,
        reason,
        redistributeTurn,
        refundContributions,
        adminNotes,
      });

      // Send notifications
      await GroupNotificationService.notifyMemberLeft({
        groupId,
        groupName,
        leftMemberId: memberId,
        leftMemberName: userName,
        reason: reason === 'request' ? 'voluntary' : 'removed',
        adminId,
        notifyGroup: true,
      });

      console.log(`✅ Removed ${userName} from group ${groupName} - reason: ${reason}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error removing member:', error);
      return {
        success: false,
        error: 'Failed to remove member',
        code: 'REMOVE_MEMBER_ERROR',
      };
    }
  }

  // Get detailed member list with turn order
  async getGroupMembersDetailed(params: {
    userId: string;
    groupId: string;
    includeFinancials?: boolean;
  }): Promise<BusinessLogicResult<GroupMemberDetailed[]>> {
    try {
      const { userId, groupId, includeFinancials = false } = params;

      // Check if user is a member
      const memberCheck = await DatabaseService.groupMembers.getMemberByUserAndGroup(userId, groupId);
      if (!memberCheck.success || !memberCheck.data) {
        return {
          success: false,
          error: 'Access denied - not a group member',
          code: 'ACCESS_DENIED',
        };
      }

      const userRole = memberCheck.data.role;

      // Get basic member list
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) {
        return {
          success: false,
          error: 'Failed to get group members',
          code: 'GET_MEMBERS_ERROR',
        };
      }

      const members = membersResult.data.items;
      const detailedMembers: GroupMemberDetailed[] = [];

      for (const member of members) {
        // Get user details
        const userResult = await DatabaseService.users.getUserById(member.user_id);
        if (!userResult.success) continue;

        const user = userResult.data;

        // Get financial data if requested and user has permission
        let totalContributions = 0;
        let totalReceived = 0;
        let reliabilityScore = 100;
        let lastPaymentDate: Date | undefined;

        if (includeFinancials && (userRole === 'admin' || member.user_id === userId)) {
          const contributionsResult = await DatabaseService.contributions.getUserContributions(member.user_id, groupId);
          if (contributionsResult.success) {
            const contributions = contributionsResult.data.items;
            totalContributions = contributions
              .filter(c => c.status === 'paid')
              .reduce((sum, c) => sum + c.amount, 0);

            const paidContributions = contributions.filter(c => c.status === 'paid' && c.paid_date);
            if (paidContributions.length > 0) {
              lastPaymentDate = new Date(Math.max(...paidContributions.map(c => new Date(c.paid_date!).getTime())));
            }

            // Calculate reliability score based on payment history
            const totalDue = contributions.length;
            const paidOnTime = contributions.filter(c => 
              c.status === 'paid' && c.paid_date && new Date(c.paid_date) <= new Date(c.due_date)
            ).length;
            reliabilityScore = totalDue > 0 ? Math.round((paidOnTime / totalDue) * 100) : 100;
          }

          // Get payout history
          const payoutsResult = await DatabaseService.payouts?.getUserPayouts(member.user_id, groupId);
          if (payoutsResult?.success) {
            totalReceived = payoutsResult.data.items
              .filter(p => p.status === 'completed')
              .reduce((sum, p) => sum + p.amount, 0);
          }
        }

        const detailedMember: GroupMemberDetailed = {
          id: member.id,
          userId: member.user_id,
          displayName: user.displayName || user.email,
          email: user.email,
          phoneNumber: user.phoneNumber,
          profileImageUrl: user.profileImageUrl,
          role: member.role,
          joinOrder: member.join_order,
          joinDate: new Date(member.joined_at),
          status: member.status as 'active' | 'suspended' | 'left',
          totalContributions,
          totalReceived,
          reliabilityScore,
          lastPaymentDate,
          nextTurnPosition: member.join_order, // Would be calculated based on current cycle
          hasReceivedPayout: totalReceived > 0,
        };

        detailedMembers.push(detailedMember);
      }

      // Sort by join order
      detailedMembers.sort((a, b) => a.joinOrder - b.joinOrder);

      return {
        success: true,
        data: detailedMembers,
      };
    } catch (error) {
      console.error('Error getting detailed members:', error);
      return {
        success: false,
        error: 'Failed to get group members',
        code: 'GET_DETAILED_MEMBERS_ERROR',
      };
    }
  }

  // Update group settings (admin only)
  async updateGroupSettings(params: {
    adminId: string;
    groupId: string;
    settings: Partial<GroupSettings>;
    effectiveDate?: Date;
    notifyMembers?: boolean;
  }): Promise<BusinessLogicResult<GroupSettings>> {
    try {
      const { adminId, groupId, settings, effectiveDate, notifyMembers = true } = params;

      // Check admin permissions
      const permissionCheck = await this.checkPermission(adminId, groupId, 'canEditSettings');
      if (!permissionCheck.success || !permissionCheck.data) {
        return {
          success: false,
          error: 'Insufficient permissions to edit group settings',
          code: 'INSUFFICIENT_PERMISSIONS',
        };
      }

      // Get current group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const group = groupResult.data;

      // Validate settings
      const validationResult = this.validateGroupSettings(settings);
      if (!validationResult.success) {
        return validationResult;
      }

      // Update group settings in database
      const updateData = {
        contribution_amount: settings.contributionAmount,
        payment_deadline_days: settings.paymentDeadlineDays,
        late_penalty_rate: settings.latePenaltyRate,
        max_late_days: settings.maxLatePaymentDays,
        auto_process_cycles: settings.autoProcessCycles,
        require_payment_proof: settings.requirePaymentProof,
        allow_member_invites: settings.allowMemberInvites,
        group_visibility: settings.groupVisibility,
        settings_updated_at: new Date(),
        settings_updated_by: adminId,
      };

      const updateResult = await DatabaseService.groups.updateGroup(groupId, updateData);
      if (!updateResult.success) {
        return {
          success: false,
          error: 'Failed to update group settings',
          code: 'UPDATE_SETTINGS_ERROR',
        };
      }

      // Create complete settings object
      const updatedSettings: GroupSettings = {
        contributionAmount: settings.contributionAmount ?? group.contribution_amount,
        paymentFrequency: settings.paymentFrequency ?? 'monthly',
        paymentDeadlineDays: settings.paymentDeadlineDays ?? group.payment_deadline_days,
        latePenaltyRate: settings.latePenaltyRate ?? group.late_penalty_rate,
        maxLatePaymentDays: settings.maxLatePaymentDays ?? group.max_late_days,
        autoProcessCycles: settings.autoProcessCycles ?? group.auto_process_cycles,
        requirePaymentProof: settings.requirePaymentProof ?? group.require_payment_proof,
        allowMemberInvites: settings.allowMemberInvites ?? group.allow_member_invites,
        groupVisibility: settings.groupVisibility ?? group.group_visibility,
      };

      // Log settings change
      await this.logSettingsChange({
        groupId,
        adminId,
        oldSettings: this.extractCurrentSettings(group),
        newSettings: updatedSettings,
        effectiveDate: effectiveDate || new Date(),
      });

      // Notify members if requested
      if (notifyMembers) {
        const changedSettings = this.getChangedSettings(group, settings);
        for (const change of changedSettings) {
          await GroupNotificationService.notifyGroupSettingsChange({
            groupId,
            groupName: group.name,
            adminName: '', // Will be fetched in notification service
            changeType: change.type,
            oldValue: change.oldValue,
            newValue: change.newValue,
            effectiveDate: effectiveDate || new Date(),
          });
        }
      }

      console.log(`✅ Updated settings for group ${group.name}`);

      return {
        success: true,
        data: updatedSettings,
      };
    } catch (error) {
      console.error('Error updating group settings:', error);
      return {
        success: false,
        error: 'Failed to update group settings',
        code: 'UPDATE_SETTINGS_ERROR',
      };
    }
  }

  // Handle member leaving group voluntarily
  async leaveGroup(params: {
    userId: string;
    groupId: string;
    reason?: string;
    requestRefund: boolean;
  }): Promise<BusinessLogicResult<{
    success: boolean;
    refundAmount?: number;
    turnAdjustment: boolean;
  }>> {
    try {
      const { userId, groupId, reason, requestRefund } = params;

      // Get member details
      const memberResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(userId, groupId);
      if (!memberResult.success || !memberResult.data) {
        return {
          success: false,
          error: 'You are not a member of this group',
          code: 'NOT_GROUP_MEMBER',
        };
      }

      const member = memberResult.data;

      // Prevent admin from leaving without transferring admin rights
      if (member.role === 'admin') {
        const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
        if (membersResult.success && membersResult.data.items.length > 1) {
          return {
            success: false,
            error: 'As admin, you must transfer admin rights before leaving the group',
            code: 'ADMIN_CANNOT_LEAVE',
          };
        }
      }

      // Calculate refund amount if requested
      let refundAmount = 0;
      if (requestRefund) {
        const contributionsResult = await DatabaseService.contributions.getUserContributions(userId, groupId);
        if (contributionsResult.success) {
          const paidContributions = contributionsResult.data.items.filter(c => c.status === 'paid');
          const totalPaid = paidContributions.reduce((sum, c) => sum + c.amount, 0);
          
          // Calculate refund based on group policy (e.g., minus processing fees)
          refundAmount = Math.max(0, totalPaid * 0.9); // 90% refund policy
        }
      }

      // Remove member using the admin function (self-removal)
      const removeResult = await this.removeMember({
        adminId: member.role === 'admin' ? userId : '', // Allow self-removal
        groupId,
        memberId: userId,
        reason: 'request',
        redistributeTurn: true,
        refundContributions: requestRefund,
        adminNotes: reason,
      });

      if (!removeResult.success) {
        return removeResult;
      }

      return {
        success: true,
        data: {
          success: true,
          refundAmount,
          turnAdjustment: true,
        },
      };
    } catch (error) {
      console.error('Error leaving group:', error);
      return {
        success: false,
        error: 'Failed to leave group',
        code: 'LEAVE_GROUP_ERROR',
      };
    }
  }

  // Transfer admin rights
  async transferAdmin(params: {
    currentAdminId: string;
    groupId: string;
    newAdminId: string;
    reason?: string;
  }): Promise<BusinessLogicResult<boolean>> {
    try {
      const { currentAdminId, groupId, newAdminId, reason } = params;

      // Check current admin permissions
      const permissionCheck = await this.checkPermission(currentAdminId, groupId, 'canTransferAdmin');
      if (!permissionCheck.success || !permissionCheck.data) {
        return {
          success: false,
          error: 'Insufficient permissions to transfer admin rights',
          code: 'INSUFFICIENT_PERMISSIONS',
        };
      }

      // Verify new admin is a group member
      const newAdminMember = await DatabaseService.groupMembers.getMemberByUserAndGroup(newAdminId, groupId);
      if (!newAdminMember.success || !newAdminMember.data) {
        return {
          success: false,
          error: 'New admin must be a group member',
          code: 'NEW_ADMIN_NOT_MEMBER',
        };
      }

      // Update roles
      const updateCurrentAdmin = DatabaseService.groupMembers.updateMemberRole(
        currentAdminId, groupId, 'member'
      );
      
      const updateNewAdmin = DatabaseService.groupMembers.updateMemberRole(
        newAdminId, groupId, 'admin'
      );

      const updateGroupAdmin = DatabaseService.groups.updateGroup(groupId, {
        admin_id: newAdminId,
        admin_transferred_at: new Date(),
        admin_transferred_by: currentAdminId,
      });

      const results = await Promise.all([updateCurrentAdmin, updateNewAdmin, updateGroupAdmin]);
      
      if (!results.every(r => r.success)) {
        return {
          success: false,
          error: 'Failed to transfer admin rights',
          code: 'TRANSFER_ADMIN_ERROR',
        };
      }

      // Log the transfer
      console.log(`✅ Admin rights transferred from ${currentAdminId} to ${newAdminId} for group ${groupId}`);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      console.error('Error transferring admin:', error);
      return {
        success: false,
        error: 'Failed to transfer admin rights',
        code: 'TRANSFER_ADMIN_ERROR',
      };
    }
  }

  // Helper methods
  private async adjustMemberPositions(
    groupId: string, 
    position: number, 
    action: 'insert' | 'remove'
  ): Promise<void> {
    try {
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) return;

      const members = membersResult.data.items;
      
      for (const member of members) {
        if (action === 'insert' && member.join_order >= position) {
          // Shift positions up to make room for new member
          await DatabaseService.groupMembers.updateMemberJoinOrder(
            member.id, 
            member.join_order + 1
          );
        } else if (action === 'remove' && member.join_order > position) {
          // Shift positions down to fill gap
          await DatabaseService.groupMembers.updateMemberJoinOrder(
            member.id, 
            member.join_order - 1
          );
        }
      }
    } catch (error) {
      console.error('Error adjusting member positions:', error);
    }
  }

  private validateGroupSettings(settings: Partial<GroupSettings>): BusinessLogicResult<boolean> {
    if (settings.contributionAmount && settings.contributionAmount < 1000) {
      return {
        success: false,
        error: 'Contribution amount must be at least UGX 1,000',
        code: 'INVALID_CONTRIBUTION_AMOUNT',
      };
    }

    if (settings.latePenaltyRate && (settings.latePenaltyRate < 0 || settings.latePenaltyRate > 50)) {
      return {
        success: false,
        error: 'Late penalty rate must be between 0% and 50%',
        code: 'INVALID_PENALTY_RATE',
      };
    }

    if (settings.maxLatePaymentDays && settings.maxLatePaymentDays > 30) {
      return {
        success: false,
        error: 'Maximum late payment days cannot exceed 30',
        code: 'INVALID_MAX_LATE_DAYS',
      };
    }

    return { success: true, data: true };
  }

  private extractCurrentSettings(group: any): GroupSettings {
    return {
      contributionAmount: group.contribution_amount || 0,
      paymentFrequency: 'monthly',
      paymentDeadlineDays: group.payment_deadline_days || 7,
      latePenaltyRate: group.late_penalty_rate || 5,
      maxLatePaymentDays: group.max_late_days || 14,
      autoProcessCycles: group.auto_process_cycles || false,
      requirePaymentProof: group.require_payment_proof || false,
      allowMemberInvites: group.allow_member_invites || false,
      groupVisibility: group.group_visibility || 'private',
    };
  }

  private getChangedSettings(group: any, newSettings: Partial<GroupSettings>): Array<{
    type: 'contribution_amount' | 'payment_date' | 'rules' | 'schedule';
    oldValue: string;
    newValue: string;
  }> {
    const changes = [];

    if (newSettings.contributionAmount && newSettings.contributionAmount !== group.contribution_amount) {
      changes.push({
        type: 'contribution_amount' as const,
        oldValue: `UGX ${group.contribution_amount?.toLocaleString()}`,
        newValue: `UGX ${newSettings.contributionAmount.toLocaleString()}`,
      });
    }

    if (newSettings.paymentDeadlineDays && newSettings.paymentDeadlineDays !== group.payment_deadline_days) {
      changes.push({
        type: 'payment_date' as const,
        oldValue: `${group.payment_deadline_days} days`,
        newValue: `${newSettings.paymentDeadlineDays} days`,
      });
    }

    return changes;
  }

  private async logMemberRemoval(params: any): Promise<void> {
    console.log('Member removal logged:', params);
    // In production, this would save to an audit log table
  }

  private async logSettingsChange(params: any): Promise<void> {
    console.log('Settings change logged:', params);
    // In production, this would save to an audit log table
  }

  // Check if group has completed all cycles
  async checkGroupCompletion(groupId: string): Promise<BusinessLogicResult<{
    isComplete: boolean;
    completionRate: number;
    remainingMembers: string[];
    totalCycles: number;
    completedCycles: number;
  }>> {
    try {
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) {
        return {
          success: false,
          error: 'Failed to get group members',
          code: 'GET_MEMBERS_ERROR',
        };
      }

      const activeMembers = membersResult.data.items.filter(m => m.status === 'active');
      const totalMembers = activeMembers.length;

      // Check how many members have received their payout
      let membersWithPayout = 0;
      const remainingMembers: string[] = [];

      for (const member of activeMembers) {
        const payoutsResult = await DatabaseService.payouts?.getUserPayouts(member.user_id, groupId);
        const hasReceived = payoutsResult?.success && 
          payoutsResult.data.items.some(p => p.status === 'completed');

        if (hasReceived) {
          membersWithPayout++;
        } else {
          remainingMembers.push(member.user_id);
        }
      }

      const completionRate = totalMembers > 0 ? (membersWithPayout / totalMembers) * 100 : 0;
      const isComplete = completionRate === 100;

      return {
        success: true,
        data: {
          isComplete,
          completionRate,
          remainingMembers,
          totalCycles: totalMembers,
          completedCycles: membersWithPayout,
        },
      };
    } catch (error) {
      console.error('Error checking group completion:', error);
      return {
        success: false,
        error: 'Failed to check group completion',
        code: 'CHECK_COMPLETION_ERROR',
      };
    }
  }

  // Handle group completion - restart, dissolve, or pause
  async handleGroupCompletion(params: {
    adminId: string;
    groupId: string;
    options: GroupCompletionOptions;
  }): Promise<BusinessLogicResult<{ success: boolean; message: string }>> {
    try {
      const { adminId, groupId, options } = params;

      // Check admin permissions
      const permissionCheck = await this.checkPermission(adminId, groupId, 'canManageCycles');
      if (!permissionCheck.success || !permissionCheck.data) {
        return {
          success: false,
          error: 'Insufficient permissions to manage group completion',
          code: 'INSUFFICIENT_PERMISSIONS',
        };
      }

      // Verify group is actually complete
      const completionCheck = await this.checkGroupCompletion(groupId);
      if (!completionCheck.success || !completionCheck.data?.isComplete) {
        return {
          success: false,
          error: 'Group has not completed all cycles yet',
          code: 'GROUP_NOT_COMPLETE',
        };
      }

      switch (options.action) {
        case 'restart':
          return await this.restartGroup(adminId, groupId, options);
        case 'dissolve':
          return await this.dissolveGroup(adminId, groupId, options);
        case 'pause':
          return await this.pauseGroup(adminId, groupId, options);
        default:
          return {
            success: false,
            error: 'Invalid completion action',
            code: 'INVALID_ACTION',
          };
      }
    } catch (error) {
      console.error('Error handling group completion:', error);
      return {
        success: false,
        error: 'Failed to handle group completion',
        code: 'COMPLETION_HANDLING_ERROR',
      };
    }
  }

  // Restart group with same or new settings
  private async restartGroup(
    adminId: string, 
    groupId: string, 
    options: GroupCompletionOptions
  ): Promise<BusinessLogicResult<{ success: boolean; message: string }>> {
    try {
      // Update group status to active and reset cycles
      const updateData: any = {
        status: 'active',
        cycle_start_date: new Date(),
        updated_at: new Date(),
      };

      // Apply new settings if provided
      if (options.newSettings) {
        const settingsValidation = this.validateGroupSettings(options.newSettings);
        if (!settingsValidation.success) {
          return settingsValidation as any;
        }

        if (options.newSettings.contributionAmount) {
          updateData.contribution_amount = options.newSettings.contributionAmount;
        }
        if (options.newSettings.paymentDeadlineDays) {
          updateData.payment_deadline_days = options.newSettings.paymentDeadlineDays;
        }
        if (options.newSettings.latePenaltyRate !== undefined) {
          updateData.late_penalty_rate = options.newSettings.latePenaltyRate;
        }
      }

      const groupUpdate = await DatabaseService.groups.updateGroup(groupId, updateData);
      if (!groupUpdate.success) {
        return {
          success: false,
          error: 'Failed to restart group',
          code: 'RESTART_GROUP_ERROR',
        };
      }

      // Reset member payout status for new cycle
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (membersResult.success && options.retainMembers) {
        for (const member of membersResult.data.items.filter(m => m.status === 'active')) {
          // Reset any cycle-specific flags or status
          await DatabaseService.groupMembers.updateMember(member.id, {
            updated_at: new Date(),
          });
        }
      }

      // Handle fund redistribution if requested
      if (options.redistributeFunds) {
        // This would redistribute any remaining funds equally
        await this.redistributeRemainingFunds(groupId);
      }

      // Send notifications if requested
      if (options.notifyMembers) {
        await GroupNotificationService.sendGroupRestart(groupId);
      }

      // Log the restart
      await this.logGroupCompletion({
        adminId,
        groupId,
        action: 'restart',
        timestamp: new Date(),
        options,
      });

      return {
        success: true,
        data: {
          success: true,
          message: 'Group has been successfully restarted with a new cycle',
        },
      };
    } catch (error) {
      console.error('Error restarting group:', error);
      return {
        success: false,
        error: 'Failed to restart group',
        code: 'RESTART_GROUP_ERROR',
      };
    }
  }

  // Dissolve group and handle final settlements
  private async dissolveGroup(
    adminId: string, 
    groupId: string, 
    options: GroupCompletionOptions
  ): Promise<BusinessLogicResult<{ success: boolean; message: string }>> {
    try {
      // Update group status to dissolved
      const groupUpdate = await DatabaseService.groups.updateGroup(groupId, {
        status: 'dissolved',
        dissolved_at: new Date(),
        dissolved_by: adminId,
      });

      if (!groupUpdate.success) {
        return {
          success: false,
          error: 'Failed to dissolve group',
          code: 'DISSOLVE_GROUP_ERROR',
        };
      }

      // Handle final fund redistribution if requested
      if (options.redistributeFunds) {
        await this.redistributeRemainingFunds(groupId);
      }

      // Update all member status to indicate group dissolution
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (membersResult.success) {
        for (const member of membersResult.data.items) {
          await DatabaseService.groupMembers.updateMember(member.id, {
            status: 'left',
            left_at: new Date(),
          });
        }
      }

      // Send final notifications if requested
      if (options.notifyMembers) {
        await GroupNotificationService.sendGroupDissolution(groupId);
      }

      // Log the dissolution
      await this.logGroupCompletion({
        adminId,
        groupId,
        action: 'dissolve',
        timestamp: new Date(),
        options,
      });

      return {
        success: true,
        data: {
          success: true,
          message: 'Group has been successfully dissolved',
        },
      };
    } catch (error) {
      console.error('Error dissolving group:', error);
      return {
        success: false,
        error: 'Failed to dissolve group',
        code: 'DISSOLVE_GROUP_ERROR',
      };
    }
  }

  // Pause group temporarily
  private async pauseGroup(
    adminId: string, 
    groupId: string, 
    options: GroupCompletionOptions
  ): Promise<BusinessLogicResult<{ success: boolean; message: string }>> {
    try {
      // Update group status to paused
      const groupUpdate = await DatabaseService.groups.updateGroup(groupId, {
        status: 'paused',
        paused_at: new Date(),
        paused_by: adminId,
      });

      if (!groupUpdate.success) {
        return {
          success: false,
          error: 'Failed to pause group',
          code: 'PAUSE_GROUP_ERROR',
        };
      }

      // Send pause notifications if requested
      if (options.notifyMembers) {
        await GroupNotificationService.sendGroupPause(groupId);
      }

      // Log the pause action
      await this.logGroupCompletion({
        adminId,
        groupId,
        action: 'pause',
        timestamp: new Date(),
        options,
      });

      return {
        success: true,
        data: {
          success: true,
          message: 'Group has been paused successfully',
        },
      };
    } catch (error) {
      console.error('Error pausing group:', error);
      return {
        success: false,
        error: 'Failed to pause group',
        code: 'PAUSE_GROUP_ERROR',
      };
    }
  }

  // Resume a paused group
  async resumeGroup(params: {
    adminId: string;
    groupId: string;
    newSettings?: Partial<GroupSettings>;
  }): Promise<BusinessLogicResult<{ success: boolean; message: string }>> {
    try {
      const { adminId, groupId, newSettings } = params;

      // Check admin permissions
      const permissionCheck = await this.checkPermission(adminId, groupId, 'canManageCycles');
      if (!permissionCheck.success || !permissionCheck.data) {
        return {
          success: false,
          error: 'Insufficient permissions to resume group',
          code: 'INSUFFICIENT_PERMISSIONS',
        };
      }

      // Verify group is paused
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      if (groupResult.data.status !== 'paused') {
        return {
          success: false,
          error: 'Group is not currently paused',
          code: 'GROUP_NOT_PAUSED',
        };
      }

      // Update group status back to active
      const updateData: any = {
        status: 'active',
        resumed_at: new Date(),
        paused_at: null,
        paused_by: null,
      };

      // Apply new settings if provided
      if (newSettings) {
        const settingsValidation = this.validateGroupSettings(newSettings);
        if (!settingsValidation.success) {
          return settingsValidation as any;
        }

        if (newSettings.contributionAmount) {
          updateData.contribution_amount = newSettings.contributionAmount;
        }
        if (newSettings.paymentDeadlineDays) {
          updateData.payment_deadline_days = newSettings.paymentDeadlineDays;
        }
      }

      const groupUpdate = await DatabaseService.groups.updateGroup(groupId, updateData);
      if (!groupUpdate.success) {
        return {
          success: false,
          error: 'Failed to resume group',
          code: 'RESUME_GROUP_ERROR',
        };
      }

      return {
        success: true,
        data: {
          success: true,
          message: 'Group has been resumed successfully',
        },
      };
    } catch (error) {
      console.error('Error resuming group:', error);
      return {
        success: false,
        error: 'Failed to resume group',
        code: 'RESUME_GROUP_ERROR',
      };
    }
  }

  // Helper methods for completion handling
  private async redistributeRemainingFunds(groupId: string): Promise<void> {
    try {
      // Get group balance and active members
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);

      if (!groupResult.success || !membersResult.success) return;

      const group = groupResult.data;
      const activeMembers = membersResult.data.items.filter(m => m.status === 'active');
      
      // This would implement the actual fund redistribution logic
      // For now, just log the action
      console.log(`Redistributing remaining funds for group ${groupId} among ${activeMembers.length} members`);
    } catch (error) {
      console.error('Error redistributing funds:', error);
    }
  }

  private async logGroupCompletion(params: {
    adminId: string;
    groupId: string;
    action: string;
    timestamp: Date;
    options: GroupCompletionOptions;
  }): Promise<void> {
    console.log('Group completion action logged:', params);
    // In production, this would save to an audit log table
  }
}

export default new GroupManagementService();