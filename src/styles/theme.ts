import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive dimensions
const scale = (size: number) => (SCREEN_WIDTH / 320) * size;
const verticalScale = (size: number) => (SCREEN_HEIGHT / 568) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export const theme = {
  // Colors
  colors: {
    // Primary brand colors
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#1E40AF', // Main primary
      700: '#1D4ED8',
      800: '#1E3A8A',
      900: '#1E40AF',
    },
    
    // Success colors
    success: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#14532D',
    },
    
    // Warning colors
    warning: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
      800: '#92400E',
      900: '#78350F',
    },
    
    // Error colors
    error: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
      800: '#991B1B',
      900: '#7F1D1D',
    },
    
    // Neutral colors
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    
    // Semantic colors
    background: '#FFFFFF',
    surface: '#F9FAFB',
    text: {
      primary: '#111827',
      secondary: '#4B5563',
      tertiary: '#6B7280',
      disabled: '#9CA3AF',
    },
    border: '#E5E7EB',
    divider: '#F3F4F6',
    overlay: 'rgba(0, 0, 0, 0.5)',
    
    // Status colors
    online: '#22C55E',
    offline: '#6B7280',
    pending: '#F59E0B',
    
    // Financial colors
    money: {
      positive: '#22C55E',
      negative: '#EF4444',
      neutral: '#6B7280',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },
    
    fontSize: {
      xs: moderateScale(12),
      sm: moderateScale(14),
      base: moderateScale(16),
      lg: moderateScale(18),
      xl: moderateScale(20),
      '2xl': moderateScale(24),
      '3xl': moderateScale(30),
      '4xl': moderateScale(36),
      '5xl': moderateScale(48),
    },
    
    lineHeight: {
      xs: moderateScale(16),
      sm: moderateScale(20),
      base: moderateScale(24),
      lg: moderateScale(28),
      xl: moderateScale(28),
      '2xl': moderateScale(32),
      '3xl': moderateScale(36),
      '4xl': moderateScale(40),
      '5xl': moderateScale(56),
    },
    
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },

  // Spacing
  spacing: {
    xs: moderateScale(4),
    sm: moderateScale(8),
    md: moderateScale(12),
    lg: moderateScale(16),
    xl: moderateScale(20),
    '2xl': moderateScale(24),
    '3xl': moderateScale(32),
    '4xl': moderateScale(40),
    '5xl': moderateScale(48),
    '6xl': moderateScale(64),
  },

  // Border radius
  borderRadius: {
    none: 0,
    sm: moderateScale(4),
    base: moderateScale(6),
    md: moderateScale(8),
    lg: moderateScale(12),
    xl: moderateScale(16),
    '2xl': moderateScale(20),
    full: 999,
  },

  // Shadows
  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    base: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.15,
      shadowRadius: 15,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 20,
      },
      shadowOpacity: 0.25,
      shadowRadius: 25,
      elevation: 12,
    },
  },

  // Layout
  layout: {
    window: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    },
    isSmallDevice: SCREEN_WIDTH < 375,
    isLargeDevice: SCREEN_WIDTH > 414,
    headerHeight: moderateScale(56),
    tabBarHeight: moderateScale(60),
    safeAreaTop: moderateScale(44),
    safeAreaBottom: moderateScale(34),
  },

  // Animation timing
  animation: {
    fast: 150,
    normal: 250,
    slow: 350,
  },

  // Component specific styles
  components: {
    button: {
      height: {
        sm: moderateScale(32),
        md: moderateScale(40),
        lg: moderateScale(48),
      },
      padding: {
        sm: moderateScale(8),
        md: moderateScale(12),
        lg: moderateScale(16),
      },
    },
    
    input: {
      height: moderateScale(48),
      padding: moderateScale(16),
      borderRadius: moderateScale(12),
    },
    
    card: {
      padding: moderateScale(16),
      borderRadius: moderateScale(12),
      margin: moderateScale(8),
    },
  },

  // Breakpoints for responsive design
  breakpoints: {
    sm: 376,
    md: 768,
    lg: 1024,
  },
};

// Utility functions
export const getResponsiveSize = (size: number) => moderateScale(size);

export const getColorVariant = (color: keyof typeof theme.colors, variant: number = 600) => {
  const colorObj = theme.colors[color];
  if (typeof colorObj === 'object' && colorObj !== null) {
    return colorObj[variant as keyof typeof colorObj] || colorObj[600];
  }
  return colorObj;
};

// Common style utilities
export const commonStyles = {
  // Flexbox utilities
  flex: {
    row: { flexDirection: 'row' as const },
    column: { flexDirection: 'column' as const },
    center: { justifyContent: 'center' as const, alignItems: 'center' as const },
    spaceBetween: { justifyContent: 'space-between' as const },
    spaceAround: { justifyContent: 'space-around' as const },
    alignCenter: { alignItems: 'center' as const },
    alignStart: { alignItems: 'flex-start' as const },
    alignEnd: { alignItems: 'flex-end' as const },
    justifyCenter: { justifyContent: 'center' as const },
    justifyStart: { justifyContent: 'flex-start' as const },
    justifyEnd: { justifyContent: 'flex-end' as const },
  },

  // Text utilities
  text: {
    center: { textAlign: 'center' as const },
    left: { textAlign: 'left' as const },
    right: { textAlign: 'right' as const },
    primary: { color: theme.colors.text.primary },
    secondary: { color: theme.colors.text.secondary },
    tertiary: { color: theme.colors.text.tertiary },
    white: { color: '#FFFFFF' },
    error: { color: theme.colors.error[600] },
    success: { color: theme.colors.success[600] },
    warning: { color: theme.colors.warning[600] },
  },

  // Background utilities
  background: {
    primary: { backgroundColor: theme.colors.primary[600] },
    secondary: { backgroundColor: theme.colors.gray[100] },
    success: { backgroundColor: theme.colors.success[600] },
    error: { backgroundColor: theme.colors.error[600] },
    warning: { backgroundColor: theme.colors.warning[600] },
    white: { backgroundColor: '#FFFFFF' },
    transparent: { backgroundColor: 'transparent' },
  },

  // Border utilities
  border: {
    base: { borderWidth: 1, borderColor: theme.colors.border },
    primary: { borderWidth: 1, borderColor: theme.colors.primary[600] },
    error: { borderWidth: 1, borderColor: theme.colors.error[600] },
    success: { borderWidth: 1, borderColor: theme.colors.success[600] },
  },

  // Spacing utilities
  margin: {
    xs: { margin: theme.spacing.xs },
    sm: { margin: theme.spacing.sm },
    md: { margin: theme.spacing.md },
    lg: { margin: theme.spacing.lg },
    xl: { margin: theme.spacing.xl },
  },
  
  padding: {
    xs: { padding: theme.spacing.xs },
    sm: { padding: theme.spacing.sm },
    md: { padding: theme.spacing.md },
    lg: { padding: theme.spacing.lg },
    xl: { padding: theme.spacing.xl },
  },
};