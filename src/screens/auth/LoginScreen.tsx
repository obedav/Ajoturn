import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LoginScreenProps } from '../../types/navigation';
import AuthService from '../../services/auth';
import { loginSchema } from '../../utils/validation';
import { useErrorHandler } from '../../utils/errorHandler';
import { FormInput } from '../../components/forms/FormInput';
import { LoadingButton } from '../../components/forms/LoadingButton';

interface LoginFormData {
  emailOrPhone: string;
  password: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  
  const { showError, showSuccess, handleAsync } = useErrorHandler();
  
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      emailOrPhone: '',
      password: '',
    },
  });

  const emailOrPhone = watch('emailOrPhone');

  const handleLogin = async (data: LoginFormData) => {
    const result = await handleAsync(async () => {
      if (loginMethod === 'email') {
        const result = await AuthService.signInWithEmail(data.emailOrPhone, data.password);
        if (!result) {
          throw new Error('Login failed. Please check your credentials.');
        }
        return result;
      } else {
        throw new Error('Phone login is coming soon!');
      }
    }, 'Login');

    if (result.success) {
      showSuccess('Welcome back!', 'Login Successful');
    } else if (result.error) {
      showError(result.error);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailOrPhone) {
      showError('Please enter your email address first', 'Reset Password');
      return;
    }

    if (loginMethod === 'email') {
      const result = await handleAsync(async () => {
        await AuthService.resetPassword(emailOrPhone);
      }, 'Password Reset');

      if (result.success) {
        showSuccess('Password reset email sent!', 'Check Your Email');
      } else if (result.error) {
        showError(result.error);
      }
    } else {
      showError('Password reset for phone numbers will be available soon!', 'Coming Soon');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <Text style={styles.appName}>Ajoturn</Text>
            <Text style={styles.subtitle}>Welcome back!</Text>
          </View>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          {/* Login Method Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                loginMethod === 'email' && styles.toggleButtonActive,
              ]}
              onPress={() => setLoginMethod('email')}
            >
              <Icon
                name="email"
                size={16}
                color={loginMethod === 'email' ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  loginMethod === 'email' && styles.toggleButtonTextActive,
                ]}
              >
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                loginMethod === 'phone' && styles.toggleButtonActive,
              ]}
              onPress={() => setLoginMethod('phone')}
            >
              <Icon
                name="phone"
                size={16}
                color={loginMethod === 'phone' ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  loginMethod === 'phone' && styles.toggleButtonTextActive,
                ]}
              >
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input Fields */}
          <FormInput
            name="emailOrPhone"
            control={control}
            label={loginMethod === 'email' ? 'Email Address' : 'Phone Number'}
            placeholder={loginMethod === 'email' ? 'Enter your email' : 'Enter your phone number'}
            leftIcon={loginMethod === 'email' ? 'email' : 'phone'}
            keyboardType={loginMethod === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.emailOrPhone}
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

          {/* Forgot Password */}
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <LoadingButton
            title="Sign In"
            onPress={handleSubmit(handleLogin)}
            loading={isSubmitting}
            variant="primary"
            size="large"
            fullWidth
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  formContainer: {
    flex: 2,
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#1E40AF',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
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
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
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
  signupLink: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600',
  },
});

export default LoginScreen;