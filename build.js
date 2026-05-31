const fs = require('fs');
const path = require('path');
const enableTestReminder =
  String(process.env.AGNI_ENABLE_TEST_REMINDER ?? 'false').toLowerCase() !== 'false';
const enableDebugOverlay =
  String(process.env.AGNI_ENABLE_DEBUG_OVERLAY ?? 'false').toLowerCase() !== 'false';
const forceOfflineMode =
  String(process.env.AGNI_FORCE_OFFLINE ?? 'false').toLowerCase() !== 'false';
const enableRemoteLogCapture =
  String(process.env.AGNI_ENABLE_REMOTE_LOG_CAPTURE ?? 'false').toLowerCase() !== 'false';
const sentryDsn = String(process.env.AGNI_SENTRY_DSN ?? '').trim();
const appRelease = String(
  process.env.AGNI_APP_RELEASE ??
    process.env.npm_package_version ??
    'dev'
).trim();
const appEnv = String(process.env.AGNI_APP_ENV ?? process.env.NODE_ENV ?? 'production').trim();
const testReminderSeconds = Math.max(
  5,
  Number.parseInt(process.env.AGNI_TEST_REMINDER_SECONDS ?? '20', 10) || 20
);

function escapeForInlineConfig(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

// Create public directory if it doesn't exist
const publicDir = 'public';
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory');
}

// Files to copy to public directory
const filesToCopy = [
    'index.html',
    'settings.html',
    'support.html',
    'manifest.webmanifest',
    'translations.json',
    'shared/notifications/core.js',
    'shared/audio/bell.js',
    'shared/app/audio-controls.js',
    'shared/app/permissions-gate.js',
    'shared/app/saved-places.js',
    'shared/app/ota-updater.js',
    'shared/diagnostics/instrumentation.js',
    'shared/diagnostics/payload-builder.js',
    'shared/diagnostics/support-runtime.js',
    'shared/settings/settings-page.js',
    'adapters/web/notifications.adapter.js',
    'adapters/android/notifications.adapter.js',
    'notifications.js',
    'timings-engine.js',
    'shared/export/pdf-export.js',
    'shared/export/ics-export.js',
    'vendor/jspdf.umd.min.js',
    'script.js', 
    'style.css',
    'assets/images/eternalagni-icon.png',
    'assets/images/app-icon-192.png',
    'assets/images/app-icon.png',
    'assets/screenshots/home-desktop.png',
    'assets/screenshots/home-portrait.png',
    'assets/audio/mantras/sunrise-mantra.mpeg',
    'assets/audio/mantras/sunset-mantra.mpeg',
    'assets/audio/mantras/panchasheel-pratidnya.mpeg',
    'assets/audio/mantras/saptashloki.mpeg',
    'assets/audio/mantras/trisatya-sharanagati.mpeg',
    'assets/video/fire-background.mp4',
    'assets/images/copper-pyramid.jpg',
    'assets/images/cow-dung-cakes.webp',
    'assets/images/cow-ghee.jpg',
    'assets/images/unpolished-rice-grains.jpg',
    'assets/images/agnihotra-timing-reference.jpg',
    'assets/audio/alerts/agnihotra-single-bell.mp3',
    'assets/audio/alerts/agnihotra-bell-3x.mp3',
    'sw.js'
];

// Folders to copy to public directory
const foldersToCopy = [
    'api'
];

// Copy each file
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        const destinationPath = path.join(publicDir, file);
        const destinationDir = path.dirname(destinationPath);
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
        }
        if (file === 'index.html') {
            let indexContent = fs.readFileSync(file, 'utf8');
            indexContent = indexContent
                .replace(/__AGNI_ENABLE_TEST_REMINDER__/g, String(enableTestReminder))
                .replace(/__AGNI_ENABLE_DEBUG_OVERLAY__/g, String(enableDebugOverlay))
                .replace(/__AGNI_FORCE_OFFLINE__/g, String(forceOfflineMode))
                .replace(/__AGNI_TEST_REMINDER_SECONDS__/g, String(testReminderSeconds))
                .replace(/__AGNI_ENABLE_REMOTE_LOG_CAPTURE__/g, String(enableRemoteLogCapture))
                .replace(/__AGNI_SENTRY_DSN__/g, escapeForInlineConfig(sentryDsn))
                .replace(/__AGNI_APP_RELEASE__/g, escapeForInlineConfig(appRelease))
                .replace(/__AGNI_APP_ENV__/g, escapeForInlineConfig(appEnv));
            fs.writeFileSync(destinationPath, indexContent, 'utf8');
        } else {
            fs.copyFileSync(file, destinationPath);
        }
        console.log(`Copied ${file} to public/`);
    } else {
        console.log(`⚠️  File not found: ${file}`);
    }
});

// Copy folders recursively
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

foldersToCopy.forEach(folder => {
    if (fs.existsSync(folder)) {
        copyDir(folder, path.join(publicDir, folder));
        console.log(`Copied folder ${folder} to public/`);
    }
});

console.log('🎉 Build completed successfully!'); 