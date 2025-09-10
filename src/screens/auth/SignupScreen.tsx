import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SignupScreenProps } from '../../types/navigation';
import AuthService from '../../services/auth';
import PhoneVerificationService from '../../services/phoneVerification';
import PhoneVerificationModal from '../../components/PhoneVerificationModal';
import { signupSchema } from '../../utils/validation';
import { useErrorHandler } from '../../utils/errorHandler';
import { FormInput } from '../../components/forms/FormInput';
import { LoadingButton } from '../../components/forms/LoadingButton';

interface SignupFormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [step, setStep] = useState<'registration' | 'phone_verification'>('registration');

  const { showError, showSuccess, handleAsync } = useErrorHandler();
  
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<SignupFormData>({
    resolver: yupResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleSignup = async (data: SignupFormData) => {
    if (!agreedToTerms) {
      showError('Please agree to the Terms and Conditions');
      return;
    }

    const result = await handleAsync(async () => {
      const user = await AuthService.signUpWithEmail(
        data.email,
        data.password,
        data.fullName,
        data.phone
      );
      
      if (!user) {
        throw new Error('Registration failed. Please try again.');
      }

      return user;
    }, 'Registration');

    if (result.success) {
      showSuccess('Account created successfully!', 'Welcome to Ajoturn');
      // Trigger phone verification
      setStep('phone_verification');
    } else if (result.error) {
      showError(result.error);
    }
  };


  const handlePhoneVerification = async (code: string) => {
    const result = await handleAsync(async () => {
      // Verify the phone code
      const verifyResult = await PhoneVerificationService.verifyCode(code);
      
      if (!verifyResult.success || !verifyResult.data) {
        throw new Error(verifyResult.error || 'Invalid verification code');
      }

      // Phone verified successfully, now create the user profile
      const user = verifyResult.data.user;
      const formData = getValues();
      
      // Create user profile in database
      const userResult = await AuthService.createCustomUserProfile({
        uid: user.uid,
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        phone_verified: true,
      });
      
      if (!userResult) {
        throw new Error('Failed to create user profile');
      }

      return userResult;
    }, 'Phone Verification');

    if (result.success) {
      showSuccess('Account created and phone verified successfully!', 'Welcome to Ajoturn');
      navigation.navigate('Login');
    } else if (result.error) {
      showError(result.error);
    }
  };

  const handleResendCode = async () => {
    const result = await handleAsync(async () => {
      const result = await PhoneVerificationService.resendCode();
      if (!result.success) {
        throw new Error(result.error || 'Failed to resend code');
      }
      return result;
    }, 'Resend Code');

    if (result.success) {
      showSuccess('Verification code resent');
    } else if (result.error) {
      showError(result.error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Ajoturn and start saving with others</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <FormInput
              name="fullName"
              control={control}
              label="Full Name"
              placeholder="Enter your full name"
              leftIcon="person"
              autoCapitalize="words"
              autoCorrect={false}
              error={errors.fullName}
              required
            />

            <FormInput
              name="email"
              control={control}
              label="Email Address"
              placeholder="Enter your email"
              leftIcon="email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              required
            />

            <FormInput
              name="phone"
              control={control}
              label="Phone Number"
              placeholder="Enter your phone number (e.g., +254712345678)"
              leftIcon="phone"
              keyboardType="phone-pad"
              autoCorrect={false}
              error={errors.phone}
              required
            />

            <FormInput
              name="password"
              control={control}
              label="Password"
              placeholder="Enter your password"
              leftIcon="lock"
              rightIcon={showPassword ? 'visibility' : 'visibility-off'}
              rightIconOnPress={() => setShowPassword(!showPassword)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={errors.password}
              required
            />

            <FormInput
              name="confirmPassword"
              control={control}
              label="Confirm Password"
              placeholder="Confirm your password"
              leftIcon="lock"
              rightIcon={showConfirmPassword ? 'visibility' : 'visibility-off'}
              rightIconOnPress={() => setShowConfirmPassword(!showConfirmPassword)}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              error={errors.confirmPassword}
              required
            />

            {/* Terms and Conditions */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <View style={[styles.checkbox, { backgroundColor: agreedToTerms ? '#1E40AF' : '#FFFFFF' }]}>
                {agreedToTerms && (
                  <Icon name="check" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxText}>
                I agree to the{' '}
                <Text style={styles.linkText}>Terms and Conditions</Text>{' '}
                and{' '}
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Signup Button */}
            <LoadingButton
              title="Create Account"
              onPress={handleSubmit(handleSignup)}
              loading={isSubmitting}
              variant="primary"
              size="large"
              fullWidth
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        visible={step === 'phone_verification'}
        phoneNumber={getValues('phone')}
        onVerify={handlePhoneVerification}
        onResend={handleResendCode}
        onCancel={() => {
          setStep('registration');
          PhoneVerificationService.clearVerificationState();
        }}
        isLoading={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#1E40AF',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  linkText: {
    color: '#1E40AF',
    fontWeight: '500',
  },
  signupButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600',
  },
});

export default SignupScreen;