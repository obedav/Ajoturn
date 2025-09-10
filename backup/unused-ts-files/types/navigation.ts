import { NavigatorScreenParams } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { Group, User, Contribution } from './database';

// Auth Stack Type Definitions
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

// Main Stack Type Definitions
export type MainStackParamList = {
  Dashboard: undefined;
  CreateGroup: undefined;
  JoinGroup: { groupCode?: string };
  GroupDetails: { groupId: string };
  Payment: { 
    contributionId: string;
    groupId: string;
    amount: number;
  };
};

// Root Stack Type Definitions
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

// Screen Props Types for Auth Stack
export type LoginScreenProps = StackScreenProps<AuthStackParamList, 'Login'>;
export type SignupScreenProps = StackScreenProps<AuthStackParamList, 'Signup'>;

// Screen Props Types for Main Stack
export type DashboardScreenProps = StackScreenProps<MainStackParamList, 'Dashboard'>;
export type CreateGroupScreenProps = StackScreenProps<MainStackParamList, 'CreateGroup'>;
export type JoinGroupScreenProps = StackScreenProps<MainStackParamList, 'JoinGroup'>;
export type GroupDetailsScreenProps = StackScreenProps<MainStackParamList, 'GroupDetails'>;
export type PaymentScreenProps = StackScreenProps<MainStackParamList, 'Payment'>;

// Root Navigation Props
export type RootStackScreenProps<Screen extends keyof RootStackParamList> = 
  StackScreenProps<RootStackParamList, Screen>;

// Navigation Hook Types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Custom Navigation Data Types
export interface NavigationUser extends User {
  isAuthenticated: boolean;
}

export interface NavigationGroup extends Group {
  memberCount: number;
  userRole?: 'admin' | 'member' | 'treasurer';
  userJoinOrder?: number;
}

export interface NavigationContribution extends Contribution {
  groupName: string;
  isUserContribution: boolean;
  daysUntilDue?: number;
}

// Screen State Types
export interface AuthScreenState {
  isLoading: boolean;
  error?: string;
}

export interface DashboardScreenState {
  user?: NavigationUser;
  groups: NavigationGroup[];
  recentContributions: NavigationContribution[];
  isLoading: boolean;
  refreshing: boolean;
  error?: string;
}

export interface GroupScreenState {
  group?: NavigationGroup;
  members: Array<{
    id: string;
    name: string;
    role: string;
    joinOrder: number;
    status: string;
    reliabilityScore: number;
  }>;
  contributions: NavigationContribution[];
  isLoading: boolean;
  error?: string;
}

// Navigation Action Types
export type NavigationAction = 
  | { type: 'NAVIGATE_TO_LOGIN' }
  | { type: 'NAVIGATE_TO_MAIN' }
  | { type: 'NAVIGATE_TO_GROUP_DETAILS'; payload: { groupId: string } }
  | { type: 'NAVIGATE_TO_PAYMENT'; payload: { contributionId: string; groupId: string; amount: number } }
  | { type: 'GO_BACK' };

// Tab Navigation Types (for future bottom tab implementation)
export type TabParamList = {
  DashboardTab: undefined;
  GroupsTab: undefined;
  PaymentsTab: undefined;
  ProfileTab: undefined;
};

export type TabScreenProps<T extends keyof TabParamList> = 
  StackScreenProps<TabParamList, T>;

// Deep Link Types
export interface DeepLinkConfig {
  screens: {
    Auth: {
      screens: {
        Login: 'login';
        Signup: 'signup';
      };
    };
    Main: {
      screens: {
        Dashboard: '';
        CreateGroup: 'create-group';
        JoinGroup: 'join-group/:groupCode?';
        GroupDetails: 'group/:groupId';
        Payment: 'payment/:contributionId/:groupId/:amount';
      };
    };
  };
}

// Navigation Options Types
export interface ScreenOptions {
  title?: string;
  headerShown?: boolean;
  headerStyle?: {
    backgroundColor?: string;
    elevation?: number;
    shadowOpacity?: number;
  };
  headerTitleStyle?: {
    fontWeight?: string;
    fontSize?: number;
    color?: string;
  };
  headerTintColor?: string;
  gestureEnabled?: boolean;
}

// Stack Navigator Options
export interface StackNavigatorOptions {
  initialRouteName?: string;
  screenOptions?: ScreenOptions;
  headerMode?: 'float' | 'screen' | 'none';
  mode?: 'card' | 'modal';
}

// Navigation Context Types
export interface NavigationContextType {
  user: NavigationUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: NavigationUser) => void;
  logout: () => void;
  updateUser: (updates: Partial<NavigationUser>) => void;
}

// Error Boundary Types
export interface NavigationError {
  message: string;
  stack?: string;
  componentStack?: string;
}

export interface NavigationErrorBoundaryState {
  hasError: boolean;
  error?: NavigationError;
}

// Animation Types
export type TransitionSpec = {
  animation: 'spring' | 'timing';
  config: {
    duration?: number;
    easing?: (t: number) => number;
    delay?: number;
    bounciness?: number;
    speed?: number;
    tension?: number;
    friction?: number;
  };
};

export type CardStyleInterpolator = (props: {
  current: { progress: any };
  next?: { progress: any };
  index: number;
  closing: any;
  layouts: {
    screen: { width: number; height: number };
  };
}) => any;

// Theme Types for Navigation
export interface NavigationTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
}

// Header Button Types
export interface HeaderButtonProps {
  title?: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}

// Modal Types
export interface ModalScreenOptions extends ScreenOptions {
  presentation?: 'modal' | 'transparentModal' | 'fullScreenModal';
  animationTypeForReplace?: 'push' | 'pop';
}

// Navigation Guards
export type NavigationGuard = (to: string, from: string) => boolean | Promise<boolean>;

export interface NavigationGuardConfig {
  requiresAuth: NavigationGuard;
  requiresGroupMembership: NavigationGuard;
  requiresAdminRole: NavigationGuard;
}

// Screen Loading States
export interface ScreenLoadingState {
  initialLoad: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error?: string;
}

// Navigation Analytics
export interface NavigationAnalytics {
  screenName: string;
  previousScreen?: string;
  timestamp: number;
  params?: Record<string, any>;
  userId?: string;
}

export type NavigationAnalyticsEvent = 
  | { type: 'SCREEN_VIEW'; payload: NavigationAnalytics }
  | { type: 'NAVIGATION_ACTION'; payload: NavigationAnalytics };

// Export commonly used types
export type {
  // Core navigation types
  AuthStackParamList,
  MainStackParamList,
  RootStackParamList,
  
  // Screen props
  LoginScreenProps,
  SignupScreenProps,
  DashboardScreenProps,
  CreateGroupScreenProps,
  JoinGroupScreenProps,
  GroupDetailsScreenProps,
  PaymentScreenProps,
  
  // State types
  AuthScreenState,
  DashboardScreenState,
  GroupScreenState,
  
  // Context types
  NavigationContextType,
  
  // Theme and styling
  NavigationTheme,
  ScreenOptions,
};

// Default export for convenience
export default {
  AuthStackParamList: {} as AuthStackParamList,
  MainStackParamList: {} as MainStackParamList,
  RootStackParamList: {} as RootStackParamList,
};