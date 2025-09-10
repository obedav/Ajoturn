import { SavingsGroup, GroupMember, Contribution } from '../services/firestore';

/**
 * Validation utilities for Ajoturn business logic
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GroupValidationRules {
  minMembers: number;
  maxMembers: number;
  minContributionAmount: number;
  maxContributionAmount: number;
  maxMissedPayments: number;
}

// Default validation rules
export const DEFAULT_VALIDATION_RULES: GroupValidationRules = {
  minMembers: 2,
  maxMembers: 50,
  minContributionAmount: 1000, // ₦1,000
  maxContributionAmount: 1000000, // ₦1,000,000
  maxMissedPayments: 2,
};

/**
 * Validate group configuration before creation
 */
export const validateGroupCreation = (
  groupData: Omit<SavingsGroup, 'id' | 'createdAt' | 'updatedAt'>,
  rules: GroupValidationRules = DEFAULT_VALIDATION_RULES
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate group name
  if (!groupData.name || groupData.name.trim().length < 3) {
    errors.push('Group name must be at least 3 characters long');
  }

  if (groupData.name && groupData.name.length > 50) {
    errors.push('Group name cannot exceed 50 characters');
  }

  // Validate contribution amount
  if (groupData.contributionAmount < rules.minContributionAmount) {
    errors.push(`Contribution amount must be at least ₦${rules.minContributionAmount.toLocaleString()}`);
  }

  if (groupData.contributionAmount > rules.maxContributionAmount) {
    errors.push(`Contribution amount cannot exceed ₦${rules.maxContributionAmount.toLocaleString()}`);
  }

  // Validate member count
  if (groupData.members.length < rules.minMembers) {
    errors.push(`Group must have at least ${rules.minMembers} members`);
  }

  if (groupData.members.length > rules.maxMembers) {
    errors.push(`Group cannot have more than ${rules.maxMembers} members`);
  }

  // Validate total cycles
  if (groupData.totalCycles < groupData.members.length) {
    errors.push('Total cycles must be at least equal to the number of members');
  }

  if (groupData.totalCycles > groupData.members.length * 2) {
    warnings.push('Total cycles significantly exceed member count - this may result in multiple payouts per member');
  }

  // Validate start date
  if (groupData.startDate < new Date()) {
    warnings.push('Start date is in the past - group will begin immediately');
  }

  const futureLimit = new Date();
  futureLimit.setMonth(futureLimit.getMonth() + 6);
  if (groupData.startDate > futureLimit) {
    warnings.push('Start date is more than 6 months in the future');
  }

  // Validate admin exists in members
  const adminMember = groupData.members.find(m => m.userId === groupData.adminId);
  if (!adminMember) {
    errors.push('Group admin must be included in the members list');
  }

  if (adminMember && adminMember.role !== 'admin') {
    errors.push('Group admin must have admin role');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate member eligibility for joining a group
 */
export const validateMemberEligibility = (
  group: SavingsGroup,
  newMember: Partial<GroupMember>
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if group is active
  if (group.status !== 'active') {
    errors.push('Cannot join inactive group');
  }

  // Check if member already exists
  const existingMember = group.members.find(m => m.userId === newMember.userId);
  if (existingMember) {
    if (existingMember.isActive) {
      errors.push('Member is already active in this group');
    } else {
      warnings.push('Member was previously in this group - will be reactivated');
    }
  }

  // Check member count limit
  const activeMembers = group.members.filter(m => m.isActive);
  if (activeMembers.length >= DEFAULT_VALIDATION_RULES.maxMembers) {
    errors.push('Group has reached maximum member limit');
  }

  // Validate member data
  if (!newMember.displayName || newMember.displayName.trim().length === 0) {
    errors.push('Member display name is required');
  }

  if (!newMember.userId || newMember.userId.trim().length === 0) {
    errors.push('Member user ID is required');
  }

  // Check if group has already started and warn about joining mid-cycle
  if (group.currentCycle > 1) {
    warnings.push('Joining mid-cycle - member may need to catch up on contributions');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate contribution payment
 */
export const validateContribution = (
  group: SavingsGroup,
  contribution: Omit<Contribution, 'id' | 'createdAt'>,
  member: GroupMember
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if group is active
  if (group.status !== 'active') {
    errors.push('Cannot make contributions to inactive group');
  }

  // Check if member is active
  if (!member.isActive) {
    errors.push('Inactive members cannot make contributions');
  }

  // Validate contribution amount
  if (contribution.amount !== group.contributionAmount) {
    if (contribution.amount < group.contributionAmount) {
      errors.push(`Contribution amount (₦${contribution.amount.toLocaleString()}) is less than required (₦${group.contributionAmount.toLocaleString()})`);
    } else {
      warnings.push(`Contribution amount (₦${contribution.amount.toLocaleString()}) exceeds required amount (₦${group.contributionAmount.toLocaleString()})`);
    }
  }

  // Check if contribution is for valid cycle
  if (contribution.cycle !== group.currentCycle) {
    if (contribution.cycle < group.currentCycle) {
      warnings.push('Making contribution for past cycle');
    } else {
      errors.push('Cannot make contributions for future cycles');
    }
  }

  // Check for duplicate contributions
  // This would typically be checked against existing contributions in the database
  if (contribution.cycle === group.currentCycle) {
    // In practice, you'd query for existing contributions here
    // For now, we'll just add a warning
    warnings.push('Please verify this is not a duplicate contribution');
  }

  // Validate due date
  const now = new Date();
  const dueDate = contribution.dueDate instanceof Date ? contribution.dueDate : new Date(contribution.dueDate);
  
  if (dueDate < now) {
    warnings.push('Contribution is overdue');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate cycle processing eligibility
 */
export const validateCycleProcessing = (
  group: SavingsGroup,
  contributions: Contribution[],
  adminId: string
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check admin permissions
  if (group.adminId !== adminId) {
    errors.push('Only group admin can process cycles');
  }

  // Check if group is active
  if (group.status !== 'active') {
    errors.push('Cannot process cycles for inactive group');
  }

  // Check if group is completed
  if (group.currentCycle > group.totalCycles) {
    errors.push('Group has already completed all cycles');
  }

  // Validate payment completion
  const activeMembers = group.members.filter(m => m.isActive);
  const expectedTotal = activeMembers.length * group.contributionAmount;
  const paidTotal = contributions
    .filter(c => c.cycle === group.currentCycle && c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);

  const completionPercentage = expectedTotal > 0 ? (paidTotal / expectedTotal) * 100 : 0;

  if (completionPercentage < 100) {
    errors.push(`Cannot process cycle: Only ${completionPercentage.toFixed(1)}% of contributions received`);
  }

  // Check for pending contributions
  const pendingContributions = contributions.filter(
    c => c.cycle === group.currentCycle && c.status === 'pending'
  );
  
  if (pendingContributions.length > 0) {
    warnings.push(`${pendingContributions.length} contributions are still pending verification`);
  }

  // Check if this is the last cycle
  if (group.currentCycle === group.totalCycles) {
    warnings.push('This is the final cycle - group will be completed after processing');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate payout eligibility
 */
export const validatePayoutEligibility = (
  group: SavingsGroup,
  recipientMember: GroupMember,
  payoutAmount: number
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if recipient is active member
  if (!recipientMember.isActive) {
    errors.push('Cannot create payout for inactive member');
  }

  // Check if recipient is in the group
  const memberExists = group.members.some(m => m.userId === recipientMember.userId);
  if (!memberExists) {
    errors.push('Recipient is not a member of this group');
  }

  // Validate payout amount
  const expectedPayout = group.members.filter(m => m.isActive).length * group.contributionAmount;
  if (payoutAmount !== expectedPayout) {
    if (payoutAmount < expectedPayout) {
      warnings.push(`Payout amount (₦${payoutAmount.toLocaleString()}) is less than expected (₦${expectedPayout.toLocaleString()})`);
    } else {
      warnings.push(`Payout amount (₦${payoutAmount.toLocaleString()}) exceeds expected amount (₦${expectedPayout.toLocaleString()})`);
    }
  }

  // Check member's payment history
  if (recipientMember.missedPayments > DEFAULT_VALIDATION_RULES.maxMissedPayments) {
    warnings.push(`Recipient has ${recipientMember.missedPayments} missed payments - consider reviewing eligibility`);
  }

  // Check if member has already received payout in this cycle
  // This would typically be checked against existing payouts in the database
  warnings.push('Please verify recipient has not already received payout for this cycle');

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate Nigerian phone number format
 */
export const validateNigerianPhoneNumber = (phoneNumber: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');

  // Check for valid Nigerian phone number patterns
  const validPatterns = [
    /^(\+234|234|0)[789][01]\d{8}$/, // Nigerian mobile numbers
  ];

  const isValid = validPatterns.some(pattern => pattern.test(phoneNumber));

  if (!isValid) {
    if (digits.length === 0) {
      errors.push('Phone number is required');
    } else if (digits.length < 11) {
      errors.push('Phone number is too short');
    } else if (digits.length > 14) {
      errors.push('Phone number is too long');
    } else {
      errors.push('Invalid Nigerian phone number format');
    }
  }

  // Format suggestions
  if (digits.length === 11 && digits.startsWith('0')) {
    warnings.push('Consider using international format: +234 instead of 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate email address format
 */
export const validateEmailAddress = (email: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || email.trim().length === 0) {
    errors.push('Email address is required');
  } else if (!emailRegex.test(email)) {
    errors.push('Invalid email address format');
  } else if (email.length > 254) {
    errors.push('Email address is too long');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Comprehensive validation for business operations
 */
export const validateBusinessOperation = (
  operation: string,
  data: any,
  context: any = {}
): ValidationResult => {
  switch (operation) {
    case 'createGroup':
      return validateGroupCreation(data, context.rules);
    
    case 'joinGroup':
      return validateMemberEligibility(context.group, data);
    
    case 'makeContribution':
      return validateContribution(context.group, data, context.member);
    
    case 'processCycle':
      return validateCycleProcessing(context.group, context.contributions, data.adminId);
    
    case 'createPayout':
      return validatePayoutEligibility(context.group, data.recipient, data.amount);
    
    case 'validatePhone':
      return validateNigerianPhoneNumber(data);
    
    case 'validateEmail':
      return validateEmailAddress(data);
    
    default:
      return {
        isValid: false,
        errors: [`Unknown validation operation: ${operation}`],
        warnings: [],
      };
  }
};