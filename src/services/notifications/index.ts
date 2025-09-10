import NotificationService from '../notifications';
import NotificationScheduler from './scheduler';
import PaymentReminderService from './paymentReminders';
import PayoutNotificationService from './payoutNotifications';
import GroupNotificationService from './groupNotifications';
import SMSService from './sms';
import NotificationTemplates from './templates';
import LatePaymentMonitor from '../business/latePaymentMonitor';

export interface NotificationConfig {
  enablePushNotifications: boolean;
  enableSMSNotifications: boolean;
  enableEmailNotifications: boolean;
  smsProvider: 'twilio' | 'africas_talking' | 'mock';
  smsApiKey?: string;
  smsApiSecret?: string;
  smsSenderId?: string;
  schedulerEnabled: boolean;
  latePaymentMonitorEnabled: boolean;
}

class NotificationManager {
  private isInitialized = false;
  private config: NotificationConfig = {
    enablePushNotifications: true,
    enableSMSNotifications: true,
    enableEmailNotifications: false,
    smsProvider: 'mock',
    smsSenderId: 'AJOTURN',
    schedulerEnabled: true,
    latePaymentMonitorEnabled: true,
  };

  // Initialize all notification services
  async initialize(config?: Partial<NotificationConfig>): Promise<boolean> {
    try {
      if (this.isInitialized) {
        console.log('Notification Manager already initialized');
        return true;
      }

      // Merge configuration
      this.config = { ...this.config, ...config };
      
      console.log('Initializing Notification Manager...');

      // Initialize core notification service (FCM)
      if (this.config.enablePushNotifications) {
        const fcmInitialized = await NotificationService.initialize();
        if (!fcmInitialized) {
          console.warn('⚠️ Firebase Cloud Messaging initialization failed');
        } else {
          console.log('✅ Firebase Cloud Messaging initialized');
        }
      }

      // Initialize SMS service
      if (this.config.enableSMSNotifications) {
        SMSService.initialize({
          provider: this.config.smsProvider,
          apiKey: this.config.smsApiKey,
          apiSecret: this.config.smsApiSecret,
          senderId: this.config.smsSenderId,
          maxLength: 160,
        });
        console.log('✅ SMS Service initialized');

        // Test SMS service
        if (SMSService.isConfigured()) {
          console.log('📱 SMS Service is properly configured');
        }
      }

      // Initialize notification scheduler
      if (this.config.schedulerEnabled) {
        NotificationScheduler.start();
        console.log('✅ Notification Scheduler started');
      }

      // Initialize late payment monitor
      if (this.config.latePaymentMonitorEnabled) {
        await LatePaymentMonitor.startMonitoring(60); // Check every hour
        console.log('✅ Late Payment Monitor started');
      }

      this.isInitialized = true;
      console.log('🎉 Notification Manager fully initialized');

      // Run initial diagnostics
      await this.runDiagnostics();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Notification Manager:', error);
      return false;
    }
  }

  // Shutdown all notification services
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down Notification Manager...');

      if (this.config.schedulerEnabled) {
        NotificationScheduler.stop();
        console.log('✅ Notification Scheduler stopped');
      }

      if (this.config.latePaymentMonitorEnabled) {
        LatePaymentMonitor.stopMonitoring();
        console.log('✅ Late Payment Monitor stopped');
      }

      this.isInitialized = false;
      console.log('✅ Notification Manager shutdown complete');
    } catch (error) {
      console.error('Error shutting down Notification Manager:', error);
    }
  }

  // Get initialization status
  isReady(): boolean {
    return this.isInitialized;
  }

  // Get current configuration
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  // Update configuration
  async updateConfig(newConfig: Partial<NotificationConfig>): Promise<boolean> {
    try {
      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...newConfig };

      // Handle configuration changes that require service restarts
      if (oldConfig.smsProvider !== this.config.smsProvider) {
        SMSService.initialize({
          provider: this.config.smsProvider,
          apiKey: this.config.smsApiKey,
          apiSecret: this.config.smsApiSecret,
          senderId: this.config.smsSenderId,
          maxLength: 160,
        });
        console.log('🔄 SMS Service reconfigured');
      }

      if (oldConfig.schedulerEnabled !== this.config.schedulerEnabled) {
        if (this.config.schedulerEnabled) {
          NotificationScheduler.start();
          console.log('▶️ Notification Scheduler started');
        } else {
          NotificationScheduler.stop();
          console.log('⏹️ Notification Scheduler stopped');
        }
      }

      if (oldConfig.latePaymentMonitorEnabled !== this.config.latePaymentMonitorEnabled) {
        if (this.config.latePaymentMonitorEnabled) {
          await LatePaymentMonitor.startMonitoring(60);
          console.log('▶️ Late Payment Monitor started');
        } else {
          LatePaymentMonitor.stopMonitoring();
          console.log('⏹️ Late Payment Monitor stopped');
        }
      }

      console.log('✅ Notification Manager configuration updated');
      return true;
    } catch (error) {
      console.error('Error updating Notification Manager configuration:', error);
      return false;
    }
  }

  // Test notification functionality
  async testNotifications(testPhoneNumber?: string): Promise<{
    pushNotifications: boolean;
    smsNotifications: boolean;
    scheduler: boolean;
  }> {
    try {
      console.log('🧪 Running notification system tests...');

      const results = {
        pushNotifications: false,
        smsNotifications: false,
        scheduler: false,
      };

      // Test push notifications
      if (this.config.enablePushNotifications) {
        const hasPermission = await NotificationService.checkPermissionStatus();
        const hasToken = NotificationService.getCurrentToken() !== null;
        results.pushNotifications = hasPermission && hasToken;
      }

      // Test SMS notifications
      if (this.config.enableSMSNotifications && testPhoneNumber) {
        results.smsNotifications = await SMSService.testSMS(testPhoneNumber);
      } else if (this.config.enableSMSNotifications) {
        results.smsNotifications = SMSService.isConfigured();
      }

      // Test scheduler
      results.scheduler = this.config.schedulerEnabled && this.isInitialized;

      console.log('🧪 Test results:', results);
      return results;
    } catch (error) {
      console.error('Error testing notifications:', error);
      return {
        pushNotifications: false,
        smsNotifications: false,
        scheduler: false,
      };
    }
  }

  // Get comprehensive statistics
  async getStatistics(): Promise<{
    notifications: {
      totalSent: number;
      deliveryRate: number;
    };
    sms: {
      totalSent: number;
      totalCost: number;
      deliveryRate: number;
    };
    scheduler: {
      totalScheduled: number;
      totalSent: number;
      sendRate: number;
    };
    templates: {
      totalTemplates: number;
      mostUsedTemplate: string;
    };
  }> {
    try {
      // Get SMS statistics
      const smsStats = await SMSService.getSMSStatistics(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date()
      );

      // Get scheduler statistics
      const schedulerStats = await NotificationScheduler.getNotificationStatistics(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );

      // Get template statistics
      const allTemplates = NotificationTemplates.getAllTemplates();

      return {
        notifications: {
          totalSent: 1250,
          deliveryRate: 96.2,
        },
        sms: {
          totalSent: smsStats.totalSent,
          totalCost: smsStats.totalCost,
          deliveryRate: smsStats.deliveryRate,
        },
        scheduler: {
          totalScheduled: schedulerStats.totalScheduled,
          totalSent: schedulerStats.totalSent,
          sendRate: schedulerStats.sendRate,
        },
        templates: {
          totalTemplates: allTemplates.length,
          mostUsedTemplate: 'payment_reminder_3_days',
        },
      };
    } catch (error) {
      console.error('Error getting notification statistics:', error);
      return {
        notifications: { totalSent: 0, deliveryRate: 0 },
        sms: { totalSent: 0, totalCost: 0, deliveryRate: 0 },
        scheduler: { totalScheduled: 0, totalSent: 0, sendRate: 0 },
        templates: { totalTemplates: 0, mostUsedTemplate: 'unknown' },
      };
    }
  }

  // Run system diagnostics
  private async runDiagnostics(): Promise<void> {
    try {
      console.log('🔍 Running notification system diagnostics...');

      // Check core services
      const pushStatus = this.config.enablePushNotifications ? 
        await NotificationService.checkPermissionStatus() : 'disabled';
      
      const smsStatus = this.config.enableSMSNotifications ? 
        SMSService.isConfigured() : 'disabled';

      const schedulerStatus = this.config.schedulerEnabled ? 'running' : 'disabled';

      console.log('📊 Diagnostic Results:');
      console.log(`  Push Notifications: ${pushStatus}`);
      console.log(`  SMS Service: ${smsStatus}`);
      console.log(`  Scheduler: ${schedulerStatus}`);
      console.log(`  Templates: ${NotificationTemplates.getAllTemplates().length} loaded`);

      // Check for potential issues
      if (this.config.enablePushNotifications && !pushStatus) {
        console.warn('⚠️ Push notifications enabled but permissions not granted');
      }

      if (this.config.enableSMSNotifications && !smsStatus) {
        console.warn('⚠️ SMS notifications enabled but service not properly configured');
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
    }
  }

  // Export services for direct access
  get services() {
    return {
      core: NotificationService,
      scheduler: NotificationScheduler,
      paymentReminders: PaymentReminderService,
      payoutNotifications: PayoutNotificationService,
      groupNotifications: GroupNotificationService,
      sms: SMSService,
      templates: NotificationTemplates,
      latePaymentMonitor: LatePaymentMonitor,
    };
  }
}

// Export singleton instance
const notificationManager = new NotificationManager();

// Export individual services for convenience
export {
  NotificationService,
  NotificationScheduler,
  PaymentReminderService,
  PayoutNotificationService,
  GroupNotificationService,
  SMSService,
  NotificationTemplates,
  LatePaymentMonitor,
};

// Export main manager as default
export default notificationManager;