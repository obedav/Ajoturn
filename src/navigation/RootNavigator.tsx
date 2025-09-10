import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from './types';

// Import Navigators
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Loading"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#f8f9fa' },
        gestureEnabled: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen 
        name="Loading" 
        component={LoadingScreen}
        options={{
          animationTypeForReplace: 'push',
        }}
      />
      
      <Stack.Screen 
        name="Auth" 
        component={AuthStack}
        options={{
          animationTypeForReplace: 'push',
          gestureEnabled: false,
        }}
      />
      
      <Stack.Screen 
        name="Main" 
        component={MainStack}
        options={{
          animationTypeForReplace: 'push',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;