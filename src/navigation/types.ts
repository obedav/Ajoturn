/**
 * Navigation TypeScript definitions for Ajoturn app
 * This file defines all navigation params and screen types
 */

import { StackScreenProps } from '@react-navigation/stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

// Root Stack Parameter List
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Loading: undefined;
};

// Auth Stack Parameter List
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  PhoneVerification: {
    phoneNumber: string;
    verificationId: string;
  };
};

// Main Tab Parameter List
export type MainTabParamList = {
  Dashboard: undefined;
  Groups: undefined;
  Payments: undefined;
  Profile: undefined;
};

// Main Stack Parameter List (for modals and additional screens)
export type MainStackParamList = {
  MainTabs: undefined;
  CreateGroup: undefined;
  JoinGroup: {
    groupCode?: string;
    inviteLink?: string;
  };
  GroupDetails: {
    groupId: string;
    groupName?: string;
  };
  Payment: {
    groupId: string;
    contributionId?: string;
    amount: number;
    dueDate?: string;
    recipient?: string;
  };
  PaymentHistory: {
    userId?: string;
    groupId?: string;
  };
  GroupSettings: {
    groupId: string;
  };
  MemberProfile: {
    userId: string;
    groupId?: string;
  };
  GroupInvite: {
    groupId: string;
  };
  PaymentConfirmation: {
    paymentId: string;
    amount: number;
    recipient: string;
  };
  EditProfile: undefined;
  Notifications: undefined;
  Help: undefined;
  Settings: undefined;
};

// Screen Props Types
export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = StackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

export type MainStackScreenProps<T extends keyof MainStackParamList> = CompositeScreenProps<
  StackScreenProps<MainStackParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// Combined Screen Props for components that need both tab and stack navigation
export type CombinedScreenProps<
  T extends keyof MainTabParamList,
  U extends keyof MainStackParamList
> = CompositeScreenProps<
  MainTabScreenProps<T>,
  MainStackScreenProps<U>
>;

// Navigation prop types for hooks
export type RootNavigationProp = RootStackScreenProps<'Auth' | 'Main'>['navigation'];
export type AuthNavigationProp = AuthStackScreenProps<'Login'>['navigation'];
export type MainTabNavigationProp = MainTabScreenProps<'Dashboard'>['navigation'];
export type MainStackNavigationProp = MainStackScreenProps<'MainTabs'>['navigation'];

// Route prop types
export type RootRouteProp<T extends keyof RootStackParamList> = RootStackScreenProps<T>['route'];
export type AuthRouteProp<T extends keyof AuthStackParamList> = AuthStackScreenProps<T>['route'];
export type MainTabRouteProp<T extends keyof MainTabParamList> = MainTabScreenProps<T>['route'];
export type MainStackRouteProp<T extends keyof MainStackParamList> = MainStackScreenProps<T>['route'];

// Generic screen component props
export interface ScreenProps<T = any> {
  navigation: T;
  route?: any;
}

// Common navigation actions
export interface NavigationActions {
  goBack: () => void;
  navigate: (screen: string, params?: any) => void;
  replace: (screen: string, params?: any) => void;
  reset: (state: any) => void;
}

// Declare global types for React Navigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}