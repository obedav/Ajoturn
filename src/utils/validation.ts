import * as yup from 'yup';

export const validationSchemas = {
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('Password is required'),
  
  phone: yup
    .string()
    .matches(
      /^(\+254|0)[7][0-9]{8}$/,
      'Please enter a valid Kenyan phone number'
    )
    .required('Phone number is required'),
  
  name: yup
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .required('Name is required'),
  
  groupName: yup
    .string()
    .min(3, 'Group name must be at least 3 characters')
    .max(30, 'Group name cannot exceed 30 characters')
    .required('Group name is required'),
  
  amount: yup
    .number()
    .positive('Amount must be positive')
    .min(100, 'Minimum amount is KES 100')
    .max(1000000, 'Maximum amount is KES 1,000,000')
    .required('Amount is required'),
  
  contributionAmount: yup
    .number()
    .positive('Contribution amount must be positive')
    .min(50, 'Minimum contribution is KES 50')
    .max(100000, 'Maximum contribution is KES 100,000')
    .required('Contribution amount is required'),
  
  groupSize: yup
    .number()
    .integer('Group size must be a whole number')
    .min(3, 'Minimum group size is 3 members')
    .max(20, 'Maximum group size is 20 members')
    .required('Group size is required'),
};

export const loginSchema = yup.object({
  emailOrPhone: yup
    .string()
    .required('Email or phone number is required')
    .test('email-or-phone', 'Please enter a valid email or phone number', function(value) {
      if (!value) return false;
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^(\+254|0)[7][0-9]{8}$/;
      
      return emailRegex.test(value) || phoneRegex.test(value);
    }),
  password: validationSchemas.password,
});

export const signupSchema = yup.object({
  fullName: validationSchemas.name,
  email: validationSchemas.email,
  phone: validationSchemas.phone,
  password: validationSchemas.password,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

export const createGroupSchema = yup.object({
  name: validationSchemas.groupName,
  description: yup
    .string()
    .max(200, 'Description cannot exceed 200 characters')
    .optional(),
  contributionAmount: validationSchemas.contributionAmount,
  maxMembers: validationSchemas.groupSize,
  paymentDay: yup
    .number()
    .integer('Payment day must be a whole number')
    .min(1, 'Payment day must be between 1 and 28')
    .max(28, 'Payment day must be between 1 and 28')
    .required('Payment day is required'),
});

export const joinGroupSchema = yup.object({
  inviteCode: yup
    .string()
    .length(8, 'Invite code must be 8 characters')
    .matches(/^[A-Z0-9]+$/, 'Invite code must contain only uppercase letters and numbers')
    .required('Invite code is required'),
});

export const paymentSchema = yup.object({
  amount: validationSchemas.amount,
  mpesaPhone: yup
    .string()
    .matches(
      /^(\+254|0)[7][0-9]{8}$/,
      'Please enter a valid M-Pesa phone number'
    )
    .required('M-Pesa phone number is required'),
});

// Utility function to format validation errors
export const formatValidationError = (error: yup.ValidationError): string => {
  return error.errors?.[0] || 'Validation error occurred';
};

// Utility function to validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Utility function to validate Kenyan phone number
export const isValidKenyanPhone = (phone: string): boolean => {
  const phoneRegex = /^(\+254|0)[7][0-9]{8}$/;
  return phoneRegex.test(phone);
};

// Utility function to format phone number to international format
export const formatPhoneNumber = (phone: string): string => {
  if (phone.startsWith('0')) {
    return `+254${phone.substring(1)}`;
  }
  if (phone.startsWith('254')) {
    return `+${phone}`;
  }
  if (phone.startsWith('+254')) {
    return phone;
  }
  return phone;
};

// Utility function to format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Utility function to parse currency input
export const parseCurrencyInput = (input: string): number => {
  const cleaned = input.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
};