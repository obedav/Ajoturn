import { Group, GroupMember, Contribution, Payout } from './database';

// Business Logic Types
export interface TurnOrder {
  cycle: number;
  recipientId: string;
  recipientName: string;
  joinOrder: number;
  scheduledDate: Date;
  status: 'upcoming' | 'current' | 'completed';
}

export interface PaymentStatusSummary {
  groupId: string;
  cycle: number;
  totalMembers: number;
  paidMembers: number;
  pendingMembers: number;
  overdueMembers: number;
  totalExpected: number;
  totalCollected: number;
  completionRate: number;
  membersStatus: MemberPaymentStatus[];
}

export interface MemberPaymentStatus {
  userId: string;
  userName: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  daysOverdue?: number;
  contributionId?: string;
}

export interface CycleProcessingResult {
  success: boolean;
  groupId: string;
  previousCycle: number;
  newCycle: number;
  payoutCreated: boolean;
  contributionsCreated: boolean;
  recipientId: string;
  payoutAmount: number;
  error?: string;
  warnings: string[];
}

export interface GroupCompletionStatus {
  isCompleted: boolean;
  groupId: string;
  totalCycles: number;
  completedCycles: number;
  remainingCycles: number;
  allMembersReceived: boolean;
  finalPayoutDate?: Date;
  completionRate: number;
  issues: string[];
}

export interface PaymentReminderConfig {
  groupId: string;
  reminderTypes: ReminderType[];
  daysBeforeDue: number[];
  includePenaltyWarning: boolean;
  customMessage?: string;
}

export interface ReminderType {
  type: 'push' | 'email' | 'sms';
  enabled: boolean;
  template: string;
}

export interface ReminderResult {
  success: boolean;
  totalSent: number;
  failedSends: number;
  results: Array<{
    userId: string;
    reminderType: 'push' | 'email' | 'sms';
    success: boolean;
    error?: string;
  }>;
}

// Business Logic Errors
export class BusinessLogicError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

export class TurnOrderError extends BusinessLogicError {
  constructor(message: string, details?: any) {
    super(message, 'TURN_ORDER_ERROR', details);
  }
}

export class PaymentValidationError extends BusinessLogicError {
  constructor(message: string, details?: any) {
    super(message, 'PAYMENT_VALIDATION_ERROR', details);
  }
}

export class CycleProcessingError extends BusinessLogicError {
  constructor(message: string, details?: any) {
    super(message, 'CYCLE_PROCESSING_ERROR', details);
  }
}

export class GroupCompletionError extends BusinessLogicError {
  constructor(message: string, details?: any) {
    super(message, 'GROUP_COMPLETION_ERROR', details);
  }
}

export class NotificationError extends BusinessLogicError {
  constructor(message: string, details?: any) {
    super(message, 'NOTIFICATION_ERROR', details);
  }
}

// Utility Types
export interface BusinessLogicResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  warnings?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CycleTransition {
  fromCycle: number;
  toCycle: number;
  transitionDate: Date;
  previousRecipient: string;
  nextRecipient: string;
  payoutProcessed: boolean;
  contributionsGenerated: boolean;
}

export interface GroupMetrics {
  groupId: string;
  averagePaymentTime: number; // days
  reliabilityRate: number; // percentage
  onTimePaymentRate: number; // percentage
  totalValue: number;
  memberRetentionRate: number; // percentage
  cycleCompletionRate: number; // percentage
  riskScore: number; // 0-100, lower is better
}

export interface RiskAssessment {
  groupId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: RiskFactor[];
  recommendations: string[];
  lastAssessment: Date;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

// Constants
export const BUSINESS_CONSTANTS = {
  MAX_OVERDUE_DAYS: 30,
  DEFAULT_GRACE_PERIOD: 3,
  MIN_RELIABILITY_SCORE: 60,
  PENALTY_RATE: 0.05, // 5% penalty
  REMINDER_DAYS: [7, 3, 1, 0], // Days before due date
  MAX_FAILED_PAYMENTS: 3,
  RISK_THRESHOLD: {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90,
  },
} as const;

// Enums
export enum CycleStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PaymentWindow {
  EARLY = 'early',
  ON_TIME = 'on_time',
  GRACE_PERIOD = 'grace_period',
  OVERDUE = 'overdue',
  EXPIRED = 'expired',
}

export enum GroupHealth {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  FAILING = 'failing',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Function parameter types
export interface CalculateTurnOrderParams {
  group: Group;
  members: GroupMember[];
  currentCycle?: number;
}

export interface CheckPaymentStatusParams {
  groupId: string;
  cycle: number;
  includeHistory?: boolean;
}

export interface ProcessGroupCycleParams {
  groupId: string;
  adminId: string;
  forceProcess?: boolean;
  skipValidation?: boolean;
}

export interface ValidateGroupCompletionParams {
  group: Group;
  members: GroupMember[];
  contributions: Contribution[];
  payouts: Payout[];
}

export interface SendPaymentRemindersParams {
  groupId: string;
  cycle: number;
  reminderConfig?: PaymentReminderConfig;
  testMode?: boolean;
}