import { __DEV__ } from 'react-native';

// Development configuration
export const DEV_CONFIG = {
  // Enable development features
  ENABLE_LOGS: __DEV__,
  ENABLE_PERFORMANCE_MONITOR: __DEV__,
  ENABLE_NETWORK_INSPECTOR: __DEV__,
  ENABLE_REDUX_DEVTOOLS: __DEV__,
  
  // API endpoints
  API_BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api' 
    : 'https://ajoturn-api.herokuapp.com/api',
  
  // Firebase config
  FIREBASE_CONFIG: {
    // This should be moved to environment variables
    projectId: 'ajoturn-dev',
    appId: '1:123456789:android:abcdef',
  },
  
  // Debug settings
  DEBUG_NETWORK: __DEV__,
  DEBUG_PERFORMANCE: __DEV__,
  MOCK_API_CALLS: false, // Set to true to use mock data
  
  // Feature flags
  FEATURES: {
    BIOMETRIC_AUTH: true,
    OFFLINE_MODE: true,
    PUSH_NOTIFICATIONS: true,
    SMS_NOTIFICATIONS: true,
    PAYMENT_INTEGRATION: true,
  },
};

// Performance monitoring
export class DevPerformanceMonitor {
  private static marks: Map<string, number> = new Map();
  
  static mark(name: string) {
    if (!DEV_CONFIG.ENABLE_PERFORMANCE_MONITOR) return;
    this.marks.set(name, performance.now());
  }
  
  static measure(name: string, startMark: string) {
    if (!DEV_CONFIG.ENABLE_PERFORMANCE_MONITOR) return;
    
    const startTime = this.marks.get(startMark);
    if (startTime) {
      const duration = performance.now() - startTime;
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
  
  static clear() {
    this.marks.clear();
  }
}

// Development logger
export class DevLogger {
  private static enabled = DEV_CONFIG.ENABLE_LOGS;
  
  static info(message: string, ...args: any[]) {
    if (this.enabled) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }
  
  static warn(message: string, ...args: any[]) {
    if (this.enabled) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }
  
  static error(message: string, error?: any, ...args: any[]) {
    if (this.enabled) {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  }
  
  static debug(message: string, ...args: any[]) {
    if (this.enabled) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
  
  static network(method: string, url: string, data?: any) {
    if (this.enabled && DEV_CONFIG.DEBUG_NETWORK) {
      console.log(`[NETWORK] ${method} ${url}`, data);
    }
  }
}

// Mock data for development
export const MOCK_DATA = {
  user: {
    uid: 'mock-user-123',
    email: 'test@ajoturn.com',
    displayName: 'Test User',
    phoneNumber: '+254712345678',
    emailVerified: true,
    phoneVerified: true,
  },
  
  groups: [
    {
      id: 'group-1',
      name: 'Family Savings',
      description: 'Monthly family contribution',
      contributionAmount: 5000,
      maxMembers: 10,
      currentMembers: 7,
      paymentDay: 15,
      status: 'active',
      isAdmin: true,
    },
    {
      id: 'group-2',
      name: 'Investment Club',
      description: 'Investment focused group',
      contributionAmount: 10000,
      maxMembers: 8,
      currentMembers: 8,
      paymentDay: 1,
      status: 'active',
      isAdmin: false,
    },
  ],
  
  payments: [
    {
      id: 'payment-1',
      amount: 5000,
      date: new Date(),
      status: 'completed',
      groupId: 'group-1',
      method: 'mpesa',
    },
    {
      id: 'payment-2',
      amount: 10000,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      status: 'completed',
      groupId: 'group-2',
      method: 'mpesa',
    },
  ],
};

// Development utilities
export const devUtils = {
  // Clear all app data
  clearAppData: () => {
    if (__DEV__) {
      // This would clear AsyncStorage, MMKV, etc.
      console.log('Clearing all app data...');
    }
  },
  
  // Reset to onboarding
  resetToOnboarding: () => {
    if (__DEV__) {
      console.log('Resetting to onboarding...');
    }
  },
  
  // Generate test data
  generateTestData: () => {
    if (__DEV__) {
      console.log('Generating test data...');
      return MOCK_DATA;
    }
  },
  
  // Toggle feature flags
  toggleFeature: (feature: keyof typeof DEV_CONFIG.FEATURES) => {
    if (__DEV__) {
      DEV_CONFIG.FEATURES[feature] = !DEV_CONFIG.FEATURES[feature];
      console.log(`Feature ${feature} is now ${DEV_CONFIG.FEATURES[feature] ? 'enabled' : 'disabled'}`);
    }
  },
};

// Export development tools for global access
if (__DEV__) {
  // Make dev tools available globally
  (global as any).devUtils = devUtils;
  (global as any).DevLogger = DevLogger;
  (global as any).DevPerformanceMonitor = DevPerformanceMonitor;
  (global as any).DEV_CONFIG = DEV_CONFIG;
}