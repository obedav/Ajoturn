import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

// Initialize Firebase App first
import '@react-native-firebase/app';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Fallback configuration for development
const defaultConfig: FirebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-project.firebaseapp.com',
  projectId: 'demo-project-id',
  storageBucket: 'demo-project.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:android:demo-app-id',
};

export const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || defaultConfig.appId,
};

// Firebase service types
export type AuthService = FirebaseAuthTypes.Module;
export type FirestoreService = FirebaseFirestoreTypes.Module;
export type MessagingService = FirebaseMessagingTypes.Module;

// Initialize Firebase services with error handling
let db: FirestoreService | null = null;
let authentication: AuthService | null = null;
let messagingService: MessagingService | null = null;

export const initializeFirebase = async (): Promise<void> => {
  try {
    authentication = auth();
    db = firestore();
    messagingService = messaging();
    
    console.log('Firebase services initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// Safe getters for Firebase services
export const getAuth = (): AuthService => {
  if (!authentication) {
    throw new Error('Firebase Auth not initialized. Call initializeFirebase() first.');
  }
  return authentication;
};

export const getFirestore = (): FirestoreService => {
  if (!db) {
    throw new Error('Firebase Firestore not initialized. Call initializeFirebase() first.');
  }
  return db;
};

export const getMessaging = (): MessagingService => {
  if (!messagingService) {
    throw new Error('Firebase Messaging not initialized. Call initializeFirebase() first.');
  }
  return messagingService;
};

// Legacy exports for backward compatibility
export { db, authentication, messagingService };

export default {
  auth: authentication,
  firestore: db,
  messaging: messagingService,
  initializeFirebase,
  getAuth,
  getFirestore,
  getMessaging,
};