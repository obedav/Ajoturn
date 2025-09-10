import { 
  CycleProcessingResult, 
  ProcessGroupCycleParams, 
  BusinessLogicResult, 
  CycleProcessingError,
  CycleTransition,
  BUSINESS_CONSTANTS
} from '../../types/business';
import DatabaseService from '../database';
import TurnOrderService from './turnOrder';
import PaymentStatusService from './paymentStatus';

class CycleProcessorService {
  /**
   * Process group cycle - move to next month/turn
   * @param params - Cycle processing parameters
   * @returns Processing result with details
   */
  async processGroupCycle(params: ProcessGroupCycleParams): Promise<BusinessLogicResult<CycleProcessingResult>> {
    try {
      const { groupId, adminId, forceProcess = false, skipValidation = false } = params;

      // Validate inputs
      if (!groupId || !adminId) {
        throw new CycleProcessingError('Group ID and admin ID are required');
      }

      // Get group details
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new CycleProcessingError('Group not found');
      }

      const group = groupResult.data;

      // Verify admin permissions
      if (group.admin_id !== adminId) {
        throw new CycleProcessingError('Only group admin can process cycles');
      }

      // Check if group is in valid state for processing
      if (!skipValidation) {
        const validationResult = await this.validateCycleProcessing(group);
        if (!validationResult.success) {
          throw new CycleProcessingError(validationResult.error || 'Cycle processing validation failed');
        }
      }

      const currentCycle = group.current_cycle;
      const nextCycle = currentCycle + 1;

      // Initialize processing result
      const processingResult: CycleProcessingResult = {
        success: false,
        groupId,
        previousCycle: currentCycle,
        newCycle: nextCycle,
        payoutCreated: false,
        contributionsCreated: false,
        recipientId: '',
        payoutAmount: 0,
        warnings: [],
      };

      // Check if we can process (all payments collected or force process)
      if (!forceProcess) {
        const paymentStatus = await PaymentStatusService.checkPaymentStatus({
          groupId,
          cycle: currentCycle,
        });

        if (paymentStatus.success && paymentStatus.data) {
          const completionRate = paymentStatus.data.completionRate;
          
          if (completionRate < 90) { // Require at least 90% payment completion
            processingResult.warnings.push(
              `Only ${completionRate.toFixed(1)}% of payments collected. Consider waiting or using force processing.`
            );
            
            if (!forceProcess) {
              throw new CycleProcessingError(
                `Insufficient payments collected (${completionRate.toFixed(1)}%). Use force processing if needed.`
              );
            }
          }
        }
      }

      // Step 1: Process current cycle payout
      const payoutResult = await this.processCurrentCyclePayout(group, currentCycle);
      if (payoutResult.success && payoutResult.data) {
        processingResult.payoutCreated = true;
        processingResult.recipientId = payoutResult.data.recipientId;
        processingResult.payoutAmount = payoutResult.data.amount;
      } else {
        processingResult.warnings.push(`Payout processing warning: ${payoutResult.error}`);
      }

      // Step 2: Check if group is completed
      if (nextCycle > group.total_cycles) {
        // Group completed - finalize
        await this.finalizeGroupCompletion(groupId);
        processingResult.success = true;
        processingResult.warnings.push('Group has completed all cycles');
        return {
          success: true,
          data: processingResult,
        };
      }

      // Step 3: Move to next cycle
      const cycleUpdateResult = await this.advanceToNextCycle(group, nextCycle);
      if (!cycleUpdateResult.success) {
        throw new CycleProcessingError('Failed to advance to next cycle');
      }

      // Step 4: Create contributions for new cycle
      const contributionsResult = await this.createNextCycleContributions(groupId, nextCycle);
      if (contributionsResult.success) {
        processingResult.contributionsCreated = true;
      } else {
        processingResult.warnings.push(`Contributions creation warning: ${contributionsResult.error}`);
      }

      // Step 5: Update member statistics
      await this.updateMemberStatistics(groupId, currentCycle);

      processingResult.success = true;
      processingResult.newCycle = nextCycle;

      // Log the successful processing
      console.log(`Successfully processed cycle ${currentCycle} for group ${groupId}`);

      return {
        success: true,
        data: processingResult,
      };
    } catch (error) {
      console.error('Error processing group cycle:', error);
      return {
        success: false,
        error: error instanceof CycleProcessingError ? error.message : 'Failed to process group cycle',
        code: error instanceof CycleProcessingError ? error.code : 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Auto-process cycles that are ready
   * @param maxGroupsToProcess - Maximum number of groups to process
   * @returns Number of groups processed
   */
  async autoProcessReadyCycles(maxGroupsToProcess: number = 10): Promise<BusinessLogicResult<number>> {
    try {
      // This would typically run as a scheduled job
      // Find groups that are ready for cycle processing
      
      const activeGroupsResult = await DatabaseService.groups.getActiveGroups({ limit: 50 });
      if (!activeGroupsResult.success || !activeGroupsResult.data) {
        throw new CycleProcessingError('Failed to fetch active groups');
      }

      const groups = activeGroupsResult.data.items;
      let processedCount = 0;

      for (const group of groups) {
        if (processedCount >= maxGroupsToProcess) break;

        // Check if group cycle is ready for processing
        const isReady = await this.isCycleReadyForProcessing(group);
        
        if (isReady) {
          // Process the cycle
          const result = await this.processGroupCycle({
            groupId: group.id,
            adminId: group.admin_id, // Auto-process as admin
            forceProcess: false,
            skipValidation: false,
          });

          if (result.success) {
            processedCount++;
            console.log(`Auto-processed cycle for group ${group.id}`);
          }
        }
      }

      return {
        success: true,
        data: processedCount,
      };
    } catch (error) {
      console.error('Error in auto-processing cycles:', error);
      return {
        success: false,
        error: 'Failed to auto-process cycles',
        code: 'AUTO_PROCESS_ERROR',
      };
    }
  }

  /**
   * Get cycle transition history for a group
   * @param groupId - Group ID
   * @returns Cycle transition history
   */
  async getCycleTransitionHistory(groupId: string): Promise<BusinessLogicResult<CycleTransition[]>> {
    try {
      // This would typically be stored in a separate audit table
      // For now, we'll construct it from available data
      
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success || !groupResult.data) {
        throw new CycleProcessingError('Group not found');
      }

      const group = groupResult.data;
      const transitions: CycleTransition[] = [];

      // Get payout history to reconstruct transitions
      const payoutsResult = await DatabaseService.payouts.getGroupPayouts(groupId);
      if (payoutsResult.success && payoutsResult.data) {
        const payouts = payoutsResult.data.items;
        
        for (let i = 0; i < payouts.length; i++) {
          const payout = payouts[i];
          const nextPayout = payouts[i + 1];
          
          transitions.push({
            fromCycle: payout.cycle_number - 1,
            toCycle: payout.cycle_number,
            transitionDate: payout.created_at,
            previousRecipient: i > 0 ? payouts[i - 1].recipient_id : '',
            nextRecipient: payout.recipient_id,
            payoutProcessed: payout.status === 'completed',
            contributionsGenerated: true, // Assume true if payout exists
          });
        }
      }

      return {
        success: true,
        data: transitions,
      };
    } catch (error) {
      console.error('Error getting cycle transition history:', error);
      return {
        success: false,
        error: 'Failed to get transition history',
        code: 'TRANSITION_HISTORY_ERROR',
      };
    }
  }

  /**
   * Validate if cycle processing can proceed
   * @param group - Group to validate
   * @returns Validation result
   */
  private async validateCycleProcessing(group: any): Promise<BusinessLogicResult<boolean>> {
    const errors: string[] = [];

    // Check group status
    if (group.status !== 'active') {
      errors.push('Group must be active to process cycles');
    }

    // Check if group has members
    if (group.total_members < 2) {
      errors.push('Group must have at least 2 members');
    }

    // Check current cycle validity
    if (group.current_cycle < 1 || group.current_cycle > group.total_cycles) {
      errors.push('Invalid current cycle number');
    }

    // Check if cycle end date has passed
    const now = new Date();
    const cycleEndDate = new Date(group.cycle_end_date);
    
    if (now < cycleEndDate) {
      errors.push('Current cycle has not ended yet');
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Process payout for current cycle
   * @param group - Group data
   * @param cycle - Current cycle
   * @returns Payout processing result
   */
  private async processCurrentCyclePayout(
    group: any, 
    cycle: number
  ): Promise<BusinessLogicResult<{ recipientId: string; amount: number }>> {
    try {
      // Get or create payout for this cycle
      const existingPayoutResult = await DatabaseService.payouts.getCyclePayout(group.id, cycle);
      
      if (existingPayoutResult.success && existingPayoutResult.data) {
        // Payout already exists, check if it needs processing
        const payout = existingPayoutResult.data;
        
        if (payout.status === 'scheduled' && payout.approved_by_admin) {
          // Mark as processing
          await DatabaseService.payouts.markAsProcessing(payout.id);
        }

        return {
          success: true,
          data: {
            recipientId: payout.recipient_id,
            amount: payout.net_amount,
          },
        };
      } else {
        // Create new payout
        const payoutResult = await DatabaseService.createCyclePayout(
          group.id,
          cycle,
          new Date()
        );

        if (payoutResult.success && payoutResult.data) {
          return {
            success: true,
            data: {
              recipientId: payoutResult.data.recipient_id,
              amount: payoutResult.data.net_amount,
            },
          };
        }
      }

      throw new CycleProcessingError('Failed to process payout');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payout processing failed',
      };
    }
  }

  /**
   * Advance group to next cycle
   * @param group - Current group data
   * @param nextCycle - Next cycle number
   * @returns Update result
   */
  private async advanceToNextCycle(group: any, nextCycle: number): Promise<BusinessLogicResult<boolean>> {
    try {
      // Calculate new cycle dates
      const cycleStartDate = new Date();
      const cycleEndDate = new Date();
      
      // Add time based on frequency
      switch (group.contribution_frequency) {
        case 'daily':
          cycleEndDate.setDate(cycleEndDate.getDate() + 1);
          break;
        case 'weekly':
          cycleEndDate.setDate(cycleEndDate.getDate() + 7);
          break;
        case 'monthly':
          cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
          break;
      }

      // Update group
      const updateResult = await DatabaseService.groups.updateGroup(group.id, {
        current_cycle: nextCycle,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate,
        successful_cycles: group.successful_cycles + 1,
      });

      return {
        success: updateResult.success,
        error: updateResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to advance to next cycle',
      };
    }
  }

  /**
   * Create contributions for next cycle
   * @param groupId - Group ID
   * @param cycle - Cycle number
   * @returns Creation result
   */
  private async createNextCycleContributions(
    groupId: string, 
    cycle: number
  ): Promise<BusinessLogicResult<boolean>> {
    try {
      // Calculate due date for new cycle
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Default 7 days to contribute

      const result = await DatabaseService.createCycleContributions(
        groupId,
        cycle,
        dueDate
      );

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create contributions for next cycle',
      };
    }
  }

  /**
   * Update member statistics after cycle completion
   * @param groupId - Group ID
   * @param completedCycle - Completed cycle number
   */
  private async updateMemberStatistics(groupId: string, completedCycle: number): Promise<void> {
    try {
      // Get payment status for completed cycle
      const statusResult = await PaymentStatusService.checkPaymentStatus({
        groupId,
        cycle: completedCycle,
      });

      if (statusResult.success && statusResult.data) {
        const status = statusResult.data;
        
        // Update each member's statistics
        for (const memberStatus of status.membersStatus) {
          const memberResult = await DatabaseService.groupMembers.getMemberByUserAndGroup(
            memberStatus.userId,
            groupId
          );

          if (memberResult.success && memberResult.data) {
            const member = memberResult.data;
            
            // Update statistics based on payment status
            await DatabaseService.groupMembers.updateMemberStatistics(member.id, {
              contributionMade: memberStatus.status === 'paid',
              isLate: memberStatus.status === 'paid' && !!memberStatus.daysOverdue,
              missed: memberStatus.status === 'overdue',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating member statistics:', error);
    }
  }

  /**
   * Finalize group completion
   * @param groupId - Group ID
   */
  private async finalizeGroupCompletion(groupId: string): Promise<void> {
    try {
      await DatabaseService.groups.updateGroup(groupId, {
        status: 'completed',
      });

      console.log(`Group ${groupId} has been marked as completed`);
    } catch (error) {
      console.error('Error finalizing group completion:', error);
    }
  }

  /**
   * Check if cycle is ready for processing
   * @param group - Group to check
   * @returns Whether cycle is ready
   */
  private async isCycleReadyForProcessing(group: any): Promise<boolean> {
    try {
      const now = new Date();
      const cycleEndDate = new Date(group.cycle_end_date);
      
      // Check if cycle end date has passed
      if (now < cycleEndDate) {
        return false;
      }

      // Check payment completion rate
      const paymentStatus = await PaymentStatusService.checkPaymentStatus({
        groupId: group.id,
        cycle: group.current_cycle,
      });

      if (paymentStatus.success && paymentStatus.data) {
        // Allow processing if completion rate is above threshold
        return paymentStatus.data.completionRate >= 80;
      }

      return false;
    } catch (error) {
      console.error('Error checking cycle readiness:', error);
      return false;
    }
  }
}

export default new CycleProcessorService();