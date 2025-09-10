# Firebase Setup Instructions for Ajoturn

## 🔥 Firebase Console Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `ajoturn-app`
4. Enable Google Analytics (recommended)
5. Wait for project creation

### 2. Add Android App
1. Click "Add app" → Android icon
2. Enter package name from `android/app/build.gradle`: `com.ajoturn`
3. Enter app nickname: `Ajoturn Android`
4. Download `google-services.json`
5. Place file in `android/app/` folder

### 3. Add iOS App (if needed)
1. Click "Add app" → iOS icon
2. Enter bundle ID from `ios/Ajoturn/Info.plist`: `com.ajoturn`
3. Enter app nickname: `Ajoturn iOS`
4. Download `GoogleService-Info.plist`
5. Add file to iOS project in Xcode

## 🔐 Authentication Setup

### 1. Enable Authentication Providers
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable **Email/Password**:
   - Click Email/Password → Enable → Save
3. Enable **Phone Authentication**:
   - Click Phone → Enable
   - Add test phone numbers if needed
   - Save

### 2. Configure Authorized Domains
1. In Authentication → Settings → Authorized domains
2. Add your domains (localhost is already included)

## 📱 Android Configuration

### 1. Update `android/app/build.gradle`
Add at the bottom:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 2. Update `android/build.gradle`
Add to dependencies:
```gradle
dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
}
```

### 3. Enable Multidex (if needed)
In `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        multiDexEnabled true
    }
}

dependencies {
    implementation 'androidx.multidex:multidex:2.0.1'
}
```

## 🍎 iOS Configuration

### 1. Install CocoaPods Dependencies
```bash
cd ios && pod install && cd ..
```

### 2. Add Capabilities in Xcode
1. Open `ios/Ajoturn.xcworkspace` in Xcode
2. Select project → Target → Signing & Capabilities
3. Add **Push Notifications** capability
4. Add **Background Modes** capability:
   - Background fetch
   - Background processing
   - Remote notifications

## 🔒 Firestore Database Setup

### 1. Create Database
1. Go to Firestore Database → Create database
2. Choose **Test mode** initially (we'll update security rules)
3. Select a location (closest to your users)

### 2. Deploy Security Rules
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init firestore

# Deploy security rules
firebase deploy --only firestore:rules
```

### 3. Create Initial Collections
The app will create these collections automatically:
- `users` - User profiles
- `savingsGroups` - Savings groups data
- `contributions` - Payment contributions
- `payouts` - Payout records
- `notifications` - Push notifications

## 📨 Cloud Messaging Setup

### 1. Enable Cloud Messaging
1. Go to Cloud Messaging in Firebase Console
2. Cloud Messaging API should be automatically enabled

### 2. Configure APNs (iOS only)
1. Go to Project Settings → Cloud Messaging
2. Upload your APNs authentication key or certificate
3. Enter Team ID and Key ID

## 🌍 Environment Variables

### 1. Copy Environment File
```bash
cp .env.example .env
```

### 2. Get Firebase Config Values
1. Go to Project Settings → General
2. Scroll to "Your apps" section
3. Click the web app config icon
4. Copy the config values to your `.env` file:

```env
FIREBASE_API_KEY=AIzaSyC...
FIREBASE_AUTH_DOMAIN=ajoturn-app.firebaseapp.com
FIREBASE_PROJECT_ID=ajoturn-app
FIREBASE_STORAGE_BUCKET=ajoturn-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef...
```

## 🧪 Testing Setup

### 1. Authentication Testing
```bash
# Test email/password signup
# Test phone number verification
# Test user profile creation
```

### 2. Firestore Testing
```bash
# Test creating savings groups
# Test joining groups
# Test making contributions
# Test security rules
```

### 3. Push Notifications Testing
```bash
# Test notification permissions
# Test foreground notifications
# Test background notifications
# Test notification opening
```

## 🚀 Production Deployment

### 1. Update Security Rules
Deploy production-ready Firestore rules:
```bash
firebase deploy --only firestore:rules
```

### 2. Environment Configuration
- Set production environment variables
- Update API keys and secrets
- Configure production domains

### 3. App Store Configuration
- Upload production APNs certificates
- Configure OAuth redirects
- Update authorized domains

## 🔧 Common Issues & Solutions

### Android Build Issues
```bash
# Clean and rebuild
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### iOS Build Issues
```bash
# Clean pods and reinstall
cd ios && rm -rf Pods && rm Podfile.lock && pod install && cd ..
```

### Permission Issues
- Ensure notification permissions are requested
- Check AndroidManifest.xml permissions
- Verify iOS capabilities are enabled

### Firebase Connection Issues
- Verify google-services.json placement
- Check Firebase project configuration
- Ensure internet connectivity

## 📚 Documentation Links

- [React Native Firebase Docs](https://rnfirebase.io/)
- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

---

## ✅ Setup Verification Checklist

- [ ] Firebase project created
- [ ] Android app configured with google-services.json
- [ ] iOS app configured with GoogleService-Info.plist (if applicable)
- [ ] Authentication providers enabled
- [ ] Firestore database created
- [ ] Security rules deployed
- [ ] Cloud Messaging configured
- [ ] Environment variables set
- [ ] App builds successfully
- [ ] Authentication works
- [ ] Database operations work
- [ ] Push notifications work

Once all items are checked, your Ajoturn app is ready for development! 🎉