/**
 * Notification System Usage Examples
 * 
 * This file demonstrates how to use the comprehensive notification system
 * for various scenarios in the Ajoturn app.
 */

import NotificationManager from './index';
import { PaymentReminderService, PayoutNotificationService, GroupNotificationService } from './index';

// Example 1: Setting up payment reminders when a contribution is created
export async function setupPaymentRemindersExample() {
  console.log('📋 Example 1: Setting up payment reminders');
  
  const contributionData = {
    contributionId: 'contrib_001',
    memberId: 'user_123',
    memberName: 'Sarah Nakamya',
    memberPhone: '+256700123456',
    groupId: 'group_abc',
    groupName: 'Savings Circle A',
    amount: 50000,
    dueDate: new Date('2024-02-15'),
    cycle: 3,
  };

  const result = await PaymentReminderService.setupPaymentReminders(contributionData);
  
  if (result.success) {
    console.log('✅ Payment reminders scheduled successfully');
    console.log('   - 3 days before: 2024-02-12 at 10:00 AM');
    console.log('   - Due date: 2024-02-15 at 9:00 AM');
    console.log('   - 2 days overdue: 2024-02-17 at 4:00 PM');
  }
}

// Example 2: Sending immediate payment reminder
export async function sendImmediateReminderExample() {
  console.log('📋 Example 2: Sending immediate payment reminder');
  
  const reminderData = {
    contributionId: 'contrib_002',
    memberId: 'user_456',
    memberName: 'John Mukasa',
    groupName: 'Investment Group B',
    amount: 75000,
    dueDate: new Date('2024-02-10'),
    daysLate: 3,
    adminMessage: 'Please contact admin if you need an extension',
    sendSMS: true,
  };

  const result = await PaymentReminderService.sendImmediateReminder(reminderData);
  
  if (result.success) {
    console.log('✅ Immediate reminder sent successfully');
    console.log('📱 SMS: "OVERDUE: Your UGX 75,000 payment for Investment Group B is 3 days late. Pay immediately to avoid penalties."');
    console.log('🔔 Push: "⚠️ Payment Overdue! Hi John Mukasa! Your payment of UGX 75,000 for Investment Group B is 3 days overdue."');
  }
}

// Example 3: Announcing next payout recipient
export async function announceNextRecipientExample() {
  console.log('📋 Example 3: Announcing next payout recipient');
  
  const payoutData = {
    recipientId: 'user_789',
    recipientName: 'Mary Namukasa',
    groupId: 'group_xyz',
    groupName: 'Business Circle C',
    cycle: 5,
    expectedPayoutAmount: 500000,
    expectedDate: new Date('2024-02-20'),
    sendToGroup: true,
  };

  const result = await PayoutNotificationService.announceNextRecipient(payoutData);
  
  if (result.success) {
    console.log('✅ Next recipient announced successfully');
    console.log('🎉 To recipient: "Great news Mary Namukasa! You\'re the next recipient in Business Circle C. You\'ll receive UGX 500,000 when the current cycle completes."');
    console.log('👥 To group: "Excellent work! Cycle 4 of Business Circle C has been completed. Mary Namukasa is next to receive UGX 500,000."');
  }
}

// Example 4: Notifying new member joined
export async function notifyMemberJoinedExample() {
  console.log('📋 Example 4: Notifying new member joined');
  
  const memberData = {
    groupId: 'group_def',
    groupName: 'Women Empowerment Group',
    adminId: 'user_admin',
    adminName: 'Grace Nakato',
    newMemberId: 'user_999',
    newMemberName: 'Faith Nalubowa',
    newMemberPhone: '+256700999888',
    joinOrder: 8,
    totalSlots: 10,
    notifyMembers: true,
    sendSMS: false,
  };

  const result = await GroupNotificationService.notifyMemberJoined(memberData);
  
  if (result.success) {
    console.log('✅ Member joined notifications sent');
    console.log('👋 To existing members: "Welcome Faith Nalubowa to Women Empowerment Group! Our group is growing stronger together."');
    console.log('🎉 To new member: "Welcome to Women Empowerment Group! You are member #8 of 10. Get ready to start saving together!"');
  }
}

// Example 5: Group full notification (ready to start)
export async function notifyGroupFullExample() {
  console.log('📋 Example 5: Notifying group is full and ready to start');
  
  const groupData = {
    groupId: 'group_hij',
    groupName: 'Tech Professionals Circle',
    adminId: 'user_admin2',
    totalMembers: 12,
    startDate: new Date('2024-02-25'),
  };

  const result = await GroupNotificationService.notifyGroupFull(groupData);
  
  if (result.success) {
    console.log('✅ Group full notifications sent');
    console.log('✨ To all members: "Amazing! Tech Professionals Circle is now complete with all 12 members. The first cycle will begin on February 25th. Get ready to start saving together!"');
    console.log('📅 First payment reminders will be automatically scheduled for March 3rd');
  }
}

// Example 6: Payout processing and completion
export async function payoutProcessingExample() {
  console.log('📋 Example 6: Payout processing workflow');
  
  const payoutData = {
    recipientId: 'user_555',
    recipientName: 'David Kiggundu',
    groupId: 'group_klm',
    groupName: 'Farmers Cooperative',
    cycle: 7,
    payoutAmount: 800000,
    processingDate: new Date(),
    payoutMethod: 'mobile_money' as const,
    accountDetails: {
      mobileNumber: '+256700555444',
    },
  };

  // Step 1: Notify processing started
  let result = await PayoutNotificationService.notifyPayoutProcessing(payoutData);
  if (result.success) {
    console.log('💸 Processing notification sent: "Hi David Kiggundu! Your payout of UGX 800,000 from Farmers Cooperative is being processed. You should receive it shortly."');
  }

  // Step 2: Simulate processing delay
  console.log('⏳ Processing payout...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Notify completion
  result = await PayoutNotificationService.notifyPayoutCompleted({
    ...payoutData,
    transactionId: 'TXN_12345',
    actualAmount: 800000,
  });

  if (result.success) {
    console.log('✅ Completion notification sent: "Congratulations David Kiggundu! You have successfully received UGX 800,000 from Farmers Cooperative. Thank you for being part of our savings group!"');
  }
}

// Example 7: Late payment escalation
export async function latePaymentEscalationExample() {
  console.log('📋 Example 7: Late payment escalation workflow');
  
  // Day 1: First warning
  await PaymentReminderService.sendOverdueNotifications({
    contributionId: 'contrib_late',
    memberId: 'user_late',
    memberName: 'Peter Ssali',
    groupName: 'Construction Workers Group',
    amount: 30000,
    dueDate: new Date('2024-02-10'),
    daysLate: 1,
    previousWarnings: 0,
  });
  console.log('⚠️ Day 1 overdue: First warning sent');

  // Day 5: Second warning with penalty
  await PaymentReminderService.sendOverdueNotifications({
    contributionId: 'contrib_late',
    memberId: 'user_late',
    memberName: 'Peter Ssali',
    groupName: 'Construction Workers Group',
    amount: 30000,
    dueDate: new Date('2024-02-10'),
    daysLate: 5,
    previousWarnings: 1,
  });
  console.log('💸 Day 5 overdue: Penalty warning sent (5% = UGX 1,500)');

  // Day 10: Account suspension
  await PaymentReminderService.processLatePaymentEscalation({
    contributionId: 'contrib_late',
    memberId: 'user_late',
    memberName: 'Peter Ssali',
    groupId: 'group_construction',
    groupName: 'Construction Workers Group',
    adminId: 'user_admin3',
    daysLate: 10,
    amount: 30000,
  });
  console.log('🚫 Day 10 overdue: Account suspended, admin notified');
}

// Example 8: Bulk operations
export async function bulkNotificationsExample() {
  console.log('📋 Example 8: Bulk notification operations');
  
  // Setup reminders for all members in a new cycle
  const contributions = [
    {
      contributionId: 'contrib_bulk_1',
      memberId: 'user_001',
      memberName: 'Alice Namazzi',
      groupId: 'group_bulk',
      groupName: 'Monthly Savers',
      amount: 40000,
      dueDate: new Date('2024-03-01'),
      cycle: 1,
    },
    {
      contributionId: 'contrib_bulk_2',
      memberId: 'user_002',
      memberName: 'Bob Katende',
      groupId: 'group_bulk',
      groupName: 'Monthly Savers',
      amount: 40000,
      dueDate: new Date('2024-03-01'),
      cycle: 1,
    },
    // ... more contributions
  ];

  const result = await PaymentReminderService.setupBulkReminders(contributions);
  
  if (result.success) {
    console.log(`✅ Bulk reminders setup: ${result.data.remindersSent}/${result.data.totalReminders} successful`);
    console.log('📅 All members will receive reminders on:');
    console.log('   - February 26th (3 days before)');
    console.log('   - March 1st (due date)');
    console.log('   - March 3rd (if overdue)');
  }
}

// Example 9: Testing the notification system
export async function testNotificationSystemExample() {
  console.log('📋 Example 9: Testing notification system');
  
  const testPhone = '+256700123456'; // Replace with actual test number
  
  const testResults = await NotificationManager.testNotifications(testPhone);
  
  console.log('🧪 Test Results:');
  console.log(`   Push Notifications: ${testResults.pushNotifications ? '✅' : '❌'}`);
  console.log(`   SMS Notifications: ${testResults.smsNotifications ? '✅' : '❌'}`);
  console.log(`   Scheduler: ${testResults.scheduler ? '✅' : '❌'}`);
  
  // Get comprehensive statistics
  const stats = await NotificationManager.getStatistics();
  console.log('📊 System Statistics:');
  console.log(`   Total notifications sent: ${stats.notifications.totalSent}`);
  console.log(`   SMS delivery rate: ${stats.sms.deliveryRate}%`);
  console.log(`   Scheduler success rate: ${stats.scheduler.sendRate}%`);
  console.log(`   Available templates: ${stats.templates.totalTemplates}`);
  console.log(`   Most used template: ${stats.templates.mostUsedTemplate}`);
}

// Example 10: Custom notification with template
export async function customNotificationExample() {
  console.log('📋 Example 10: Custom notification using templates');
  
  // Send a custom notification using the template system
  const customData = {
    templateId: 'maintenance_notice',
    userId: 'user_custom',
    data: {
      memberName: 'Janet Nakato',
      groupName: 'Elite Savers Circle',
      startTime: '2:00 PM',
      endTime: '4:00 PM',
    },
    sendSMS: true,
    sendEmail: false,
    groupId: 'group_elite',
  };

  const success = await NotificationManager.services.core.sendToUser(customData);
  
  if (success) {
    console.log('✅ Custom notification sent successfully');
    console.log('🔧 Message: "Ajoturn will undergo scheduled maintenance from 2:00 PM to 4:00 PM. Some features may be temporarily unavailable."');
  }
}

// Run all examples (for demonstration purposes)
export async function runAllExamples() {
  console.log('🚀 Running all notification system examples...\n');
  
  await setupPaymentRemindersExample();
  console.log('');
  
  await sendImmediateReminderExample();
  console.log('');
  
  await announceNextRecipientExample();
  console.log('');
  
  await notifyMemberJoinedExample();
  console.log('');
  
  await notifyGroupFullExample();
  console.log('');
  
  await payoutProcessingExample();
  console.log('');
  
  await latePaymentEscalationExample();
  console.log('');
  
  await bulkNotificationsExample();
  console.log('');
  
  await testNotificationSystemExample();
  console.log('');
  
  await customNotificationExample();
  console.log('');
  
  console.log('🎉 All examples completed successfully!');
}

export default {
  setupPaymentRemindersExample,
  sendImmediateReminderExample,
  announceNextRecipientExample,
  notifyMemberJoinedExample,
  notifyGroupFullExample,
  payoutProcessingExample,
  latePaymentEscalationExample,
  bulkNotificationsExample,
  testNotificationSystemExample,
  customNotificationExample,
  runAllExamples,
};