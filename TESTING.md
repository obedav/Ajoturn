# Ajoturn MVP - Testing Guide

This guide provides comprehensive instructions for testing the Ajoturn MVP on devices.

## Prerequisites

### Development Environment
- Node.js 20+
- React Native CLI
- Android Studio (for Android testing)
- Xcode (for iOS testing - macOS only)
- Java Development Kit (JDK) 17+

### Device Requirements
- Android 8.0+ (API level 26+)
- iOS 12.0+ (for iOS testing)
- Minimum 2GB RAM recommended
- 100MB+ available storage

## Initial Setup

### 1. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# - Firebase credentials
# - M-Pesa keys (if testing payments)
# - SMS provider keys (if testing notifications)
```

### 2. Install Dependencies
```bash
# Install npm dependencies
npm install

# For iOS (macOS only)
cd ios && pod install && cd ..
```

### 3. Clean Build (if needed)
```bash
# Clean everything
npm run clean

# Or clean specific platforms
npm run clean:android
npm run clean:ios
```

## Android Testing

### 1. Enable Developer Mode
1. Go to Settings → About Phone
2. Tap "Build Number" 7 times
3. Enable "USB Debugging" in Developer Options

### 2. Build and Install
```bash
# For debug build (recommended for testing)
npm run build:android:debug

# Install on connected device
npm run android

# Or specific device
npx react-native run-android --deviceId="DEVICE_ID"
```

### 3. Generate APK for Distribution
```bash
# Build release APK
npm run build:android:release

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

## iOS Testing (macOS only)

### 1. Setup Device for Testing
1. Connect device via USB
2. Trust the computer when prompted
3. In Xcode, add your Apple Developer Account
4. Select your development team

### 2. Build and Install
```bash
# For debug build
npm run build:ios:debug

# For release build
npm run build:ios:release

# Or use Xcode
# Open ios/Ajoturn.xcworkspace in Xcode
# Select your device and click Run
```

## Testing Features

### 1. Form Validation Testing
- **Login Screen**: Try invalid emails, weak passwords
- **Signup Screen**: Test password confirmation, phone number validation
- **Group Creation**: Test various input combinations
- **Payment Forms**: Test amount validation, phone number formats

### 2. Network Connectivity Testing
```bash
# Enable airplane mode to test offline functionality
# App should show cached data and queue actions
```

### 3. Error Handling Testing
- Force close the app during operations
- Try operations with poor network
- Test with invalid Firebase credentials
- Test with malformed API responses

### 4. Performance Testing
- Test with multiple groups (if available)
- Test rapid navigation between screens
- Monitor memory usage in development tools

### 5. Crash Testing (Development Only)
```javascript
// In development, you can trigger a test crash
// Open Chrome DevTools connected to the app
devUtils.generateTestData(); // Generate mock data
DevLogger.info('Testing crash reporting');
```

## Build Variants

### Debug Build
```bash
npm run prepare:testing
```
Features:
- Development tools enabled
- Detailed logging
- Crashlytics in test mode
- Mock data available

### Release Build
```bash
npm run prepare:release
```
Features:
- Production optimizations
- Minimal logging
- Crashlytics enabled
- Real API endpoints

## Common Issues & Troubleshooting

### Android Issues

#### Build Failures
```bash
# Clear gradle cache
cd android && ./gradlew clean && cd ..

# Reset metro cache
npx react-native start --reset-cache
```

#### APK Installation Failed
```bash
# Check device connection
adb devices

# Uninstall previous version
adb uninstall com.ajoturn

# Reinstall
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Metro Connection Issues
```bash
# Port forwarding for device testing
adb reverse tcp:8081 tcp:8081
```

### iOS Issues (macOS only)

#### Code Signing Issues
1. Open Xcode
2. Select project → Signing & Capabilities
3. Select your development team
4. Ensure Bundle Identifier is unique

#### Pod Installation Issues
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### General Issues

#### Metro Bundler Issues
```bash
# Clear all caches
npx react-native start --reset-cache
rm -rf node_modules
npm install
```

#### Firebase Connection Issues
1. Verify `google-services.json` (Android) is in `android/app/`
2. Verify `GoogleService-Info.plist` (iOS) is in iOS project
3. Check Firebase project configuration

## Testing Checklist

### Core Functionality
- [ ] App launches successfully
- [ ] User registration with email
- [ ] User login with email
- [ ] Form validation working
- [ ] Error messages displayed correctly
- [ ] Loading states visible during operations

### Network & Offline
- [ ] App works with good internet connection
- [ ] Cached data displayed when offline
- [ ] Network status indicator working
- [ ] Actions queued when offline
- [ ] Queued actions processed when back online

### UI/UX
- [ ] All screens render correctly
- [ ] Navigation between screens smooth
- [ ] Forms are responsive
- [ ] Toast messages appear for feedback
- [ ] Loading indicators show during operations

### Error Handling
- [ ] Graceful handling of network errors
- [ ] User-friendly error messages
- [ ] App doesn't crash on errors
- [ ] Crash reporting working (check Firebase console)

### Performance
- [ ] App starts within 3 seconds
- [ ] Navigation transitions smooth
- [ ] No memory leaks during extended use
- [ ] Battery usage reasonable

## Device Testing Matrix

| Feature | Android 8+ | Android 10+ | iOS 12+ | iOS 15+ |
|---------|------------|-------------|---------|---------|
| Authentication | ✓ | ✓ | ✓ | ✓ |
| Form Validation | ✓ | ✓ | ✓ | ✓ |
| Offline Mode | ✓ | ✓ | ✓ | ✓ |
| Push Notifications | ✓ | ✓ | ✓ | ✓ |
| Biometric Auth | ✓ | ✓ | ✓ | ✓ |

## Deployment Preparation

### Android Release
1. Generate signed APK
2. Test on multiple devices
3. Upload to Google Play Console (Internal Testing)
4. Validate with Play Console pre-launch reports

### iOS Release (macOS only)
1. Archive build in Xcode
2. Upload to TestFlight
3. Test with TestFlight beta users
4. Submit for App Store Review

## Support

For testing issues, check:
1. This testing guide
2. React Native troubleshooting docs
3. Firebase console for backend issues
4. Device logs for crash information

## Test Data

The app includes mock data for testing:
- Test user: `test@ajoturn.com` / `password123`
- Sample groups and payment data available in development mode

Enable mock data by setting `MOCK_API_CALLS=true` in development config.