# Self-hosted OTA updates (free, GitHub Releases)

Push **HTML / JS / CSS** fixes to installed APKs without a Play Store build and
**without any paid service** (no Capgo cloud, no subscription). Native plugins,
notification channels, and `AndroidManifest` changes still need a new APK.

We keep the open-source `@capgo/capacitor-updater` plugin purely as the on-device
download/apply engine and run it in **manual mode** — it never contacts Capgo.

## How it behaves on the device (the important part)

`shared/app/ota-updater.js` is loaded on every page and is built so it can
**never** degrade normal usage:

- **Bad / no internet never hurts the app.** The version check is deferred until
  ~6s after launch, time-boxed (8s), throttled to once per hour, and fully
  wrapped in try/catch. Offline or a failed fetch simply does nothing — the app
  keeps running the bundle it already has.
- **The running session is never interrupted.** New bundles are fetched with
  `download()` and queued with `next()`. The plugin applies the queued bundle
  **only when the app is backgrounded or relaunched** — we never call `set()` or
  `reload()`. A user mid-Agnihotra is never yanked out or reloaded.
- **Broken bundles roll back automatically.** `notifyAppReady()` runs within
  seconds on every page. If a freshly applied bundle fails to boot, the plugin
  reverts to the last known-good bundle on the next start.
- **Never around sunrise / sunset (Agnihotra blackout).** Updates are not
  downloaded or queued in a window of **45 min before to 30 min after** each
  day's sunrise and sunset (read from the same `agnihotra_timings_cache`).
  If timings are not known yet (e.g. fresh install), a **wide safe default**
  blackout is used instead: **04:00–12:00** and **16:00–21:00** local time. As
  an extra layer, if a bundle is queued while a ritual window is approaching, it
  is held (via `setMultiDelay` with a `date` condition) so it cannot be applied
  on background until the window passes. The check retries after the window.

Watch it live:

```bash
./agni-android.sh adb-logs-ota
```

Look for `queued-for-next-launch`, `up-to-date`, `skip offline`,
`skip agnihotra-blackout`, `apply-delayed-past-ritual`, or
`blocked-needs-new-apk`.

## One-time setup

1. The repo is public: `github.com/codesmith17/AGNIHOTRA`. The app reads:
   `https://github.com/codesmith17/AGNIHOTRA/releases/latest/download/version.json`
2. Build and install a **new APK once** (it carries the updater plugin):

   ```bash
   ./agni-android.sh release-build-sign agnihotra-ota-v1.apk
   ```

   Older APKs without the plugin must install this build before OTA works.

## Publishing an update

### Option A — GitHub Actions (recommended, hands-off)

Bump `version` in `package.json`, then push a tag:

```bash
git tag v1.0.2 && git push origin v1.0.2
```

`.github/workflows/ota-release.yml` builds, zips `public/`, writes
`version.json`, builds a **debug ("test") APK** and a **signed release APK**,
and publishes a **latest** GitHub Release with all four assets:

- `version.json` + `dist.zip` — the OTA web bundle (auto-applied by installed apps)
- `agnihotra-v<version>-test-debug.apk` — debug build with verbose logs
- `agnihotra-v<version>-release.apk` — release build (debug-signed, installable)

You can also run it manually from the Actions tab (workflow_dispatch).

### Option B — from your machine

```bash
npm run ota:release      # build + pack + publish via gh CLI
# or just build the files and upload them yourself:
npm run ota:pack         # creates release/ota/dist.zip + version.json
```

`ota:release` needs the GitHub CLI (`gh auth login`). It creates/updates a
release tagged `v<version>` with the two assets.

## version.json format

```json
{
  "version": "1.0.2",
  "url": "https://github.com/codesmith17/AGNIHOTRA/releases/latest/download/dist.zip",
  "minNative": "1.0.1",
  "generatedAt": "2026-05-31T12:00:00.000Z",
  "notes": ""
}
```

- **version** — must be greater than the device's current bundle version to apply.
- **url** — the `dist.zip` (contents of `public/`, `index.html` at the zip root).
- **minNative** — floor APK version. If a bundle needs a newer native shell (new
  plugin / permission), raise this; older APKs will skip it until users install a
  new APK. Override at pack time with `AGNI_OTA_MIN_NATIVE=1.0.2 npm run ota:pack`.

## What can / cannot go over OTA

| OTA OK | Needs new APK |
|--------|----------------|
| `script.js`, `style.css`, `*.html` | New Capacitor plugin |
| `shared/**`, `translations.json` | `AndroidManifest` / permissions |
| Notification **logic** in JS | Notification **channel** IDs (Android) |

## Troubleshooting

- **No update on device** — APK must be the one built after the updater was
  added; check `adb-logs-ota` for `up-to-date` vs `skip offline` vs
  `blocked-needs-new-apk`.
- **Update not applied yet** — by design it applies on the next background/restart,
  not mid-session. Background the app or relaunch.
- **Rollback happened** — a bundle failed `notifyAppReady()`; fix and publish a
  higher version.
