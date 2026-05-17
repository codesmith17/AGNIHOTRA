#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
DEBUG_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
UNSIGNED_RELEASE_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release-unsigned.apk"
DEFAULT_PACKAGE="com.eternalagni.app"
DEFAULT_ACTIVITY=".MainActivity"

usage() {
  cat <<'EOF'
Agnihotra Android helper script

Usage:
  ./agni-android.sh <command> [args]

Core commands:
  help
      Show this help.

  debug-build
      Build debug APK (sync + assembleDebug).

  debug-install
      Install debug APK to connected adb device.

  debug-run
      Launch installed app on connected device.

  debug-build-install-run
      Build debug APK, install, then launch.

  release-build
      Build unsigned release APK (sync + assembleRelease).

  release-sign [output_name]
      Sign unsigned release APK with debug keystore and save to release/.
      If output_name is omitted, filename is:
      agnihotra-v<version>+<gitHash>-signed.apk

  release-build-sign [output_name]
      Build release then sign in one step.

  release-install <apk_path>
      Install a specific release APK to connected device.

ADB commands:
  adb-devices
      Show connected devices.

  adb-connect <host:port>
      Connect to device over Wi-Fi adb.

  adb-pair <host:port> <pairing_code>
      Pair device over Wi-Fi adb.

  adb-home
      Send HOME key event.

  adb-logs
      Stream informative logcat.

  adb-logs-location
      Stream only AGNI location logs.

  screenshot [file_name]
      Take screenshot from device and save under release/widget-screenshots/.
      Default file_name: screenshot-YYYYmmdd-HHMMSS.png

Examples:
  ./agni-android.sh debug-build-install-run
  ./agni-android.sh release-build-sign
  ./agni-android.sh release-install release/agnihotra-v1.0.1+abcd123-signed.apk
  ./agni-android.sh adb-connect 192.168.1.4:5555
  ./agni-android.sh screenshot widget-after-fix.png
EOF
}

ensure_release_dir() {
  mkdir -p "$PROJECT_DIR/release/widget-screenshots"
}

detect_sdk_dir() {
  if [[ -f "$ANDROID_DIR/local.properties" ]]; then
    awk -F= '/^sdk.dir=/{print $2; exit}' "$ANDROID_DIR/local.properties"
    return 0
  fi
  return 1
}

detect_build_tools_dir() {
  local sdk_dir
  sdk_dir="$(detect_sdk_dir)"
  if [[ -z "${sdk_dir:-}" ]]; then
    echo "Unable to find sdk.dir in android/local.properties" >&2
    exit 1
  fi
  local bt_version
  bt_version="$(ls "$sdk_dir/build-tools" | sort -V | awk 'END{print}')"
  if [[ -z "${bt_version:-}" ]]; then
    echo "No Android build-tools found under: $sdk_dir/build-tools" >&2
    exit 1
  fi
  echo "$sdk_dir/build-tools/$bt_version"
}

detect_version_name() {
  awk '/versionName/{gsub(/"/,"",$2); print $2; exit}' "$ANDROID_DIR/app/build.gradle"
}

detect_git_hash() {
  git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "nogit"
}

cmd_debug_build() {
  (cd "$PROJECT_DIR" && npm run android:apk)
}

cmd_debug_install() {
  adb install -r "$DEBUG_APK"
}

cmd_debug_run() {
  adb shell am start -n "$DEFAULT_PACKAGE/$DEFAULT_ACTIVITY"
}

cmd_release_build() {
  (cd "$PROJECT_DIR" && npm run android:sync && cd android && ./gradlew assembleRelease)
}

cmd_release_sign() {
  ensure_release_dir
  local output_name="${1:-}"
  local version hash
  version="$(detect_version_name)"
  hash="$(detect_git_hash)"
  if [[ -z "$output_name" ]]; then
    output_name="agnihotra-v${version}+${hash}-signed.apk"
  fi
  local output_path="$PROJECT_DIR/release/$output_name"
  local aligned_apk="/tmp/agnihotra-release-aligned.apk"
  local bt_dir
  bt_dir="$(detect_build_tools_dir)"

  if [[ ! -f "$UNSIGNED_RELEASE_APK" ]]; then
    echo "Unsigned release APK not found. Run: ./agni-android.sh release-build" >&2
    exit 1
  fi

  rm -f "$aligned_apk" "$output_path" "$output_path.idsig"
  "$bt_dir/zipalign" -v -p 4 "$UNSIGNED_RELEASE_APK" "$aligned_apk" >/dev/null
  "$bt_dir/apksigner" sign \
    --ks "$HOME/.android/debug.keystore" \
    --ks-key-alias androiddebugkey \
    --ks-pass pass:android \
    --key-pass pass:android \
    --out "$output_path" \
    "$aligned_apk"

  echo "Signed APK: $output_path"
  "$bt_dir/apksigner" verify --print-certs "$output_path"
}

cmd_release_install() {
  local apk_path="${1:-}"
  if [[ -z "$apk_path" ]]; then
    echo "Usage: ./agni-android.sh release-install <apk_path>" >&2
    exit 1
  fi
  adb install -r "$apk_path"
}

cmd_adb_logs_location() {
  adb logcat -v time '*:I' | awk '/AGNIHOTRA\]\[LOCATION/ { print }'
}

cmd_screenshot() {
  ensure_release_dir
  local file_name="${1:-}"
  if [[ -z "$file_name" ]]; then
    file_name="screenshot-$(date +%Y%m%d-%H%M%S).png"
  fi
  local remote="/sdcard/$file_name"
  local local_path="$PROJECT_DIR/release/widget-screenshots/$file_name"
  adb shell screencap -p "$remote"
  adb pull "$remote" "$local_path"
  adb shell rm "$remote"
  echo "Saved screenshot: $local_path"
}

command="${1:-help}"
shift || true

case "$command" in
  help|-h|--help) usage ;;
  debug-build) cmd_debug_build ;;
  debug-install) cmd_debug_install ;;
  debug-run) cmd_debug_run ;;
  debug-build-install-run) cmd_debug_build; cmd_debug_install; cmd_debug_run ;;
  release-build) cmd_release_build ;;
  release-sign) cmd_release_sign "${1:-}" ;;
  release-build-sign) cmd_release_build; cmd_release_sign "${1:-}" ;;
  release-install) cmd_release_install "${1:-}" ;;
  adb-devices) adb devices -l ;;
  adb-connect) adb connect "${1:?Usage: ./agni-android.sh adb-connect <host:port>}" ;;
  adb-pair) adb pair "${1:?Usage: ./agni-android.sh adb-pair <host:port> <code>}" "${2:?Usage: ./agni-android.sh adb-pair <host:port> <code>}" ;;
  adb-home) adb shell input keyevent 3 ;;
  adb-logs) adb logcat -v time '*:I' ;;
  adb-logs-location) cmd_adb_logs_location ;;
  screenshot) cmd_screenshot "${1:-}" ;;
  *)
    echo "Unknown command: $command" >&2
    usage
    exit 1
    ;;
esac
