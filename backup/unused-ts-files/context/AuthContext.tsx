import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { NavigationUser, NavigationContextType } from '../types/navigation';
import FirestoreService from '../services/database/firestoreService';

// Create the Auth Context
const AuthContext = createContext<NavigationContextType | undefined>(undefined);

// Auth Provider Props
interface AuthProviderProps {
  children: React.ReactNode;
}

// Storage Keys
const STORAGE_KEYS = {
  USER_DATA: '@ajoturn_user_data',
  AUTH_STATE: '@ajoturn_auth_state',
};

// Auth Provider Component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<NavigationUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
    
    // Listen for Firebase auth state changes
    const unsubscribe = auth().onAuthStateChanged(handleAuthStateChange);
    
    return () => unsubscribe();
  }, []);

  // Initialize authentication state
  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check if user data exists in AsyncStorage
      const storedUserData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      const storedAuthState = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_STATE);
      
      if (storedUserData && storedAuthState === 'authenticated') {
        const userData = JSON.parse(storedUserData) as NavigationUser;
        setUser(userData);
        setIsAuthenticated(true);
      }
      
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Firebase auth state changes
  const handleAuthStateChange = async (firebaseUser: FirebaseAuthTypes.User | null) => {
    try {
      if (firebaseUser) {
        // User is signed in
        await handleUserSignedIn(firebaseUser);
      } else {
        // User is signed out
        await handleUserSignedOut();
      }
    } catch (error) {
      console.error('Error handling auth state change:', error);
      setIsLoading(false);
    }
  };

  // Handle user signed in
  const handleUserSignedIn = async (firebaseUser: FirebaseAuthTypes.User) => {
    try {
      // Get user data from Firestore
      const userResult = await FirestoreService.getUserById(firebaseUser.uid);
      
      if (userResult.success && userResult.data) {
        const navigationUser: NavigationUser = {
          ...userResult.data,
          isAuthenticated: true,
        };
        
        await login(navigationUser);
      } else {
        // User doesn't exist in Firestore, create new user record
        const newUser = {
          phone: firebaseUser.phoneNumber || '',
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'User',
          bvn_verified: false,
          phone_verified: !!firebaseUser.phoneNumber,
          email_verified: firebaseUser.emailVerified,
          identity_verified: false,
          total_groups: 0,
          total_contributions: 0,
          total_payouts_received: 0,
          reliability_score: 100,
          notification_preferences: {
            push_enabled: true,
            email_enabled: true,
            contribution_reminders: true,
            payout_alerts: true,
          },
        };
        
        const createResult = await FirestoreService.createUser(newUser);
        
        if (createResult.success && createResult.data) {
          const navigationUser: NavigationUser = {
            ...createResult.data,
            isAuthenticated: true,
          };
          
          await login(navigationUser);
        } else {
          throw new Error('Failed to create user profile');
        }
      }
    } catch (error) {
      console.error('Error handling user sign in:', error);
      setIsLoading(false);
    }
  };

  // Handle user signed out
  const handleUserSignedOut = async () => {
    await logout();
  };

  // Login function
  const login = async (userData: NavigationUser) => {
    try {
      // Store user data
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_STATE, 'authenticated');
      
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error storing user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Sign out from Firebase
      await auth().signOut();
      
      // Clear stored data
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
      
      // Reset state
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user function
  const updateUser = async (updates: Partial<NavigationUser>) => {
    try {
      if (!user) return;
      
      const updatedUser = { ...user, ...updates };
      
      // Update in Firestore
      const updateResult = await FirestoreService.updateUser(user.id, updates);
      
      if (updateResult.success) {
        // Update local state and storage
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
        setUser(updatedUser);
      } else {
        console.error('Failed to update user:', updateResult.error);
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  // Context value
  const contextValue: NavigationContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use Auth Context
export function useAuthContext(): NavigationContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}

// Helper functions
export const authHelpers = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return auth().currentUser !== null;
  },
  
  // Get current Firebase user
  getCurrentUser: () => {
    return auth().currentUser;
  },
  
  // Sign in with phone number
  signInWithPhone: async (phoneNumber: string) => {
    try {
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      return { success: true, confirmation };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  // Verify phone number with code
  confirmCode: async (confirmation: any, code: string) => {
    try {
      await confirmation.confirm(code);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  // Sign in with email and password
  signInWithEmail: async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  // Create account with email and password
  createUserWithEmail: async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      
      // Update display name
      if (userCredential.user) {
        await userCredential.user.updateProfile({ displayName });
      }
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  // Send password reset email
  resetPassword: async (email: string) => {
    try {
      await auth().sendPasswordResetEmail(email);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  
  // Update user profile
  updateProfile: async (updates: { displayName?: string; photoURL?: string }) => {
    try {
      const user = auth().currentUser;
      if (user) {
        await user.updateProfile(updates);
        return { success: true };
      }
      return { success: false, error: 'No user logged in' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// Export the context for direct use if needed
export default AuthContext;