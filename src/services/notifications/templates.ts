export interface NotificationTemplate {
  id: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
  sound?: string;
  priority: 'low' | 'normal' | 'high' | 'max';
  category?: string;
  actions?: NotificationAction[];
  smsTemplate?: string;
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
}

export interface TemplateData {
  memberName?: string;
  groupName?: string;
  amount?: number;
  dueDate?: string;
  daysLate?: number;
  cycle?: number;
  recipientName?: string;
  joinedMemberName?: string;
  adminName?: string;
  payoutAmount?: number;
  penaltyAmount?: number;
  warningCount?: number;
}

class NotificationTemplates {
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Payment Reminder Templates
    this.addTemplate({
      id: 'payment_reminder_3_days',
      type: 'payment_reminder',
      title: '💰 Payment Reminder',
      body: 'Hi {{memberName}}! Your payment of {{amount}} for {{groupName}} is due in 3 days ({{dueDate}}). Please prepare to make your contribution.',
      icon: 'payment',
      priority: 'normal',
      category: 'reminder',
      actions: [
        { id: 'view_payment', title: 'View Details', icon: 'visibility' },
        { id: 'mark_paid', title: 'Mark as Paid', icon: 'check' },
      ],
      smsTemplate: 'Payment reminder: {{amount}} due in 3 days for {{groupName}} ({{dueDate}}). Please prepare your contribution.',
    });

    this.addTemplate({
      id: 'payment_due_today',
      type: 'payment_due',
      title: '🚨 Payment Due Today!',
      body: 'Hi {{memberName}}! Your payment of {{amount}} for {{groupName}} is due TODAY ({{dueDate}}). Please make your contribution to avoid late fees.',
      icon: 'schedule',
      priority: 'high',
      category: 'urgent',
      actions: [
        { id: 'pay_now', title: 'Pay Now', icon: 'payment' },
        { id: 'contact_admin', title: 'Contact Admin', icon: 'phone' },
      ],
      smsTemplate: 'URGENT: Payment of {{amount}} for {{groupName}} is due TODAY ({{dueDate}}). Pay now to avoid late fees.',
    });

    this.addTemplate({
      id: 'payment_overdue_2_days',
      type: 'payment_overdue',
      title: '⚠️ Payment Overdue!',
      body: 'Hi {{memberName}}! Your payment of {{amount}} for {{groupName}} is {{daysLate}} days overdue. Please pay immediately to avoid penalties.',
      icon: 'error',
      priority: 'max',
      category: 'urgent',
      actions: [
        { id: 'pay_immediately', title: 'Pay Now', icon: 'payment' },
        { id: 'explain_delay', title: 'Explain Delay', icon: 'message' },
      ],
      smsTemplate: 'OVERDUE: Your {{amount}} payment for {{groupName}} is {{daysLate}} days late. Pay immediately to avoid penalties.',
    });

    // Payout Notifications
    this.addTemplate({
      id: 'payout_recipient_next',
      type: 'payout_next',
      title: '🎉 You\'re Next!',
      body: 'Great news {{recipientName}}! You\'re the next recipient in {{groupName}}. You\'ll receive {{payoutAmount}} when the current cycle completes.',
      icon: 'monetization_on',
      priority: 'high',
      category: 'payout',
      actions: [
        { id: 'view_details', title: 'View Details', icon: 'info' },
        { id: 'prepare_account', title: 'Prepare Account', icon: 'account_balance' },
      ],
      smsTemplate: 'Great news! You\'re next to receive {{payoutAmount}} from {{groupName}} when the cycle completes.',
    });

    this.addTemplate({
      id: 'payout_processing',
      type: 'payout_processing',
      title: '💸 Payout Processing',
      body: 'Hi {{recipientName}}! Your payout of {{payoutAmount}} from {{groupName}} is being processed. You should receive it shortly.',
      icon: 'sync',
      priority: 'high',
      category: 'payout',
      actions: [
        { id: 'track_payout', title: 'Track Payout', icon: 'track_changes' },
        { id: 'contact_admin', title: 'Contact Admin', icon: 'support_agent' },
      ],
      smsTemplate: 'Your payout of {{payoutAmount}} from {{groupName}} is being processed. You should receive it shortly.',
    });

    this.addTemplate({
      id: 'payout_completed',
      type: 'payout_completed',
      title: '✅ Payout Received!',
      body: 'Congratulations {{recipientName}}! You have successfully received {{payoutAmount}} from {{groupName}}. Thank you for being part of our savings group!',
      icon: 'check_circle',
      priority: 'high',
      category: 'success',
      actions: [
        { id: 'view_receipt', title: 'View Receipt', icon: 'receipt' },
        { id: 'share_success', title: 'Share', icon: 'share' },
      ],
      smsTemplate: 'Congratulations! You have successfully received {{payoutAmount}} from {{groupName}}.',
    });

    // Group Update Notifications
    this.addTemplate({
      id: 'member_joined',
      type: 'group_update',
      title: '👋 New Member Joined',
      body: 'Welcome {{joinedMemberName}} to {{groupName}}! Our group is growing stronger together.',
      icon: 'group_add',
      priority: 'normal',
      category: 'group_update',
      actions: [
        { id: 'view_member', title: 'View Profile', icon: 'person' },
        { id: 'welcome_message', title: 'Send Welcome', icon: 'waving_hand' },
      ],
      smsTemplate: 'New member {{joinedMemberName}} has joined {{groupName}}. Welcome to our growing community!',
    });

    this.addTemplate({
      id: 'cycle_completed',
      type: 'cycle_completed',
      title: '🏆 Cycle Completed!',
      body: 'Excellent work! Cycle {{cycle}} of {{groupName}} has been completed. {{recipientName}} has received their payout of {{payoutAmount}}.',
      icon: 'celebration',
      priority: 'high',
      category: 'milestone',
      actions: [
        { id: 'view_summary', title: 'View Summary', icon: 'assessment' },
        { id: 'next_cycle', title: 'Next Cycle Info', icon: 'navigate_next' },
      ],
      smsTemplate: 'Cycle {{cycle}} of {{groupName}} completed! {{recipientName}} received {{payoutAmount}}. Great teamwork!',
    });

    this.addTemplate({
      id: 'group_full',
      type: 'group_update',
      title: '✨ Group Complete!',
      body: 'Amazing! {{groupName}} is now complete with all members. The first cycle will begin soon. Get ready to start saving together!',
      icon: 'groups',
      priority: 'high',
      category: 'milestone',
      actions: [
        { id: 'view_schedule', title: 'View Schedule', icon: 'schedule' },
        { id: 'group_chat', title: 'Group Chat', icon: 'chat' },
      ],
      smsTemplate: '{{groupName}} is now complete! First cycle begins soon. Get ready to start saving together!',
    });

    // Late Payment Notifications
    this.addTemplate({
      id: 'late_payment_warning',
      type: 'late_payment',
      title: '⚠️ Late Payment Warning',
      body: 'Hi {{memberName}}! This is warning #{{warningCount}} for your late payment of {{amount}} in {{groupName}}. Please pay soon to avoid penalties.',
      icon: 'warning',
      priority: 'high',
      category: 'warning',
      actions: [
        { id: 'pay_now', title: 'Pay Now', icon: 'payment' },
        { id: 'contact_admin', title: 'Contact Admin', icon: 'support' },
      ],
      smsTemplate: 'Warning #{{warningCount}}: Late payment of {{amount}} for {{groupName}}. Pay soon to avoid penalties.',
    });

    this.addTemplate({
      id: 'penalty_applied',
      type: 'penalty_applied',
      title: '💸 Late Payment Penalty',
      body: 'Hi {{memberName}}! A penalty of {{penaltyAmount}} has been applied to your late payment in {{groupName}}. Total due: {{amount}}.',
      icon: 'money_off',
      priority: 'max',
      category: 'penalty',
      actions: [
        { id: 'pay_total', title: 'Pay Total Due', icon: 'payment' },
        { id: 'dispute_penalty', title: 'Dispute', icon: 'gavel' },
      ],
      smsTemplate: 'Penalty of {{penaltyAmount}} applied for late payment in {{groupName}}. Total due: {{amount}}.',
    });

    this.addTemplate({
      id: 'account_suspended',
      type: 'account_suspended',
      title: '🚫 Account Suspended',
      body: 'Hi {{memberName}}! Your account has been temporarily suspended due to late payment in {{groupName}}. Please contact the admin to resolve.',
      icon: 'block',
      priority: 'max',
      category: 'urgent',
      actions: [
        { id: 'contact_admin', title: 'Contact Admin', icon: 'support_agent' },
        { id: 'pay_dues', title: 'Pay Outstanding', icon: 'payment' },
      ],
      smsTemplate: 'Account suspended due to late payment in {{groupName}}. Contact admin to resolve.',
    });

    // Admin Notifications
    this.addTemplate({
      id: 'admin_payment_confirmed',
      type: 'admin_notification',
      title: '✅ Payment Confirmed',
      body: 'Payment confirmed: {{memberName}} paid {{amount}} for {{groupName}} cycle {{cycle}}.',
      icon: 'verified',
      priority: 'normal',
      category: 'admin',
      smsTemplate: 'Payment confirmed: {{memberName}} paid {{amount}} for {{groupName}}.',
    });

    this.addTemplate({
      id: 'admin_member_needs_help',
      type: 'admin_notification',
      title: '🆘 Member Needs Help',
      body: '{{memberName}} in {{groupName}} has requested help with their payment. They may need assistance or an extension.',
      icon: 'help',
      priority: 'high',
      category: 'admin_urgent',
      actions: [
        { id: 'contact_member', title: 'Contact Member', icon: 'phone' },
        { id: 'grant_extension', title: 'Grant Extension', icon: 'schedule' },
      ],
      smsTemplate: '{{memberName}} in {{groupName}} needs help with payment. Please contact them.',
    });

    // System Notifications
    this.addTemplate({
      id: 'app_update_available',
      type: 'app_update',
      title: '🔄 App Update Available',
      body: 'A new version of Ajoturn is available with improved features and bug fixes. Update now for the best experience!',
      icon: 'system_update',
      priority: 'low',
      category: 'system',
      actions: [
        { id: 'update_now', title: 'Update Now', icon: 'download' },
        { id: 'remind_later', title: 'Remind Later', icon: 'schedule' },
      ],
    });

    this.addTemplate({
      id: 'maintenance_notice',
      type: 'maintenance',
      title: '🔧 Scheduled Maintenance',
      body: 'Ajoturn will undergo scheduled maintenance from {{startTime}} to {{endTime}}. Some features may be temporarily unavailable.',
      icon: 'build',
      priority: 'normal',
      category: 'system',
    });
  }

  private addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(templateId: string): NotificationTemplate | null {
    return this.templates.get(templateId) || null;
  }

  renderTemplate(templateId: string, data: TemplateData): NotificationTemplate | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    return {
      ...template,
      title: this.replaceVariables(template.title, data),
      body: this.replaceVariables(template.body, data),
      smsTemplate: template.smsTemplate ? this.replaceVariables(template.smsTemplate, data) : undefined,
    };
  }

  private replaceVariables(text: string, data: TemplateData): string {
    let result = text;
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const placeholder = `{{${key}}}`;
        const replacement = this.formatValue(key, value);
        result = result.replace(new RegExp(placeholder, 'g'), replacement);
      }
    });

    return result;
  }

  private formatValue(key: string, value: any): string {
    if (key === 'amount' || key === 'payoutAmount' || key === 'penaltyAmount') {
      return this.formatCurrency(value);
    }
    
    if (key === 'dueDate' && value instanceof Date) {
      return value.toLocaleDateString('en-UG', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    
    return String(value);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByType(type: string): NotificationTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.type === type);
  }

  getTemplatesByCategory(category: string): NotificationTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.category === category);
  }
}

export default new NotificationTemplates();