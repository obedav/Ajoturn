export interface User {
  id: string;
  phone: string;
  email?: string;
  name: string;
  bvn_verified: boolean;
  created_at: Date;
  updated_at: Date;
  
  // Optional profile fields
  profile_picture?: string;
  date_of_birth?: Date;
  address?: string;
  occupation?: string;
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // App settings
  notification_preferences?: {
    push_enabled: boolean;
    email_enabled: boolean;
    contribution_reminders: boolean;
    payout_alerts: boolean;
  };
  
  // Verification status
  phone_verified: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  
  // Stats
  total_groups: number;
  total_contributions: number;
  total_payouts_received: number;
  reliability_score: number; // 0-100 based on payment history
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  contribution_amount: number;
  total_members: number;
  admin_id: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  
  // Group settings
  max_members: number;
  contribution_frequency: 'daily' | 'weekly' | 'monthly';
  payout_schedule: 'weekly' | 'monthly';
  start_date: Date;
  estimated_end_date: Date;
  
  // Current cycle info
  current_cycle: number;
  total_cycles: number;
  cycle_start_date: Date;
  cycle_end_date: Date;
  
  // Group rules
  late_payment_penalty?: number;
  grace_period_days: number;
  minimum_reliability_score?: number;
  
  // Group stats
  total_contributions_collected: number;
  total_payouts_made: number;
  successful_cycles: number;
  
  // Group image/theme
  group_image?: string;
  theme_color?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  join_order: number; // Position in payout rotation (1, 2, 3, etc.)
  status: 'active' | 'inactive' | 'removed' | 'pending';
  joined_at: Date;
  updated_at: Date;
  
  // Member role and permissions
  role: 'admin' | 'member' | 'treasurer';
  can_invite_members: boolean;
  can_view_all_contributions: boolean;
  
  // Member performance
  total_contributions_made: number;
  missed_contributions: number;
  late_contributions: number;
  on_time_contributions: number;
  reliability_percentage: number;
  
  // Payout tracking
  payout_received: boolean;
  payout_cycle?: number;
  payout_date?: Date;
  
  // Member preferences for this group
  notification_enabled: boolean;
  auto_contribute: boolean;
}

export interface Contribution {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  cycle_number: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  
  // Payment details
  due_date: Date;
  paid_date?: Date;
  payment_method?: 'bank_transfer' | 'card' | 'cash' | 'mobile_money';
  transaction_reference?: string;
  
  // Late payment info
  is_late: boolean;
  late_penalty_amount?: number;
  grace_period_used: boolean;
  
  // Verification
  verified_by_admin: boolean;
  verification_date?: Date;
  admin_notes?: string;
  
  // Payment proof
  payment_proof_url?: string;
  payment_proof_type?: 'receipt' | 'screenshot' | 'bank_statement';
}

export interface Payout {
  id: string;
  group_id: string;
  recipient_id: string;
  amount: number;
  cycle_number: number;
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  
  // Payout timing
  scheduled_date: Date;
  processed_date?: Date;
  completed_date?: Date;
  
  // Payment details
  payout_method: 'bank_transfer' | 'mobile_money' | 'cash';
  bank_details?: {
    account_number: string;
    bank_name: string;
    account_name: string;
  };
  mobile_money_details?: {
    provider: string;
    phone_number: string;
    account_name: string;
  };
  
  // Transaction tracking
  transaction_reference?: string;
  external_transaction_id?: string;
  
  // Verification and approval
  approved_by_admin: boolean;
  approval_date?: Date;
  admin_notes?: string;
  
  // Fees and deductions
  processing_fee?: number;
  penalty_deductions?: number;
  net_amount: number;
  
  // Failure handling
  failure_reason?: string;
  retry_count: number;
  max_retries: number;
}

// Additional types for complex operations
export interface GroupStatistics {
  group_id: string;
  total_contributions: number;
  total_payouts: number;
  active_members: number;
  completion_rate: number;
  average_reliability_score: number;
  cycles_completed: number;
  cycles_remaining: number;
  next_payout_date: Date;
  next_recipient_id: string;
}

export interface UserStatistics {
  user_id: string;
  groups_joined: number;
  groups_completed: number;
  total_contributed: number;
  total_received: number;
  reliability_score: number;
  on_time_payment_rate: number;
  current_active_groups: number;
}

export interface CycleInfo {
  group_id: string;
  cycle_number: number;
  start_date: Date;
  end_date: Date;
  recipient_id: string;
  expected_total_contributions: number;
  actual_total_contributions: number;
  payout_amount: number;
  status: 'active' | 'completed' | 'failed';
  contributions: Contribution[];
  payout?: Payout;
}

// Enums for status values
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum GroupStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export enum MemberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REMOVED = 'removed',
  PENDING = 'pending'
}

export enum ContributionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum PayoutStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money'
}

// Database operation result types
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}

// Query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  order_by?: string;
  order_direction?: 'asc' | 'desc';
  cursor?: string;
}

export interface FilterOptions {
  status?: string;
  date_from?: Date;
  date_to?: Date;
  user_id?: string;
  group_id?: string;
}

// Batch operation types
export interface BatchOperation {
  operation: 'create' | 'update' | 'delete';
  collection: string;
  document_id?: string;
  data?: any;
}

export interface BatchResult {
  success: boolean;
  results: Array<{
    success: boolean;
    document_id?: string;
    error?: string;
  }>;
}