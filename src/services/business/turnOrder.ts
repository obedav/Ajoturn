import { 
  TurnOrder, 
  CalculateTurnOrderParams, 
  BusinessLogicResult, 
  TurnOrderError,
  CycleStatus
} from '../../types/business';
import { GroupMember } from '../../types/database';
import DatabaseService from '../database';

class TurnOrderService {
  /**
   * Calculate the turn order for a group across all cycles
   * @param params - Group and member information
   * @returns Array of turn orders for all cycles
   */
  async calculateTurnOrder(params: CalculateTurnOrderParams): Promise<BusinessLogicResult<TurnOrder[]>> {
    try {
      const { group, members, currentCycle = 1 } = params;

      // Validate inputs
      const validation = this.validateTurnOrderParams(params);
      if (!validation.isValid) {
        throw new TurnOrderError(`Invalid parameters: ${validation.errors.join(', ')}`);
      }

      // Get active members sorted by join order
      const activeMembers = members
        .filter(member => member.status === 'active')
        .sort((a, b) => a.join_order - b.join_order);

      if (activeMembers.length === 0) {
        throw new TurnOrderError('No active members found in group');
      }

      // Calculate turn order for all cycles
      const turnOrders: TurnOrder[] = [];
      const cycleStartDate = new Date(group.cycle_start_date);

      for (let cycle = 1; cycle <= group.total_cycles; cycle++) {
        const memberIndex = (cycle - 1) % activeMembers.length;
        const recipient = activeMembers[memberIndex];
        
        // Calculate scheduled date for this cycle
        const scheduledDate = this.calculateCycleDate(
          cycleStartDate, 
          cycle, 
          group.contribution_frequency
        );

        // Determine status
        let status: TurnOrder['status'] = 'upcoming';
        if (cycle < currentCycle) {
          status = 'completed';
        } else if (cycle === currentCycle) {
          status = 'current';
        }

        turnOrders.push({
          cycle,
          recipientId: recipient.user_id,
          recipientName: `User ${recipient.user_id}`, // Would fetch actual name in real implementation
          joinOrder: recipient.join_order,
          scheduledDate,
          status,
        });
      }

      return {
        success: true,
        data: turnOrders,
      };
    } catch (error) {
      console.error('Error calculating turn order:', error);
      return {
        success: false,
        error: error instanceof TurnOrderError ? error.message : 'Failed to calculate turn order',
        code: error instanceof TurnOrderError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get the next recipient in the turn order
   * @param groupId - Group ID
   * @param currentCycle - Current cycle number
   * @returns Next recipient information
   */
  async getNextRecipient(groupId: string, currentCycle: number): Promise<BusinessLogicResult<TurnOrder>> {
    try {
      // Get group and members
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new TurnOrderError('Group not found');
      }

      const membersResult = await DatabaseService.groupMembers.getGroupMembers(
        groupId,
        { status: 'active' }
      );
      if (!membersResult.success) {
        throw new TurnOrderError('Failed to fetch group members');
      }

      // Calculate turn order
      const turnOrderResult = await this.calculateTurnOrder({
        group: groupResult.data,
        members: membersResult.data.items,
        currentCycle,
      });

      if (!turnOrderResult.success || !turnOrderResult.data) {
        throw new TurnOrderError('Failed to calculate turn order');
      }

      // Find next recipient
      const nextTurn = turnOrderResult.data.find(turn => turn.status === 'current');
      if (!nextTurn) {
        throw new TurnOrderError('No current recipient found');
      }

      return {
        success: true,
        data: nextTurn,
      };
    } catch (error) {
      console.error('Error getting next recipient:', error);
      return {
        success: false,
        error: error instanceof TurnOrderError ? error.message : 'Failed to get next recipient',
        code: error instanceof TurnOrderError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Check if a specific user's turn has passed
   * @param groupId - Group ID
   * @param userId - User ID to check
   * @param currentCycle - Current cycle
   * @returns Whether user's turn has passed
   */
  async hasUserTurnPassed(
    groupId: string, 
    userId: string, 
    currentCycle: number
  ): Promise<BusinessLogicResult<boolean>> {
    try {
      // Get user's membership
      const membershipResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(
        userId,
        groupId
      );

      if (!membershipResult.success || !membershipResult.data) {
        throw new TurnOrderError('User membership not found');
      }

      const membership = membershipResult.data;
      
      // Check if user has already received payout
      if (membership.payout_received) {
        return { success: true, data: true };
      }

      // Check if user's join order has passed in current cycle pattern
      // For a group with N members, user with join_order X gets payout in cycles X, X+N, X+2N, etc.
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new TurnOrderError('Group not found');
      }

      const group = groupResult.data;
      const userTurnCycles = [];
      
      // Calculate all cycles where this user would receive payout
      for (let cycle = membership.join_order; cycle <= group.total_cycles; cycle += group.total_members) {
        userTurnCycles.push(cycle);
      }

      // Check if any of user's turn cycles have passed
      const hasPassedTurn = userTurnCycles.some(cycle => cycle < currentCycle);

      return {
        success: true,
        data: hasPassedTurn,
      };
    } catch (error) {
      console.error('Error checking user turn status:', error);
      return {
        success: false,
        error: error instanceof TurnOrderError ? error.message : 'Failed to check user turn status',
        code: error instanceof TurnOrderError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get full turn schedule for a group
   * @param groupId - Group ID
   * @returns Complete turn schedule
   */
  async getGroupTurnSchedule(groupId: string): Promise<BusinessLogicResult<TurnOrder[]>> {
    try {
      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new TurnOrderError('Group not found');
      }

      // Get all members
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) {
        throw new TurnOrderError('Failed to fetch group members');
      }

      // Calculate complete turn order
      return await this.calculateTurnOrder({
        group: groupResult.data,
        members: membersResult.data.items,
        currentCycle: groupResult.data.current_cycle,
      });
    } catch (error) {
      console.error('Error getting group turn schedule:', error);
      return {
        success: false,
        error: error instanceof TurnOrderError ? error.message : 'Failed to get turn schedule',
        code: error instanceof TurnOrderError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Validate turn order calculation parameters
   * @param params - Parameters to validate
   * @returns Validation result
   */
  private validateTurnOrderParams(params: CalculateTurnOrderParams) {
    const errors: string[] = [];

    if (!params.group) {
      errors.push('Group is required');
    } else {
      if (!params.group.id) errors.push('Group ID is required');
      if (!params.group.total_cycles || params.group.total_cycles <= 0) {
        errors.push('Group must have valid total cycles');
      }
      if (!params.group.contribution_frequency) {
        errors.push('Group must have contribution frequency');
      }
    }

    if (!params.members || !Array.isArray(params.members)) {
      errors.push('Members array is required');
    } else if (params.members.length === 0) {
      errors.push('At least one member is required');
    }

    if (params.currentCycle && params.currentCycle <= 0) {
      errors.push('Current cycle must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Calculate the date for a specific cycle
   * @param startDate - Group start date
   * @param cycle - Cycle number
   * @param frequency - Contribution frequency
   * @returns Calculated date
   */
  private calculateCycleDate(
    startDate: Date, 
    cycle: number, 
    frequency: 'daily' | 'weekly' | 'monthly'
  ): Date {
    const date = new Date(startDate);
    const cycleOffset = cycle - 1; // Cycle 1 starts at startDate

    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + cycleOffset);
        break;
      case 'weekly':
        date.setDate(date.getDate() + (cycleOffset * 7));
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + cycleOffset);
        break;
      default:
        throw new TurnOrderError(`Invalid frequency: ${frequency}`);
    }

    return date;
  }

  /**
   * Recalculate turn order when members change
   * @param groupId - Group ID
   * @param reason - Reason for recalculation
   * @returns Updated turn order
   */
  async recalculateTurnOrder(
    groupId: string, 
    reason: 'member_added' | 'member_removed' | 'member_status_changed'
  ): Promise<BusinessLogicResult<TurnOrder[]>> {
    try {
      console.log(`Recalculating turn order for group ${groupId}, reason: ${reason}`);

      // This would typically involve complex logic to handle:
      // - Member additions mid-cycle
      // - Member removals and redistributing turns
      // - Maintaining fairness in payout order
      
      // For now, we'll recalculate from current state
      const result = await this.getGroupTurnSchedule(groupId);
      
      if (result.success && result.data) {
        // Log the recalculation for audit purposes
        console.log(`Turn order recalculated: ${result.data.length} cycles planned`);
      }

      return result;
    } catch (error) {
      console.error('Error recalculating turn order:', error);
      return {
        success: false,
        error: 'Failed to recalculate turn order',
        code: 'RECALCULATION_ERROR',
      };
    }
  }
}

export default new TurnOrderService();