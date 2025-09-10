import { SavingsGroup } from '../services/firestore';

/**
 * Date utility functions for Ajoturn business logic
 */

export interface CycleDates {
  cycleStart: Date;
  cycleEnd: Date;
  paymentDue: Date;
  payoutDate: Date;
}

export interface PaymentSchedule {
  cycle: number;
  dueDate: Date;
  payoutDate: Date;
  recipient: string;
}

/**
 * Calculate cycle dates based on group settings and cycle number
 */
export const calculateCycleDates = (
  group: SavingsGroup, 
  cycleNumber: number = group.currentCycle
): CycleDates => {
  const startDate = new Date(group.startDate);
  
  // Calculate cycle start date
  const cycleStart = new Date(startDate);
  
  switch (group.contributionFrequency) {
    case 'daily':
      cycleStart.setDate(startDate.getDate() + (cycleNumber - 1));
      break;
    case 'weekly':
      cycleStart.setDate(startDate.getDate() + (cycleNumber - 1) * 7);
      break;
    case 'monthly':
      cycleStart.setMonth(startDate.getMonth() + (cycleNumber - 1));
      break;
  }
  
  // Calculate cycle end date
  const cycleEnd = new Date(cycleStart);
  switch (group.contributionFrequency) {
    case 'daily':
      cycleEnd.setDate(cycleStart.getDate() + 1);
      break;
    case 'weekly':
      cycleEnd.setDate(cycleStart.getDate() + 7);
      break;
    case 'monthly':
      cycleEnd.setMonth(cycleStart.getMonth() + 1);
      break;
  }
  
  // Payment due date (usually middle of cycle)
  const paymentDue = new Date(cycleStart);
  const cycleDuration = cycleEnd.getTime() - cycleStart.getTime();
  paymentDue.setTime(cycleStart.getTime() + cycleDuration * 0.5);
  
  // Payout date (end of cycle when all payments received)
  const payoutDate = new Date(cycleEnd);
  payoutDate.setDate(cycleEnd.getDate() - 1); // Day before cycle ends
  
  return {
    cycleStart,
    cycleEnd,
    paymentDue,
    payoutDate,
  };
};

/**
 * Generate complete payment schedule for entire group duration
 */
export const generatePaymentSchedule = (group: SavingsGroup): PaymentSchedule[] => {
  const schedule: PaymentSchedule[] = [];
  const sortedMembers = [...group.members]
    .filter(member => member.isActive)
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  
  for (let cycle = 1; cycle <= group.totalCycles; cycle++) {
    const cycleDates = calculateCycleDates(group, cycle);
    const recipientIndex = (cycle - 1) % sortedMembers.length;
    const recipient = sortedMembers[recipientIndex];
    
    schedule.push({
      cycle,
      dueDate: cycleDates.paymentDue,
      payoutDate: cycleDates.payoutDate,
      recipient: recipient.displayName,
    });
  }
  
  return schedule;
};

/**
 * Check if a payment is overdue
 */
export const isPaymentOverdue = (dueDate: Date, currentDate: Date = new Date()): boolean => {
  return currentDate > dueDate;
};

/**
 * Calculate days overdue
 */
export const getDaysOverdue = (dueDate: Date, currentDate: Date = new Date()): number => {
  if (!isPaymentOverdue(dueDate, currentDate)) return 0;
  
  const timeDiff = currentDate.getTime() - dueDate.getTime();
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
};

/**
 * Calculate days until due date
 */
export const getDaysUntilDue = (dueDate: Date, currentDate: Date = new Date()): number => {
  const timeDiff = dueDate.getTime() - currentDate.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

/**
 * Get the next business day (skips weekends for monthly cycles)
 */
export const getNextBusinessDay = (date: Date): Date => {
  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);
  
  // Skip weekends
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
};

/**
 * Format date for display in Nigerian format
 */
export const formatNigerianDate = (date: Date): string => {
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format date and time for display
 */
export const formatNigerianDateTime = (date: Date): string => {
  return date.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get relative time string (e.g., "2 days ago", "in 3 days")
 */
export const getRelativeTime = (date: Date, currentDate: Date = new Date()): string => {
  const timeDiff = date.getTime() - currentDate.getTime();
  const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Tomorrow';
  if (daysDiff === -1) return 'Yesterday';
  if (daysDiff > 1) return `In ${daysDiff} days`;
  if (daysDiff < -1) return `${Math.abs(daysDiff)} days ago`;
  
  return formatNigerianDate(date);
};

/**
 * Check if date is within grace period (typically 2-3 days after due date)
 */
export const isWithinGracePeriod = (
  dueDate: Date, 
  graceDays: number = 2, 
  currentDate: Date = new Date()
): boolean => {
  if (!isPaymentOverdue(dueDate, currentDate)) return true;
  
  const daysOverdue = getDaysOverdue(dueDate, currentDate);
  return daysOverdue <= graceDays;
};

/**
 * Calculate the estimated completion date for the group
 */
export const getGroupCompletionDate = (group: SavingsGroup): Date => {
  const startDate = new Date(group.startDate);
  const completionDate = new Date(startDate);
  
  switch (group.contributionFrequency) {
    case 'daily':
      completionDate.setDate(startDate.getDate() + group.totalCycles);
      break;
    case 'weekly':
      completionDate.setDate(startDate.getDate() + (group.totalCycles * 7));
      break;
    case 'monthly':
      completionDate.setMonth(startDate.getMonth() + group.totalCycles);
      break;
  }
  
  return completionDate;
};

/**
 * Validate if a date is a valid business day for transactions
 */
export const isValidTransactionDate = (date: Date): boolean => {
  const day = date.getDay();
  
  // Exclude Sundays and Saturdays for some financial operations
  if (day === 0 || day === 6) return false;
  
  // Add any Nigerian public holidays here if needed
  // This would typically come from a holiday API or predefined list
  
  return true;
};

/**
 * Get the next valid transaction date
 */
export const getNextValidTransactionDate = (date: Date = new Date()): Date => {
  let nextDate = new Date(date);
  
  while (!isValidTransactionDate(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return nextDate;
};

/**
 * Calculate time remaining in current cycle
 */
export const getCycleTimeRemaining = (group: SavingsGroup): {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
} => {
  const cycleDates = calculateCycleDates(group);
  const now = new Date();
  const timeRemaining = cycleDates.cycleEnd.getTime() - now.getTime();
  
  if (timeRemaining <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: true,
    };
  }
  
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    days,
    hours,
    minutes,
    isExpired: false,
  };
};