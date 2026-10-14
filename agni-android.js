#!/usr/bin/env node

/**
 * Agnihotra Unified Cross-Platform Android Helper Script
 * 
 * Works out-of-the-box across all three operating systems:
 *   - Windows (PowerShell & Command Prompt)
 *   - macOS
 *   - Linux
 *
 * Usage:
 *   node agni-android.js <command> [args]
 *   npm run agni <command>
 *   ./agni-android.js <command> (Mac/Linux)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync, execSync } = require('child_process');

const isWindows = process.platform === 'win32';
const PROJECT_DIR = __dirname;
const ANDROID_DIR = path.join(PROJECT_DIR, 'android');
const DEBUG_APK = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const UNSIGNED_RELEASE_APK = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
const RELEASE_AAB = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
const DEFAULT_PACKAGE = 'com.eternalagni.app';
const DEFAULT_ACTIVITY = '.MainActivity';

// -----------------------------------------------------------------------------
// Terminal Colors
// -----------------------------------------------------------------------------
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

function logInfo(msg) {
  console.log(`${colors.cyan}==> ${msg}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✔ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.error(`${colors.red}✖ Error: ${msg}${colors.reset}`);
}

// -----------------------------------------------------------------------------
// SDK & Tool Discovery
// -----------------------------------------------------------------------------

function detectSdkDir() {
  const localProps = path.join(ANDROID_DIR, 'local.properties');
  if (fs.existsSync(localProps)) {
    const content = fs.readFileSync(localProps, 'utf8');
    const match = content.match(/^sdk\.dir\s*=\s*(.+)$/m);
    if (match) {
      let sdkPath = match[1].trim().replace(/\\\\/g, '\\');
      if (fs.existsSync(sdkPath)) return sdkPath;
    }
  }

  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }

  if (isWindows) {
    const winPath = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
    if (fs.existsSync(winPath)) return winPath;
  } else if (process.platform === 'darwin') {
    const macPath = path.join(os.homedir(), 'Library', 'Android', 'sdk');
    if (fs.existsSync(macPath)) return macPath;
  } else {
    const linuxPath = path.join(os.homedir(), 'Android', 'Sdk');
    if (fs.existsSync(linuxPath)) return linuxPath;
  }

  logError('Unable to detect Android SDK location. Please ensure android/local.properties exists.');
  process.exit(1);
}

function detectAdbPath() {
  try {
    const whichCmd = isWindows ? 'where adb' : 'which adb';
    const out = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    if (out && fs.existsSync(out)) return out;
  } catch (_) {}

  const sdkDir = detectSdkDir();
  const adbBin = isWindows ? 'adb.exe' : 'adb';
  const candidate = path.join(sdkDir, 'platform-tools', adbBin);
  if (fs.existsSync(candidate)) return candidate;

  logError(`adb binary not found in PATH or at ${candidate}`);
  process.exit(1);
}

function detectBuildToolsDir() {
  const sdkDir = detectSdkDir();
  const btPath = path.join(sdkDir, 'build-tools');
  if (!fs.existsSync(btPath)) {
    logError(`No build-tools directory found under: ${btPath}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(btPath).filter(d => fs.statSync(path.join(btPath, d)).isDirectory());
  if (entries.length === 0) {
    logError(`No build-tools version found under: ${btPath}`);
    process.exit(1);
  }

  entries.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return path.join(btPath, entries[0]);
}

function detectKeytoolPath() {
  try {
    const whichCmd = isWindows ? 'where keytool' : 'which keytool';
    const out = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    if (out && fs.existsSync(out)) return out;
  } catch (_) {}

  if (process.env.JAVA_HOME) {
    const bin = path.join(process.env.JAVA_HOME, 'bin', isWindows ? 'keytool.exe' : 'keytool');
    if (fs.existsSync(bin)) return bin;
  }

  if (isWindows) {
    const javaRoots = ['C:\\Program Files\\Java', 'C:\\Program Files (x86)\\Java'];
    for (const root of javaRoots) {
      if (fs.existsSync(root)) {
        try {
          const jdks = fs.readdirSync(root);
          for (const jdk of jdks) {
            const bin = path.join(root, jdk, 'bin', 'keytool.exe');
            if (fs.existsSync(bin)) return bin;
          }
        } catch (_) {}
      }
    }
  }
  return null;
}


function getVersionName() {
  const buildGradle = path.join(ANDROID_DIR, 'app', 'build.gradle');
  if (fs.existsSync(buildGradle)) {
    const content = fs.readFileSync(buildGradle, 'utf8');
    const match = content.match(/versionName\s+["']([^"']+)["']/);
    if (match) return match[1];
  }
  return '1.0.0';
}

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: PROJECT_DIR, stdio: ['pipe', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (_) {
    return 'nogit';
  }
}

function runCommand(command, args, cwd = PROJECT_DIR) {
  const isScript = typeof command === 'string' && (
    command.endsWith('.bat') || command.endsWith('.cmd') || command === 'npm' || command === 'npx'
  );
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: isWindows ? isScript : false });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureReleaseDir() {
  const dir = path.join(PROJECT_DIR, 'release', 'widget-screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// -----------------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------------

function showHelp() {
  console.log(`
${colors.bold}Agnihotra Cross-Platform Android Helper (Universal Script)${colors.reset}
Applicable for: Windows (PowerShell & CMD), macOS, and Linux.

${colors.bold}Usage:${colors.reset}
  node agni-android.js <command> [args]
  npm run agni <command>

${colors.bold}Core Commands:${colors.reset}
  ${colors.green}debug-build${colors.reset}
      Builds web bundle + syncs Capacitor + compiles native C++ and debug APK.
  
  ${colors.green}debug-install${colors.reset}
      Installs debug APK to connected device.

  ${colors.green}debug-run${colors.reset}
      Launches app on connected device.

  ${colors.green}debug-build-install-run${colors.reset}
      Executes build, install, and launch in one single step.

  ${colors.green}release-build${colors.reset}
      Builds unsigned release APK (sync + assembleRelease).

  ${colors.green}release-sign [output_name]${colors.reset}
      Zipaligns and signs release APK with debug keystore into release/.

  ${colors.green}release-build-sign [output_name]${colors.reset}
      Builds and signs release APK in one step.

  ${colors.green}release-bundle [output_name]${colors.reset}
      Builds and signs release Android App Bundle (.aab) with upload keystore.

  ${colors.green}release-install <apk_path>${colors.reset}
      Installs a specific release APK.

${colors.bold}ADB Device Commands:${colors.reset}
  ${colors.green}adb-devices${colors.reset}          List connected devices.
  ${colors.green}adb-connect <host:port>${colors.reset} Connect via Wi-Fi ADB.
  ${colors.green}adb-pair <host:port> <code>${colors.reset} Pair via Wi-Fi ADB.
  ${colors.green}adb-home${colors.reset}             Send HOME button event.
  ${colors.green}adb-logs${colors.reset}             Stream logcat logs.
  ${colors.green}adb-logs-location${colors.reset}    Stream location logs.
  ${colors.green}adb-logs-vibrate${colors.reset}     Stream vibration logs.
  ${colors.green}screenshot [file_name]${colors.reset} Capture screenshot from device.

${colors.bold}Examples:${colors.reset}
  node agni-android.js debug-build-install-run
  node agni-android.js release-build-sign
  node agni-android.js screenshot home.png
`);
}

function cmdDebugBuild() {
  logInfo('Building web assets...');
  runCommand('npm', ['run', 'build']);
  logInfo('Syncing Capacitor Android...');
  runCommand('npx', ['cap', 'sync', 'android']);
  logInfo('Compiling native C++ & assembling Debug APK...');
  const gradlew = isWindows ? path.join(ANDROID_DIR, 'gradlew.bat') : './gradlew';
  runCommand(gradlew, ['assembleDebug'], ANDROID_DIR);
  logSuccess('Debug APK build complete!');
}

function cmdDebugInstall() {
  const adb = detectAdbPath();
  if (!fs.existsSync(DEBUG_APK)) {
    logError(`Debug APK not found at: ${DEBUG_APK}. Run 'debug-build' first.`);
    process.exit(1);
  }
  logInfo('Installing Debug APK to device...');
  runCommand(adb, ['install', '-r', DEBUG_APK]);
  logSuccess('App installed successfully!');
}

function cmdDebugRun() {
  const adb = detectAdbPath();
  logInfo('Launching application on device...');
  runCommand(adb, ['shell', 'am', 'start', '-n', `${DEFAULT_PACKAGE}/${DEFAULT_ACTIVITY}`]);
  logSuccess('App launched!');
}

function cmdReleaseBuild() {
  logInfo('Building web assets...');
  runCommand('npm', ['run', 'build']);
  logInfo('Syncing Capacitor Android...');
  runCommand('npx', ['cap', 'sync', 'android']);
  logInfo('Compiling native C++ & assembling Release APK...');
  const gradlew = isWindows ? path.join(ANDROID_DIR, 'gradlew.bat') : './gradlew';
  runCommand(gradlew, ['assembleRelease'], ANDROID_DIR);
  logSuccess('Release build complete!');
}

function cmdReleaseSign(outputName) {
  ensureReleaseDir();
  const version = getVersionName();
  const hash = getGitHash();
  const finalName = outputName || `agnihotra-v${version}+${hash}-signed.apk`;
  const outputPath = path.join(PROJECT_DIR, 'release', finalName);
  const alignedApk = path.join(os.tmpdir(), 'agnihotra-release-aligned.apk');
  const btDir = detectBuildToolsDir();
  const zipalign = path.join(btDir, isWindows ? 'zipalign.exe' : 'zipalign');
  const apksigner = path.join(btDir, isWindows ? 'apksigner.bat' : 'apksigner');
  const keystore = path.join(os.homedir(), '.android', 'debug.keystore');

  if (!fs.existsSync(UNSIGNED_RELEASE_APK)) {
    logError(`Unsigned release APK not found at: ${UNSIGNED_RELEASE_APK}. Run 'release-build' first.`);
    process.exit(1);
  }

  if (fs.existsSync(alignedApk)) fs.unlinkSync(alignedApk);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  logInfo('Zipaligning APK...');
  runCommand(zipalign, ['-v', '-p', '4', UNSIGNED_RELEASE_APK, alignedApk]);

  logInfo('Signing APK with keystore...');
  runCommand(apksigner, [
    'sign',
    '--ks', keystore,
    '--ks-key-alias', 'androiddebugkey',
    '--ks-pass', 'pass:android',
    '--key-pass', 'pass:android',
    '--out', outputPath,
    alignedApk
  ]);

  logSuccess(`Signed APK saved to: ${outputPath}`);
  logInfo('Verifying APK signature:');
  runCommand(apksigner, ['verify', '--print-certs', outputPath]);
}

function cmdReleaseBundle(outputName) {
  ensureReleaseDir();
  logInfo('Building web assets...');
  runCommand('npm', ['run', 'build']);
  logInfo('Syncing Capacitor Android...');
  runCommand('npx', ['cap', 'sync', 'android']);
  logInfo('Compiling native C++ & assembling signed Release AAB bundle...');
  const gradlew = isWindows ? path.join(ANDROID_DIR, 'gradlew.bat') : './gradlew';
  runCommand(gradlew, ['bundleRelease'], ANDROID_DIR);

  if (!fs.existsSync(RELEASE_AAB)) {
    logError(`Built bundle not found at: ${RELEASE_AAB}`);
    process.exit(1);
  }

  const version = getVersionName();
  const finalName = outputName || `agnihotra-v${version}.aab`;
  const destPath = path.join(PROJECT_DIR, 'release', finalName);

  fs.copyFileSync(RELEASE_AAB, destPath);
  logSuccess(`Signed Release AAB bundle created at: ${destPath}`);

  const keytool = detectKeytoolPath();
  if (keytool) {
    try {
      logInfo('Verifying bundle signing certificate:');
      runCommand(keytool, ['-printcert', '-jarfile', destPath]);
    } catch (_) {}
  }
}

function cmdScreenshot(fileName) {
  ensureReleaseDir();
  const adb = detectAdbPath();
  const name = fileName || `screenshot-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.png`;
  const remote = `/sdcard/${name}`;
  const local = path.join(PROJECT_DIR, 'release', 'widget-screenshots', name);

  logInfo('Capturing screenshot from device...');
  runCommand(adb, ['shell', 'screencap', '-p', remote]);
  runCommand(adb, ['pull', remote, local]);
  runCommand(adb, ['shell', 'rm', remote]);
  logSuccess(`Screenshot saved to: ${local}`);
}

// -----------------------------------------------------------------------------
// Dispatcher
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = (args[0] || 'help').toLowerCase();
const arg1 = args[1] || '';
const arg2 = args[2] || '';

switch (command) {
  case 'help':
  case '-h':
  case '--help':
    showHelp();
    break;

  case 'debug-build':
    cmdDebugBuild();
    break;

  case 'debug-install':
    cmdDebugInstall();
    break;

  case 'debug-run':
    cmdDebugRun();
    break;

  case 'debug-build-install-run':
    cmdDebugBuild();
    cmdDebugInstall();
    cmdDebugRun();
    break;

  case 'release-build':
    cmdReleaseBuild();
    break;

  case 'release-sign':
    cmdReleaseSign(arg1);
    break;

  case 'release-build-sign':
    cmdReleaseBuild();
    cmdReleaseSign(arg1);
    break;

  case 'release-bundle':
  case 'bundle-release':
    cmdReleaseBundle(arg1);
    break;

  case 'release-install':
    if (!arg1) {
      logError('Usage: node agni-android.js release-install <apk_path>');
      process.exit(1);
    }
    runCommand(detectAdbPath(), ['install', '-r', arg1]);
    break;

  case 'adb-devices':
    runCommand(detectAdbPath(), ['devices', '-l']);
    break;

  case 'adb-connect':
    if (!arg1) {
      logError('Usage: node agni-android.js adb-connect <host:port>');
      process.exit(1);
    }
    runCommand(detectAdbPath(), ['connect', arg1]);
    break;

  case 'adb-pair':
    if (!arg1 || !arg2) {
      logError('Usage: node agni-android.js adb-pair <host:port> <code>');
      process.exit(1);
    }
    runCommand(detectAdbPath(), ['pair', arg1, arg2]);
    break;

  case 'adb-home':
    runCommand(detectAdbPath(), ['shell', 'input', 'keyevent', '3']);
    break;

  case 'adb-logs':
    runCommand(detectAdbPath(), ['logcat', '-v', 'time', '*:I']);
    break;

  case 'adb-logs-location': {
    const adb = detectAdbPath();
    const filter = isWindows ? 'findstr "AGNIHOTRA][LOCATION"' : 'grep "AGNIHOTRA\\]\\[LOCATION"';
    runCommand(adb, ['logcat', '-v', 'time', '*:I']);
    break;
  }

  case 'screenshot':
    cmdScreenshot(arg1);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}

