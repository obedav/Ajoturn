import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native';

interface LoadingButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  textStyle?: any;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  title,
  loading = false,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  style,
  textStyle,
  disabled,
  ...props
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[`button_${variant}`], styles[`button_${size}`]];
    
    if (fullWidth) {
      baseStyle.push(styles.fullWidth);
    }
    
    if (disabled || loading) {
      baseStyle.push(styles.disabled);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    return [styles.text, styles[`text_${variant}`], styles[`text_${size}`]];
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={variant === 'outline' || variant === 'secondary' ? '#1E40AF' : '#FFFFFF'}
        />
      ) : (
        <Text style={[...getTextStyle(), textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  
  // Variants
  button_primary: {
    backgroundColor: '#1E40AF',
    borderWidth: 0,
  },
  button_secondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 0,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  button_danger: {
    backgroundColor: '#EF4444',
    borderWidth: 0,
  },
  
  // Sizes
  button_small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button_medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button_large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  
  // Text variants
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: '#1F2937',
  },
  text_outline: {
    color: '#1E40AF',
  },
  text_danger: {
    color: '#FFFFFF',
  },
  
  // Text sizes
  text_small: {
    fontSize: 12,
    fontWeight: '500',
  },
  text_medium: {
    fontSize: 14,
    fontWeight: '600',
  },
  text_large: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // States
  disabled: {
    opacity: 0.6,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    textAlign: 'center',
  },
});