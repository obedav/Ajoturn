import crashlytics from '@react-native-firebase/crashlytics';
import DeviceInfo from 'react-native-device-info';
import { __DEV__ } from 'react-native';

interface CrashReportingConfig {
  enableInDev: boolean;
  enableUserTracking: boolean;
  enablePerformanceMonitoring: boolean;
}

class CrashReportingService {
  private static instance: CrashReportingService;
  private config: CrashReportingConfig = {
    enableInDev: false,
    enableUserTracking: true,
    enablePerformanceMonitoring: true,
  };

  private constructor() {}

  static getInstance(): CrashReportingService {
    if (!CrashReportingService.instance) {
      CrashReportingService.instance = new CrashReportingService();
    }
    return CrashReportingService.instance;
  }

  async initialize(config?: Partial<CrashReportingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Only enable crashlytics in production unless explicitly enabled in dev
    const shouldEnable = !__DEV__ || this.config.enableInDev;
    
    if (shouldEnable) {
      await crashlytics().setCrashlyticsCollectionEnabled(true);
      
      // Set app metadata
      await this.setAppMetadata();
      
      console.log('Crashlytics initialized successfully');
    } else {
      await crashlytics().setCrashlyticsCollectionEnabled(false);
      console.log('Crashlytics disabled in development');
    }
  }

  private async setAppMetadata() {
    try {
      // Set app version and build info
      const version = await DeviceInfo.getVersion();
      const buildNumber = await DeviceInfo.getBuildNumber();
      const bundleId = DeviceInfo.getBundleId();
      const deviceId = await DeviceInfo.getUniqueId();
      
      await crashlytics().setAttribute('app_version', version);
      await crashlytics().setAttribute('build_number', buildNumber);
      await crashlytics().setAttribute('bundle_id', bundleId);
      await crashlytics().setAttribute('device_id', deviceId);
      
      // Set device info
      const deviceName = await DeviceInfo.getDeviceName();
      const systemVersion = DeviceInfo.getSystemVersion();
      const manufacturer = await DeviceInfo.getManufacturer();
      
      await crashlytics().setAttribute('device_name', deviceName);
      await crashlytics().setAttribute('system_version', systemVersion);
      await crashlytics().setAttribute('manufacturer', manufacturer);
      
    } catch (error) {
      console.error('Failed to set crash reporting metadata:', error);
    }
  }

  // Set user identifier
  async setUserId(userId: string) {
    if (!this.config.enableUserTracking) return;
    
    try {
      await crashlytics().setUserId(userId);
    } catch (error) {
      console.error('Failed to set user ID for crash reporting:', error);
    }
  }

  // Set user attributes
  async setUserAttributes(attributes: Record<string, string>) {
    if (!this.config.enableUserTracking) return;
    
    try {
      for (const [key, value] of Object.entries(attributes)) {
        await crashlytics().setAttribute(key, value);
      }
    } catch (error) {
      console.error('Failed to set user attributes for crash reporting:', error);
    }
  }

  // Log custom message
  log(message: string, severity: 'debug' | 'info' | 'warning' | 'error' = 'info') {
    try {
      crashlytics().log(`[${severity.toUpperCase()}] ${message}`);
    } catch (error) {
      console.error('Failed to log message to crash reporting:', error);
    }
  }

  // Record non-fatal error
  recordError(error: Error, context?: Record<string, any>) {
    try {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          crashlytics().setAttribute(key, String(value));
        });
      }
      
      crashlytics().recordError(error);
      
      // Also log to console in development
      if (__DEV__) {
        console.error('Recorded error:', error, context);
      }
    } catch (err) {
      console.error('Failed to record error to crash reporting:', err);
    }
  }

  // Set custom keys for debugging
  setCustomKey(key: string, value: string | number | boolean) {
    try {
      crashlytics().setAttribute(key, String(value));
    } catch (error) {
      console.error('Failed to set custom key for crash reporting:', error);
    }
  }

  // Track screen view
  trackScreenView(screenName: string) {
    try {
      this.log(`Screen viewed: ${screenName}`);
      this.setCustomKey('last_screen', screenName);
    } catch (error) {
      console.error('Failed to track screen view:', error);
    }
  }

  // Track user action
  trackUserAction(action: string, details?: Record<string, any>) {
    try {
      const message = details 
        ? `User action: ${action} - ${JSON.stringify(details)}`
        : `User action: ${action}`;
      
      this.log(message);
    } catch (error) {
      console.error('Failed to track user action:', error);
    }
  }

  // Track API calls
  trackAPICall(method: string, endpoint: string, statusCode?: number, duration?: number) {
    try {
      const message = `API ${method} ${endpoint} - Status: ${statusCode || 'unknown'} - Duration: ${duration || 'unknown'}ms`;
      this.log(message);
      
      if (statusCode && statusCode >= 400) {
        this.setCustomKey('last_api_error', `${method} ${endpoint} - ${statusCode}`);
      }
    } catch (error) {
      console.error('Failed to track API call:', error);
    }
  }

  // Force crash (for testing only)
  forceCrash() {
    if (__DEV__) {
      console.warn('Force crash called - this should only be used for testing');
      crashlytics().crash();
    }
  }

  // Test crash reporting
  async testCrashReporting() {
    if (__DEV__) {
      try {
        // Record a test error
        const testError = new Error('Test error for crash reporting');
        this.recordError(testError, { test: 'crash_reporting_test' });
        
        // Log test message
        this.log('Crash reporting test completed successfully');
        
        console.log('Crash reporting test completed. Check Firebase console for results.');
      } catch (error) {
        console.error('Crash reporting test failed:', error);
      }
    }
  }
}

// Export singleton instance
export const crashReporting = CrashReportingService.getInstance();

// React hook for crash reporting
export const useCrashReporting = () => {
  const recordError = (error: Error, context?: Record<string, any>) => {
    crashReporting.recordError(error, context);
  };

  const logMessage = (message: string, severity: 'debug' | 'info' | 'warning' | 'error' = 'info') => {
    crashReporting.log(message, severity);
  };

  const trackScreen = (screenName: string) => {
    crashReporting.trackScreenView(screenName);
  };

  const trackAction = (action: string, details?: Record<string, any>) => {
    crashReporting.trackUserAction(action, details);
  };

  return {
    recordError,
    logMessage,
    trackScreen,
    trackAction,
  };
};

// Error boundary helper
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallbackComponent?: React.ComponentType<any>
) => {
  return class ErrorBoundaryWrapper extends React.Component<P, { hasError: boolean }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      // Update state so the next render will show the fallback UI
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      // Record the error to crash reporting
      crashReporting.recordError(error, {
        component_stack: errorInfo.componentStack,
        error_boundary: 'true',
      });
    }

    render() {
      if (this.state.hasError) {
        // Render fallback component or default error UI
        if (fallbackComponent) {
          const FallbackComponent = fallbackComponent;
          return React.createElement(FallbackComponent);
        }
        
        return React.createElement('text', {}, 'Something went wrong.');
      }

      return React.createElement(Component, this.props);
    }
  };
};