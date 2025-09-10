import { BusinessLogicResult } from '../types/business';
import DatabaseService from './database';

export interface GroupInvite {
  id: string;
  group_id: string;
  invite_code: string;
  created_by: string;
  created_at: Date;
  expires_at: Date;
  max_uses?: number;
  current_uses: number;
  is_active: boolean;
}

export interface InviteValidation {
  isValid: boolean;
  group?: any;
  invite?: GroupInvite;
  error?: string;
}

class GroupInviteService {
  /**
   * Generate a unique invite code for a group
   * @param groupId - Group ID
   * @param createdBy - User ID who created the invite
   * @param expiresInHours - Expiration time in hours (default 24)
   * @param maxUses - Maximum number of uses (optional)
   * @returns Generated invite code
   */
  async generateInviteCode(
    groupId: string,
    createdBy: string,
    expiresInHours: number = 24,
    maxUses?: number
  ): Promise<BusinessLogicResult<GroupInvite>> {
    try {
      // Validate group exists and user is admin
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      const group = groupResult.data;
      if (group.admin_id !== createdBy) {
        return {
          success: false,
          error: 'Only group admin can generate invite codes',
          code: 'PERMISSION_DENIED',
        };
      }

      // Check if group is full
      if (group.total_members >= group.max_members) {
        return {
          success: false,
          error: 'Group is already full',
          code: 'GROUP_FULL',
        };
      }

      // Generate unique invite code
      const inviteCode = this.generateUniqueCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      const invite: GroupInvite = {
        id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        group_id: groupId,
        invite_code: inviteCode,
        created_by: createdBy,
        created_at: new Date(),
        expires_at: expiresAt,
        max_uses: maxUses,
        current_uses: 0,
        is_active: true,
      };

      // Store invite in database
      const storeResult = await this.storeInvite(invite);
      if (!storeResult) {
        return {
          success: false,
          error: 'Failed to create invite code',
          code: 'STORAGE_FAILED',
        };
      }

      console.log(`Generated invite code ${inviteCode} for group ${groupId}`);

      return {
        success: true,
        data: invite,
      };
    } catch (error) {
      console.error('Error generating invite code:', error);
      return {
        success: false,
        error: 'Failed to generate invite code',
        code: 'GENERATION_ERROR',
      };
    }
  }

  /**
   * Validate an invite code
   * @param inviteCode - Invite code to validate
   * @returns Validation result with group and invite details
   */
  async validateInviteCode(inviteCode: string): Promise<BusinessLogicResult<InviteValidation>> {
    try {
      if (!inviteCode || inviteCode.length !== 6) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Invalid invite code format',
          },
        };
      }

      // Find invite by code
      const invite = await this.getInviteByCode(inviteCode.toUpperCase());
      if (!invite) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Invite code not found',
          },
        };
      }

      // Check if invite is active
      if (!invite.is_active) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Invite code has been deactivated',
          },
        };
      }

      // Check expiration
      if (new Date() > invite.expires_at) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Invite code has expired',
          },
        };
      }

      // Check usage limits
      if (invite.max_uses && invite.current_uses >= invite.max_uses) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Invite code has reached maximum uses',
          },
        };
      }

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(invite.group_id);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Associated group not found',
          },
        };
      }

      const group = groupResult.data;

      // Check if group is full
      if (group.total_members >= group.max_members) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Group is full and cannot accept new members',
          },
        };
      }

      // Check if group is still accepting members
      if (group.status !== 'recruiting' && group.status !== 'active') {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Group is not currently accepting new members',
          },
        };
      }

      return {
        success: true,
        data: {
          isValid: true,
          group,
          invite,
        },
      };
    } catch (error) {
      console.error('Error validating invite code:', error);
      return {
        success: false,
        error: 'Failed to validate invite code',
        code: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Use an invite code to join a group
   * @param inviteCode - Invite code
   * @param userId - User joining the group
   * @returns Join result
   */
  async useInviteCode(inviteCode: string, userId: string): Promise<BusinessLogicResult<any>> {
    try {
      // Validate the invite code first
      const validationResult = await this.validateInviteCode(inviteCode);
      if (!validationResult.success || !validationResult.data?.isValid) {
        return {
          success: false,
          error: validationResult.data?.error || 'Invalid invite code',
          code: 'INVALID_INVITE',
        };
      }

      const { group, invite } = validationResult.data;
      if (!group || !invite) {
        return {
          success: false,
          error: 'Invite validation failed',
          code: 'VALIDATION_FAILED',
        };
      }

      // Check if user is already a member
      const membershipResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(userId, group.id);
      if (membershipResult.success && membershipResult.data) {
        return {
          success: false,
          error: 'You are already a member of this group',
          code: 'ALREADY_MEMBER',
        };
      }

      // Add user to group
      const joinResult = await DatabaseService.groupMembers.addMember({
        group_id: group.id,
        user_id: userId,
        role: 'member',
        join_order: group.total_members + 1,
        status: 'active',
        joined_via: 'invite_code',
        invite_code: inviteCode,
      });

      if (!joinResult.success) {
        return {
          success: false,
          error: 'Failed to join group',
          code: 'JOIN_FAILED',
        };
      }

      // Update invite usage count
      await this.incrementInviteUsage(invite.id);

      // Update group member count
      await DatabaseService.groups.updateGroup(group.id, {
        total_members: group.total_members + 1,
      });

      console.log(`User ${userId} joined group ${group.id} using invite code ${inviteCode}`);

      return {
        success: true,
        data: {
          group,
          membership: joinResult.data,
          message: `Successfully joined ${group.name}!`,
        },
      };
    } catch (error) {
      console.error('Error using invite code:', error);
      return {
        success: false,
        error: 'Failed to use invite code',
        code: 'USAGE_ERROR',
      };
    }
  }

  /**
   * Get all active invites for a group
   * @param groupId - Group ID
   * @returns List of active invites
   */
  async getGroupInvites(groupId: string): Promise<BusinessLogicResult<GroupInvite[]>> {
    try {
      const invites = await this.getActiveInvitesForGroup(groupId);
      return {
        success: true,
        data: invites,
      };
    } catch (error) {
      console.error('Error getting group invites:', error);
      return {
        success: false,
        error: 'Failed to get group invites',
        code: 'FETCH_ERROR',
      };
    }
  }

  /**
   * Deactivate an invite code
   * @param inviteId - Invite ID
   * @param userId - User deactivating the invite
   * @returns Deactivation result
   */
  async deactivateInvite(inviteId: string, userId: string): Promise<BusinessLogicResult<boolean>> {
    try {
      const invite = await this.getInviteById(inviteId);
      if (!invite) {
        return {
          success: false,
          error: 'Invite not found',
          code: 'INVITE_NOT_FOUND',
        };
      }

      // Verify user has permission to deactivate
      const groupResult = await DatabaseService.groups.getGroupById(invite.group_id);
      if (!groupResult.success || !groupResult.data) {
        return {
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND',
        };
      }

      if (groupResult.data.admin_id !== userId) {
        return {
          success: false,
          error: 'Only group admin can deactivate invites',
          code: 'PERMISSION_DENIED',
        };
      }

      // Deactivate the invite
      const result = await this.updateInvite(inviteId, { is_active: false });
      
      return {
        success: result,
        data: result,
      };
    } catch (error) {
      console.error('Error deactivating invite:', error);
      return {
        success: false,
        error: 'Failed to deactivate invite',
        code: 'DEACTIVATION_ERROR',
      };
    }
  }

  /**
   * Generate a unique 6-character invite code
   * @returns Unique invite code
   */
  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Store invite in database (simulated - would use real database)
   * @param invite - Invite to store
   * @returns Success status
   */
  private async storeInvite(invite: GroupInvite): Promise<boolean> {
    try {
      // In a real implementation, this would store in Firestore
      // For now, we'll simulate storage
      console.log(`Storing invite: ${JSON.stringify(invite)}`);
      return true;
    } catch (error) {
      console.error('Error storing invite:', error);
      return false;
    }
  }

  /**
   * Get invite by code (simulated)
   * @param code - Invite code
   * @returns Invite or null
   */
  private async getInviteByCode(code: string): Promise<GroupInvite | null> {
    try {
      // In a real implementation, this would query Firestore
      // For now, we'll simulate a database lookup
      
      // Simulate some valid codes for testing
      if (code === 'TEST01') {
        return {
          id: 'invite_test_1',
          group_id: 'group_1',
          invite_code: code,
          created_by: 'admin_user',
          created_at: new Date(Date.now() - 3600000), // 1 hour ago
          expires_at: new Date(Date.now() + 82800000), // 23 hours from now
          current_uses: 0,
          is_active: true,
        };
      }
      
      return null; // Code not found
    } catch (error) {
      console.error('Error getting invite by code:', error);
      return null;
    }
  }

  /**
   * Get invite by ID (simulated)
   * @param inviteId - Invite ID
   * @returns Invite or null
   */
  private async getInviteById(inviteId: string): Promise<GroupInvite | null> {
    try {
      // In a real implementation, this would query Firestore by ID
      return null; // Simulated
    } catch (error) {
      console.error('Error getting invite by ID:', error);
      return null;
    }
  }

  /**
   * Get active invites for a group (simulated)
   * @param groupId - Group ID
   * @returns Array of active invites
   */
  private async getActiveInvitesForGroup(groupId: string): Promise<GroupInvite[]> {
    try {
      // In a real implementation, this would query Firestore
      return []; // Simulated
    } catch (error) {
      console.error('Error getting active invites:', error);
      return [];
    }
  }

  /**
   * Increment invite usage count (simulated)
   * @param inviteId - Invite ID
   * @returns Success status
   */
  private async incrementInviteUsage(inviteId: string): Promise<boolean> {
    try {
      // In a real implementation, this would increment the count in Firestore
      console.log(`Incrementing usage for invite: ${inviteId}`);
      return true;
    } catch (error) {
      console.error('Error incrementing invite usage:', error);
      return false;
    }
  }

  /**
   * Update invite properties (simulated)
   * @param inviteId - Invite ID
   * @param updates - Properties to update
   * @returns Success status
   */
  private async updateInvite(inviteId: string, updates: Partial<GroupInvite>): Promise<boolean> {
    try {
      // In a real implementation, this would update the document in Firestore
      console.log(`Updating invite ${inviteId}:`, updates);
      return true;
    } catch (error) {
      console.error('Error updating invite:', error);
      return false;
    }
  }

  /**
   * Clean up expired invites (utility function)
   * This would typically run as a scheduled job
   */
  async cleanupExpiredInvites(): Promise<BusinessLogicResult<number>> {
    try {
      // In a real implementation, this would:
      // 1. Query for expired invites
      // 2. Mark them as inactive
      // 3. Return count of cleaned up invites
      
      console.log('Cleaning up expired invites...');
      return {
        success: true,
        data: 0, // Simulated count
      };
    } catch (error) {
      console.error('Error cleaning up expired invites:', error);
      return {
        success: false,
        error: 'Failed to cleanup expired invites',
        code: 'CLEANUP_ERROR',
      };
    }
  }
}

export default new GroupInviteService();