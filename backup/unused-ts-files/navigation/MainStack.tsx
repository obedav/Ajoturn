import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainStackParamList } from '../types/navigation';

// Import screens
import DashboardScreen from '../screens/main/DashboardScreen';
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import JoinGroupScreen from '../screens/main/JoinGroupScreen';
import GroupDetailsScreen from '../screens/main/GroupDetailsScreen';
import PaymentScreen from '../screens/main/PaymentScreen';

const Stack = createStackNavigator<MainStackParamList>();

const MainStack: React.FC = () => {
  const commonScreenOptions = {
    headerStyle: {
      backgroundColor: '#1E40AF',
      elevation: 0,
      shadowOpacity: 0,
      height: Platform.OS === 'ios' ? 100 : 70,
    },
    headerTitleStyle: {
      fontWeight: '600' as const,
      fontSize: 18,
      color: '#FFFFFF',
    },
    headerTintColor: '#FFFFFF',
    headerTitleAlign: 'center' as const,
    cardStyle: { backgroundColor: '#F8FAFC' },
    gestureEnabled: true,
  };

  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={commonScreenOptions}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: 'Ajoturn',
          headerLeft: () => null,
          headerRight: () => (
            <Icon
              name="notifications"
              size={24}
              color="#FFFFFF"
              style={{ marginRight: 16 }}
              onPress={() => {
                // Handle notifications press
                console.log('Notifications pressed');
              }}
            />
          ),
        })}
      />
      
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{
          title: 'Create Group',
          headerBackTitleVisible: false,
          presentation: Platform.OS === 'ios' ? 'modal' : undefined,
        }}
      />
      
      <Stack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{
          title: 'Join Group',
          headerBackTitleVisible: false,
        }}
      />
      
      <Stack.Screen
        name="GroupDetails"
        component={GroupDetailsScreen}
        options={({ route, navigation }) => ({
          title: 'Group Details',
          headerBackTitleVisible: false,
          headerRight: () => (
            <Icon
              name="more-vert"
              size={24}
              color="#FFFFFF"
              style={{ marginRight: 16 }}
              onPress={() => {
                // Handle group options menu
                console.log('Group options pressed');
              }}
            />
          ),
        })}
      />
      
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={({ route }) => ({
          title: 'Make Payment',
          headerBackTitleVisible: false,
          presentation: Platform.OS === 'ios' ? 'modal' : undefined,
          headerRight: () => (
            <Icon
              name="help-outline"
              size={24}
              color="#FFFFFF"
              style={{ marginRight: 16 }}
              onPress={() => {
                // Handle payment help
                console.log('Payment help pressed');
              }}
            />
          ),
        })}
      />
    </Stack.Navigator>
  );
};

export default MainStack;