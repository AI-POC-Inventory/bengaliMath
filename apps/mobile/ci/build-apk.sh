#!/usr/bin/env bash
# Step 2: provision the Android SDK on JDK 21 and assemble the debug APK.
set -euo pipefail

apt-get update -qq && apt-get install -y -qq unzip curl >/dev/null

export ANDROID_SDK_ROOT=/opt/android-sdk
export ANDROID_HOME="$ANDROID_SDK_ROOT"
mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
curl -fsSL -o /tmp/cmdtools.zip \
  https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/cmdtools.zip -d "$ANDROID_SDK_ROOT/cmdline-tools"
mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

# `yes` is killed by SIGPIPE (exit 141) once sdkmanager stops reading; guard the
# pipe so pipefail doesn't treat that as a build failure.
set +o pipefail
yes | sdkmanager --licenses >/dev/null 2>&1 || true
set -o pipefail
sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" >/dev/null

cd apps/mobile/android
chmod +x gradlew
./gradlew assembleDebug --no-daemon --stacktrace
