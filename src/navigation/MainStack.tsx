import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MainStackParamList } from './types';

// Import Main Tabs
import MainTabs from './MainTabs';

// Import Modal Screens
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import JoinGroupScreen from '../screens/main/JoinGroupScreen';
import GroupDetailsScreen from '../screens/main/GroupDetailsScreen';
import PaymentScreen from '../screens/main/PaymentScreen';
import PaymentHistoryScreen from '../screens/main/PaymentHistoryScreen';
import GroupSettingsScreen from '../screens/main/GroupSettingsScreen';
import MemberProfileScreen from '../screens/main/MemberProfileScreen';
import GroupInviteScreen from '../screens/main/GroupInviteScreen';
import PaymentConfirmationScreen from '../screens/main/PaymentConfirmationScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import HelpScreen from '../screens/main/HelpScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Stack = createStackNavigator<MainStackParamList>();

const MainStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#3182ce',
          elevation: 4,
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        headerTintColor: '#ffffff',
        headerBackTitleVisible: false,
        cardStyle: { backgroundColor: '#f8f9fa' },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{
          headerShown: false,
        }}
      />
      
      <Stack.Screen 
        name="CreateGroup" 
        component={CreateGroupScreen}
        options={{
          title: 'Create New Group',
          headerTitle: 'Create Savings Group',
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      
      <Stack.Screen 
        name="JoinGroup" 
        component={JoinGroupScreen}
        options={{
          title: 'Join Group',
          headerTitle: 'Join Savings Group',
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      
      <Stack.Screen 
        name="GroupDetails" 
        component={GroupDetailsScreen}
        options={({ route }) => ({
          title: route.params?.groupName || 'Group Details',
          headerTitle: route.params?.groupName || 'Group Details',
        })}
      />
      
      <Stack.Screen 
        name="Payment" 
        component={PaymentScreen}
        options={{
          title: 'Make Payment',
          headerTitle: 'Contribution Payment',
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      
      <Stack.Screen 
        name="PaymentHistory" 
        component={PaymentHistoryScreen}
        options={{
          title: 'Payment History',
          headerTitle: 'Payment History',
        }}
      />
      
      <Stack.Screen 
        name="GroupSettings" 
        component={GroupSettingsScreen}
        options={{
          title: 'Group Settings',
          headerTitle: 'Group Settings',
        }}
      />
      
      <Stack.Screen 
        name="MemberProfile" 
        component={MemberProfileScreen}
        options={{
          title: 'Member Profile',
          headerTitle: 'Member Details',
        }}
      />
      
      <Stack.Screen 
        name="GroupInvite" 
        component={GroupInviteScreen}
        options={{
          title: 'Invite Members',
          headerTitle: 'Invite to Group',
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      
      <Stack.Screen 
        name="PaymentConfirmation" 
        component={PaymentConfirmationScreen}
        options={{
          title: 'Payment Confirmation',
          headerTitle: 'Payment Successful',
          presentation: 'modal',
          gestureEnabled: false,
          headerLeft: () => null,
        }}
      />
      
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{
          title: 'Edit Profile',
          headerTitle: 'Edit Profile',
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerTitle: 'Notifications',
        }}
      />
      
      <Stack.Screen 
        name="Help" 
        component={HelpScreen}
        options={{
          title: 'Help & Support',
          headerTitle: 'Help & Support',
        }}
      />
      
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitle: 'App Settings',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainStack;