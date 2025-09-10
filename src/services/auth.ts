import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import { db } from '../config/firebase';

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
}

class AuthService {
  private confirmResult: FirebaseAuthTypes.ConfirmationResult | null = null;

  // Email/Password Authentication
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<UserProfile | null> {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      if (displayName) {
        await user.updateProfile({ displayName });
      }

      await this.sendEmailVerification();
      
      const userProfile = await this.createUserProfile(user);
      return userProfile;
    } catch (error: any) {
      this.handleAuthError(error);
      return null;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<UserProfile | null> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      return await this.getUserProfile(userCredential.user.uid);
    } catch (error: any) {
      this.handleAuthError(error);
      return null;
    }
  }

  // Phone Authentication
  async signInWithPhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      this.confirmResult = confirmation;
      return true;
    } catch (error: any) {
      this.handleAuthError(error);
      return false;
    }
  }

  async confirmPhoneCode(code: string): Promise<UserProfile | null> {
    try {
      if (!this.confirmResult) {
        throw new Error('No phone verification in progress');
      }

      const userCredential = await this.confirmResult.confirm(code);
      const userProfile = await this.createUserProfile(userCredential.user);
      this.confirmResult = null;
      return userProfile;
    } catch (error: any) {
      this.handleAuthError(error);
      return null;
    }
  }

  // Email Verification
  async sendEmailVerification(): Promise<void> {
    const user = auth().currentUser;
    if (user && !user.emailVerified) {
      await user.sendEmailVerification();
    }
  }

  // Password Reset
  async resetPassword(email: string): Promise<boolean> {
    try {
      await auth().sendPasswordResetEmail(email);
      Alert.alert('Success', 'Password reset email sent');
      return true;
    } catch (error: any) {
      this.handleAuthError(error);
      return false;
    }
  }

  // Sign Out
  async signOut(): Promise<void> {
    try {
      await auth().signOut();
    } catch (error: any) {
      this.handleAuthError(error);
    }
  }

  // User Profile Management
  private async createUserProfile(user: FirebaseAuthTypes.User): Promise<UserProfile> {
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || undefined,
      phoneNumber: user.phoneNumber || undefined,
      displayName: user.displayName || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEmailVerified: user.emailVerified,
      isPhoneVerified: !!user.phoneNumber,
    };

    await db.collection('users').doc(user.uid).set(userProfile);
    return userProfile;
  }

  async createCustomUserProfile(userData: {
    uid: string;
    name: string;
    email: string;
    phone: string;
    phone_verified?: boolean;
  }): Promise<UserProfile | null> {
    try {
      const userProfile: UserProfile = {
        uid: userData.uid,
        email: userData.email,
        phoneNumber: userData.phone,
        displayName: userData.name,
        firstName: userData.name.split(' ')[0],
        lastName: userData.name.split(' ').slice(1).join(' '),
        createdAt: new Date(),
        updatedAt: new Date(),
        isEmailVerified: false,
        isPhoneVerified: userData.phone_verified || false,
      };

      await db.collection('users').doc(userData.uid).set(userProfile);
      return userProfile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        return doc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<boolean> {
    try {
      await db.collection('users').doc(uid).update({
        ...updates,
        updatedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  // Get current user
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  // Auth state listener
  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void) {
    return auth().onAuthStateChanged(callback);
  }

  // Error handling
  private handleAuthError(error: any) {
    let message = 'An error occurred during authentication';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'Email address is already in use';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email address';
        break;
      case 'auth/weak-password':
        message = 'Password is too weak';
        break;
      case 'auth/user-not-found':
        message = 'No account found with this email';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Try again later';
        break;
      case 'auth/invalid-phone-number':
        message = 'Invalid phone number format';
        break;
      case 'auth/invalid-verification-code':
        message = 'Invalid verification code';
        break;
      default:
        message = error.message || 'Authentication failed';
    }

    Alert.alert('Authentication Error', message);
    console.error('Auth Error:', error);
  }
}

export default new AuthService();