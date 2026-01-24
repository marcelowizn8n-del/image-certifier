# Image Certifier - Publishing Guide

## Prerequisites

Before publishing, make sure you have:
1. Apple Developer Program membership ($99/year) - for App Store
2. Google Play Developer account ($25 one-time) - for Google Play
3. EAS CLI installed: `npm install -g eas-cli`
4. Expo account: https://expo.dev/signup

## Step 1: Configure EAS

### Login to Expo
```bash
cd mobile
npx eas-cli login
```

### Initialize EAS Build
```bash
npx eas-cli build:configure
```

This will update `eas.json` with your project configuration.

## Step 2: Update App Configuration

### Update `app.json`:
1. Replace `"your-project-id"` with your actual Expo project ID
2. Update `bundleIdentifier` (iOS) and `package` (Android) if needed
3. Add your app icons (replace placeholder files in `/assets`)

### Required Assets:
- `icon.png` - 1024x1024px app icon
- `splash.png` - 1284x2778px splash screen
- `adaptive-icon.png` - 1024x1024px Android adaptive icon

## Step 3: Build for iOS (TestFlight)

### Create iOS Build
```bash
npx eas-cli build --platform ios --profile production
```

### Submit to App Store
```bash
npx eas-cli submit --platform ios
```

This will:
1. Build your app in the cloud
2. Sign it with your Apple Developer credentials
3. Submit to TestFlight for testing
4. You can then promote it to the App Store in App Store Connect

### In App Store Connect:
1. Go to https://appstoreconnect.apple.com
2. Select your app
3. Add app metadata (description, screenshots, etc.)
4. Submit for review

## Step 4: Build for Android (Google Play)

### Create Android Build
```bash
npx eas-cli build --platform android --profile production
```

### Submit to Google Play
```bash
npx eas-cli submit --platform android
```

Before submitting, you need to:
1. Create your app in Google Play Console
2. Generate a service account JSON key
3. Add the key path to `eas.json` under `submit.production.android.serviceAccountKeyPath`

### In Google Play Console:
1. Go to https://play.google.com/console
2. Create your app
3. Add store listing (description, screenshots, etc.)
4. Upload the AAB file or use EAS submit
5. Submit for review

## Step 5: App Store Requirements

### iOS App Store:
- Privacy Policy URL (already at https://imgcertifier.app/privacy)
- App description in all supported languages
- Screenshots for different device sizes
- Camera usage description (already configured)
- Photo library usage description (already configured)

### Google Play:
- Privacy Policy URL
- Feature graphic (1024x500px)
- Screenshots for phone and tablet
- Content rating questionnaire
- Data safety form

## API Configuration

Update the API URL in `mobile/src/lib/api.ts`:
```typescript
const API_BASE_URL = 'https://www.imgcertifier.app';
```

Make sure your backend is deployed and accessible from the mobile app.

## Testing

### Test on Physical Device with Expo Go:
```bash
cd mobile
npm start
```
Scan the QR code with Expo Go app.

### Test Development Build:
```bash
npx eas-cli build --platform ios --profile development
npx eas-cli build --platform android --profile development
```

## Troubleshooting

### Build Fails:
- Check `eas.json` configuration
- Verify all dependencies in `package.json`
- Check Expo SDK compatibility

### Submission Fails:
- Verify Apple/Google credentials
- Check app metadata requirements
- Ensure all required assets are present

## Support

For issues with EAS Build:
- Expo Documentation: https://docs.expo.dev/build/introduction/
- Expo Forums: https://forums.expo.dev/
