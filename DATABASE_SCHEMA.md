# Ajoturn Database Schema

## 🗄️ Firestore Collections Overview

The Ajoturn app uses Firestore as its primary database with the following collections:

- **users** - User profiles and authentication data
- **groups** - Savings group information
- **group_members** - Group membership and member statistics
- **contributions** - Payment contributions made by users
- **payouts** - Money distribution to group members

## 📊 Collection Schemas

### Users Collection
```typescript
interface User {
  id: string;                    // Document ID
  phone: string;                 // Primary identifier (unique)
  email?: string;                // Optional email address
  name: string;                  // Full name
  bvn_verified: boolean;         // Bank Verification Number status
  created_at: Date;
  updated_at: Date;
  
  // Profile fields
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
  
  // Statistics
  total_groups: number;
  total_contributions: number;
  total_payouts_received: number;
  reliability_score: number;     // 0-100 based on payment history
}
```

### Groups Collection
```typescript
interface Group {
  id: string;                    // Document ID
  name: string;                  // Group name
  description?: string;          // Optional description
  contribution_amount: number;   // Fixed amount per contribution
  total_members: number;         // Current member count
  admin_id: string;              // User ID of group admin
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  
  // Group settings
  max_members: number;           // Maximum allowed members
  contribution_frequency: 'daily' | 'weekly' | 'monthly';
  payout_schedule: 'weekly' | 'monthly';
  start_date: Date;
  estimated_end_date: Date;
  
  // Current cycle information
  current_cycle: number;
  total_cycles: number;
  cycle_start_date: Date;
  cycle_end_date: Date;
  
  // Group rules
  late_payment_penalty?: number;
  grace_period_days: number;
  minimum_reliability_score?: number;
  
  // Statistics
  total_contributions_collected: number;
  total_payouts_made: number;
  successful_cycles: number;
  
  // Customization
  group_image?: string;
  theme_color?: string;
}
```

### Group Members Collection
```typescript
interface GroupMember {
  id: string;                    // Document ID
  group_id: string;              // Reference to groups collection
  user_id: string;               // Reference to users collection
  join_order: number;            // Position in payout rotation (1, 2, 3, etc.)
  status: 'active' | 'inactive' | 'removed' | 'pending';
  joined_at: Date;
  updated_at: Date;
  
  // Role and permissions
  role: 'admin' | 'member' | 'treasurer';
  can_invite_members: boolean;
  can_view_all_contributions: boolean;
  
  // Performance tracking
  total_contributions_made: number;
  missed_contributions: number;
  late_contributions: number;
  on_time_contributions: number;
  reliability_percentage: number;
  
  // Payout tracking
  payout_received: boolean;
  payout_cycle?: number;
  payout_date?: Date;
  
  // Member preferences
  notification_enabled: boolean;
  auto_contribute: boolean;
}
```

### Contributions Collection
```typescript
interface Contribution {
  id: string;                    // Document ID
  group_id: string;              // Reference to groups collection
  user_id: string;               // Reference to users collection
  amount: number;                // Contribution amount
  cycle_number: number;          // Which cycle this belongs to
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  
  // Payment timing
  due_date: Date;
  paid_date?: Date;
  payment_method?: 'bank_transfer' | 'card' | 'cash' | 'mobile_money';
  transaction_reference?: string;
  
  // Late payment handling
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
```

### Payouts Collection
```typescript
interface Payout {
  id: string;                    // Document ID
  group_id: string;              // Reference to groups collection
  recipient_id: string;          // Reference to users collection
  amount: number;                // Total payout amount
  cycle_number: number;          // Which cycle this payout is for
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
  
  // Timing
  scheduled_date: Date;
  processed_date?: Date;
  completed_date?: Date;
  
  // Payment method
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
  
  // Approval workflow
  approved_by_admin: boolean;
  approval_date?: Date;
  admin_notes?: string;
  
  // Fees and calculations
  processing_fee?: number;
  penalty_deductions?: number;
  net_amount: number;
  
  // Retry logic
  failure_reason?: string;
  retry_count: number;
  max_retries: number;
}
```

## 🔧 CRUD Operations

### User Operations
```typescript
// Create user
const user = await DatabaseService.users.createUser({
  phone: "+2348123456789",
  name: "John Doe",
  bvn_verified: false,
  // ... other fields
});

// Get user by ID
const user = await DatabaseService.users.getUserById(userId);

// Update user
const updatedUser = await DatabaseService.users.updateUser(userId, {
  email: "john@example.com",
  bvn_verified: true,
});

// Search users by name
const users = await DatabaseService.users.searchUsersByName("John");
```

### Group Operations
```typescript
// Create group with admin
const result = await DatabaseService.createGroupWithAdmin({
  name: "Tech Professionals Ajo",
  contribution_amount: 50000,
  max_members: 10,
  contribution_frequency: "monthly",
  // ... other fields
}, adminUser);

// Join group
const joinResult = await DatabaseService.joinGroup(groupId, userId, "Jane Doe");

// Get group dashboard
const dashboard = await DatabaseService.getGroupDashboard(groupId);
```

### Contribution Operations
```typescript
// Create contributions for a cycle
const contributions = await DatabaseService.createCycleContributions(
  groupId,
  cycleNumber,
  dueDate
);

// Mark contribution as paid
const paidContribution = await DatabaseService.contributions.markAsPaid(
  contributionId,
  {
    paid_date: new Date(),
    payment_method: "bank_transfer",
    transaction_reference: "TXN123456",
  }
);

// Get user contributions
const userContributions = await DatabaseService.contributions.getUserContributions(
  userId,
  { status: "pending" }
);
```

### Payout Operations
```typescript
// Create payout for cycle
const payout = await DatabaseService.createCyclePayout(
  groupId,
  cycleNumber,
  scheduledDate
);

// Approve payout
const approvedPayout = await DatabaseService.payouts.approvePayout(
  payoutId,
  adminId,
  "Approved for payment"
);

// Mark payout as completed
const completedPayout = await DatabaseService.payouts.markAsCompleted(
  payoutId,
  {
    external_transaction_id: "EXT123456",
    completed_date: new Date(),
  }
);
```

## 🔄 Real-time Listeners

```typescript
// Listen to group updates
const unsubscribe = DatabaseService.groups.onGroupUpdates(groupId, (group) => {
  console.log("Group updated:", group);
});

// Listen to user contributions
const unsubscribeContributions = DatabaseService.contributions.onUserContributionsUpdates(
  userId,
  groupId,
  (contributions) => {
    console.log("Contributions updated:", contributions);
  }
);

// Clean up listeners
unsubscribe();
unsubscribeContributions();
```

## 📈 Analytics and Statistics

```typescript
// Get user statistics
const userStats = await DatabaseService.users.getUserStatistics(userId);
console.log("Reliability score:", userStats.reliability_score);

// Get group statistics
const groupStats = await DatabaseService.groups.getGroupStatistics(groupId);
console.log("Completion rate:", groupStats.completion_rate);

// Get user dashboard with all data
const dashboard = await DatabaseService.getUserDashboard(userId);
```

## 🔐 Security Rules

The database includes comprehensive Firestore security rules that ensure:

- Users can only access their own data
- Group members can view group data
- Only admins can modify group settings
- Contribution and payout access is properly controlled
- All operations are authenticated

## 📱 Usage Example

```typescript
import DatabaseService from './src/services/database';

// Initialize a new savings group
async function createSavingsGroup() {
  try {
    const adminUser = await DatabaseService.users.getUserById(currentUserId);
    if (!adminUser.success) return;

    const groupResult = await DatabaseService.createGroupWithAdmin({
      name: "Monthly Savings Circle",
      description: "Save ₦50,000 monthly",
      contribution_amount: 50000,
      max_members: 12,
      contribution_frequency: "monthly",
      payout_schedule: "monthly",
      start_date: new Date(),
      estimated_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      current_cycle: 1,
      total_cycles: 12,
      grace_period_days: 3,
    }, adminUser.data!);

    if (groupResult.success) {
      console.log("Group created:", groupResult.data.group.name);
      console.log("Admin membership:", groupResult.data.membership.role);
    }
  } catch (error) {
    console.error("Error creating group:", error);
  }
}
```

## 🚀 Getting Started

1. Import the database service:
   ```typescript
   import DatabaseService from './src/services/database';
   ```

2. Use the service methods:
   ```typescript
   const result = await DatabaseService.users.createUser(userData);
   ```

3. Handle results:
   ```typescript
   if (result.success) {
     console.log("User created:", result.data);
   } else {
     console.error("Error:", result.error);
   }
   ```

The database service provides comprehensive CRUD operations, real-time listeners, and complex business logic for managing the complete Ajoturn savings group lifecycle.