interface SMSConfig {
  provider: 'twilio' | 'africas_talking' | 'mock';
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  maxLength: number;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

class SMSService {
  private config: SMSConfig = {
    provider: 'mock', // Use mock for development
    maxLength: 160,
    senderId: 'AJOTURN',
  };

  // Initialize SMS service with configuration
  initialize(config: Partial<SMSConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`SMS Service initialized with provider: ${this.config.provider}`);
  }

  // Send SMS message
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Clean and validate phone number
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      if (!this.isValidPhoneNumber(cleanPhone)) {
        console.error('Invalid phone number:', phoneNumber);
        return false;
      }

      // Truncate message if too long
      const finalMessage = this.truncateMessage(message);

      let result: SMSResult;
      
      switch (this.config.provider) {
        case 'twilio':
          result = await this.sendWithTwilio(cleanPhone, finalMessage);
          break;
        case 'africas_talking':
          result = await this.sendWithAfricasTalking(cleanPhone, finalMessage);
          break;
        case 'mock':
        default:
          result = await this.sendWithMockProvider(cleanPhone, finalMessage);
          break;
      }

      if (result.success) {
        console.log(`SMS sent successfully to ${cleanPhone}, ID: ${result.messageId}`);
        // Log SMS delivery for analytics
        await this.logSMSDelivery(cleanPhone, finalMessage, result);
      } else {
        console.error(`SMS failed to ${cleanPhone}: ${result.error}`);
      }

      return result.success;
    } catch (error) {
      console.error('Error sending SMS:', error);
      return false;
    }
  }

  // Send SMS to multiple recipients
  async sendBulkSMS(phoneNumbers: string[], message: string): Promise<{ success: number; failed: number }> {
    const results = await Promise.allSettled(
      phoneNumbers.map(phone => this.sendSMS(phone, message))
    );

    const success = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;
    
    const failed = results.length - success;

    console.log(`Bulk SMS completed: ${success} sent, ${failed} failed`);
    return { success, failed };
  }

  // Twilio integration
  private async sendWithTwilio(phoneNumber: string, message: string): Promise<SMSResult> {
    try {
      // Mock Twilio implementation
      // In production, you would use the actual Twilio SDK
      console.log('Sending SMS via Twilio:', {
        to: phoneNumber,
        from: this.config.senderId,
        body: message,
      });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        messageId: `twilio_${Date.now()}`,
        cost: 0.05, // USD
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Twilio API error',
      };
    }
  }

  // Africa's Talking integration (popular in Africa)
  private async sendWithAfricasTalking(phoneNumber: string, message: string): Promise<SMSResult> {
    try {
      // Mock Africa's Talking implementation
      // In production, you would use the actual Africa's Talking SDK
      console.log('Sending SMS via Africa\'s Talking:', {
        to: [phoneNumber],
        message,
        from: this.config.senderId,
      });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));

      return {
        success: true,
        messageId: `at_${Date.now()}`,
        cost: 0.02, // USD
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Africa\'s Talking API error',
      };
    }
  }

  // Mock provider for development/testing
  private async sendWithMockProvider(phoneNumber: string, message: string): Promise<SMSResult> {
    console.log('📱 MOCK SMS:', {
      to: phoneNumber,
      message: message,
      timestamp: new Date().toISOString(),
    });

    // Simulate some failures for testing
    const shouldFail = Math.random() < 0.05; // 5% failure rate
    
    if (shouldFail) {
      return {
        success: false,
        error: 'Mock delivery failure',
      };
    }

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      cost: 0.01,
    };
  }

  // Clean phone number (remove spaces, dashes, etc.)
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Add Uganda country code if missing
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('0')) {
        cleaned = '+256' + cleaned.substring(1);
      } else if (!cleaned.startsWith('256')) {
        cleaned = '+256' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }

    return cleaned;
  }

  // Validate phone number format
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation for Ugandan phone numbers
    const ugandaPhoneRegex = /^\+256[0-9]{9}$/;
    return ugandaPhoneRegex.test(phoneNumber);
  }

  // Truncate message to fit SMS length limits
  private truncateMessage(message: string): string {
    if (message.length <= this.config.maxLength) {
      return message;
    }

    // Truncate and add ellipsis
    return message.substring(0, this.config.maxLength - 3) + '...';
  }

  // Log SMS delivery for analytics
  private async logSMSDelivery(phoneNumber: string, message: string, result: SMSResult): Promise<void> {
    try {
      const logEntry = {
        phoneNumber: phoneNumber,
        message: message,
        provider: this.config.provider,
        success: result.success,
        messageId: result.messageId,
        cost: result.cost,
        error: result.error,
        timestamp: new Date(),
      };

      // In production, you would save this to your database
      console.log('SMS Delivery Log:', logEntry);
    } catch (error) {
      console.error('Error logging SMS delivery:', error);
    }
  }

  // Get SMS delivery statistics
  async getSMSStatistics(startDate: Date, endDate: Date): Promise<{
    totalSent: number;
    totalFailed: number;
    totalCost: number;
    deliveryRate: number;
  }> {
    // Mock implementation - in production, query from database
    return {
      totalSent: 150,
      totalFailed: 8,
      totalCost: 2.34,
      deliveryRate: 94.9,
    };
  }

  // Check if SMS service is properly configured
  isConfigured(): boolean {
    switch (this.config.provider) {
      case 'twilio':
        return !!(this.config.apiKey && this.config.apiSecret);
      case 'africas_talking':
        return !!(this.config.apiKey && this.config.apiSecret);
      case 'mock':
        return true;
      default:
        return false;
    }
  }

  // Get current configuration (without secrets)
  getConfig(): Omit<SMSConfig, 'apiKey' | 'apiSecret'> {
    return {
      provider: this.config.provider,
      senderId: this.config.senderId,
      maxLength: this.config.maxLength,
    };
  }

  // Test SMS functionality
  async testSMS(testPhoneNumber: string): Promise<boolean> {
    const testMessage = `Test message from Ajoturn at ${new Date().toLocaleTimeString()}. Service is working correctly!`;
    
    console.log('Sending test SMS...');
    const result = await this.sendSMS(testPhoneNumber, testMessage);
    
    if (result) {
      console.log('✅ SMS test successful');
    } else {
      console.log('❌ SMS test failed');
    }
    
    return result;
  }

  // Format currency for SMS messages
  formatCurrencyForSMS(amount: number): string {
    // Use a shorter format suitable for SMS
    if (amount >= 1000000) {
      return `UGX ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `UGX ${(amount / 1000).toFixed(0)}K`;
    } else {
      return `UGX ${amount}`;
    }
  }

  // Create short URL for SMS (if needed)
  async createShortUrl(longUrl: string): Promise<string> {
    // Mock implementation - in production, use a URL shortening service
    const shortId = Math.random().toString(36).substr(2, 8);
    return `https://ajoturn.app/l/${shortId}`;
  }
}

export default new SMSService();