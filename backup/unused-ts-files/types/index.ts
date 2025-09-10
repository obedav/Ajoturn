// Core types for the Ajoturn app
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[]; // Array of user IDs
  memberCount: number;
  contributionAmount: number;
  payoutSchedule: PayoutSchedule;
  nextPayoutDate: Date;
  currentRound: number;
  totalRounds: number;
  status: GroupStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  groupId: string;
  userId: string;
  amount: number;
  round: number;
  dueDate: Date;
  paidDate?: Date;
  status: PaymentStatus;
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: any;
  read: boolean;
  createdAt: Date;
}

export type GroupStatus = 'active' | 'completed' | 'paused' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'failed';
export type PayoutSchedule = 'weekly' | 'monthly' | 'bi-weekly';
export type NotificationType = 
  | 'payment_reminder'
  | 'payout_notification'
  | 'group_invitation'
  | 'system_update';

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Groups: undefined;
  Payments: undefined;
  Profile: undefined;
};

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface CreateGroupForm {
  name: string;
  description: string;
  contributionAmount: number;
  payoutSchedule: PayoutSchedule;
  maxMembers: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Context types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (data: SignupForm) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
}

export interface AppContextType {
  groups: Group[];
  payments: Payment[];
  notifications: Notification[];
  loading: boolean;
  refreshData: () => Promise<void>;
}