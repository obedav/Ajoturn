import React, { useEffect, useState, useContext } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useColorScheme, StatusBar, Platform } from 'react-native';
import { RootStackParamList, NavigationUser } from '../types/navigation';

// Navigation Stacks
import AuthStack from './AuthStack';
import MainStack from './MainStack';

// Auth Service
import AuthService from '../services/auth';

// Loading Screen
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator<RootStackParamList>();

// Custom Navigation Theme
const AjoturnLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1E40AF',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
    notification: '#EF4444',
  },
};

const AjoturnDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#3B82F6',
    background: '#111827',
    card: '#1F2937',
    text: '#F9FAFB',
    border: '#374151',
    notification: '#F87171',
  },
};

// Deep Linking Configuration
const linking = {
  prefixes: ['ajoturn://', 'https://ajoturn.app'],
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

interface RootNavigatorProps {
  onReady?: () => void;
}

const RootNavigator: React.FC<RootNavigatorProps> = ({ onReady }) => {
  const scheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<NavigationUser | null>(null);

  // Initialize app and check authentication state
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if user is already authenticated
        const currentUser = AuthService.getCurrentUser();
        
        if (currentUser) {
          // Get user profile from database
          const userProfile = await AuthService.getUserProfile(currentUser.uid);
          
          if (userProfile) {
            setUser({
              ...userProfile,
              isAuthenticated: true,
            });
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        const userProfile = await AuthService.getUserProfile(firebaseUser.uid);
        
        if (userProfile) {
          setUser({
            ...userProfile,
            isAuthenticated: true,
          });
        }
      } else {
        // User is signed out
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  // Show loading screen while initializing
  if (isLoading) {
    return <LoadingScreen />;
  }

  const theme = scheme === 'dark' ? AjoturnDarkTheme : AjoturnLightTheme;

  return (
    <>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.primary}
        translucent={Platform.OS === 'android'}
      />
      <NavigationContainer
        theme={theme}
        linking={linking}
        onReady={onReady}
        fallback={<LoadingScreen />}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            animationTypeForReplace: user?.isAuthenticated ? 'push' : 'pop',
          }}
        >
          {user?.isAuthenticated ? (
            <Stack.Screen
              name="Main"
              component={MainStack}
              options={{
                animationTypeForReplace: 'push',
              }}
            />
          ) : (
            <Stack.Screen
              name="Auth"
              component={AuthStack}
              options={{
                animationTypeForReplace: 'pop',
              }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default RootNavigator;