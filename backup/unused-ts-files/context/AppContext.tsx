import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AuthService from '../services/auth';
import DatabaseService from '../services/database/index';
import { User } from '../types/database';
import { networkManager, appCache, offlineQueue } from '../utils/network';
import { useErrorHandler } from '../utils/errorHandler';

// Types
interface AppState {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // App State
  groups: any[];
  notifications: Notification[];
  realtimeUpdates: boolean;
  
  // UI State
  activeTab: string;
  networkStatus: 'online' | 'offline';
}

interface Notification {
  id: string;
  type: 'payment_due' | 'payment_received' | 'payout_ready' | 'cycle_completed';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  groupId?: string;
}

type AppAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_GROUPS'; payload: any[] }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'SET_REALTIME_UPDATES'; payload: boolean }
  | { type: 'SET_NETWORK_STATUS'; payload: 'online' | 'offline' }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'RESET_STATE' };

// Initial State
const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  groups: [],
  notifications: [],
  realtimeUpdates: true,
  activeTab: 'Dashboard',
  networkStatus: 'online',
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    
    case 'SET_GROUPS':
      return { ...state, groups: action.payload };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications].slice(0, 50), // Keep max 50 notifications
      };
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(notif =>
          notif.id === action.payload ? { ...notif, read: true } : notif
        ),
      };
    
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };
    
    case 'SET_REALTIME_UPDATES':
      return { ...state, realtimeUpdates: action.payload };
    
    case 'SET_NETWORK_STATUS':
      return { ...state, networkStatus: action.payload };
    
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    // Auth Actions
    signIn: (email: string, password: string) => Promise<boolean>;
    signOut: () => Promise<void>;
    refreshUserData: () => Promise<void>;
    
    // Data Actions
    loadUserGroups: () => Promise<void>;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
    markNotificationRead: (notificationId: string) => void;
    
    // Settings Actions
    toggleRealtimeUpdates: () => void;
    setActiveTab: (tab: string) => void;
  };
} | null>(null);

// Provider Component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Auth Actions
  const signIn = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await AuthService.signInWithEmail(email, password);
      if (user) {
        dispatch({ type: 'SET_USER', payload: user as User });
        dispatch({ type: 'SET_AUTHENTICATED', payload: true });
        await loadUserGroups();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Sign in error:', error);
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signOut = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await AuthService.signOut();
      dispatch({ type: 'RESET_STATE' });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const refreshUserData = async (): Promise<void> => {
    try {
      const currentUser = AuthService.getCurrentUser();
      if (currentUser) {
        const userProfile = await AuthService.getUserProfile(currentUser.uid);
        if (userProfile) {
          dispatch({ type: 'SET_USER', payload: userProfile as User });
        }
      }
    } catch (error) {
      console.error('Refresh user data error:', error);
    }
  };

  // Data Actions
  const loadUserGroups = async (): Promise<void> => {
    try {
      const currentUser = AuthService.getCurrentUser();
      if (currentUser) {
        const dashboardResult = await DatabaseService.getUserDashboard(currentUser.uid);
        if (dashboardResult.success && dashboardResult.data) {
          dispatch({ type: 'SET_GROUPS', payload: dashboardResult.data.groups });
        }
      }
    } catch (error) {
      console.error('Load user groups error:', error);
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>): void => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });
  };

  const markNotificationRead = (notificationId: string): void => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: notificationId });
  };

  // Settings Actions
  const toggleRealtimeUpdates = (): void => {
    dispatch({ type: 'SET_REALTIME_UPDATES', payload: !state.realtimeUpdates });
  };

  const setActiveTab = (tab: string): void => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  };

  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Check if user is already authenticated
        const currentUser = AuthService.getCurrentUser();
        if (currentUser) {
          const userProfile = await AuthService.getUserProfile(currentUser.uid);
          if (userProfile) {
            dispatch({ type: 'SET_USER', payload: userProfile as User });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });
            await loadUserGroups();
          }
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeApp();
  }, []);

  // Network status monitoring
  useEffect(() => {
    const unsubscribe = networkManager.addListener((isOnline) => {
      dispatch({ type: 'SET_NETWORK_STATUS', payload: isOnline ? 'online' : 'offline' });
      
      if (isOnline) {
        // Process queued actions when coming back online
        offlineQueue.processQueue(async (action) => {
          // Handle different types of queued actions
          switch (action.type) {
            case 'CREATE_GROUP':
              // Implement group creation logic
              return true;
            case 'MAKE_PAYMENT':
              // Implement payment logic
              return true;
            case 'UPDATE_PROFILE':
              // Implement profile update logic
              return true;
            default:
              return false;
          }
        });
      }
    });

    return unsubscribe;
  }, []);

  // Realtime updates (would integrate with Firebase listeners)
  useEffect(() => {
    if (state.realtimeUpdates && state.isAuthenticated && state.user) {
      // Set up realtime listeners for user's groups
      const setupRealtimeListeners = async () => {
        // This would set up Firebase listeners for:
        // - Group updates
        // - Payment status changes
        // - New notifications
        // - Cycle completions
        
        console.log('Setting up realtime listeners for user:', state.user?.uid);
        
        // Example: Listen for new notifications
        // In a real implementation, you'd set up Firebase listeners here
      };

      setupRealtimeListeners();
      
      return () => {
        // Clean up listeners
        console.log('Cleaning up realtime listeners');
      };
    }
  }, [state.realtimeUpdates, state.isAuthenticated, state.user]);

  // Periodic data refresh when not using realtime
  useEffect(() => {
    if (!state.realtimeUpdates && state.isAuthenticated) {
      const interval = setInterval(() => {
        refreshUserData();
        loadUserGroups();
      }, 60000); // Refresh every minute

      return () => clearInterval(interval);
    }
  }, [state.realtimeUpdates, state.isAuthenticated]);

  const contextValue = {
    state,
    dispatch,
    actions: {
      signIn,
      signOut,
      refreshUserData,
      loadUserGroups,
      addNotification,
      markNotificationRead,
      toggleRealtimeUpdates,
      setActiveTab,
    },
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Custom hooks for specific functionality
export function useAuth() {
  const { state, actions } = useApp();
  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    signIn: actions.signIn,
    signOut: actions.signOut,
    refreshUserData: actions.refreshUserData,
  };
}

export function useGroups() {
  const { state, actions } = useApp();
  return {
    groups: state.groups,
    loadUserGroups: actions.loadUserGroups,
  };
}

export function useNotifications() {
  const { state, actions } = useApp();
  return {
    notifications: state.notifications,
    unreadCount: state.notifications.filter(n => !n.read).length,
    addNotification: actions.addNotification,
    markNotificationRead: actions.markNotificationRead,
  };
}

export function useSettings() {
  const { state, actions } = useApp();
  return {
    realtimeUpdates: state.realtimeUpdates,
    networkStatus: state.networkStatus,
    activeTab: state.activeTab,
    toggleRealtimeUpdates: actions.toggleRealtimeUpdates,
    setActiveTab: actions.setActiveTab,
  };
}