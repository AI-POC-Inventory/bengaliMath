# Bengali Math - Google Play Store Deployment Guide

This guide will walk you through deploying the Bengali Math Android app to the Google Play Store.

## Before You Start

### 1. Prerequisites Checklist

- [ ] Google Play Developer account ($25 one-time fee)
- [ ] Android Studio installed
- [ ] Java JDK 11+ installed
- [ ] Node.js 18+ installed
- [ ] Backend API deployed and accessible

### 2. Prepare Your Backend

The mobile app needs a publicly accessible backend API. You have several options:

#### Option A: Google Cloud Run (Recommended for this project)
Your backend is already set up for Cloud Run. Deploy it:

```bash
# From the server/ directory
gcloud run deploy bengali-math-api --source . --region asia-south1
```

Note the service URL (e.g., `https://bengali-math-api-xxxxx.run.app`)

#### Option B: Railway, Heroku, or Similar
Follow their deployment guides and note your backend URL.

### 3. Configure the App for Production

1. **Update the API URL in the UI**

   Edit `ui/.env.production`:
   ```
   VITE_API_BASE_URL=https://your-backend-url.com/api
   ```

2. **Rebuild the UI with production settings**
   ```bash
   cd ui
   npm run build
   ```

3. **Sync with Capacitor**
   ```bash
   cd ../apps/mobile
   npm run sync
   ```

## Step-by-Step Deployment

### Step 1: Generate a Release Keystore

This keystore is used to sign your app. **Keep it secure and never commit it to git!**

```bash
cd apps/mobile
keytool -genkey -v -keystore bengali-math-release.keystore -alias bengali-math -keyalg RSA -keysize 2048 -validity 10000
```

You'll be asked:
- Keystore password (e.g., `YourSecurePassword123`)
- Key password (can be same as keystore password)
- Your name, organization, city, state, country

**Important**: Save these passwords securely! You'll need them for every app update.

### Step 2: Configure Gradle Signing

1. Create `apps/mobile/android/keystore.properties`:

   ```properties
   storeFile=../../bengali-math-release.keystore
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyAlias=bengali-math
   keyPassword=YOUR_KEY_PASSWORD
   ```

   **Add this file to .gitignore!**

2. Edit `apps/mobile/android/app/build.gradle`:

   Find the `android {` section and add signing configuration:

   ```gradle
   def keystorePropertiesFile = rootProject.file("keystore.properties")
   def keystoreProperties = new Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       ...
       
       signingConfigs {
           release {
               if (keystorePropertiesFile.exists()) {
                   storeFile file(keystoreProperties['storeFile'])
                   storePassword keystoreProperties['storePassword']
                   keyAlias keystoreProperties['keyAlias']
                   keyPassword keystoreProperties['keyPassword']
               }
           }
       }
       
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

### Step 3: Update App Version

Edit `apps/mobile/android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        applicationId "com.bengalimath.app"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1      // Increment this for each release (1, 2, 3, ...)
        versionName "1.0.0" // User-facing version (1.0.0, 1.1.0, 2.0.0, ...)
        ...
    }
}
```

### Step 4: Build Release App Bundle

Google Play requires the AAB (Android App Bundle) format:

```bash
cd apps/mobile/android
./gradlew bundleRelease
```

If successful, the bundle will be at:
`android/app/build/outputs/bundle/release/app-release.aab`

**Troubleshooting**:
- If Gradle fails, try: `./gradlew clean bundleRelease`
- If signing fails, verify `keystore.properties` paths and passwords

### Step 5: Create Google Play Developer Account

1. Go to [Google Play Console](https://play.google.com/console/signup)
2. Pay the $25 registration fee
3. Complete your account details
4. Agree to the Developer Distribution Agreement

### Step 6: Create Your App in Play Console

1. Click **"Create app"**
2. Fill in:
   - **App name**: Bengali Math (বাংলা গণিত)
   - **Default language**: Bengali or English
   - **App or game**: App
   - **Free or paid**: Free
   - **Declarations**: Complete all declarations

### Step 7: Complete Store Listing

Navigate to **"Main store listing"** and provide:

#### Required Text
- **App name**: Bengali Math
- **Short description** (80 chars max):
  ```
  Learn mathematics in Bengali - interactive lessons and AI-powered tutoring
  ```

- **Full description** (4000 chars max):
  ```
  Bengali Math is an interactive educational platform designed to make learning mathematics engaging and accessible for Bengali-speaking students.

  Key Features:
  • Comprehensive curriculum for Classes 5-10
  • Interactive practice sessions with instant feedback
  • AI-powered doubt resolution - ask questions in Bengali
  • Step-by-step problem-solving guidance
  • Word problem generation tailored to real-world scenarios
  • Dark mode support for comfortable learning
  • Track your progress with detailed history

  The app covers all major topics including:
  - Arithmetic and number systems
  - Algebra and equations
  - Geometry and shapes
  - Statistics and probability
  - And much more!

  Perfect for:
  • Students preparing for board exams
  • Self-learners wanting to strengthen math skills
  • Anyone looking to learn math in Bengali

  Download now and start your math learning journey!
  ```

#### Graphics Assets

You'll need to create:

1. **App Icon** (512 x 512 px, PNG, 32-bit)
   - Should be the Bengali Math logo
   - No transparency

2. **Feature Graphic** (1024 x 500 px, PNG or JPG)
   - Promotional banner shown in Play Store

3. **Screenshots** (at least 2 required)
   - Phone: 16:9 or 9:16 ratio, min 320px
   - Take screenshots of:
     - Home screen with class selection
     - Practice session in action
     - AI doubt resolution feature
     - History/progress tracking

**Tip**: Use Android Studio's Device File Explorer or screenshot from a real device.

#### Contact Details
- **Email**: sendtosutap@gmail.com
- **Phone**: (optional)
- **Website**: (if you have one)

#### Privacy Policy
You **must** provide a privacy policy URL. Create a simple one covering:
- What data you collect (user preferences, session data)
- How you use it (improving the app)
- Third-party services (Anthropic API for AI features)
- Data retention and user rights

Host it on GitHub Pages or a free hosting service.

### Step 8: Set Up App Content

1. **App category**:
   - Category: Education
   - Tags: Mathematics, Bengali, Learning

2. **Content rating**:
   - Complete the questionnaire
   - Your app should be rated "Everyone" or "Everyone 10+"

3. **Target audience**:
   - Age groups: 5-12, 13-17 (or as appropriate)

4. **News app**: No

5. **COVID-19 contact tracing and status apps**: No

6. **Data safety**:
   - Declare what data you collect
   - For Bengali Math:
     - User preferences (stored locally)
     - Session data (practice history)
     - API keys (stored securely)
   - Encryption: Yes (HTTPS)
   - User can request deletion: Yes

### Step 9: Create a Production Release

1. Navigate to **"Release" → "Production"**
2. Click **"Create new release"**
3. **Upload the AAB**:
   - Click "Upload" and select `app-release.aab`
   - Wait for processing (a few minutes)

4. **Release name**: 1 (or 1.0.0)

5. **Release notes** (What's new in this version):
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

6. **Review release** and click **"Save"**

### Step 10: Submit for Review

1. Review all sections - they must have green checkmarks
2. Click **"Send for review"**
3. Google will review your app (typically 1-3 days, up to 7 days)

### Step 11: App Review and Publishing

You'll receive an email when review is complete.

**If Approved**:
- Your app goes live automatically
- Users can find it on Google Play Store
- Celebrate! 🎉

**If Rejected**:
- Review the rejection reason
- Fix the issues
- Resubmit

## Post-Launch

### Monitor Your App

- **Play Console**: Check crashes, ANRs, reviews
- **User feedback**: Respond to reviews
- **Analytics**: Track installs, retention

### Push Updates

When you have new features or fixes:

1. Increment `versionCode` and `versionName` in `build.gradle`
2. Build new AAB: `./gradlew bundleRelease`
3. Upload to Play Console → Production → Create new release
4. Google reviews updates faster (usually < 24 hours)

### Rollout Strategy

For your first update, consider:
- **Staged rollout**: Release to 10%, then 50%, then 100%
- **Internal testing track**: Test with friends/family first
- **Closed testing**: Beta testers get early access

## Troubleshooting Common Issues

### "App not signed correctly"
- Verify `keystore.properties` paths are correct
- Ensure passwords match your keystore

### "Upload failed - duplicate version"
- Increment `versionCode` in `build.gradle`

### "Missing required graphics"
- Ensure all screenshots and icons meet size requirements
- Icons must be PNG, 32-bit, no transparency

### "Privacy policy required"
- Must be a publicly accessible URL (not a PDF or doc)
- Should be on HTTPS

### "API level warning"
- Update `targetSdkVersion` to latest (currently 34)

## Resources

- [Google Play Console](https://play.google.com/console)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Launch Checklist](https://developer.android.com/distribute/best-practices/launch/launch-checklist)
- [App Signing](https://developer.android.com/studio/publish/app-signing)
- [Privacy Policy Generator](https://app-privacy-policy-generator.firebaseapp.com/)

## Support

For issues specific to Bengali Math:
- Email: sendtosutap@gmail.com
- GitHub: [Your repo URL]

---

**Good luck with your launch!** 🚀
