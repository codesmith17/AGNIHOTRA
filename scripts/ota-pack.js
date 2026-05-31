#!/usr/bin/env node
/**
 * Pack a self-hosted OTA bundle for EternalAgni.
 *
 * Produces (in release/ota/):
 *   - dist.zip      -> the contents of public/ (index.html at the zip root)
 *   - version.json  -> the manifest ota-updater.js reads
 *
 * Upload BOTH files as assets on a new GitHub Release of the public repo.
 * The app reads the LATEST release via:
 *   https://github.com/codesmith17/AGNIHOTRA/releases/latest/download/version.json
 *
 * Usage:
 *   npm run ota:pack            # version comes from package.json
 *   AGNI_OTA_MIN_NATIVE=1.0.1 npm run ota:pack
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "release", "ota");
const ZIP_PATH = path.join(OUT_DIR, "dist.zip");
const MANIFEST_PATH = path.join(OUT_DIR, "version.json");

const REPO = "codesmith17/AGNIHOTRA";
const DOWNLOAD_BASE = `https://github.com/${REPO}/releases/latest/download`;

function fail(message) {
  console.error(`\n[ota-pack] ERROR: ${message}\n`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = String(pkg.version || "").trim();
if (!version) fail("package.json has no version.");

const minNative = String(process.env.AGNI_OTA_MIN_NATIVE || pkg.otaMinNative || "1.0.1").trim();

if (!fs.existsSync(PUBLIC_DIR) || !fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
  fail("public/index.html not found. Run `npm run build` first.");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(ZIP_PATH)) fs.rmSync(ZIP_PATH);

// Zip the CONTENTS of public/ so index.html sits at the zip root (required by
// the capacitor-updater plugin). -r recurse, -q quiet, -X drop extra attrs.
try {
  execFileSync("zip", ["-r", "-q", "-X", ZIP_PATH, "."], {
    cwd: PUBLIC_DIR,
    stdio: "inherit",
  });
} catch (error) {
  fail(`zip failed (${error?.message || error}). Ensure the 'zip' CLI is installed.`);
}

const manifest = {
  version,
  url: `${DOWNLOAD_BASE}/dist.zip`,
  minNative,
  generatedAt: new Date().toISOString(),
  notes: process.env.AGNI_OTA_NOTES || "",
};
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const zipBytes = fs.statSync(ZIP_PATH).size;
console.log("\n[ota-pack] OK");
console.log(`  version    : ${version}`);
console.log(`  minNative  : ${minNative}`);
console.log(`  dist.zip   : ${ZIP_PATH} (${(zipBytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  version.json: ${MANIFEST_PATH}`);
console.log("\nNext: create a GitHub Release and attach BOTH files as assets.");
console.log(`  gh release create v${version} "${ZIP_PATH}" "${MANIFEST_PATH}" --title "OTA v${version}" --notes "OTA web bundle"\n`);
