import { BusinessLogicResult } from '../../types/business';
import DatabaseService from '../database';
import PaymentTrackingService from './paymentTracking';
import NotificationService from '../notifications';
import PayoutNotificationService from '../notifications/payoutNotifications';

export interface TurnRotationJob {
  id: string;
  groupId: string;
  cycle: number;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TurnRotationResult {
  success: boolean;
  cycle: number;
  nextRecipient?: {
    userId: string;
    name: string;
    amount: number;
  };
  payoutAmount: number;
  processedAt: Date;
}

class TurnRotationSchedulerService {
  private pendingJobs: Map<string, NodeJS.Timeout> = new Map();
  private processingJobs: Set<string> = new Set();

  async scheduleAutomaticRotation(params: {
    groupId: string;
    cycle: number;
    delayMinutes?: number;
  }): Promise<BusinessLogicResult<TurnRotationJob>> {
    try {
      const { groupId, cycle, delayMinutes = 5 } = params;
      const jobId = `rotation_${groupId}_${cycle}_${Date.now()}`;
      
      // Check if already scheduled
      if (this.pendingJobs.has(`${groupId}_${cycle}`)) {
        return {
          success: false,
          error: 'Turn rotation already scheduled for this cycle',
          code: 'ALREADY_SCHEDULED',
        };
      }

      const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
      
      const job: TurnRotationJob = {
        id: jobId,
        groupId,
        cycle,
        scheduledAt,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store job in database (would be stored in a jobs table in real implementation)
      await this.storeRotationJob(job);

      // Schedule the job
      const timeout = setTimeout(() => {
        this.processRotationJob(jobId);
      }, delayMinutes * 60 * 1000);

      this.pendingJobs.set(`${groupId}_${cycle}`, timeout);

      console.log(`Turn rotation scheduled for group ${groupId}, cycle ${cycle} at ${scheduledAt}`);

      return {
        success: true,
        data: job,
      };
    } catch (error) {
      console.error('Error scheduling turn rotation:', error);
      return {
        success: false,
        error: 'Failed to schedule turn rotation',
        code: 'SCHEDULE_ERROR',
      };
    }
  }

  async processRotationJob(jobId: string): Promise<BusinessLogicResult<TurnRotationResult>> {
    try {
      const job = await this.getRotationJob(jobId);
      if (!job) {
        return {
          success: false,
          error: 'Job not found',
          code: 'JOB_NOT_FOUND',
        };
      }

      const jobKey = `${job.groupId}_${job.cycle}`;
      
      // Check if already processing
      if (this.processingJobs.has(jobKey)) {
        return {
          success: false,
          error: 'Job already being processed',
          code: 'ALREADY_PROCESSING',
        };
      }

      this.processingJobs.add(jobKey);
      
      try {
        // Update job status
        await this.updateJobStatus(jobId, 'processing');

        // Verify cycle is still complete and ready for rotation
        const progressResult = await PaymentTrackingService.getPaymentProgress(job.groupId, job.cycle);
        if (!progressResult.success || !progressResult.data?.canProcessCycle) {
          throw new Error('Cycle is no longer ready for processing');
        }

        // Process the automatic turn rotation
        const rotationResult = await PaymentTrackingService.processAutomaticTurnRotation(
          job.groupId,
          job.cycle
        );

        if (!rotationResult.success) {
          throw new Error(rotationResult.error || 'Turn rotation failed');
        }

        // Send rotation completion notifications
        await this.sendRotationNotifications(job.groupId, job.cycle, rotationResult.data);

        // Setup payout notifications for the recipient
        if (rotationResult.data.nextRecipient) {
          await PayoutNotificationService.notifyPayoutCompleted({
            recipientId: rotationResult.data.recipient.userId,
            recipientName: rotationResult.data.recipient.name,
            groupId: job.groupId,
            groupName: rotationResult.data.groupName || 'Group',
            cycle: job.cycle,
            payoutAmount: rotationResult.data.payoutAmount || 0,
            processingDate: new Date(),
            payoutMethod: 'mobile_money', // Default method
          });

          // Announce next recipient
          await PayoutNotificationService.announceNextRecipient({
            recipientId: rotationResult.data.nextRecipient.userId,
            recipientName: rotationResult.data.nextRecipient.name,
            groupId: job.groupId,
            groupName: rotationResult.data.groupName || 'Group',
            cycle: job.cycle + 1,
            expectedPayoutAmount: rotationResult.data.nextRecipient.expectedAmount,
            expectedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            sendToGroup: true,
          });
        }

        // Mark job as completed
        await this.updateJobStatus(jobId, 'completed');

        const result: TurnRotationResult = {
          success: true,
          cycle: job.cycle,
          nextRecipient: rotationResult.data.nextRecipient,
          payoutAmount: rotationResult.data.payoutAmount || 0,
          processedAt: new Date(),
        };

        console.log(`Turn rotation completed for group ${job.groupId}, cycle ${job.cycle}`);

        return {
          success: true,
          data: result,
        };

      } catch (error) {
        console.error('Error processing rotation job:', error);
        
        // Increment attempts and decide on retry
        job.attempts += 1;
        job.errorMessage = error.message;

        if (job.attempts >= job.maxAttempts) {
          await this.updateJobStatus(jobId, 'failed');
          
          // Send failure notification to admin
          await this.sendFailureNotification(job.groupId, job.cycle, error.message);
          
          return {
            success: false,
            error: `Turn rotation failed after ${job.maxAttempts} attempts: ${error.message}`,
            code: 'MAX_ATTEMPTS_EXCEEDED',
          };
        } else {
          // Schedule retry in 10 minutes
          setTimeout(() => {
            this.processRotationJob(jobId);
          }, 10 * 60 * 1000);
          
          await this.updateJobStatus(jobId, 'pending');
          
          return {
            success: false,
            error: `Turn rotation failed, retry scheduled (attempt ${job.attempts}/${job.maxAttempts})`,
            code: 'RETRY_SCHEDULED',
          };
        }
      } finally {
        this.processingJobs.delete(jobKey);
        this.pendingJobs.delete(jobKey);
      }
    } catch (error) {
      console.error('Error in processRotationJob:', error);
      return {
        success: false,
        error: 'Failed to process rotation job',
        code: 'PROCESSING_ERROR',
      };
    }
  }

  async cancelScheduledRotation(groupId: string, cycle: number): Promise<BusinessLogicResult<boolean>> {
    try {
      const jobKey = `${groupId}_${cycle}`;
      
      if (this.pendingJobs.has(jobKey)) {
        const timeout = this.pendingJobs.get(jobKey)!;
        clearTimeout(timeout);
        this.pendingJobs.delete(jobKey);
        
        console.log(`Cancelled scheduled rotation for group ${groupId}, cycle ${cycle}`);
        
        return {
          success: true,
          data: true,
        };
      }

      return {
        success: false,
        error: 'No scheduled rotation found',
        code: 'NOT_SCHEDULED',
      };
    } catch (error) {
      console.error('Error cancelling scheduled rotation:', error);
      return {
        success: false,
        error: 'Failed to cancel scheduled rotation',
        code: 'CANCEL_ERROR',
      };
    }
  }

  async getScheduledRotations(groupId?: string): Promise<BusinessLogicResult<TurnRotationJob[]>> {
    try {
      // In real implementation, would query jobs table
      const jobs: TurnRotationJob[] = [];
      
      // For now, return information about pending jobs
      const pendingJobs: TurnRotationJob[] = [];
      for (const [key, _] of this.pendingJobs) {
        const [gId, cycle] = key.split('_');
        if (!groupId || gId === groupId) {
          pendingJobs.push({
            id: `pending_${key}`,
            groupId: gId,
            cycle: parseInt(cycle),
            scheduledAt: new Date(), // Would be actual scheduled time
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      return {
        success: true,
        data: pendingJobs,
      };
    } catch (error) {
      console.error('Error getting scheduled rotations:', error);
      return {
        success: false,
        error: 'Failed to get scheduled rotations',
        code: 'GET_SCHEDULED_ERROR',
      };
    }
  }

  private async sendRotationNotifications(
    groupId: string, 
    cycle: number, 
    rotationData: any
  ): Promise<void> {
    try {
      // Get group members
      const membersResult = await DatabaseService.groupMembers.getGroupMembers(groupId);
      if (!membersResult.success) return;

      const members = membersResult.data.items;
      
      // Send notification to all members
      const notifications = members.map(member => 
        NotificationService.sendToUser(member.user_id, {
          type: 'cycle_completed',
          title: 'Cycle Completed!',
          message: `Cycle ${cycle} has been completed and funds have been distributed.`,
          data: {
            groupId,
            cycle,
            nextRecipient: rotationData.nextRecipient,
          },
        })
      );

      await Promise.all(notifications);

      // Send special notification to next recipient
      if (rotationData.nextRecipient) {
        await NotificationService.sendToUser(rotationData.nextRecipient.userId, {
          type: 'payout_ready',
          title: 'Your Turn is Next!',
          message: `You're the next recipient in the group rotation. Your payout will be processed soon.`,
          data: {
            groupId,
            nextCycle: cycle + 1,
            expectedAmount: rotationData.nextRecipient.amount,
          },
        });
      }
    } catch (error) {
      console.error('Error sending rotation notifications:', error);
    }
  }

  private async sendFailureNotification(
    groupId: string, 
    cycle: number, 
    errorMessage: string
  ): Promise<void> {
    try {
      // Get group admin
      const groupResult = await DatabaseService.groups.getGroupById(groupId);
      if (!groupResult.success) return;

      const adminId = groupResult.data.admin_id;
      
      await NotificationService.sendToUser(adminId, {
        type: 'rotation_failed',
        title: 'Turn Rotation Failed',
        message: `Automatic turn rotation failed for cycle ${cycle}. Manual intervention required.`,
        data: {
          groupId,
          cycle,
          errorMessage,
        },
      });
    } catch (error) {
      console.error('Error sending failure notification:', error);
    }
  }

  private async storeRotationJob(job: TurnRotationJob): Promise<void> {
    // In real implementation, would store in database
    console.log('Storing rotation job:', job.id);
  }

  private async getRotationJob(jobId: string): Promise<TurnRotationJob | null> {
    // In real implementation, would fetch from database
    // For now, create a mock job based on jobId
    const parts = jobId.split('_');
    if (parts.length >= 4) {
      return {
        id: jobId,
        groupId: parts[1],
        cycle: parseInt(parts[2]),
        scheduledAt: new Date(),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }

  private async updateJobStatus(jobId: string, status: TurnRotationJob['status']): Promise<void> {
    // In real implementation, would update in database
    console.log(`Updating job ${jobId} status to ${status}`);
  }

  // Cleanup method to be called when service shuts down
  cleanup(): void {
    for (const timeout of this.pendingJobs.values()) {
      clearTimeout(timeout);
    }
    this.pendingJobs.clear();
    this.processingJobs.clear();
  }
}

export default new TurnRotationSchedulerService();