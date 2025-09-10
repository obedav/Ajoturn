import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { BusinessLogicResult } from '../types/business';

export interface PhoneVerificationResult {
  verificationId: string;
  phoneNumber: string;
}

export interface PhoneVerificationError {
  code: string;
  message: string;
}

class PhoneVerificationService {
  private verificationId: string | null = null;
  private phoneNumber: string | null = null;

  /**
   * Send verification code to phone number
   * @param phoneNumber - Nigerian phone number (e.g., +2348012345678)
   * @returns Verification ID for code confirmation
   */
  async sendVerificationCode(phoneNumber: string): Promise<BusinessLogicResult<PhoneVerificationResult>> {
    try {
      // Validate Nigerian phone number format
      const formattedPhone = this.formatNigerianPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return {
          success: false,
          error: 'Invalid Nigerian phone number format. Use format: 08012345678 or +2348012345678',
          code: 'INVALID_PHONE_FORMAT',
        };
      }

      console.log(`Sending verification code to: ${formattedPhone}`);

      // Send verification code using Firebase Auth
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      
      this.verificationId = confirmation.verificationId;
      this.phoneNumber = formattedPhone;

      return {
        success: true,
        data: {
          verificationId: confirmation.verificationId,
          phoneNumber: formattedPhone,
        },
      };
    } catch (error: any) {
      console.error('Phone verification error:', error);
      
      let errorMessage = 'Failed to send verification code';
      let errorCode = 'VERIFICATION_FAILED';

      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format';
        errorCode = 'INVALID_PHONE_NUMBER';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later';
        errorCode = 'TOO_MANY_REQUESTS';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later';
        errorCode = 'QUOTA_EXCEEDED';
      }

      return {
        success: false,
        error: errorMessage,
        code: errorCode,
      };
    }
  }

  /**
   * Verify the SMS code entered by user
   * @param code - 6-digit verification code
   * @returns Firebase user credential
   */
  async verifyCode(code: string): Promise<BusinessLogicResult<FirebaseAuthTypes.UserCredential>> {
    try {
      if (!this.verificationId) {
        return {
          success: false,
          error: 'No verification in progress. Please request a new code',
          code: 'NO_VERIFICATION_IN_PROGRESS',
        };
      }

      // Validate code format
      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        return {
          success: false,
          error: 'Please enter a valid 6-digit code',
          code: 'INVALID_CODE_FORMAT',
        };
      }

      console.log(`Verifying code: ${code} for verification ID: ${this.verificationId}`);

      // Create credential and sign in
      const credential = auth.PhoneAuthProvider.credential(this.verificationId, code);
      const userCredential = await auth().signInWithCredential(credential);

      // Clear verification state
      this.verificationId = null;
      this.phoneNumber = null;

      return {
        success: true,
        data: userCredential,
      };
    } catch (error: any) {
      console.error('Code verification error:', error);

      let errorMessage = 'Invalid verification code';
      let errorCode = 'INVALID_CODE';

      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code. Please check and try again';
        errorCode = 'INVALID_VERIFICATION_CODE';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Verification code has expired. Please request a new code';
        errorCode = 'CODE_EXPIRED';
      } else if (error.code === 'auth/session-expired') {
        errorMessage = 'Verification session expired. Please start again';
        errorCode = 'SESSION_EXPIRED';
      }

      return {
        success: false,
        error: errorMessage,
        code: errorCode,
      };
    }
  }

  /**
   * Resend verification code
   * @returns New verification result
   */
  async resendCode(): Promise<BusinessLogicResult<PhoneVerificationResult>> {
    if (!this.phoneNumber) {
      return {
        success: false,
        error: 'No phone number to resend to. Please start verification again',
        code: 'NO_PHONE_NUMBER',
      };
    }

    return this.sendVerificationCode(this.phoneNumber);
  }

  /**
   * Format Nigerian phone number to international format
   * @param phoneNumber - Phone number in various formats
   * @returns Formatted phone number or null if invalid
   */
  private formatNigerianPhoneNumber(phoneNumber: string): string | null {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // Handle different Nigerian phone number formats
    if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
      // Format: 08012345678 -> +2348012345678
      return '+234' + digitsOnly.substring(1);
    } else if (digitsOnly.length === 10) {
      // Format: 8012345678 -> +2348012345678
      return '+234' + digitsOnly;
    } else if (digitsOnly.length === 13 && digitsOnly.startsWith('234')) {
      // Format: 2348012345678 -> +2348012345678
      return '+' + digitsOnly;
    } else if (digitsOnly.length === 14 && digitsOnly.startsWith('234')) {
      // Already in correct format: +2348012345678
      return phoneNumber;
    }

    return null; // Invalid format
  }

  /**
   * Validate if phone number is Nigerian
   * @param phoneNumber - Phone number to validate
   * @returns Boolean indicating if valid Nigerian number
   */
  isValidNigerianPhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatNigerianPhoneNumber(phoneNumber);
    return formatted !== null;
  }

  /**
   * Get current verification state
   * @returns Current verification details
   */
  getVerificationState(): { hasActiveVerification: boolean; phoneNumber: string | null } {
    return {
      hasActiveVerification: this.verificationId !== null,
      phoneNumber: this.phoneNumber,
    };
  }

  /**
   * Clear verification state
   */
  clearVerificationState(): void {
    this.verificationId = null;
    this.phoneNumber = null;
  }

  /**
   * Check if phone number is already registered
   * @param phoneNumber - Phone number to check
   * @returns Whether phone number exists in system
   */
  async isPhoneNumberRegistered(phoneNumber: string): Promise<BusinessLogicResult<boolean>> {
    try {
      const formattedPhone = this.formatNigerianPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return {
          success: false,
          error: 'Invalid phone number format',
          code: 'INVALID_PHONE_FORMAT',
        };
      }

      // In a real implementation, you would check your user database
      // For now, we'll use Firebase Auth methods if available
      const methods = await auth().fetchSignInMethodsForEmail(`${formattedPhone}@phone.local`);
      
      return {
        success: true,
        data: methods.length > 0,
      };
    } catch (error) {
      console.error('Error checking phone registration:', error);
      return {
        success: false,
        error: 'Failed to check phone registration status',
        code: 'CHECK_REGISTRATION_FAILED',
      };
    }
  }
}

export default new PhoneVerificationService();