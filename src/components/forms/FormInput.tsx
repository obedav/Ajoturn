import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Control, Controller, FieldError } from 'react-hook-form';

interface FormInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  name: string;
  control: Control<any>;
  label?: string;
  error?: FieldError;
  leftIcon?: string;
  rightIcon?: string;
  rightIconOnPress?: () => void;
  required?: boolean;
  containerStyle?: any;
  inputStyle?: any;
  errorStyle?: any;
  labelStyle?: any;
}

export const FormInput: React.FC<FormInputProps> = ({
  name,
  control,
  label,
  error,
  leftIcon,
  rightIcon,
  rightIconOnPress,
  required = false,
  containerStyle,
  inputStyle,
  errorStyle,
  labelStyle,
  placeholder,
  ...textInputProps
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <View style={[
            styles.inputContainer,
            error && styles.inputContainerError,
          ]}>
            {leftIcon && (
              <Icon
                name={leftIcon}
                size={20}
                color={error ? '#EF4444' : '#6B7280'}
                style={styles.leftIcon}
              />
            )}
            
            <TextInput
              style={[
                styles.textInput,
                inputStyle,
                leftIcon && styles.textInputWithLeftIcon,
                rightIcon && styles.textInputWithRightIcon,
              ]}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              {...textInputProps}
            />
            
            {rightIcon && (
              <TouchableOpacity
                onPress={rightIconOnPress}
                style={styles.rightIconContainer}
              >
                <Icon
                  name={rightIcon}
                  size={20}
                  color={error ? '#EF4444' : '#6B7280'}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      
      {error && (
        <Text style={[styles.errorText, errorStyle]}>
          {error.message}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  leftIcon: {
    marginRight: 12,
  },
  rightIconContainer: {
    padding: 4,
  },
  textInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  textInputWithLeftIcon: {
    paddingLeft: 0,
  },
  textInputWithRightIcon: {
    paddingRight: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
});