import { SavingsGroup, GroupMember, Contribution, Payout } from './firestore';

// Sample data for testing business logic without Firebase
export const SAMPLE_USER_ID = 'user123';
export const SAMPLE_ADMIN_ID = 'admin456';

// Sample Group Members
export const sampleMembers: GroupMember[] = [
  {
    userId: SAMPLE_ADMIN_ID,
    displayName: 'John Doe (Admin)',
    joinedAt: new Date('2024-01-01'),
    role: 'admin',
    isActive: true,
    totalContributions: 15000,
    missedPayments: 0,
  },
  {
    userId: SAMPLE_USER_ID,
    displayName: 'Jane Smith (You)',
    joinedAt: new Date('2024-01-02'),
    role: 'member',
    isActive: true,
    totalContributions: 15000,
    missedPayments: 0,
  },
  {
    userId: 'user789',
    displayName: 'Mike Johnson',
    joinedAt: new Date('2024-01-03'),
    role: 'member',
    isActive: true,
    totalContributions: 10000,
    missedPayments: 1,
  },
  {
    userId: 'user101',
    displayName: 'Sarah Wilson',
    joinedAt: new Date('2024-01-04'),
    role: 'member',
    isActive: true,
    totalContributions: 15000,
    missedPayments: 0,
  },
  {
    userId: 'user102',
    displayName: 'David Brown',
    joinedAt: new Date('2024-01-05'),
    role: 'member',
    isActive: true,
    totalContributions: 5000,
    missedPayments: 2,
  },
  {
    userId: 'user103',
    displayName: 'Lisa Davis',
    joinedAt: new Date('2024-01-06'),
    role: 'member',
    isActive: true,
    totalContributions: 15000,
    missedPayments: 0,
  },
];

// Sample Groups
export const sampleGroups: SavingsGroup[] = [
  {
    id: 'group1',
    name: 'Monthly Savers Circle',
    description: 'A trusted group of colleagues saving for the future',
    adminId: SAMPLE_ADMIN_ID,
    members: sampleMembers,
    contributionAmount: 5000,
    contributionFrequency: 'monthly',
    payoutSchedule: 'monthly',
    status: 'active',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-07-01'),
    currentCycle: 3,
    totalCycles: 6,
    createdAt: new Date('2023-12-20'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'group2',
    name: 'Family Thrift Group',
    description: 'Weekly family savings for emergencies',
    adminId: SAMPLE_USER_ID,
    members: sampleMembers.slice(0, 4), // Smaller group
    contributionAmount: 2000,
    contributionFrequency: 'weekly',
    payoutSchedule: 'weekly',
    status: 'active',
    startDate: new Date('2024-01-08'),
    endDate: new Date('2024-05-08'),
    currentCycle: 8,
    totalCycles: 16,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'group3',
    name: 'Completed Success Group',
    description: 'A completed group that finished successfully',
    adminId: SAMPLE_ADMIN_ID,
    members: sampleMembers.slice(0, 3),
    contributionAmount: 10000,
    contributionFrequency: 'monthly',
    payoutSchedule: 'monthly',
    status: 'completed',
    startDate: new Date('2023-06-01'),
    endDate: new Date('2023-09-01'),
    currentCycle: 4,
    totalCycles: 3,
    createdAt: new Date('2023-05-15'),
    updatedAt: new Date('2023-09-01'),
  },
];

// Sample Contributions
export const sampleContributions: Contribution[] = [
  // Group 1 - Current Cycle (3) Contributions
  {
    id: 'contrib1',
    groupId: 'group1',
    userId: SAMPLE_ADMIN_ID,
    amount: 5000,
    dueDate: new Date('2024-03-10'),
    paidDate: new Date('2024-03-08'),
    status: 'paid',
    paymentMethod: 'Bank Transfer',
    transactionId: 'TXN001',
    cycle: 3,
    createdAt: new Date('2024-03-08'),
  },
  {
    id: 'contrib2',
    groupId: 'group1',
    userId: SAMPLE_USER_ID,
    amount: 5000,
    dueDate: new Date('2024-03-10'),
    paidDate: new Date('2024-03-09'),
    status: 'paid',
    paymentMethod: 'Mobile Money',
    transactionId: 'TXN002',
    cycle: 3,
    createdAt: new Date('2024-03-09'),
  },
  {
    id: 'contrib3',
    groupId: 'group1',
    userId: 'user789',
    amount: 5000,
    dueDate: new Date('2024-03-10'),
    status: 'pending',
    paymentMethod: 'Cash',
    transactionId: 'CASH001',
    cycle: 3,
    createdAt: new Date('2024-03-11'),
  },
  {
    id: 'contrib4',
    groupId: 'group1',
    userId: 'user101',
    amount: 5000,
    dueDate: new Date('2024-03-10'),
    paidDate: new Date('2024-03-07'),
    status: 'paid',
    paymentMethod: 'Debit Card',
    transactionId: 'TXN003',
    cycle: 3,
    createdAt: new Date('2024-03-07'),
  },
  {
    id: 'contrib5',
    groupId: 'group1',
    userId: 'user102',
    amount: 5000,
    dueDate: new Date('2024-03-10'),
    status: 'overdue',
    cycle: 3,
    createdAt: new Date('2024-03-12'),
  },
  {
    id: 'contrib6',
    groupId: 'group1',
    userId: 'user103',
    amount: 5000,
    dueDate: new Date('2024-03-10'),
    paidDate: new Date('2024-03-10'),
    status: 'paid',
    paymentMethod: 'Bank Transfer',
    transactionId: 'TXN004',
    cycle: 3,
    createdAt: new Date('2024-03-10'),
  },
  
  // Group 2 - Current Cycle (8) Contributions
  {
    id: 'contrib7',
    groupId: 'group2',
    userId: SAMPLE_USER_ID,
    amount: 2000,
    dueDate: new Date('2024-03-15'),
    paidDate: new Date('2024-03-14'),
    status: 'paid',
    paymentMethod: 'Mobile Money',
    transactionId: 'TXN005',
    cycle: 8,
    createdAt: new Date('2024-03-14'),
  },
  {
    id: 'contrib8',
    groupId: 'group2',
    userId: SAMPLE_ADMIN_ID,
    amount: 2000,
    dueDate: new Date('2024-03-15'),
    status: 'pending',
    paymentMethod: 'Cash',
    transactionId: 'CASH002',
    cycle: 8,
    createdAt: new Date('2024-03-15'),
  },
];

// Sample Payouts
export const samplePayouts: Payout[] = [
  {
    id: 'payout1',
    groupId: 'group1',
    recipientId: SAMPLE_ADMIN_ID,
    amount: 30000,
    cycle: 1,
    status: 'paid',
    scheduledDate: new Date('2024-01-31'),
    paidDate: new Date('2024-01-31'),
    transactionId: 'PAYOUT001',
    createdAt: new Date('2024-01-31'),
  },
  {
    id: 'payout2',
    groupId: 'group1',
    recipientId: SAMPLE_USER_ID,
    amount: 30000,
    cycle: 2,
    status: 'paid',
    scheduledDate: new Date('2024-02-29'),
    paidDate: new Date('2024-02-29'),
    transactionId: 'PAYOUT002',
    createdAt: new Date('2024-02-29'),
  },
];

// Mock service functions that simulate Firebase calls
class SampleDataService {
  async getSavingsGroup(groupId: string): Promise<SavingsGroup | null> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return sampleGroups.find(group => group.id === groupId) || null;
  }

  async getUserGroups(userId: string): Promise<SavingsGroup[]> {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
    return sampleGroups.filter(group => 
      group.members.some(member => member.userId === userId)
    );
  }

  async getGroupContributions(groupId: string, cycle?: number): Promise<Contribution[]> {
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate network delay
    return sampleContributions.filter(contrib => 
      contrib.groupId === groupId && 
      (cycle ? contrib.cycle === cycle : true)
    );
  }

  async getUserContributions(userId: string, groupId?: string): Promise<Contribution[]> {
    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate network delay
    return sampleContributions.filter(contrib => 
      contrib.userId === userId &&
      (groupId ? contrib.groupId === groupId : true)
    );
  }

  async createContribution(contributionData: Omit<Contribution, 'id' | 'createdAt'>): Promise<string | null> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    const newId = `contrib_${Date.now()}`;
    const newContribution: Contribution = {
      ...contributionData,
      id: newId,
      createdAt: new Date(),
    };
    sampleContributions.push(newContribution);
    return newId;
  }

  async createSavingsGroup(groupData: Omit<SavingsGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate network delay
    const newId = `group_${Date.now()}`;
    const newGroup: SavingsGroup = {
      ...groupData,
      id: newId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sampleGroups.push(newGroup);
    return newId;
  }

  async getUserPayouts(userId: string): Promise<Payout[]> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return samplePayouts.filter(payout => payout.recipientId === userId);
  }

  async getGroupPayouts(groupId: string): Promise<Payout[]> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return samplePayouts.filter(payout => payout.groupId === groupId);
  }

  async createPayout(payoutData: Omit<Payout, 'id' | 'createdAt'>): Promise<string | null> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    const newId = `payout_${Date.now()}`;
    const newPayout: Payout = {
      ...payoutData,
      id: newId,
      createdAt: new Date(),
    };
    samplePayouts.push(newPayout);
    return newId;
  }

  async updatePayout(payoutId: string, updates: Partial<Payout>): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
    const index = samplePayouts.findIndex(payout => payout.id === payoutId);
    if (index !== -1) {
      samplePayouts[index] = { ...samplePayouts[index], ...updates };
      return true;
    }
    return false;
  }

  async batchUpdate(updates: { collection: string; docId: string; data: any }[]): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    // Simulate batch update success
    return true;
  }
}

export const sampleDataService = new SampleDataService();