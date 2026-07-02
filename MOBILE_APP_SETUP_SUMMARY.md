# Bengali Math - Mobile App Setup Summary

## ✅ What Has Been Done

### 1. Mobile App Structure Created
- Created `apps/mobile/` directory with Capacitor 8 setup
- Initialized Android project with proper configuration
- Set up monorepo structure for better organization

### 2. Android App Configured
- **App ID**: `com.bengalimath.app`
- **App Name**: Bengali Math
- **Package**: Capacitor 8.4.1 (latest stable)
- **Target SDK**: Android API 22+ (Android 5.1+)
- All necessary permissions configured (Internet, Network State)

### 3. Build System Set Up
- NPM scripts for building, syncing, and running
- Gradle configuration for Android builds
- Keystore template for release signing
- Quick-start script for easy development

### 4. Documentation Created
- **README.md** (root) - Complete project overview with mobile app section
- **apps/mobile/README.md** - Detailed setup and development guide
- **apps/mobile/DEPLOYMENT_GUIDE.md** - Step-by-step Google Play deployment
- **apps/mobile/quick-start.bat** - Windows quick start script
- **ui/.env.example** - API configuration template

### 5. Git Configuration
- New branch: `feature/android-mobile-app`
- Updated `.gitignore` with Android/mobile patterns
- Committed all changes with detailed commit message
- **Pushed to remote**: `origin/feature/android-mobile-app`

### 6. Code Fixes
- Fixed TypeScript error in `History.tsx` (JSX syntax issue)
- All TypeScript checks passing
- Production build successful

## 📋 Next Steps for You

### Step 1: Review and Merge
1. Go to: https://github.com/AI-POC-Inventory/bengaliMath/pull/new/feature/android-mobile-app
2. Review the changes
3. Create and merge the pull request

### Step 2: Configure Backend URL

**For Local Development:**
1. Find your computer's IP address:
   ```bash
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. Create `ui/.env`:
   ```env
   VITE_API_BASE_URL=http://YOUR_IP:3001/api
   ```
   Example: `VITE_API_BASE_URL=http://192.168.1.100:3001/api`

3. Ensure your backend server accepts connections from the local network

**For Production Deployment:**
1. Deploy your backend to Google Cloud Run (or similar):
   ```bash
   cd server
   gcloud run deploy bengali-math-api --source . --region asia-south1
   ```

2. Create `ui/.env.production`:
   ```env
   VITE_API_BASE_URL=https://your-cloud-run-url.run.app/api
   ```

### Step 3: Test the Mobile App

1. **Install dependencies:**
   ```bash
   cd apps/mobile
   npm install
   ```

2. **Build and sync:**
   ```bash
   npm run sync
   ```
   This will:
   - Build the React UI from `ui/`
   - Copy build files to Android project
   - Sync Capacitor configuration

3. **Open in Android Studio:**
   ```bash
   npm run open
   ```
   Or use the quick-start script:
   ```bash
   quick-start.bat
   ```

4. **Run on device/emulator:**
   - In Android Studio, click the Run button (green play)
   - Or use: `npm run run`

### Step 4: Prepare for Google Play Release

Follow the detailed guide in [apps/mobile/DEPLOYMENT_GUIDE.md](apps/mobile/DEPLOYMENT_GUIDE.md):

1. **Generate Keystore** (one-time):
   ```bash
   cd apps/mobile
   keytool -genkey -v -keystore bengali-math-release.keystore -alias bengali-math -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure Signing**:
   - Copy `android/keystore.properties.example` to `android/keystore.properties`
   - Fill in your keystore passwords
   - **Never commit this file to git!**

3. **Build Release Bundle**:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

4. **Upload to Google Play**:
   - Create Google Play Developer account ($25)
   - Create app listing
   - Upload AAB file
   - Submit for review

## 📁 Project Structure

```
bengaliMath/
├── apps/
│   └── mobile/                          # ← NEW: Android mobile app
│       ├── android/                     # Native Android project
│       │   ├── app/
│       │   │   ├── build.gradle         # Android build config
│       │   │   └── src/main/
│       │   │       ├── AndroidManifest.xml
│       │   │       └── java/com/bengalimath/app/
│       │   ├── gradle/
│       │   ├── build.gradle
│       │   └── keystore.properties.example  # Signing template
│       ├── capacitor.config.json        # Capacitor configuration
│       ├── package.json                 # NPM scripts
│       ├── README.md                    # Setup guide
│       ├── DEPLOYMENT_GUIDE.md          # Play Store guide
│       ├── quick-start.bat              # Quick start script
│       └── .gitignore                   # Mobile-specific ignores
│
├── ui/                                  # React frontend
│   ├── dist/                            # ← Used by mobile app
│   └── .env.example                     # ← NEW: API config template
│
├── server/                              # Backend API
├── service/                             # Python services
├── database/                            # SQLite database
├── README.md                            # ← UPDATED: Includes mobile info
└── .gitignore                           # ← UPDATED: Android patterns
```

## 🔧 NPM Scripts (apps/mobile)

```bash
npm run build        # Build React UI
npm run sync         # Build UI + sync with Android
npm run open         # Open in Android Studio
npm run run          # Build, sync, and run on device
npm run copy         # Copy web assets to Android
npm run update       # Update Capacitor Android
```

## 📝 Important Notes

### Backend Requirements
- The mobile app **requires a network-accessible backend**
- For local testing: Use your computer's local IP (not `localhost`)
- For production: Deploy backend to cloud (Cloud Run, Railway, Heroku, etc.)

### API Configuration
- The app reads `VITE_API_BASE_URL` from the UI build
- After changing the backend URL, **always rebuild and sync**:
  ```bash
  cd apps/mobile
  npm run sync
  ```

### Keystore Security
- The `.keystore` file and `keystore.properties` are **never** committed to git
- Store these securely - you need them for **every app update**
- If you lose the keystore, you **cannot update the app** on Play Store

### App Updates
- Increment `versionCode` and `versionName` in `android/app/build.gradle`
- Build new AAB with `./gradlew bundleRelease`
- Upload to Play Console
- Updates are reviewed faster than initial submission (usually < 24 hours)

## 🐛 Troubleshooting

### "Cannot connect to backend"
1. Verify `VITE_API_BASE_URL` in `ui/.env`
2. Check backend is running and accessible from device
3. Ensure backend CORS allows the app origin
4. Rebuild and sync: `npm run sync`

### "Gradle build failed"
1. Check Java JDK version (needs 11+)
2. Sync Gradle: File → Sync Project with Gradle Files in Android Studio
3. Clean and rebuild: `./gradlew clean bundleRelease`

### "App crashes on launch"
1. Check Android Studio Logcat for error messages
2. Verify web assets were synced: `npm run sync`
3. Check that the UI build is working: `cd ui && npm run build`

### "Web assets not updating"
Always run `npm run sync` after making UI changes. This rebuilds the UI and copies files to the Android project.

## 📊 Current Status

- ✅ Android project created and configured
- ✅ Capacitor setup complete
- ✅ Build system configured
- ✅ Documentation written
- ✅ Git branch created and pushed
- ✅ Ready for testing and deployment

## 🎯 Recommended Workflow

### Development Workflow
1. Make changes to React app in `ui/src/`
2. Test in browser: `cd ui && npm run dev`
3. When ready to test on mobile:
   ```bash
   cd apps/mobile
   npm run sync        # Rebuilds UI and syncs
   npm run open        # Opens in Android Studio
   ```
4. Run from Android Studio or: `npm run run`

### Release Workflow
1. Update version numbers in `android/app/build.gradle`
2. Build release bundle: `cd android && ./gradlew bundleRelease`
3. Test the release build thoroughly
4. Upload to Google Play Console
5. Submit for review
6. Monitor for crashes/feedback

## 📚 Resources

- **Local Documentation**:
  - [apps/mobile/README.md](apps/mobile/README.md) - Setup guide
  - [apps/mobile/DEPLOYMENT_GUIDE.md](apps/mobile/DEPLOYMENT_GUIDE.md) - Play Store publishing

- **External Resources**:
  - [Capacitor Docs](https://capacitorjs.com/docs)
  - [Android Developer Guide](https://developer.android.com/guide)
  - [Google Play Console](https://play.google.com/console)

## 🎉 Success!

Your Bengali Math app is now ready to be deployed as an Android app to the Google Play Store!

**Next immediate action**: Create a pull request and merge the `feature/android-mobile-app` branch.

---

**Questions or issues?** Email: sendtosutap@gmail.com

**Created by**: Claude Sonnet 4.5  
**Date**: 2026-07-01
