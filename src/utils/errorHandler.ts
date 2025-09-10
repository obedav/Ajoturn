import Toast from 'react-native-toast-message';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Firebase Auth error messages
const authErrorMessages: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email address',
  'auth/wrong-password': 'Incorrect password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password is too weak',
  'auth/invalid-email': 'Invalid email address',
  'auth/user-disabled': 'This account has been disabled',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later',
  'auth/network-request-failed': 'Network error. Please check your connection',
  'auth/invalid-credential': 'Invalid credentials provided',
};

// Firebase Firestore error messages
const firestoreErrorMessages: Record<string, string> = {
  'permission-denied': 'You do not have permission to perform this action',
  'not-found': 'The requested resource was not found',
  'already-exists': 'This resource already exists',
  'failed-precondition': 'Operation failed due to system constraints',
  'out-of-range': 'Operation was attempted past the valid range',
  'unauthenticated': 'You must be logged in to perform this action',
  'unavailable': 'Service is temporarily unavailable',
  'deadline-exceeded': 'Operation timed out',
};

// Network error messages
const networkErrorMessages: Record<string, string> = {
  'ERR_NETWORK': 'Network connection error',
  'ERR_TIMEOUT': 'Request timed out',
  'ERR_CANCELED': 'Request was canceled',
  'ERR_INTERNET_DISCONNECTED': 'No internet connection',
};

class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Handle Firebase Auth errors
  handleAuthError(error: any): AppError {
    const code = error.code || 'auth/unknown';
    const message = authErrorMessages[code] || error.message || 'Authentication error occurred';
    
    const appError: AppError = {
      code,
      message,
      details: error,
      timestamp: new Date(),
    };

    this.logError(appError);
    return appError;
  }

  // Handle Firebase Firestore errors
  handleFirestoreError(error: any): AppError {
    const code = error.code || 'unknown';
    const message = firestoreErrorMessages[code] || error.message || 'Database error occurred';
    
    const appError: AppError = {
      code,
      message,
      details: error,
      timestamp: new Date(),
    };

    this.logError(appError);
    return appError;
  }

  // Handle network errors
  handleNetworkError(error: any): AppError {
    const code = error.code || 'ERR_NETWORK';
    const message = networkErrorMessages[code] || 'Network error occurred';
    
    const appError: AppError = {
      code,
      message,
      details: error,
      timestamp: new Date(),
    };

    this.logError(appError);
    return appError;
  }

  // Handle generic errors
  handleGenericError(error: any, context?: string): AppError {
    const appError: AppError = {
      code: error.code || 'GENERIC_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: { ...error, context },
      timestamp: new Date(),
    };

    this.logError(appError);
    return appError;
  }

  // Show user-friendly error toast
  showErrorToast(error: AppError | string, title?: string) {
    const message = typeof error === 'string' ? error : error.message;
    
    Toast.show({
      type: 'error',
      text1: title || 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  }

  // Show success toast
  showSuccessToast(message: string, title?: string) {
    Toast.show({
      type: 'success',
      text1: title || 'Success',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }

  // Show info toast
  showInfoToast(message: string, title?: string) {
    Toast.show({
      type: 'info',
      text1: title || 'Info',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  }

  // Show warning toast
  showWarningToast(message: string, title?: string) {
    Toast.show({
      type: 'error', // Using error type for warnings as toast-message doesn't have warning
      text1: title || 'Warning',
      text2: message,
      position: 'top',
      visibilityTime: 3500,
    });
  }

  // Log errors (in production, you might want to send to crash reporting service)
  private logError(error: AppError) {
    console.error(`[${error.timestamp.toISOString()}] ${error.code}: ${error.message}`, error.details);
    
    // In production, you would send this to your crash reporting service
    // Example: Crashlytics.recordError(error);
  }

  // Utility method to check if error is network related
  isNetworkError(error: any): boolean {
    return (
      error.code?.includes('network') ||
      error.code?.includes('timeout') ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('connection')
    );
  }

  // Utility method to check if error is authentication related
  isAuthError(error: any): boolean {
    return error.code?.startsWith('auth/');
  }

  // Utility method to check if error is permission related
  isPermissionError(error: any): boolean {
    return (
      error.code === 'permission-denied' ||
      error.code === 'unauthenticated'
    );
  }

  // Handle async operations with error handling
  async handleAsync<T>(
    operation: () => Promise<T>,
    errorContext?: string
  ): Promise<{ success: boolean; data?: T; error?: AppError }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error: any) {
      let appError: AppError;

      if (this.isAuthError(error)) {
        appError = this.handleAuthError(error);
      } else if (this.isNetworkError(error)) {
        appError = this.handleNetworkError(error);
      } else if (error.code) {
        appError = this.handleFirestoreError(error);
      } else {
        appError = this.handleGenericError(error, errorContext);
      }

      return { success: false, error: appError };
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility function for handling promises with error handling
export const safeAsync = <T>(
  operation: () => Promise<T>,
  errorContext?: string
) => {
  return errorHandler.handleAsync(operation, errorContext);
};

// React Hook for error handling
export const useErrorHandler = () => {
  const showError = (error: AppError | string, title?: string) => {
    errorHandler.showErrorToast(error, title);
  };

  const showSuccess = (message: string, title?: string) => {
    errorHandler.showSuccessToast(message, title);
  };

  const showInfo = (message: string, title?: string) => {
    errorHandler.showInfoToast(message, title);
  };

  const showWarning = (message: string, title?: string) => {
    errorHandler.showWarningToast(message, title);
  };

  const handleAsync = <T>(
    operation: () => Promise<T>,
    errorContext?: string
  ) => {
    return errorHandler.handleAsync(operation, errorContext);
  };

  return {
    showError,
    showSuccess,
    showInfo,
    showWarning,
    handleAsync,
    isNetworkError: errorHandler.isNetworkError,
    isAuthError: errorHandler.isAuthError,
    isPermissionError: errorHandler.isPermissionError,
  };
};