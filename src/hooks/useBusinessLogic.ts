import { useState, useCallback } from 'react';
import BusinessLogicService, {
  TurnOrderResult,
  PaymentStatusResult,
  CycleProcessResult,
  GroupCompletionResult,
  ReminderResult,
} from '../services/businessLogic';

// Hook for managing turn order calculations
export const useTurnOrder = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TurnOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateTurnOrder = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await BusinessLogicService.calculateTurnOrder(groupId);
      setData(result);
      if (!result.success) {
        setError(result.error || 'Failed to calculate turn order');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { 
        success: false, 
        currentRecipient: null, 
        nextRecipient: null, 
        cycleProgress: 0,
        error: errorMessage 
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    data,
    error,
    calculateTurnOrder,
  };
};

// Hook for managing payment status checks
export const usePaymentStatus = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaymentStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkPaymentStatus = useCallback(async (groupId: string, cycle?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await BusinessLogicService.checkPaymentStatus(groupId, cycle);
      setData(result);
      if (!result.success) {
        setError(result.error || 'Failed to check payment status');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        totalExpected: 0,
        totalPaid: 0,
        totalPending: 0,
        completionPercentage: 0,
        paidMembers: [],
        pendingMembers: [],
        overdueMembers: [],
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    data,
    error,
    checkPaymentStatus,
  };
};

// Hook for managing group cycle processing
export const useGroupCycle = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processGroupCycle = useCallback(async (groupId: string, adminId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await BusinessLogicService.processGroupCycle(groupId, adminId);
      if (!result.success) {
        setError(result.error || 'Failed to process group cycle');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        newCycle: 0,
        payoutCreated: false,
        payoutAmount: 0,
        recipientId: '',
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    processGroupCycle,
  };
};

// Hook for managing group completion validation
export const useGroupCompletion = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GroupCompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateGroupCompletion = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await BusinessLogicService.validateGroupCompletion(groupId);
      setData(result);
      if (!result.success) {
        setError(result.error || 'Failed to validate group completion');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        isCompleted: false,
        remainingCycles: 0,
        totalCyclesCompleted: 0,
        completionPercentage: 0,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    data,
    error,
    validateGroupCompletion,
  };
};

// Hook for managing payment reminders
export const usePaymentReminders = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendPaymentReminders = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await BusinessLogicService.sendPaymentReminders(groupId);
      if (!result.success) {
        setError(result.error || 'Failed to send payment reminders');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        remindersSent: 0,
        reminders: [],
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    sendPaymentReminders,
  };
};

// Combined hook for comprehensive group management
export const useGroupManagement = (groupId: string) => {
  const turnOrder = useTurnOrder();
  const paymentStatus = usePaymentStatus();
  const groupCycle = useGroupCycle();
  const groupCompletion = useGroupCompletion();
  const paymentReminders = usePaymentReminders();

  const refreshAll = useCallback(async () => {
    if (!groupId) return;

    const promises = [
      turnOrder.calculateTurnOrder(groupId),
      paymentStatus.checkPaymentStatus(groupId),
      groupCompletion.validateGroupCompletion(groupId),
    ];

    await Promise.allSettled(promises);
  }, [groupId, turnOrder, paymentStatus, groupCompletion]);

  const processNextCycle = useCallback(async (adminId: string) => {
    const result = await groupCycle.processGroupCycle(groupId, adminId);
    if (result.success) {
      // Refresh all data after successful cycle processing
      await refreshAll();
    }
    return result;
  }, [groupId, groupCycle, refreshAll]);

  const sendReminders = useCallback(async () => {
    return await paymentReminders.sendPaymentReminders(groupId);
  }, [groupId, paymentReminders]);

  const isLoading = 
    turnOrder.loading || 
    paymentStatus.loading || 
    groupCycle.loading || 
    groupCompletion.loading || 
    paymentReminders.loading;

  return {
    // Individual hooks
    turnOrder,
    paymentStatus,
    groupCycle,
    groupCompletion,
    paymentReminders,
    
    // Combined functionality
    refreshAll,
    processNextCycle,
    sendReminders,
    isLoading,
    
    // Convenience getters
    get currentRecipient() { return turnOrder.data?.currentRecipient || null; },
    get nextRecipient() { return turnOrder.data?.nextRecipient || null; },
    get cycleProgress() { return turnOrder.data?.cycleProgress || 0; },
    get paymentCompletion() { return paymentStatus.data?.completionPercentage || 0; },
    get isGroupCompleted() { return groupCompletion.data?.isCompleted || false; },
    get remainingCycles() { return groupCompletion.data?.remainingCycles || 0; },
  };
};