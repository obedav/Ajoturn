import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import navigation components
import AuthStack from './src/navigation/AuthStack';
import MainStack from './src/navigation/MainStack';
import LoadingScreen from './src/screens/LoadingScreen';

// Import services for initialization
import AuthService from './src/services/auth';
import { initializeFirebase } from './src/config/firebase';

// Import types
import { RootStackParamList } from './src/navigation/types';

const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase
        await initializeFirebase();
        console.log('🔥 Firebase initialized successfully');
        
        // Check authentication status
        const currentUser = AuthService.getCurrentUser();
        setIsAuthenticated(!!currentUser);
        
        // Add a small delay for better UX
        setTimeout(() => {
          setIsLoading(false);
        }, 2000);
      } catch (error) {
        console.error('App initialization error:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
    
    // Listen to auth state changes
    const unsubscribe = AuthService.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (!isLoading) {
        // Only update loading state if we're not in initial loading
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isLoading]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoading ? (
            <Stack.Screen name="Loading" component={LoadingScreen} />
          ) : isAuthenticated ? (
            <Stack.Screen name="Main" component={MainStack} />
          ) : (
            <Stack.Screen name="Auth" component={AuthStack} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;