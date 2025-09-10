// Basic types for the current app
export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  contribution_amount: number;
  total_members: number;
  admin_id: string;
  status: 'active' | 'completed' | 'paused';
  current_cycle: number;
  next_payout_date?: string;
}

export interface GroupMember {
  user_id: string;
  name: string;
  join_order: number;
  status: 'active' | 'inactive';
  total_contributions: number;
  missed_payments: number;
}

export interface Contribution {
  id: string;
  group_id: string;
  user_id: string;
  amount: number;
  cycle_number: number;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string;
  paid_date?: string;
}

export interface ScreenProps {
  navigation: any;
  route?: any;
}