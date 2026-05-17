# EternalAgni - Agnihotra Timing App

Precise sunrise and sunset timing for Agnihotra practice with location-based calculations.

## Features

- **Seconds-precision timing** for accurate Agnihotra practice
- **Automatic location detection** (GPS or IP-based)
- **Smart upcoming countdowns** based on current time
- **Offline-ready** with fallback APIs

## Quick Start

### Option 1: Basic Usage (sunrisesunset.io API)
Simply open `index.html` in your browser. This provides seconds-precision timing suitable for Agnihotra.

### Option 2: Maximum Precision (homatherapie.de API)
For the most precise timing used by Agnihotra practitioners worldwide:

#### Method A: Deployed Proxy (Best for sharing)
Deploy your own CORS proxy so **anyone can use your app**:

```bash
# Quick deployment (interactive script)
./deploy.sh

# Or deploy manually:
# Vercel: vercel --prod
# Netlify: netlify deploy --prod --dir .
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

#### Method B: Local Proxy Server
```bash
# Install dependencies
npm install

# Start the CORS proxy server
npm start

# Open http://localhost:8080 in your browser
```

#### Method C: Browser Extension
1. Install "CORS Unblock" extension in Chrome
2. Enable it when using the app
3. Disable it for normal browsing

#### Method D: Chrome with CORS Disabled
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --disable-web-security --user-data-dir="/tmp/chrome_dev" file://$(pwd)/index.html

# Windows
chrome.exe --disable-web-security --user-data-dir="c:/temp/chrome_dev" file:///path/to/index.html

# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev" file://$(pwd)/index.html
```

## Android App Build (Capacitor)

This project includes a Capacitor Android app in `android/` and can generate:

- Debug APK for local/device testing
- Release AAB/APK for Play Store or production distribution

### Prerequisites (one-time setup)

1. Install Node dependencies:
```bash
npm install
```

2. Install Android Studio (includes Android SDK tools).

3. Ensure `android/local.properties` exists with your SDK path:
```properties
sdk.dir=/opt/homebrew/share/android-commandlinetools
```
If your SDK is elsewhere, update the path accordingly.

4. Verify Android platform tools (`adb`) are available:
```bash
adb version
```

### Device Setup (first-time install)

#### USB debugging

1. On phone: enable Developer options and turn on USB debugging.
2. Connect phone via USB and accept the trust prompt.
3. Verify device connection:

```bash
adb devices
```

#### Wireless ADB (optional)

```bash
# Pair once using the pairing IP:PORT shown on phone
adb pair <PHONE_IP:PAIR_PORT>

# Connect using the connect IP:PORT shown on phone
adb connect <PHONE_IP:CONNECT_PORT>
adb devices
```

### Local Build (debug/testing)

Use these commands from repo root:

```bash
# (Optional) regenerate Android icons/splash from resources/
npm run assets:android

# Build web assets and sync to Android project
npm run android:sync

# Build debug APK
npm run android:apk
```

Debug APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

You can install it on a connected device with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### One-script Android workflow (`agni-android.sh`)

For daily use, run the helper script from repo root:

```bash
./agni-android.sh help
./agni-android.sh debug-build-install-run
./agni-android.sh release-build-sign
./agni-android.sh screenshot widget-check.png
```

This covers debug build/install, release build+sign, and ADB screenshot capture in one place.

### Fast Reinstall Flow (recommended during testing)

Use this exact sequence to rebuild and ensure latest JS/native changes are on device:

```bash
cd "/Users/krishnatripathi/Desktop/AGNIHOTRA"
npm run android:apk
adb uninstall com.eternalagni.app
adb install -r "/Users/krishnatripathi/Desktop/AGNIHOTRA/android/app/build/outputs/apk/debug/app-debug.apk"
```

After install, open app. It should request required permissions (location + notifications).

### Build Release APK and Save to `release/`

Use this flow to generate the latest Android splash/icons, build a release APK, and copy it into a top-level `release/` folder:

```bash
cd "/Users/krishnatripathi/Desktop/AGNIHOTRA"
npm run assets:android
npm run android:sync
cd android && ./gradlew assembleRelease
cd ..
mkdir -p release
cp android/app/build/outputs/apk/release/app-release-unsigned.apk release/agnihotra-release-unsigned.apk
```

Output file:

`release/agnihotra-release-unsigned.apk`

> Note: this is an unsigned release APK. For Play Store upload, prefer signed AAB (`npm run android:aab` with keystore config).

### Permission Troubleshooting Logs

If location prompt does not appear, capture only location debug lines:

```bash
adb logcat -v time '*:I' | awk '/AGNIHOTRA\]\[LOCATION/ { print }'
```

For menu + notification diagnostics:

```bash
adb logcat -v time '*:I' | awk '/AGNIHOTRA\]\[(MENU|NOTIFY|ALERT|SW|LOCATION)/ { print }'
```

### Open in Android Studio

```bash
npm run android:open
```

From Android Studio you can run on emulator/physical device and use Logcat.

### Production Build (release)

#### 1) Generate a signing keystore (one-time)

```bash
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias release
```

Store `release-key.jks` in a safe location (do not lose it).

#### 2) Configure signing in Gradle

Add these values in `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=release-key.jks
MYAPP_UPLOAD_KEY_ALIAS=release
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

Then reference them in `android/app/build.gradle` under `signingConfigs` and `buildTypes.release` (standard Android signing setup).

#### 3) Build release artifacts

```bash
# Play Store preferred format
npm run android:aab

# Optional release APK
cd android && ./gradlew assembleRelease
```

Release outputs:

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

### Command Reference

- `npm run build` - Build/copy web files to `public/`
- `npm run android:sync` - Build web + sync Capacitor Android
- `npm run android:open` - Open Android project in Android Studio
- `npm run android:apk` - Build debug APK
- `npm run android:aab` - Build release AAB
- `npm run assets:android` - Generate Android icon/splash assets

### Notes

- Use debug APK for development/testing only.
- Use signed release AAB for Play Store.
- After web code changes, always run `npm run android:sync` before building.

### Runtime Flags (build-time env)

These are read during `npm run build` / `npm run android:sync`:

- `AGNI_ENABLE_TEST_REMINDER=true|false`  
  Controls visibility/availability of the test reminder button.
- `AGNI_TEST_REMINDER_SECONDS=<number>`  
  Test reminder delay in seconds (minimum 5).
- `AGNI_ENABLE_DEBUG_OVERLAY=true|false`  
  Controls in-app debug overlay visibility. Defaults to the same value as `AGNI_ENABLE_TEST_REMINDER` when not set.

Quick debug build command (enable both test reminder + debug overlay):

```bash
AGNI_ENABLE_TEST_REMINDER=true AGNI_ENABLE_DEBUG_OVERLAY=true npm run android:apk
```

## How It Works

### API Priority System
1. **homatherapie.de** (via local proxy) - Maximum precision
2. **sunrisesunset.io** (direct) - Seconds precision, CORS-friendly

### Location Detection
1. **GPS coordinates** (if permission granted) - Most accurate
2. **IP geolocation** (if GPS denied) - City-level accuracy
3. **Error handling** with clear user guidance

### Smart Timing Logic
- **Before sunrise**: Shows today's sunrise + sunset
- **After sunrise**: Shows tomorrow's sunrise + sunset

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Mobile browsers**: Works on all devices

## Development

### Local Development with Proxy
```bash
# Start the proxy server
npm run dev

# Open http://localhost:8080 in browser
# Or serve the files via any web server
```

### Project Structure
```
AGNIHOTRA/
├── index.html          # Main app
├── script.js           # Core functionality
├── style.css           # Styling
├── cors-proxy.js       # CORS bypass server
├── package.json        # Node.js dependencies
└── README.md           # This file
```

## 🔒 Security Notes

- **CORS bypass methods are for development/personal use only**
- **Don't use CORS-disabled browsers for general browsing**
- **The proxy server only forwards requests to homatherapie.de**

## 🌍 Location Privacy

- **GPS data**: Never stored, only used for timing calculations
- **IP geolocation**: Uses free services, no tracking
- **No data collection**: Everything runs client-side

## 📖 Agnihotra Practice

This app provides the precise timing needed for traditional Agnihotra fire ceremonies:

- **Sunrise timing**: For morning Agnihotra
- **Sunset timing**: For evening Agnihotra  
- **Seconds precision**: Essential for proper practice
- **Location-specific**: Accurate for your exact coordinates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both APIs
5. Submit a pull request

## License

MIT License - Feel free to use for personal or educational purposes.

---

**May your Agnihotra practice bring peace and healing to the world**
 