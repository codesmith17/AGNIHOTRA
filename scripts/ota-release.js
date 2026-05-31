#!/usr/bin/env node
/**
 * Publish the packed OTA bundle to GitHub Releases using the `gh` CLI.
 *
 * Run `npm run ota:pack` first (npm run ota:release does this for you).
 * Requires: GitHub CLI (`gh`) installed and authenticated (`gh auth login`).
 *
 * Creates (or replaces) a release tagged v<version> and uploads dist.zip +
 * version.json as assets. Because it is the newest published release, the app's
 * "/releases/latest/download/version.json" URL immediately points at it.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "release", "ota");
const ZIP_PATH = path.join(OUT_DIR, "dist.zip");
const MANIFEST_PATH = path.join(OUT_DIR, "version.json");

function fail(message) {
  console.error(`\n[ota-release] ERROR: ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(ZIP_PATH) || !fs.existsSync(MANIFEST_PATH)) {
  fail("dist.zip / version.json missing. Run `npm run ota:pack` first.");
}

let version = "";
try {
  version = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")).version;
} catch (_) {}
if (!version) fail("version.json has no version.");

const tag = `v${version}`;

try {
  execFileSync("gh", ["--version"], { stdio: "ignore" });
} catch (_) {
  fail("GitHub CLI `gh` not found. Install it or upload the two files manually.");
}

// If the tag/release already exists, replace its assets; otherwise create it.
let exists = false;
try {
  execFileSync("gh", ["release", "view", tag], { stdio: "ignore" });
  exists = true;
} catch (_) {}

try {
  if (exists) {
    console.log(`[ota-release] Updating existing release ${tag}...`);
    execFileSync(
      "gh",
      ["release", "upload", tag, ZIP_PATH, MANIFEST_PATH, "--clobber"],
      { stdio: "inherit" }
    );
  } else {
    console.log(`[ota-release] Creating release ${tag}...`);
    execFileSync(
      "gh",
      [
        "release",
        "create",
        tag,
        ZIP_PATH,
        MANIFEST_PATH,
        "--title",
        `OTA ${tag}`,
        "--notes",
        "Self-hosted OTA web bundle for EternalAgni.",
        "--latest",
      ],
      { stdio: "inherit" }
    );
  }
} catch (error) {
  fail(`gh release failed: ${error?.message || error}`);
}

console.log(`\n[ota-release] Published ${tag}. Devices will pick it up in the background.\n`);
