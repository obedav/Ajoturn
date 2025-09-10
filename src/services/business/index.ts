import TurnOrderService from './turnOrder';
import PaymentStatusService from './paymentStatus';
import CycleProcessorService from './cycleProcessor';
import GroupCompletionService from './groupCompletion';
import PaymentReminderService from './paymentReminders';

import {
  TurnOrder,
  PaymentStatusSummary,
  CycleProcessingResult,
  GroupCompletionStatus,
  ReminderResult,
  BusinessLogicResult,
  CalculateTurnOrderParams,
  CheckPaymentStatusParams,
  ProcessGroupCycleParams,
  ValidateGroupCompletionParams,
  SendPaymentRemindersParams,
  BusinessLogicError,
} from '../../types/business';

/**
 * Main business logic service that aggregates all business functions
 * Provides a unified interface for complex business operations
 */
class BusinessLogicService {
  // Turn Order Management
  turnOrder = TurnOrderService;
  
  // Payment Status Management
  paymentStatus = PaymentStatusService;
  
  // Cycle Processing
  cycleProcessor = CycleProcessorService;
  
  // Group Completion
  groupCompletion = GroupCompletionService;
  
  // Payment Reminders
  paymentReminders = PaymentReminderService;

  /**
   * Calculate turn order for a group
   * @param params - Turn order calculation parameters
   * @returns Turn order array
   */
  async calculateTurnOrder(params: CalculateTurnOrderParams): Promise<BusinessLogicResult<TurnOrder[]>> {
    return this.turnOrder.calculateTurnOrder(params);
  }

  /**
   * Check payment status for a group cycle
   * @param params - Payment status check parameters
   * @returns Payment status summary
   */
  async checkPaymentStatus(params: CheckPaymentStatusParams): Promise<BusinessLogicResult<PaymentStatusSummary>> {
    return this.paymentStatus.checkPaymentStatus(params);
  }

  /**
   * Process group cycle - move to next month/turn
   * @param params - Cycle processing parameters
   * @returns Processing result
   */
  async processGroupCycle(params: ProcessGroupCycleParams): Promise<BusinessLogicResult<CycleProcessingResult>> {
    return this.cycleProcessor.processGroupCycle(params);
  }

  /**
   * Validate if group has completed all cycles
   * @param params - Group completion validation parameters
   * @returns Group completion status
   */
  async validateGroupCompletion(params: ValidateGroupCompletionParams): Promise<BusinessLogicResult<GroupCompletionStatus>> {
    return this.groupCompletion.validateGroupCompletion(params);
  }

  /**
   * Send payment reminders to members
   * @param params - Payment reminder parameters
   * @returns Reminder sending results
   */
  async sendPaymentReminders(params: SendPaymentRemindersParams): Promise<BusinessLogicResult<ReminderResult>> {
    return this.paymentReminders.sendPaymentReminders(params);
  }

  /**
   * Comprehensive group health check
   * Combines multiple business logic checks for overall group status
   * @param groupId - Group ID to check
   * @returns Comprehensive health report
   */
  async performGroupHealthCheck(groupId: string): Promise<BusinessLogicResult<any>> {
    try {
      // Get group basic info first
      const DatabaseService = (await import('../database')).default;
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      
      if (!groupResult.success || !groupResult.data) {
        throw new BusinessLogicError('Group not found', 'GROUP_NOT_FOUND');
      }

      const group = groupResult.data;
      const currentCycle = group.current_cycle;

      // Perform parallel health checks
      const [
        paymentStatusResult,
        turnOrderResult,
        completionResult,
      ] = await Promise.allSettled([
        this.checkPaymentStatus({ groupId, cycle: currentCycle }),
        this.turnOrder.getGroupTurnSchedule(groupId),
        this.groupCompletion.getGroupCompletionReport(groupId),
      ]);

      const healthReport = {
        groupId,
        checkDate: new Date(),
        groupStatus: group.status,
        currentCycle,
        totalCycles: group.total_cycles,
        checks: {
          paymentStatus: {
            success: paymentStatusResult.status === 'fulfilled' && paymentStatusResult.value.success,
            data: paymentStatusResult.status === 'fulfilled' ? paymentStatusResult.value.data : null,
            error: paymentStatusResult.status === 'rejected' ? paymentStatusResult.reason?.message : 
                   (paymentStatusResult.status === 'fulfilled' ? paymentStatusResult.value.error : null),
          },
          turnOrder: {
            success: turnOrderResult.status === 'fulfilled' && turnOrderResult.value.success,
            data: turnOrderResult.status === 'fulfilled' ? turnOrderResult.value.data : null,
            error: turnOrderResult.status === 'rejected' ? turnOrderResult.reason?.message :
                   (turnOrderResult.status === 'fulfilled' ? turnOrderResult.value.error : null),
          },
          completion: {
            success: completionResult.status === 'fulfilled' && completionResult.value.success,
            data: completionResult.status === 'fulfilled' ? completionResult.value.data : null,
            error: completionResult.status === 'rejected' ? completionResult.reason?.message :
                   (completionResult.status === 'fulfilled' ? completionResult.value.error : null),
          },
        },
        overallHealth: 'healthy', // Will be calculated below
        recommendations: [] as string[],
        warnings: [] as string[],
        criticalIssues: [] as string[],
      };

      // Analyze results and determine overall health
      let healthyChecks = 0;
      const totalChecks = 3;

      if (healthReport.checks.paymentStatus.success) {
        healthyChecks++;
        const paymentData = healthReport.checks.paymentStatus.data;
        if (paymentData) {
          if (paymentData.completionRate < 70) {
            healthReport.warnings.push(`Low payment completion rate: ${paymentData.completionRate.toFixed(1)}%`);
          }
          if (paymentData.overdueMembers > 0) {
            healthReport.warnings.push(`${paymentData.overdueMembers} members with overdue payments`);
          }
        }
      } else {
        healthReport.criticalIssues.push('Cannot check payment status');
      }

      if (healthReport.checks.turnOrder.success) {
        healthyChecks++;
      } else {
        healthReport.criticalIssues.push('Cannot determine turn order');
      }

      if (healthReport.checks.completion.success) {
        healthyChecks++;
        const completionData = healthReport.checks.completion.data;
        if (completionData && completionData.issues.length > 0) {
          healthReport.warnings.push(...completionData.issues);
        }
      } else {
        healthReport.warnings.push('Cannot assess group completion status');
      }

      // Determine overall health
      const healthPercentage = (healthyChecks / totalChecks) * 100;
      
      if (healthPercentage === 100 && healthReport.criticalIssues.length === 0) {
        healthReport.overallHealth = 'healthy';
      } else if (healthPercentage >= 66 && healthReport.criticalIssues.length === 0) {
        healthReport.overallHealth = 'warning';
      } else if (healthPercentage >= 33) {
        healthReport.overallHealth = 'critical';
      } else {
        healthReport.overallHealth = 'failing';
      }

      // Add recommendations based on findings
      if (healthReport.warnings.length > 0) {
        healthReport.recommendations.push('Review and address warning issues promptly');
      }
      if (healthReport.criticalIssues.length > 0) {
        healthReport.recommendations.push('Immediate attention required for critical issues');
      }
      if (healthReport.checks.paymentStatus.data?.completionRate && 
          healthReport.checks.paymentStatus.data.completionRate < 80) {
        healthReport.recommendations.push('Consider sending payment reminders to improve completion rate');
      }

      return {
        success: true,
        data: healthReport,
      };
    } catch (error) {
      console.error('Error performing group health check:', error);
      return {
        success: false,
        error: error instanceof BusinessLogicError ? error.message : 'Failed to perform group health check',
        code: error instanceof BusinessLogicError ? error.code : 'HEALTH_CHECK_ERROR',
      };
    }
  }

  /**
   * Auto-process ready groups
   * Combines cycle processing with health checks
   * @param maxGroups - Maximum number of groups to process
   * @returns Processing summary
   */
  async autoProcessReadyGroups(maxGroups: number = 5): Promise<BusinessLogicResult<any>> {
    try {
      const cycleResult = await this.cycleProcessor.autoProcessReadyCycles(maxGroups);
      
      if (!cycleResult.success) {
        return cycleResult;
      }

      const processedCount = cycleResult.data || 0;
      const summary = {
        processedGroups: processedCount,
        timestamp: new Date(),
        details: `Successfully auto-processed ${processedCount} group cycles`,
      };

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('Error in auto-processing ready groups:', error);
      return {
        success: false,
        error: 'Failed to auto-process ready groups',
        code: 'AUTO_PROCESS_ERROR',
      };
    }
  }

  /**
   * Comprehensive error handling wrapper
   * @param operation - Business operation to perform
   * @param operationName - Name of the operation for logging
   * @returns Operation result with enhanced error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<BusinessLogicResult<T>>,
    operationName: string
  ): Promise<BusinessLogicResult<T>> {
    try {
      console.log(`Starting business operation: ${operationName}`);
      const startTime = Date.now();
      
      const result = await operation();
      
      const duration = Date.now() - startTime;
      console.log(`Completed business operation: ${operationName} (${duration}ms)`);
      
      if (!result.success) {
        console.warn(`Business operation failed: ${operationName} - ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Business operation error in ${operationName}:`, error);
      
      // Enhanced error classification
      let errorCode = 'UNKNOWN_ERROR';
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof BusinessLogicError) {
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
        // Classify common error types
        if (error.message.includes('not found')) {
          errorCode = 'NOT_FOUND_ERROR';
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorCode = 'PERMISSION_ERROR';
        } else if (error.message.includes('validation') || error.message.includes('invalid')) {
          errorCode = 'VALIDATION_ERROR';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorCode = 'NETWORK_ERROR';
        }
      }
      
      return {
        success: false,
        error: `${operationName} failed: ${errorMessage}`,
        code: errorCode,
      };
    }
  }

  /**
   * Batch process multiple groups
   * @param groupIds - Array of group IDs to process
   * @param operation - Operation to perform on each group
   * @returns Batch processing results
   */
  async batchProcess<T>(
    groupIds: string[],
    operation: (groupId: string) => Promise<BusinessLogicResult<T>>,
    operationName: string
  ): Promise<BusinessLogicResult<Array<{ groupId: string; result: BusinessLogicResult<T> }>>> {
    try {
      const results = [];
      
      for (const groupId of groupIds) {
        const groupResult = await this.withErrorHandling(
          () => operation(groupId),
          `${operationName} for group ${groupId}`
        );
        
        results.push({
          groupId,
          result: groupResult,
        });
      }
      
      const successCount = results.filter(r => r.result.success).length;
      const failureCount = results.length - successCount;
      
      console.log(`Batch ${operationName} completed: ${successCount} succeeded, ${failureCount} failed`);
      
      return {
        success: true,
        data: results,
        warnings: failureCount > 0 ? [`${failureCount} operations failed`] : undefined,
      };
    } catch (error) {
      console.error(`Batch processing error for ${operationName}:`, error);
      return {
        success: false,
        error: `Batch ${operationName} failed`,
        code: 'BATCH_PROCESSING_ERROR',
      };
    }
  }
}

export default new BusinessLogicService();