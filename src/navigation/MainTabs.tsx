import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import Main Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import GroupDetailsScreen from '../screens/main/GroupDetailsScreen'; // Using existing groups screen
import PaymentHistoryScreen from '../screens/main/PaymentHistoryScreen';

// TabBar Icon Component
const TabBarIcon: React.FC<{ focused: boolean; name: string }> = ({ focused, name }) => {
  const getIcon = () => {
    switch (name) {
      case 'Dashboard':
        return 'dashboard';
      case 'Groups':
        return 'group';
      case 'Payments':
        return 'payment';
      case 'Profile':
        return 'person';
      default:
        return 'help';
    }
  };

  return (
    <Icon 
      name={getIcon()} 
      size={24} 
      color={focused ? '#3182ce' : '#9ca3af'} 
    />
  );
};

// Profile Screen Component (placeholder)
const ProfileScreen: React.FC = () => {
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
      padding: 20
    }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2d3748', marginBottom: 10 }}>
        Profile
      </Text>
      <Text style={{ fontSize: 16, color: '#718096', textAlign: 'center' }}>
        User profile settings and information will be displayed here.
      </Text>
    </View>
  );
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabBarIcon focused={focused} name={route.name} />
        ),
        tabBarActiveTintColor: '#3182ce',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingTop: 5,
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: '#3182ce',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        headerTintColor: '#ffffff',
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          headerTitle: 'Ajoturn',
          tabBarLabel: 'Home',
        }}
      />
      
      <Tab.Screen 
        name="Groups" 
        component={GroupDetailsScreen}
        options={{
          title: 'My Groups',
          headerTitle: 'My Groups',
          tabBarLabel: 'Groups',
        }}
      />
      
      <Tab.Screen 
        name="Payments" 
        component={PaymentHistoryScreen}
        options={{
          title: 'Payment History',
          headerTitle: 'Payment History',
          tabBarLabel: 'Payments',
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;