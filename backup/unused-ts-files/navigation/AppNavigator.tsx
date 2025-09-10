import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Navigation Types
import { 
  RootStackParamList, 
  AuthStackParamList, 
  MainStackParamList,
  NavigationTheme 
} from '../types/navigation';

// Screen Components
import LoadingScreen from '../screens/LoadingScreen';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Main Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import JoinGroupScreen from '../screens/main/JoinGroupScreen';
import GroupDetailsScreen from '../screens/main/GroupDetailsScreen';
import PaymentScreen from '../screens/main/PaymentScreen';

// Authentication Context
import { useAuthContext } from '../context/AuthContext';

// Stack Navigators
const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

// Custom Theme
const ajoturnTheme: NavigationTheme = {
  dark: false,
  colors: {
    primary: '#3182ce',
    background: '#f7fafc',
    card: '#ffffff',
    text: '#2d3748',
    border: '#e2e8f0',
    notification: '#38a169',
  },
};

// Auth Stack Navigator
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <AuthStack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          title: 'Welcome Back',
          headerShown: false,
        }}
      />
      <AuthStack.Screen 
        name="Signup" 
        component={SignupScreen}
        options={{
          title: 'Create Account',
          headerShown: false,
        }}
      />
    </AuthStack.Navigator>
  );
}

// Main Stack Navigator
function MainNavigator() {
  return (
    <MainStack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerStyle: {
          backgroundColor: ajoturnTheme.colors.primary,
          elevation: 4,
          shadowOpacity: 0.3,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
          color: '#ffffff',
        },
        headerTintColor: '#ffffff',
        gestureEnabled: true,
      }}
    >
      <MainStack.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Ajoturn',
          headerLeft: () => null, // Remove back button on dashboard
        }}
      />
      <MainStack.Screen 
        name="CreateGroup" 
        component={CreateGroupScreen}
        options={{
          title: 'Create New Group',
        }}
      />
      <MainStack.Screen 
        name="JoinGroup" 
        component={JoinGroupScreen}
        options={{
          title: 'Join Group',
        }}
      />
      <MainStack.Screen 
        name="GroupDetails" 
        component={GroupDetailsScreen}
        options={({ route }) => ({
          title: 'Group Details',
        })}
      />
      <MainStack.Screen 
        name="Payment" 
        component={PaymentScreen}
        options={{
          title: 'Make Payment',
          presentation: 'modal',
        }}
      />
    </MainStack.Navigator>
  );
}

// Root Navigator Component
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthContext();

  // Show loading screen while checking auth state
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      {isAuthenticated ? (
        <RootStack.Screen 
          name="Main" 
          component={MainNavigator}
          options={{
            animationTypeForReplace: isAuthenticated ? 'push' : 'pop',
          }}
        />
      ) : (
        <RootStack.Screen 
          name="Auth" 
          component={AuthNavigator}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      )}
    </RootStack.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const linking = {
    prefixes: ['ajoturn://'],
    config: {
      screens: {
        Auth: {
          screens: {
            Login: 'login',
            Signup: 'signup',
          },
        },
        Main: {
          screens: {
            Dashboard: '',
            CreateGroup: 'create-group',
            JoinGroup: 'join-group/:groupCode?',
            GroupDetails: 'group/:groupId',
            Payment: 'payment/:contributionId/:groupId/:amount',
          },
        },
      },
    },
  };

  return (
    <NavigationContainer 
      theme={ajoturnTheme}
      linking={linking}
      fallback={<LoadingScreen />}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

// Export individual navigators for testing
export { AuthNavigator, MainNavigator, RootNavigator };