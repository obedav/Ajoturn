import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthStackParamList } from './types';

// Import Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator<AuthStackParamList>();

const AuthStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#f8f9fa' },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        transitionSpec: {
          open: {
            animation: 'timing',
            config: {
              duration: 300,
            },
          },
          close: {
            animation: 'timing',
            config: {
              duration: 300,
            },
          },
        },
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
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          };
        },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          title: 'Login to Ajoturn',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="Signup" 
        component={SignupScreen}
        options={{
          title: 'Create Account',
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="ForgotPassword" 
        component={LoadingScreen} // Placeholder - you can create ForgotPasswordScreen later
        options={{
          title: 'Reset Password',
          headerShown: true,
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: '#f8f9fa',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#2d3748',
          },
          headerTintColor: '#3182ce',
        }}
      />
      
      <Stack.Screen 
        name="PhoneVerification" 
        component={LoadingScreen} // Placeholder - you can create PhoneVerificationScreen later
        options={{
          title: 'Verify Phone Number',
          headerShown: true,
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: '#f8f9fa',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#2d3748',
          },
          headerTintColor: '#3182ce',
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;