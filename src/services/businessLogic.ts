import { SavingsGroup, GroupMember, Contribution, Payout } from './firestore';
import FirestoreService from './firestore';
import messaging from '@react-native-firebase/messaging';

// Business Logic Types
export interface TurnOrderResult {
  success: boolean;
  currentRecipient: GroupMember | null;
  nextRecipient: GroupMember | null;
  cycleProgress: number;
  error?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  totalExpected: number;
  totalPaid: number;
  totalPending: number;
  completionPercentage: number;
  paidMembers: GroupMember[];
  pendingMembers: GroupMember[];
  overdueMembers: GroupMember[];
  error?: string;
}

export interface CycleProcessResult {
  success: boolean;
  newCycle: number;
  payoutCreated: boolean;
  payoutId?: string;
  payoutAmount: number;
  recipientId: string;
  error?: string;
}

export interface GroupCompletionResult {
  success: boolean;
  isCompleted: boolean;
  remainingCycles: number;
  totalCyclesCompleted: number;
  completionPercentage: number;
  error?: string;
}

export interface PaymentReminder {
  memberId: string;
  memberName: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
  reminderType: 'upcoming' | 'due' | 'overdue';
}

export interface ReminderResult {
  success: boolean;
  remindersSent: number;
  reminders: PaymentReminder[];
  error?: string;
}

// Error types
export class BusinessLogicError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

class AjoturnBusinessLogic {
  /**
   * Calculates turn order and determines whose turn is next for payout
   */
  async calculateTurnOrder(groupId: string): Promise<TurnOrderResult> {
    try {
      const group = await FirestoreService.getSavingsGroup(groupId);
      
      if (!group) {
        throw new BusinessLogicError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (group.status !== 'active') {
        throw new BusinessLogicError('Group is not active', 'GROUP_INACTIVE');
      }

      // Sort members by join date to establish turn order
      const sortedMembers = [...group.members]
        .filter(member => member.isActive)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

      if (sortedMembers.length === 0) {
        throw new BusinessLogicError('No active members in group', 'NO_ACTIVE_MEMBERS');
      }

      // Current recipient is based on current cycle (1-indexed)
      const currentRecipientIndex = (group.currentCycle - 1) % sortedMembers.length;
      const currentRecipient = sortedMembers[currentRecipientIndex];
      
      // Next recipient
      const nextRecipientIndex = group.currentCycle % sortedMembers.length;
      const nextRecipient = sortedMembers[nextRecipientIndex];

      // Calculate cycle progress
      const cycleProgress = Math.min((group.currentCycle / group.totalCycles) * 100, 100);

      return {
        success: true,
        currentRecipient,
        nextRecipient: nextRecipient !== currentRecipient ? nextRecipient : null,
        cycleProgress,
      };
    } catch (error) {
      console.error('Error calculating turn order:', error);
      return {
        success: false,
        currentRecipient: null,
        nextRecipient: null,
        cycleProgress: 0,
        error: error instanceof BusinessLogicError ? error.message : 'Failed to calculate turn order',
      };
    }
  }

  /**
   * Checks payment status for current cycle and tracks who has paid
   */
  async checkPaymentStatus(groupId: string, cycle?: number): Promise<PaymentStatusResult> {
    try {
      const group = await FirestoreService.getSavingsGroup(groupId);
      
      if (!group) {
        throw new BusinessLogicError('Group not found', 'GROUP_NOT_FOUND');
      }

      const targetCycle = cycle || group.currentCycle;
      const contributions = await FirestoreService.getGroupContributions(groupId, targetCycle);
      
      const activeMembers = group.members.filter(member => member.isActive);
      const totalExpected = activeMembers.length * group.contributionAmount;
      
      const paidContributions = contributions.filter(c => c.status === 'paid');
      const pendingContributions = contributions.filter(c => c.status === 'pending');
      const overdueContributions = contributions.filter(c => {
        if (c.status === 'paid') return false;
        const dueDate = c.dueDate instanceof Date ? c.dueDate : new Date(c.dueDate.seconds * 1000);
        return new Date() > dueDate;
      });

      const totalPaid = paidContributions.reduce((sum, c) => sum + c.amount, 0);
      const totalPending = pendingContributions.reduce((sum, c) => sum + c.amount, 0);
      
      // Get member details for each category
      const paidMemberIds = new Set(paidContributions.map(c => c.userId));
      const pendingMemberIds = new Set(pendingContributions.map(c => c.userId));
      const overdueMemberIds = new Set(overdueContributions.map(c => c.userId));

      const paidMembers = activeMembers.filter(m => paidMemberIds.has(m.userId));
      const pendingMembers = activeMembers.filter(m => pendingMemberIds.has(m.userId) && !paidMemberIds.has(m.userId));
      const overdueMembers = activeMembers.filter(m => overdueMemberIds.has(m.userId));

      const completionPercentage = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;

      return {
        success: true,
        totalExpected,
        totalPaid,
        totalPending,
        completionPercentage,
        paidMembers,
        pendingMembers,
        overdueMembers,
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      return {
        success: false,
        totalExpected: 0,
        totalPaid: 0,
        totalPending: 0,
        completionPercentage: 0,
        paidMembers: [],
        pendingMembers: [],
        overdueMembers: [],
        error: error instanceof BusinessLogicError ? error.message : 'Failed to check payment status',
      };
    }
  }

  /**
   * Processes group cycle - moves to next month/turn and creates payout
   */
  async processGroupCycle(groupId: string, adminId: string): Promise<CycleProcessResult> {
    try {
      const group = await FirestoreService.getSavingsGroup(groupId);
      
      if (!group) {
        throw new BusinessLogicError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (group.adminId !== adminId) {
        throw new BusinessLogicError('Only group admin can process cycle', 'UNAUTHORIZED');
      }

      if (group.status !== 'active') {
        throw new BusinessLogicError('Group is not active', 'GROUP_INACTIVE');
      }

      // Check if current cycle payments are complete
      const paymentStatus = await this.checkPaymentStatus(groupId);
      if (!paymentStatus.success) {
        throw new BusinessLogicError('Failed to check payment status', 'PAYMENT_CHECK_FAILED');
      }

      if (paymentStatus.completionPercentage < 100) {
        throw new BusinessLogicError(
          `Cannot process cycle: Only ${paymentStatus.completionPercentage}% of payments received`,
          'INCOMPLETE_PAYMENTS'
        );
      }

      // Get current recipient
      const turnOrder = await this.calculateTurnOrder(groupId);
      if (!turnOrder.success || !turnOrder.currentRecipient) {
        throw new BusinessLogicError('Failed to determine payout recipient', 'RECIPIENT_ERROR');
      }

      const currentRecipient = turnOrder.currentRecipient;
      const payoutAmount = paymentStatus.totalPaid;

      // Create payout record
      const payoutData: Omit<Payout, 'id' | 'createdAt'> = {
        groupId,
        recipientId: currentRecipient.userId,
        amount: payoutAmount,
        cycle: group.currentCycle,
        status: 'pending',
        scheduledDate: new Date(),
      };

      const payoutId = await FirestoreService.createPayout(payoutData);
      if (!payoutId) {
        throw new BusinessLogicError('Failed to create payout record', 'PAYOUT_CREATION_FAILED');
      }

      // Update group to next cycle
      const newCycle = group.currentCycle + 1;
      const updates: Partial<SavingsGroup> = {
        currentCycle: newCycle,
        updatedAt: new Date(),
      };

      // Check if group should be completed
      if (newCycle > group.totalCycles) {
        updates.status = 'completed';
        updates.endDate = new Date();
      }

      // Update group in Firestore using batch update
      const updateSuccess = await FirestoreService.batchUpdate([
        {
          collection: 'savingsGroups',
          docId: groupId,
          data: updates,
        },
      ]);

      if (!updateSuccess) {
        throw new BusinessLogicError('Failed to update group cycle', 'GROUP_UPDATE_FAILED');
      }

      return {
        success: true,
        newCycle,
        payoutCreated: true,
        payoutId,
        payoutAmount,
        recipientId: currentRecipient.userId,
      };
    } catch (error) {
      console.error('Error processing group cycle:', error);
      return {
        success: false,
        newCycle: 0,
        payoutCreated: false,
        payoutAmount: 0,
        recipientId: '',
        error: error instanceof BusinessLogicError ? error.message : 'Failed to process group cycle',
      };
    }
  }

  /**
   * Validates if group cycle is finished and determines completion status
   */
  async validateGroupCompletion(groupId: string): Promise<GroupCompletionResult> {
    try {
      const group = await FirestoreService.getSavingsGroup(groupId);
      
      if (!group) {
        throw new BusinessLogicError('Group not found', 'GROUP_NOT_FOUND');
      }

      const totalCyclesCompleted = group.currentCycle - 1; // Current cycle is in progress
      const remainingCycles = Math.max(0, group.totalCycles - group.currentCycle);
      const completionPercentage = Math.min((totalCyclesCompleted / group.totalCycles) * 100, 100);
      
      const isCompleted = group.status === 'completed' || group.currentCycle > group.totalCycles;

      return {
        success: true,
        isCompleted,
        remainingCycles,
        totalCyclesCompleted,
        completionPercentage,
      };
    } catch (error) {
      console.error('Error validating group completion:', error);
      return {
        success: false,
        isCompleted: false,
        remainingCycles: 0,
        totalCyclesCompleted: 0,
        completionPercentage: 0,
        error: error instanceof BusinessLogicError ? error.message : 'Failed to validate group completion',
      };
    }
  }

  /**
   * Sends payment reminders to group members based on payment status
   */
  async sendPaymentReminders(groupId: string): Promise<ReminderResult> {
    try {
      const group = await FirestoreService.getSavingsGroup(groupId);
      
      if (!group) {
        throw new BusinessLogicError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (group.status !== 'active') {
        throw new BusinessLogicError('Group is not active', 'GROUP_INACTIVE');
      }

      // Get payment status for current cycle
      const paymentStatus = await this.checkPaymentStatus(groupId);
      if (!paymentStatus.success) {
        throw new BusinessLogicError('Failed to check payment status', 'PAYMENT_CHECK_FAILED');
      }

      const contributions = await FirestoreService.getGroupContributions(groupId, group.currentCycle);
      const reminders: PaymentReminder[] = [];
      let remindersSent = 0;

      const now = new Date();

      // Process pending and overdue members
      const membersToRemind = [
        ...paymentStatus.pendingMembers,
        ...paymentStatus.overdueMembers,
      ];

      for (const member of membersToRemind) {
        const contribution = contributions.find(c => c.userId === member.userId);
        
        if (contribution && contribution.status !== 'paid') {
          const dueDate = contribution.dueDate instanceof Date 
            ? contribution.dueDate 
            : new Date(contribution.dueDate.seconds * 1000);
          
          const timeDiff = now.getTime() - dueDate.getTime();
          const daysOverdue = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
          
          let reminderType: 'upcoming' | 'due' | 'overdue';
          if (daysOverdue > 0) {
            reminderType = 'overdue';
          } else if (Math.abs(timeDiff) <= 24 * 60 * 60 * 1000) { // Due today
            reminderType = 'due';
          } else {
            reminderType = 'upcoming';
          }

          const reminder: PaymentReminder = {
            memberId: member.userId,
            memberName: member.displayName,
            amount: group.contributionAmount,
            dueDate,
            daysOverdue,
            reminderType,
          };

          reminders.push(reminder);

          // Send push notification (in a real app, you'd send to the member's device)
          try {
            await this.sendNotificationToMember(member, reminder, group);
            remindersSent++;
          } catch (notificationError) {
            console.error(`Failed to send notification to ${member.displayName}:`, notificationError);
          }
        }
      }

      return {
        success: true,
        remindersSent,
        reminders,
      };
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      return {
        success: false,
        remindersSent: 0,
        reminders: [],
        error: error instanceof BusinessLogicError ? error.message : 'Failed to send payment reminders',
      };
    }
  }

  /**
   * Helper function to send notification to a specific member
   */
  private async sendNotificationToMember(
    member: GroupMember, 
    reminder: PaymentReminder, 
    group: SavingsGroup
  ): Promise<void> {
    try {
      // In a real implementation, you would:
      // 1. Get the member's FCM token from their user document
      // 2. Send a push notification using Firebase Cloud Messaging
      // 3. Optionally send SMS using a service like Twilio
      
      let title: string;
      let body: string;

      switch (reminder.reminderType) {
        case 'upcoming':
          title = `Payment Due Soon - ${group.name}`;
          body = `Your contribution of ₦${reminder.amount.toLocaleString()} is due on ${reminder.dueDate.toLocaleDateString()}.`;
          break;
        case 'due':
          title = `Payment Due Today - ${group.name}`;
          body = `Your contribution of ₦${reminder.amount.toLocaleString()} is due today. Please make your payment.`;
          break;
        case 'overdue':
          title = `Overdue Payment - ${group.name}`;
          body = `Your payment is ${reminder.daysOverdue} day(s) overdue. Please pay ₦${reminder.amount.toLocaleString()} immediately.`;
          break;
      }

      // For now, just log the notification
      console.log(`Notification sent to ${member.displayName}:`, { title, body });
      
      // In production, you would use:
      /*
      const message = {
        notification: { title, body },
        data: {
          groupId: group.id,
          reminderType: reminder.reminderType,
          amount: reminder.amount.toString(),
        },
        token: memberFCMToken, // Get from user document
      };
      
      await messaging().send(message);
      */
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Utility function to get next payment due date based on contribution frequency
   */
  getNextPaymentDueDate(group: SavingsGroup, currentDate: Date = new Date()): Date {
    const dueDate = new Date(currentDate);
    
    switch (group.contributionFrequency) {
      case 'daily':
        dueDate.setDate(dueDate.getDate() + 1);
        break;
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + 7);
        break;
      case 'monthly':
        dueDate.setMonth(dueDate.getMonth() + 1);
        break;
    }
    
    return dueDate;
  }

  /**
   * Calculate late fees based on overdue days
   */
  calculateLateFee(overdueDays: number, contributionAmount: number): number {
    if (overdueDays <= 0) return 0;
    
    // 2% per day late, max 20% of contribution
    const feePercentage = Math.min(overdueDays * 0.02, 0.20);
    return Math.floor(contributionAmount * feePercentage);
  }
}

export default new AjoturnBusinessLogic();