# Bengali Math - Mobile App Deployment Checklist

## ✅ Completed Tasks

- [x] Created `apps/mobile/` directory with Capacitor 8 setup
- [x] Initialized Android project with proper configuration
- [x] Set up NPM scripts for build, sync, and run
- [x] Created comprehensive documentation (README, DEPLOYMENT_GUIDE)
- [x] Fixed TypeScript errors in the codebase
- [x] Updated `.gitignore` with Android/mobile patterns
- [x] Created `.env.example` template for API configuration
- [x] Generated keystore configuration template
- [x] Created quick-start script for Windows
- [x] Committed all changes to `feature/android-mobile-app` branch
- [x] Pushed branch to remote repository

## 📋 Immediate Next Steps (Do These First)

### 1. Create and Merge Pull Request
- [ ] Go to: https://github.com/AI-POC-Inventory/bengaliMath/pull/new/feature/android-mobile-app
- [ ] Review the changes
- [ ] Create the pull request with the provided description
- [ ] Merge to main branch

### 2. Configure Backend URL
**Choose ONE option:**

#### Option A: Local Development (Test on same Wi-Fi network)
- [ ] Find your computer's IP address:
  ```bash
  ipconfig
  # Look for IPv4 Address (e.g., 192.168.1.100)
  ```
- [ ] Create `ui/.env`:
  ```env
  VITE_API_BASE_URL=http://YOUR_IP:3001/api
  ```
- [ ] Start backend server: `cd server && npm start`
- [ ] Ensure backend accepts connections from local network

#### Option B: Production Deployment (For App Store release)
- [ ] Deploy backend to Google Cloud Run:
  ```bash
  cd server
  gcloud run deploy bengali-math-api --source . --region asia-south1
  ```
- [ ] Note the deployed URL (e.g., `https://bengali-math-api-xxxxx.run.app`)
- [ ] Create `ui/.env.production`:
  ```env
  VITE_API_BASE_URL=https://your-cloud-run-url.run.app/api
  ```

### 3. Test the Mobile App Locally
- [ ] Install dependencies:
  ```bash
  cd apps/mobile
  npm install
  ```
- [ ] Build and sync:
  ```bash
  npm run sync
  ```
- [ ] Open in Android Studio:
  ```bash
  npm run open
  ```
  Or use quick-start: `quick-start.bat`
- [ ] Run on emulator or device
- [ ] Test all features:
  - [ ] Class selection
  - [ ] Practice sessions
  - [ ] AI doubt resolution
  - [ ] History tracking
  - [ ] Dark mode
  - [ ] Backend connectivity

## 🎯 Google Play Store Deployment (After Testing)

### Phase 1: Prepare Release Build

- [ ] **Generate Keystore** (ONE TIME ONLY - Keep this secure!):
  ```bash
  cd apps/mobile
  keytool -genkey -v -keystore bengali-math-release.keystore -alias bengali-math -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Save keystore password securely
- [ ] Save key password securely
- [ ] Backup the `.keystore` file to a secure location
- [ ] **NEVER commit the keystore to git!**

### Phase 2: Configure Signing

- [ ] Copy keystore template:
  ```bash
  cd apps/mobile/android
  cp keystore.properties.example keystore.properties
  ```
- [ ] Edit `keystore.properties` with your actual passwords
- [ ] Verify `.gitignore` excludes `keystore.properties`

### Phase 3: Build Release Bundle

- [ ] Update version in `android/app/build.gradle`:
  ```gradle
  versionCode 1
  versionName "1.0.0"
  ```
- [ ] Build the release bundle:
  ```bash
  cd apps/mobile/android
  ./gradlew bundleRelease
  ```
- [ ] Verify AAB file created at:
  `android/app/build/outputs/bundle/release/app-release.aab`

### Phase 4: Create Google Play Developer Account

- [ ] Go to: https://play.google.com/console/signup
- [ ] Pay $25 registration fee
- [ ] Complete account verification
- [ ] Accept Developer Distribution Agreement
- [ ] Set up payment profile

### Phase 5: Create App Listing

- [ ] Click "Create app" in Play Console
- [ ] Fill in basic info:
  - [ ] App name: Bengali Math (বাংলা গণিত)
  - [ ] Default language: Bengali or English
  - [ ] App type: App
  - [ ] Free or paid: Free
- [ ] Complete all declarations

### Phase 6: Prepare Graphics Assets

**Required graphics:**

- [ ] **App Icon** (512x512 PNG, 32-bit, no transparency)
  - Use Bengali Math logo
  
- [ ] **Feature Graphic** (1024x500 PNG/JPG)
  - Create promotional banner
  
- [ ] **Screenshots** (at least 2):
  - [ ] Home screen with class selection
  - [ ] Practice session in action
  - [ ] AI doubt resolution feature
  - [ ] History/progress screen
  - Min size: 320px, 16:9 or 9:16 ratio

- [ ] **Optional but recommended**:
  - [ ] Tablet screenshots
  - [ ] Promo video (30 sec - 2 min)

### Phase 7: Complete Store Listing

- [ ] Write short description (80 chars max)
- [ ] Write full description (see DEPLOYMENT_GUIDE.md for template)
- [ ] Upload app icon
- [ ] Upload feature graphic
- [ ] Upload screenshots
- [ ] Add contact email: sendtosutap@gmail.com
- [ ] Add website URL (if available)
- [ ] **Create and add Privacy Policy URL** (REQUIRED!)
  - [ ] Create privacy policy covering:
    - Data collection (preferences, sessions)
    - Third-party services (Anthropic API)
    - Data retention
    - User rights
  - [ ] Host on GitHub Pages or similar
  - [ ] Add URL to Play Console

### Phase 8: Configure App Content

- [ ] Set app category: Education
- [ ] Add tags: Mathematics, Bengali, Learning
- [ ] Complete content rating questionnaire
  - Expected rating: Everyone or Everyone 10+
- [ ] Set target audience age groups: 5-12, 13-17
- [ ] Complete data safety form:
  - [ ] Declare data collection
  - [ ] Encryption: Yes (HTTPS)
  - [ ] Deletion option: Yes

### Phase 9: Upload and Release

- [ ] Go to: Release → Production
- [ ] Click "Create new release"
- [ ] Upload `app-release.aab`
- [ ] Wait for processing (few minutes)
- [ ] Write release notes:
  ```
  Initial release of Bengali Math!
  
  Features:
  • Complete mathematics curriculum for Classes 5-10
  • Interactive practice sessions
  • AI-powered doubt resolution in Bengali
  • Word problem generation
  • Progress tracking and history
  • Light and dark themes
  ```
- [ ] Review all sections (must be green checkmarks)
- [ ] Click "Save"
- [ ] Click "Send for review"

### Phase 10: Wait for Review

- [ ] Monitor email for review status
- [ ] Expected wait: 1-3 days (up to 7 days)
- [ ] If rejected:
  - [ ] Review rejection reason
  - [ ] Fix issues
  - [ ] Resubmit
- [ ] If approved:
  - [ ] App goes live automatically
  - [ ] Celebrate! 🎉

## 📊 Post-Launch Tasks

### Monitoring
- [ ] Set up Play Console alerts
- [ ] Monitor crash reports
- [ ] Check user reviews daily
- [ ] Respond to reviews
- [ ] Track install metrics

### Updates
When you have new features:
- [ ] Increment `versionCode` and `versionName`
- [ ] Build new AAB: `./gradlew bundleRelease`
- [ ] Test thoroughly
- [ ] Upload to Play Console
- [ ] Write release notes
- [ ] Submit for review (faster than initial: < 24 hours)

### Analytics (Optional but Recommended)
- [ ] Integrate Google Analytics for Firebase
- [ ] Track user engagement
- [ ] Monitor feature usage
- [ ] Identify drop-off points

## 🔧 Maintenance Checklist

### Monthly
- [ ] Check for crashes/ANRs in Play Console
- [ ] Review user feedback
- [ ] Update dependencies if needed
- [ ] Test on latest Android versions

### When Android Updates
- [ ] Update `targetSdkVersion` to latest
- [ ] Test on new Android version
- [ ] Fix any breaking changes
- [ ] Submit update

## 📚 Documentation Reference

- **Setup Guide**: [apps/mobile/README.md](apps/mobile/README.md)
- **Deployment Guide**: [apps/mobile/DEPLOYMENT_GUIDE.md](apps/mobile/DEPLOYMENT_GUIDE.md)
- **Setup Summary**: [MOBILE_APP_SETUP_SUMMARY.md](MOBILE_APP_SETUP_SUMMARY.md)
- **This Checklist**: [MOBILE_APP_CHECKLIST.md](MOBILE_APP_CHECKLIST.md)

## 🆘 Troubleshooting Reference

### Cannot connect to backend
1. Check `VITE_API_BASE_URL` in `ui/.env`
2. Verify backend is running
3. Test backend URL in browser
4. Check CORS configuration
5. Rebuild and sync: `npm run sync`

### Build errors
1. Clean build: `./gradlew clean`
2. Sync Gradle in Android Studio
3. Check Java JDK version (needs 11+)
4. Invalidate caches in Android Studio

### Keystore issues
1. Verify `keystore.properties` paths
2. Check passwords match
3. Ensure keystore file exists
4. Never commit keystore to git!

## 🎯 Quick Command Reference

```bash
# Test locally
cd apps/mobile
npm run sync && npm run open

# Build release
cd apps/mobile/android
./gradlew bundleRelease

# Update version
# Edit: apps/mobile/android/app/build.gradle
# Increment: versionCode and versionName
```

## ✨ Success Metrics

**Initial launch goals:**
- [ ] 100+ downloads in first month
- [ ] 4.0+ star rating
- [ ] < 1% crash rate
- [ ] Positive user reviews

**Long-term goals:**
- [ ] 1000+ active users
- [ ] 4.5+ star rating
- [ ] Regular feature updates
- [ ] Community engagement

---

## 📞 Support

**Email**: sendtosutap@gmail.com  
**Repository**: https://github.com/AI-POC-Inventory/bengaliMath

---

**Last Updated**: 2026-07-01  
**Created by**: Claude Sonnet 4.5
