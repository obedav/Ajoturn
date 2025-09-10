import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

// Import Navigation
import RootNavigator from './src/navigation/RootNavigator';

// Import Navigation Reference for deep linking
import { navigationRef } from './src/navigation/navigationRef';

// Import Context Providers
import { AuthProvider } from './src/contexts/AuthContext';
import { GroupProvider } from './src/contexts/GroupContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

const App: React.FC = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Handle user state changes
  function onAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, [initializing]);

  if (initializing) {
    // Return a loading screen or splash screen
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#3182ce"
        translucent={false}
      />
      
      <AuthProvider initialUser={user}>
        <GroupProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </NotificationProvider>
        </GroupProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;