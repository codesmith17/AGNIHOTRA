// --- Astronomical Constants (Meeus/NOAA SPA) ---
const ASTRONOMICAL_CONSTANTS = {
  JULIAN_DAY_AT_UNIX_EPOCH: 2440587.5,
  JULIAN_DAY_AT_J2000: 2451545.0,
  DAYS_PER_JULIAN_CENTURY: 36525,
  MILLISECONDS_PER_DAY: 86400000,
  MILLISECONDS_PER_HOUR: 3600000,

  // Geometric Mean Longitude Constants
  SUN_MEAN_LONGITUDE_J2000: 280.46646,
  SUN_MEAN_LONGITUDE_COEFF_1: 36000.76983,
  SUN_MEAN_LONGITUDE_COEFF_2: 0.0003032,

  // Mean Anomaly Constants
  SUN_MEAN_ANOMALY_J2000: 357.52911,
  SUN_MEAN_ANOMALY_COEFF_1: 35999.05029,
  SUN_MEAN_ANOMALY_COEFF_2: 0.0001537,

  // Orbit Eccentricity Constants
  EARTH_ORBIT_ECCENTRICITY_J2000: 0.016708634,
  EARTH_ORBIT_ECCENTRICITY_COEFF_1: 0.000042037,
  EARTH_ORBIT_ECCENTRICITY_COEFF_2: 0.0000001267,

  // Equation of Center Constants
  SUN_EQ_CENTER_COEFF_1: 1.914602,
  SUN_EQ_CENTER_COEFF_2: 0.004817,
  SUN_EQ_CENTER_COEFF_3: 0.000014,
  SUN_EQ_CENTER_COEFF_4: 0.019993,
  SUN_EQ_CENTER_COEFF_5: 0.000101,
  SUN_EQ_CENTER_COEFF_6: 0.000289,

  // Moon/Nutation Constants
  MOON_ASCENDING_NODE_J2000: 125.04,
  MOON_ASCENDING_NODE_COEFF_1: 1934.136,
  SUN_APPARENT_LONGITUDE_CONST_1: 0.00569,
  SUN_APPARENT_LONGITUDE_CONST_2: 0.00478,

  // Obliquity Constants
  MEAN_OBLIQUITY_J2000_BASE: 23,
  MEAN_OBLIQUITY_J2000_MIN: 26,
  MEAN_OBLIQUITY_COEFF_1: 21.448,
  MEAN_OBLIQUITY_COEFF_2: 46.815,
  MEAN_OBLIQUITY_COEFF_3: 0.00059,
  MEAN_OBLIQUITY_COEFF_4: 0.001813,
  NUTATION_OBLIQUITY_COEFF: 0.00256,
};

// --- Astronomical Calculation (Homatherapy Germany Style) ---
/**
 * IMPORTANT NOTE ON AGNIHOTRA TIMINGS:
 * Agnihotra sunrise/sunset is DIFFERENT from the "actual" (visual) sunrise/sunset seen in news or weather apps.
 *
 * 1. VISUAL SUNRISE: Occurs when the top edge (upper limb) of the sun appears on the horizon.
 *    Calculated at altitude -0.833° to account for atmospheric refraction and the sun's radius.
 *
 * 2. AGNIHOTRA SUNRISE: Occurs when the CENTER of the sun's disk is exactly on the mathematical horizon.
 *    Calculated at altitude 0.0° with NO atmospheric refraction.
 *
 * This is why Agnihotra timings may differ by 2-4 minutes from standard weather reports.
 * High-precision Agnihotra timing calculation based on Meeus/NOAA SPA.
 */
function calculateAgnihotraTiming(dateUTC, lat, lon, tzHours) {
  const degreesToRadians = Math.PI / 180;
  const radiansToDegrees = 180 / Math.PI;

  /**
   * Internal helper to compute sun details for a specific timestamp.
   * Sources:
   * - Jean Meeus, "Astronomical Algorithms" (2nd Ed.)
   * - NOAA Solar Calculation Details: https://gml.noaa.gov/grad/solcalc/calcdetails.html
   */
  function getSunDetails(timestampUTC) {
    /**
     * 1. TIME & EPOCH
     * julianDay: A continuous count of days since 4713 BCE. Standardizes time across eras. (Meeus Ch. 7)
     */
    const julianDay =
      timestampUTC / ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_DAY +
      ASTRONOMICAL_CONSTANTS.JULIAN_DAY_AT_UNIX_EPOCH;
    /**
     * julianCentury: Number of 100-year blocks since Jan 1, 2000. Tracks secular orbital drift. (Meeus Eq. 25.1)
     */
    const julianCentury =
      (julianDay - ASTRONOMICAL_CONSTANTS.JULIAN_DAY_AT_J2000) /
      ASTRONOMICAL_CONSTANTS.DAYS_PER_JULIAN_CENTURY;

    /**
     * 2. ORBITAL POSITION
     * sunGeometricMeanLongitude: The Sun's "average" position if Earth's orbit were a circle. (Meeus Eq. 25.2)
     */
    let sunGeometricMeanLongitude =
      ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_J2000 +
      julianCentury *
        (ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_COEFF_1 +
          ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_COEFF_2 * julianCentury);
    sunGeometricMeanLongitude = ((sunGeometricMeanLongitude % 360) + 360) % 360;

    /**
     * sunMeanAnomaly: Earth's "starting point" in its loop relative to Perihelion (closest point to Sun). (Meeus Eq. 25.3)
     */
    const sunMeanAnomaly =
      ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_J2000 +
      julianCentury *
        (ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_COEFF_1 -
          ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_COEFF_2 * julianCentury);

    /**
     * earthOrbitEccentricity: Measures how "oval" Earth's orbit is (changes slightly every century). (Meeus Eq. 25.4)
     */
    const earthOrbitEccentricity =
      ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_J2000 -
      julianCentury *
        (ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_COEFF_1 +
          ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_COEFF_2 *
            julianCentury);

    /**
     * 3. CORRECTIONS & ACCURACY
     * sunEquationOfCenter: Keplerian correction for Earth's non-uniform speed in its oval orbit. (Meeus Ch. 25)
     */
    const sunEquationOfCenter =
      Math.sin(degreesToRadians * sunMeanAnomaly) *
        (ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_1 -
          julianCentury *
            (ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_2 +
              ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_3 * julianCentury)) +
      Math.sin(degreesToRadians * 2 * sunMeanAnomaly) *
        (ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_4 -
          ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_5 * julianCentury) +
      Math.sin(degreesToRadians * 3 * sunMeanAnomaly) *
        ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_6;

    /**
     * sunTrueLongitude: The exact physical position of the Sun after orbital speed correction.
     */
    const sunTrueLongitude = sunGeometricMeanLongitude + sunEquationOfCenter;

    /**
     * moonAscendingNodeLongitude: Tracks Moon's position to calculate Nutation (Earth's axis wobble).
     */
    const moonAscendingNodeLongitude =
      ASTRONOMICAL_CONSTANTS.MOON_ASCENDING_NODE_J2000 -
      ASTRONOMICAL_CONSTANTS.MOON_ASCENDING_NODE_COEFF_1 * julianCentury;

    /**
     * sunApparentLongitude: Sun's apparent position from Earth, correcting for wobble and light time.
     */
    const sunApparentLongitude =
      sunTrueLongitude -
      ASTRONOMICAL_CONSTANTS.SUN_APPARENT_LONGITUDE_CONST_1 -
      ASTRONOMICAL_CONSTANTS.SUN_APPARENT_LONGITUDE_CONST_2 *
        Math.sin(degreesToRadians * moonAscendingNodeLongitude);

    /**
     * 4. EARTH'S TILT (SEASONS)
     * meanObliquityOfEcliptic: Average tilt of Earth's axis (~23.44°). (Meeus Eq. 22.2)
     */
    const meanObliquityOfEcliptic =
      ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_J2000_BASE +
      (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_J2000_MIN +
        (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_1 -
          julianCentury *
            (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_2 +
              julianCentury *
                (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_3 -
                  julianCentury * ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_4))) /
          60) /
        60;

    /**
     * correctedObliquityOfEcliptic: Precise axis tilt at this exact moment, including Moon's wobble.
     */
    const correctedObliquityOfEcliptic =
      meanObliquityOfEcliptic +
      ASTRONOMICAL_CONSTANTS.NUTATION_OBLIQUITY_COEFF *
        Math.cos(degreesToRadians * moonAscendingNodeLongitude);

    /**
     * sunApparentDeclination: The "height" of the Sun relative to the Equator. Determines day length.
     */
    const sunApparentDeclination = Math.asin(
      Math.sin(degreesToRadians * correctedObliquityOfEcliptic) *
        Math.sin(degreesToRadians * sunApparentLongitude)
    );

    /**
     * 5. TIMING
     * equationOfTime: Fixes the gap between "Sundial Time" and "Clock Time" caused by Earth's variable speed. (Meeus Ch. 28)
     */
    const tangentSquaredObliquity = Math.pow(
      Math.tan(degreesToRadians * (correctedObliquityOfEcliptic / 2)),
      2
    );
    const equationOfTime =
      4 *
      radiansToDegrees *
      (tangentSquaredObliquity *
        Math.sin(2 * degreesToRadians * sunGeometricMeanLongitude) -
        2 * earthOrbitEccentricity * Math.sin(degreesToRadians * sunMeanAnomaly) +
        4 *
          earthOrbitEccentricity *
          tangentSquaredObliquity *
          Math.sin(degreesToRadians * sunMeanAnomaly) *
          Math.cos(2 * degreesToRadians * sunGeometricMeanLongitude) -
        0.5 *
          tangentSquaredObliquity *
          tangentSquaredObliquity *
          Math.sin(4 * degreesToRadians * sunGeometricMeanLongitude) -
        1.25 *
          earthOrbitEccentricity *
          earthOrbitEccentricity *
          Math.sin(2 * degreesToRadians * sunMeanAnomaly));

    return { sunApparentDeclination, equationOfTime };
  }

  /**
   * ITERATIVE REFINEMENT
   * Agnihotra requires exact sunrise/sunset. Since the Sun's position changes
   * between solar noon and the horizon event, we perform a second pass
   * to recalculate the Sun's state at the estimated event time.
   */
  let initialSunDetails = getSunDetails(dateUTC.getTime());

  // Hour Angle for altitude = 0° (Mathematical Horizon):
  // cos(H) = (sin(h) - sin(lat)*sin(delta)) / (cos(lat)*cos(delta))
  // For Agnihotra h=0, so sin(h)=0. Simplifies to: -tan(lat)*tan(delta)
  const cosineOfHourAngle =
    -Math.tan(lat * degreesToRadians) *
    Math.tan(initialSunDetails.sunApparentDeclination);

  // Handle polar day/night
  if (cosineOfHourAngle < -1 || cosineOfHourAngle > 1) return null;

  const hourAngle = Math.acos(cosineOfHourAngle) * radiansToDegrees;
  const solarNoonAtNoonDetails =
    12 + tzHours - lon / 15 - initialSunDetails.equationOfTime / 60;

  // Pass 2: Refine Sunrise
  const approximateSunriseUTC =
    dateUTC.getTime() +
    (solarNoonAtNoonDetails - hourAngle / 15 - tzHours) *
      ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_HOUR;
  const sunriseDetails = getSunDetails(approximateSunriseUTC);
  const refinedHourAngleSunrise =
    Math.acos(
      -Math.tan(lat * degreesToRadians) *
        Math.tan(sunriseDetails.sunApparentDeclination)
    ) * radiansToDegrees;
  const refinedSunrise =
    12 +
    tzHours -
    lon / 15 -
    sunriseDetails.equationOfTime / 60 -
    refinedHourAngleSunrise / 15;

  // Pass 2: Refine Sunset
  const approximateSunsetUTC =
    dateUTC.getTime() +
    (solarNoonAtNoonDetails + hourAngle / 15 - tzHours) *
      ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_HOUR;
  const sunsetDetails = getSunDetails(approximateSunsetUTC);
  const refinedHourAngleSunset =
    Math.acos(
      -Math.tan(lat * degreesToRadians) *
        Math.tan(sunsetDetails.sunApparentDeclination)
    ) * radiansToDegrees;
  const refinedSunset =
    12 +
    tzHours -
    lon / 15 -
    sunsetDetails.equationOfTime / 60 +
    refinedHourAngleSunset / 15;

  return { sunrise: refinedSunrise, sunset: refinedSunset };
}

// Convert decimal hours to HH:MM:SS with exact rounding
function formatHoursToHMS(h) {
  if (h === null) return "--:--:--";
  let sec = Math.round(h * 3600);
  sec = (sec + 86400) % 86400;
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(
    2,
    "0"
  )}:${String(ss).padStart(2, "0")}`;
}

// Function to generate local 6-month timings
function generateLocal6MonthTimings(lat, lng) {
  const timingsMap = {};
  const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
  const startDate = new Date();

  for (let i = 0; i < 183; i++) {
    // Approx 6 months
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);

    // Use UTC date for consistent astronomical calculation
    const dateUTC = new Date(
      Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      )
    );
    const timings = calculateAgnihotraTiming(dateUTC, lat, lng, tzOffsetHours);

    if (timings) {
      const dateStr = formatDateToDDMMYYYY(currentDate);
      timingsMap[dateStr] = {
        date: dateStr,
        sunrise: formatHoursToHMS(timings.sunrise),
        sunset: formatHoursToHMS(timings.sunset),
      };
    }
  }
  return timingsMap;
}

// Function to format date to DD.MM.YYYY format
function formatDateToDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

const CACHE_KEY = "agnihotra_timings_cache";
const CACHE_EXPIRY_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds
const TRANSLATION_STORAGE_KEY = "agnihotra_language";
const DEBUG_STORAGE_KEY = "agnihotra_debug";
const LAST_KNOWN_LOCATION_KEY = "agnihotra_last_known_location";
const EXPORT_FILE_REGISTRY_KEY = "agnihotra_export_file_registry_v1";
const EXPORT_NOTIFICATION_CHANNEL_ID = "agnihotra-export-default-v2";
const LOCATION_NAME_REFRESH_DISTANCE_KM = 3;
const REQUIRE_MANDATORY_LOCATION_PERMISSION = true;
const REQUIRE_MANDATORY_NOTIFICATION_PERMISSION = true;
let translations = {};
let latestTimingsForNativeReminders = null;
let latestExportLocationMeta = null;
let agnihotraMainInitStarted = false;
let permissionGateBound = false;
const exportNotificationReceiptWaiters = new Map();

function markExportNotificationReceived(notificationId, meta = {}) {
  if (!notificationId || !exportNotificationReceiptWaiters.has(notificationId)) return;
  const waiter = exportNotificationReceiptWaiters.get(notificationId);
  clearTimeout(waiter.timeoutHandle);
  exportNotificationReceiptWaiters.delete(notificationId);
  waiter.resolve({
    received: true,
    receivedAtMs: Date.now(),
    ...meta,
  });
}

function waitForExportNotificationReceipt(notificationId, timeoutMs = 4500) {
  if (!notificationId) {
    return Promise.resolve({ received: false, reason: "no-notification-id" });
  }
  return new Promise((resolve) => {
    const timeoutHandle = setTimeout(() => {
      exportNotificationReceiptWaiters.delete(notificationId);
      resolve({
        received: false,
        reason: "timeout",
        timedOutAtMs: Date.now(),
      });
    }, Math.max(500, timeoutMs));

    exportNotificationReceiptWaiters.set(notificationId, {
      resolve,
      timeoutHandle,
    });
  });
}

function getStoredLanguagePreference() {
  const saved = localStorage.getItem(TRANSLATION_STORAGE_KEY);
  return ["en", "hi", "mr"].includes(saved) ? saved : "en";
}

let currentLanguage = getStoredLanguagePreference();

function isNativeAppRuntime() {
  return Boolean(
    window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()
  );
}

function getRuntimeBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["false", "0", "off", "no"].includes(normalized)) return false;
      if (["true", "1", "on", "yes"].includes(normalized)) return true;
    }
  }
  return false;
}

function isForcedOfflineModeEnabled() {
  return getRuntimeBoolean(
    window.AGNI_RUNTIME_CONFIG?.forceOffline,
    window.AGNI_FORCE_OFFLINE
  );
}

function setupForcedOfflineMode() {
  if (!isForcedOfflineModeEnabled()) return;
  if (window.__agnihotraOfflineLockApplied) return;
  window.__agnihotraOfflineLockApplied = true;
  window.__agnihotraForcedOffline = true;
  console.info("[AGNIHOTRA][OFFLINE] forced-offline-mode-enabled");

  if (typeof window.fetch === "function") {
    window.fetch = (...args) => {
      const requestUrl = String(args?.[0] ?? "");
      console.warn("[AGNIHOTRA][OFFLINE] blocked-fetch", { url: requestUrl });
      return Promise.reject(new TypeError("Forced offline mode enabled"));
    };
  }

  if (typeof window.XMLHttpRequest === "function") {
    class OfflineLockedXMLHttpRequest extends window.XMLHttpRequest {
      send() {
        try {
          this.abort();
        } catch (_) {}
        console.warn("[AGNIHOTRA][OFFLINE] blocked-xhr");
        throw new Error("Forced offline mode enabled");
      }
    }
    window.XMLHttpRequest = OfflineLockedXMLHttpRequest;
  }

  if (typeof window.WebSocket === "function") {
    window.WebSocket = class OfflineLockedWebSocket {
      constructor(url) {
        console.warn("[AGNIHOTRA][OFFLINE] blocked-websocket", { url: String(url || "") });
        throw new Error("Forced offline mode enabled");
      }
    };
  }
}

function isEffectivelyOnline() {
  if (window.__agnihotraForcedOffline) return false;
  return Boolean(navigator.onLine);
}

function isDebugEnabled() {
  return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

function serializeForConsole(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function debugLog(stage, payload = null) {
  if (!isDebugEnabled()) return;
  if (payload === null) {
    console.log(`[AGNIHOTRA][${stage}]`);
  } else {
    console.log(`[AGNIHOTRA][${stage}] ${serializeForConsole(payload)}`);
  }
}

function locationLog(stage, payload = null) {
  if (payload === null) {
    console.info(`[AGNIHOTRA][LOCATION] ${stage}`);
  } else {
    console.info(`[AGNIHOTRA][LOCATION] ${stage} ${serializeForConsole(payload)}`);
  }
  window.__agnihotraLastLocationMeta = {
    stage,
    payload,
    at: new Date().toISOString()
  };
}

const DEBUG_OVERLAY_MAX_LINES = 120;
let debugOverlayInitialized = false;

function stringifyDebugValue(value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function ensureDebugOverlayContainer() {
  if (typeof document === "undefined" || !document.body) return null;
  let panel = document.getElementById("agnihotra-debug-overlay");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "agnihotra-debug-overlay";
  panel.className = "agnihotra-debug-overlay";
  panel.innerHTML = `
    <div class="agnihotra-debug-header">
      <span>Debug logs</span>
      <button id="agnihotra-debug-clear" type="button">Clear</button>
    </div>
    <div id="agnihotra-debug-lines" class="agnihotra-debug-lines"></div>
  `;
  document.body.appendChild(panel);
  const clearButton = document.getElementById("agnihotra-debug-clear");
  clearButton?.addEventListener("click", () => {
    const linesNode = document.getElementById("agnihotra-debug-lines");
    if (linesNode) linesNode.innerHTML = "";
  });
  return panel;
}

function pushDebugOverlayLine(level, args) {
  const message = args.map(stringifyDebugValue).join(" ");
  if (!message.includes("[AGNIHOTRA]")) return;
  const panel = ensureDebugOverlayContainer();
  if (!panel) return;
  const linesNode = document.getElementById("agnihotra-debug-lines");
  if (!linesNode) return;

  const line = document.createElement("div");
  line.className = `agnihotra-debug-line ${level}`;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  line.textContent = `${hh}:${mm}:${ss} ${message}`;
  linesNode.appendChild(line);

  while (linesNode.childElementCount > DEBUG_OVERLAY_MAX_LINES) {
    linesNode.removeChild(linesNode.firstChild);
  }
  linesNode.scrollTop = linesNode.scrollHeight;
}

function setupDebugOverlayLogger() {
  const enabled = getRuntimeBoolean(
    window.AGNI_RUNTIME_CONFIG?.enableDebugOverlay,
    window.AGNI_ENABLE_DEBUG_OVERLAY,
    window.AGNI_RUNTIME_CONFIG?.enableTestReminder,
    window.AGNI_ENABLE_TEST_REMINDER
  );
  if (!enabled) {
    const existing = document.getElementById("agnihotra-debug-overlay");
    if (existing) existing.remove();
    return;
  }
  if (debugOverlayInitialized) return;
  debugOverlayInitialized = true;
  ensureDebugOverlayContainer();
  ["log", "info", "warn", "error"].forEach((methodName) => {
    const original = console[methodName];
    if (typeof original !== "function") return;
    console[methodName] = (...args) => {
      original.apply(console, args);
      try {
        pushDebugOverlayLine(methodName, args);
      } catch (_) {}
    };
  });
}

function getMandatoryPermissionGate() {
  if (typeof document === "undefined" || !document.body) return null;
  let gate = document.getElementById("permission-gate");
  if (!gate) {
    gate = document.createElement("div");
    gate.id = "permission-gate";
    gate.className = "permission-gate hidden";
    gate.innerHTML = `
      <div class="permission-gate-card">
        <h3 class="permission-gate-title">Permissions required</h3>
        <p id="permission-gate-message" class="permission-gate-message">
          Location and notification permissions are required for Agnihotra reminders.
        </p>
        <div class="permission-gate-actions">
          <button id="permission-location-btn" type="button">Grant location</button>
          <button id="permission-notification-btn" type="button">Grant notifications</button>
          <button id="permission-settings-btn" type="button" class="secondary">Open app settings</button>
        </div>
      </div>
    `;
    document.body.appendChild(gate);
  }
  return gate;
}

function setPermissionGateVisible(visible, message = "") {
  const gate = getMandatoryPermissionGate();
  if (!gate) return;
  gate.classList.toggle("hidden", !visible);
  const messageElement = document.getElementById("permission-gate-message");
  if (messageElement && message) {
    messageElement.innerText = message;
  }
}

function isPermissionGateVisible() {
  const gate = document.getElementById("permission-gate");
  return Boolean(gate && !gate.classList.contains("hidden"));
}

async function getLocationPermissionState() {
  if (!navigator.geolocation) return "unavailable";
  if (!navigator.permissions?.query) return "prompt";
  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result?.state || "prompt";
  } catch (_) {
    return "prompt";
  }
}

async function requestMandatoryLocationPermission() {
  if (!navigator.geolocation) return false;
  try {
    const position = await getCurrentPositionAsync({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    if (position?.coords) {
      saveLastKnownLocation(position.coords.latitude, position.coords.longitude);
    }
    return true;
  } catch (error) {
    locationLog("mandatory-location-request-failed", {
      code: error?.code,
      message: error?.message,
    });
    return false;
  }
}

async function openNativeAppSettings() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin || typeof appPlugin.openSettings !== "function") return false;
  try {
    await appPlugin.openSettings();
    return true;
  } catch (_) {
    return false;
  }
}

async function evaluateMandatoryPermissions({ forcePrompt = false } = {}) {
  let locationGranted = !REQUIRE_MANDATORY_LOCATION_PERMISSION;
  let notificationGranted = !REQUIRE_MANDATORY_NOTIFICATION_PERMISSION;
  let locationState = "unknown";
  let notificationState = "unknown";

  if (REQUIRE_MANDATORY_NOTIFICATION_PERMISSION) {
    notificationState =
      (await window.AgnihotraNotifications?.getPermissionStatus?.()) || "unknown";
    if (forcePrompt) {
      notificationGranted = Boolean(
        await window.AgnihotraNotifications?.requestPermission({ force: true })
      );
      notificationState =
        (await window.AgnihotraNotifications?.getPermissionStatus?.()) || notificationState;
    } else {
      if (notificationState === "granted") {
        notificationGranted = true;
      } else {
        notificationGranted = Boolean(
          await window.AgnihotraNotifications?.ensurePermissionBootstrap?.()
        );
        notificationState =
          (await window.AgnihotraNotifications?.getPermissionStatus?.()) || notificationState;
      }
    }
  }

  if (REQUIRE_MANDATORY_LOCATION_PERMISSION) {
    locationState = await getLocationPermissionState();
    locationLog("mandatory-location-state", { state: locationState, forcePrompt });
    if (locationState === "granted" && !forcePrompt) {
      locationGranted = true;
    } else {
      locationGranted = await requestMandatoryLocationPermission();
      locationState = await getLocationPermissionState();
    }
  }

  const allGranted = locationGranted && notificationGranted;
  if (allGranted) {
    setPermissionGateVisible(false);
    return true;
  }

  const blocked = [];
  if (!locationGranted) blocked.push("location");
  if (!notificationGranted) blocked.push("notifications");
  const denied = [];
  if (!locationGranted && locationState === "denied") denied.push("location");
  if (!notificationGranted && notificationState === "denied") denied.push("notifications");
  const gateMessage =
    denied.length > 0
      ? `Permission denied for ${denied.join(
          " and "
        )}. Tap Open app settings, allow permission, then return here.`
      : `Please grant ${blocked.join(" and ")} permission${
          blocked.length > 1 ? "s" : ""
        } to continue.`;
  setLocationLoading(false);
  setPermissionGateVisible(true, gateMessage);
  return false;
}

async function continueAppInitialization() {
  if (agnihotraMainInitStarted) return;
  agnihotraMainInitStarted = true;
  window.AgnihotraNotifications?.setup();
  // Preload the native bell on app start so .playInstant() is gapless later.
  window.AgnihotraBell?.preload?.().catch((err) =>
    console.warn("[AGNIHOTRA][BELL] preload-init-failed", err?.message)
  );
  getLocation();
  updateOnlineStatus();
  loadTranslations().then(() => {
    applyTranslations();
    refreshUpcomingEvents();
  });
}

function bindPermissionGateActions() {
  if (permissionGateBound) return;
  permissionGateBound = true;
  const gate = getMandatoryPermissionGate();
  if (!gate) return;

  const locationBtn = document.getElementById("permission-location-btn");
  const notificationBtn = document.getElementById("permission-notification-btn");
  const settingsBtn = document.getElementById("permission-settings-btn");

  locationBtn?.addEventListener("click", async () => {
    const granted = await evaluateMandatoryPermissions({ forcePrompt: true });
    if (granted) {
      continueAppInitialization();
    }
  });

  notificationBtn?.addEventListener("click", async () => {
    const granted = await evaluateMandatoryPermissions({ forcePrompt: true });
    if (granted) {
      continueAppInitialization();
    }
  });

  settingsBtn?.addEventListener("click", async () => {
    const opened = await openNativeAppSettings();
    if (!opened) {
      alert("Please open app settings manually and allow location + notifications.");
    }
    const granted = await evaluateMandatoryPermissions({ forcePrompt: false });
    if (granted) {
      continueAppInitialization();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isPermissionGateVisible()) {
      evaluateMandatoryPermissions({ forcePrompt: false }).then((granted) => {
        if (granted) continueAppInitialization();
      });
    }
  });

  const appPlugin = window.Capacitor?.Plugins?.App;
  if (appPlugin?.addListener) {
    appPlugin.addListener("appStateChange", ({ isActive }) => {
      if (isActive && isPermissionGateVisible()) {
        evaluateMandatoryPermissions({ forcePrompt: false }).then((granted) => {
          if (granted) continueAppInitialization();
        });
      }
    });
  }
}

window.enableAgnihotraDebug = function() {
  localStorage.setItem(DEBUG_STORAGE_KEY, "1");
  console.log("[AGNIHOTRA] Debug logging enabled.");
};

window.disableAgnihotraDebug = function() {
  localStorage.removeItem(DEBUG_STORAGE_KEY);
  console.log("[AGNIHOTRA] Debug logging disabled.");
};

function saveLastKnownLocation(lat, lng, locationName = null) {
  try {
    localStorage.setItem(
      LAST_KNOWN_LOCATION_KEY,
      JSON.stringify({
        lat,
        lng,
        locationName,
        savedAt: Date.now(),
      })
    );
  } catch (_) {}
}

function getLastKnownLocation() {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number") {
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function getNearbyCachedLocationName(lat, lng, thresholdKm = LOCATION_NAME_REFRESH_DISTANCE_KM) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const candidates = [];
  const lastKnown = getLastKnownLocation();
  if (lastKnown?.locationName) {
    candidates.push({
      source: "last-known",
      name: lastKnown.locationName,
      lat: lastKnown.lat,
      lng: lastKnown.lng,
    });
  }

  try {
    const cacheRaw = localStorage.getItem(CACHE_KEY);
    if (cacheRaw) {
      const cache = JSON.parse(cacheRaw);
      if (
        typeof cache?.locationName === "string" &&
        Number.isFinite(cache?.lat) &&
        Number.isFinite(cache?.lng)
      ) {
        candidates.push({
          source: "timings-cache",
          name: cache.locationName,
          lat: cache.lat,
          lng: cache.lng,
        });
      }
    }
  } catch (_) {}

  let best = null;
  for (const candidate of candidates) {
    const distanceKm = haversineDistanceKm(lat, lng, candidate.lat, candidate.lng);
    if (distanceKm <= thresholdKm && (!best || distanceKm < best.distanceKm)) {
      best = { ...candidate, distanceKm };
    }
  }

  if (best) {
    locationLog("location-name-cache-hit", {
      source: best.source,
      distanceKm: Number(best.distanceKm.toFixed(3)),
      thresholdKm,
    });
    return best.name;
  }

  locationLog("location-name-cache-miss", { thresholdKm });
  return null;
}

let preciseLocationRetryInFlight = false;

function retryPreciseLocationInBackground(reason = "unknown") {
  if (!navigator.geolocation || preciseLocationRetryInFlight) return;
  preciseLocationRetryInFlight = true;
  const startedAt = performance.now();
  locationLog("precise-retry-start", { reason });

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      preciseLocationRetryInFlight = false;
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      locationLog("precise-retry-success", {
        lat: latitude,
        lng: longitude,
        accuracyMeters: position.coords.accuracy,
        elapsedMs: Math.round(performance.now() - startedAt)
      });

      document.getElementById("userLocation").innerText =
        "Your Location: Detecting nearby place...";
      saveLastKnownLocation(latitude, longitude);

      const timingsPromise = getSunriseSunset(latitude, longitude);
      await reverseGeocode(latitude, longitude, true);
      await timingsPromise;
    },
    (error) => {
      preciseLocationRetryInFlight = false;
      locationLog("precise-retry-failed", {
        code: error?.code,
        message: error?.message,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function tryImmediatePreciseLocationRecovery() {
  if (!navigator.geolocation) return null;
  const startedAt = performance.now();
  try {
    const position = await getCurrentPositionAsync({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    });
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    locationLog("gps-recovery-success", {
      lat: latitude,
      lng: longitude,
      accuracyMeters: position.coords.accuracy,
      elapsedMs: Math.round(performance.now() - startedAt)
    });
    return { latitude, longitude };
  } catch (error) {
    locationLog("gps-recovery-failed", {
      code: error?.code,
      message: error?.message,
      elapsedMs: Math.round(performance.now() - startedAt)
    });
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function t(key, fallback = "") {
  return translations?.[currentLanguage]?.[key] || fallback;
}

function interpolateTemplate(template, values = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return values[key] !== undefined ? String(values[key]) : "";
  });
}

function getReminderNotificationCopy(eventLabel, minutes) {
  const titleTemplate = t(
    "notifications.reminderTitle",
    "Agnihotra reminder"
  );
  const bodyTemplate = t(
    "notifications.reminderBody",
    "{{event}} starts in {{minutes}} minutes."
  );
  return {
    title: interpolateTemplate(titleTemplate, { event: eventLabel, minutes }),
    body: interpolateTemplate(bodyTemplate, { event: eventLabel, minutes }),
  };
}

function getTestReminderNotificationCopy(seconds = 30) {
  const titleTemplate = t("notifications.testTitle", "Agnihotra test reminder");
  const bodyTemplate = t(
    "notifications.testBody",
    "Test reminder starts in {{seconds}} seconds."
  );
  return {
    title: interpolateTemplate(titleTemplate, { seconds }),
    body: interpolateTemplate(bodyTemplate, { seconds }),
  };
}

function getNowNotificationCopy(eventLabel) {
  const titleTemplate = t("notifications.nowTitle", "Agnihotra time now");
  const bodyTemplate = t(
    "notifications.nowBody",
    "{{event}} is starting now."
  );
  return {
    title: interpolateTemplate(titleTemplate, { event: eventLabel }),
    body: interpolateTemplate(bodyTemplate, { event: eventLabel }),
  };
}

function buildNativeReminderEventsFromTimings(timings, daysAhead = 14) {
  if (!timings || typeof timings !== "object") return [];
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const endDate = new Date(todayStart);
  endDate.setDate(endDate.getDate() + daysAhead);

  const events = [];
  Object.entries(timings).forEach(([dateStr, dayData]) => {
    if (!dayData?.sunrise || !dayData?.sunset) return;

    let day;
    let month;
    let year;
    if (dateStr.includes(".")) {
      const parts = dateStr.split(".");
      if (parts.length !== 3) return;
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    } else if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return;
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    } else {
      return;
    }
    if (!day || !month || !year) return;

    const rowDate = new Date(year, month - 1, day);
    if (rowDate < todayStart || rowDate > endDate) return;

    const sunriseTs = parseDateTime(dateStr, dayData.sunrise);
    const sunsetTs = parseDateTime(dateStr, dayData.sunset);

    if (sunriseTs > now + 30000) {
      const sunriseLabel = `${t("timeLabels.sunrise", "Sunrise")} • ${dateStr}`;
      const sunriseCopy = getReminderNotificationCopy(
        sunriseLabel,
        PRE_ALERT_MINUTES
      );
      events.push({
        id: `${dateStr}-sunrise`,
        label: sunriseLabel,
        time: sunriseTs,
        reminderTitle: sunriseCopy.title,
        reminderBody: sunriseCopy.body,
      });
    }

    if (sunsetTs > now + 30000) {
      const sunsetLabel = `${t("timeLabels.sunset", "Sunset")} • ${dateStr}`;
      const sunsetCopy = getReminderNotificationCopy(
        sunsetLabel,
        PRE_ALERT_MINUTES
      );
      events.push({
        id: `${dateStr}-sunset`,
        label: sunsetLabel,
        time: sunsetTs,
        reminderTitle: sunsetCopy.title,
        reminderBody: sunsetCopy.body,
      });
    }
  });

  return events.sort((a, b) => a.time - b.time);
}

function scheduleNativeRemindersFromTimings(timings, options = {}) {
  latestTimingsForNativeReminders = timings || latestTimingsForNativeReminders;
  const events = buildNativeReminderEventsFromTimings(
    latestTimingsForNativeReminders,
    14
  );
  if (events.length === 0) return;
  window.AgnihotraNotifications?.scheduleUpcomingReminders(events, {
    leadMinutes: PRE_ALERT_MINUTES,
    replaceExisting: options.replaceExisting !== false,
  });
}

function setTestReminderStatus(message) {
  const status = document.getElementById("testReminderStatus");
  if (status) status.textContent = message || "";
}

function getTestReminderSeconds() {
  const configured =
    Number(window.AGNI_RUNTIME_CONFIG?.testReminderSeconds) ||
    Number(window.AGNI_TEST_REMINDER_SECONDS);
  return Number.isFinite(configured) && configured >= 5
    ? Math.round(configured)
    : 20;
}

function isTestReminderEnabled() {
  return getRuntimeBoolean(
    window.AGNI_RUNTIME_CONFIG?.enableTestReminder,
    window.AGNI_ENABLE_TEST_REMINDER
  );
}

function updateTestReminderButtonCopy() {
  const button = document.getElementById("testReminderBtn");
  if (!button) return;
  const seconds = getTestReminderSeconds();
  const buttonTemplate = t(
    "notifications.testButtonTemplate",
    "Test reminder in {{seconds}}s"
  );
  button.textContent = interpolateTemplate(buttonTemplate, { seconds });
}

function clearTestReminderTimers() {
  if (testReminderTimeoutId) {
    clearTimeout(testReminderTimeoutId);
    testReminderTimeoutId = null;
  }
  if (testReminderCountdownIntervalId) {
    clearInterval(testReminderCountdownIntervalId);
    testReminderCountdownIntervalId = null;
  }
}

async function runQuickReminderTest() {
  const isNative = isNativeAppRuntime();
  const seconds = getTestReminderSeconds();
  const reminderCopy = getTestReminderNotificationCopy(seconds);
  const countdownTemplate = t(
    "notifications.testCountdown",
    "Test reminder in {{seconds}}s..."
  );

  const scheduled = await window.AgnihotraNotifications?.scheduleTestReminder?.({
    delaySeconds: seconds,
    title: reminderCopy.title,
    body: reminderCopy.body,
    tag: `agnihotra-test-reminder-${seconds}s`
  });
  console.log("[AGNIHOTRA][ALERT] test-reminder-schedule-result", {
    scheduled: Boolean(scheduled),
    isNative,
    delaySeconds: seconds,
  });

  if (!scheduled) {
    clearTestReminderTimers();
    setTestReminderStatus("Unable to schedule test reminder.");
    return;
  }

  clearTestReminderTimers();
  let secondsLeft = seconds;
  setTestReminderStatus(
    interpolateTemplate(countdownTemplate, { seconds: secondsLeft })
  );
  testReminderCountdownIntervalId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      if (testReminderCountdownIntervalId) {
        clearInterval(testReminderCountdownIntervalId);
        testReminderCountdownIntervalId = null;
      }
      return;
    }
    setTestReminderStatus(
      interpolateTemplate(countdownTemplate, { seconds: secondsLeft })
    );
  }, 1000);

  testReminderTimeoutId = setTimeout(() => {
    if (isNative) {
      console.log("[AGNIHOTRA][ALERT] test-reminder-trigger-native", {
        mode: "notification-channel-sound-only",
      });
      setTestReminderStatus("Test notification triggered.");
    } else {
      window.AgnihotraBell?.playTriple?.("test-reminder-web");
      console.log("[AGNIHOTRA][ALERT] test-reminder-trigger-web", {
        mode: "native-audio-3x",
      });
      setTestReminderStatus("Test bell triggered.");
    }
    clearTestReminderTimers();
  }, seconds * 1000);
}

function getNextLanguage(lang) {
  if (lang === "en") return "hi";
  if (lang === "hi") return "mr";
  return "en";
}

function getLanguageDisplayName(lang) {
  if (lang === "hi") return "हिन्दी";
  if (lang === "mr") return "मराठी";
  return "English";
}

async function loadTranslations() {
  try {
    const response = await fetch("translations.json");
    if (!response.ok) return;
    translations = await response.json();
  } catch (error) {
    console.warn("Unable to load translations:", error);
  }
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translated = t(key, element.textContent.trim());
    if (translated) {
      element.textContent = translated;
    }
  });
  const locationLoadingText = document.getElementById("locationLoadingText");
  if (locationLoadingText) {
    locationLoadingText.textContent = t(
      "dashboard.detectingLocation",
      "Detecting your location..."
    );
  }

  const toggleButton = document.getElementById("languageToggle");
  if (toggleButton) {
    toggleButton.textContent = getLanguageDisplayName(currentLanguage);
  }

  document.querySelectorAll(".lang-option").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLanguage);
  });
  updateTestReminderButtonCopy();
  syncNativeWidgetLanguage();
}

async function syncNativeWidgetLanguage() {
  if (!isNativeAppRuntime()) return;
  const widgetPlugin = window.Capacitor?.Plugins?.AgnihotraWidget;
  if (!widgetPlugin?.setLocalizationStrings) return;
  try {
    await widgetPlugin.setLocalizationStrings({
      widgetTitle: t("widget.title", "EternalAgni"),
      widgetCountdownLabel: "Countdown",
      widgetTimePassedLabel: t("widget.timePassed", "Time passed"),
      widgetNoTimingLabel: t("widget.noTiming", "Open app to load timing"),
    });
  } catch (error) {
    console.warn("[AGNIHOTRA][WIDGET] language-sync-failed", error);
  }
}

function setupLanguageToggle() {
  const toggleButton = document.getElementById("languageToggle");
  const langButtons = document.querySelectorAll(".lang-option");

  // Ensure there is always a valid persisted preference.
  localStorage.setItem(TRANSLATION_STORAGE_KEY, currentLanguage);

  const setLanguage = (language) => {
    currentLanguage = ["en", "hi", "mr"].includes(language) ? language : "en";
    localStorage.setItem(TRANSLATION_STORAGE_KEY, currentLanguage);
    applyTranslations();
    refreshUpcomingEvents();
    scheduleNativeRemindersFromTimings(latestTimingsForNativeReminders);
  };

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      setLanguage(getNextLanguage(currentLanguage));
    });
  }

  langButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.getAttribute("data-lang"));
    });
  });

  applyTranslations();
}

function setupTestReminderButton() {
  const wrap = document.querySelector(".test-reminder-wrap");
  const button = document.getElementById("testReminderBtn");
  const mockBtn = document.getElementById("mockCountdownBtn");
  if (!button && !mockBtn) return;
  if (!isTestReminderEnabled()) {
    if (wrap) wrap.style.display = "none";
    return;
  }
  if (wrap) wrap.style.display = "";
  updateTestReminderButtonCopy();
  if (button) {
    button.addEventListener("click", () => {
      initAudio();
      runQuickReminderTest();
    });
  }
  if (mockBtn) {
    mockBtn.addEventListener("click", () => {
      initAudio();
      runMockWindowOpenTest(10);
    });
  }
}

let mockCountdownIntervalId = null;
let mockCountdownTimeoutId = null;

function setMockCountdownStatus(message) {
  const status = document.getElementById("mockCountdownStatus");
  if (status) status.textContent = message || "";
}

function clearMockCountdownTimers() {
  if (mockCountdownIntervalId) {
    clearInterval(mockCountdownIntervalId);
    mockCountdownIntervalId = null;
  }
  if (mockCountdownTimeoutId) {
    clearTimeout(mockCountdownTimeoutId);
    mockCountdownTimeoutId = null;
  }
}

function ringSingleBellInstant(reason = "ting") {
  // Primary + only path: @capacitor-community/native-audio (SoundPool on
  // Android — gapless, no autoplay gating, no HTMLAudio lag). Falls back to
  // HTMLAudio internally if the plugin is unavailable.
  if (window.AgnihotraBell && typeof window.AgnihotraBell.playInstant === "function") {
    return window.AgnihotraBell.playInstant(reason);
  }
  console.warn("[AGNIHOTRA][BELL] helper-missing", { reason });
  return false;
}

function runMockWindowOpenTest(seconds = 10) {
  clearMockCountdownTimers();
  const safeSeconds = Math.max(1, Number(seconds) || 10);
  const startedAt = Date.now();
  let secondsLeft = safeSeconds;
  const template = t(
    "notifications.mockCountdown",
    "Mock window opens in {{seconds}}s..."
  );

  // Make absolutely sure audio is unlocked by the current gesture.
  try {
    initAudio();
  } catch (err) {
    console.warn("[AGNIHOTRA][MOCK] initAudio-threw", { message: err?.message });
  }

  console.log("[AGNIHOTRA][MOCK] tap", {
    seconds: safeSeconds,
    runtime: isNativeAppRuntime() ? "native" : "web",
    visibility:
      typeof document !== "undefined" ? document.visibilityState : "n/a",
    audioCtxState: audioCtx?.state || "none",
    bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
  });

  setMockCountdownStatus(
    interpolateTemplate(template, { seconds: secondsLeft })
  );

  mockCountdownIntervalId = setInterval(() => {
    secondsLeft -= 1;
    console.log("[AGNIHOTRA][MOCK] tick", {
      secondsLeft,
      elapsedMs: Date.now() - startedAt,
      visibility: document.visibilityState,
      bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
    });
    if (secondsLeft <= 0) {
      if (mockCountdownIntervalId) {
        clearInterval(mockCountdownIntervalId);
        mockCountdownIntervalId = null;
      }
      setMockCountdownStatus(
        interpolateTemplate(template, { seconds: 0 })
      );
      return;
    }
    setMockCountdownStatus(
      interpolateTemplate(template, { seconds: secondsLeft })
    );
  }, 1000);

  mockCountdownTimeoutId = setTimeout(() => {
    const isForeground =
      typeof document !== "undefined" &&
      document.visibilityState === "visible";
    console.log("[AGNIHOTRA][MOCK] zero-mark-fire", {
      elapsedMs: Date.now() - startedAt,
      visibility: document.visibilityState,
      bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
      willRing: isForeground,
    });
    if (isForeground) {
      ringSingleBellInstant("mock-zero-mark");
      setMockCountdownStatus("Mock window opened — single bell ting.");
    } else {
      // App is backgrounded/closed: never ring the single ting.
      setMockCountdownStatus("App not foreground — single ting skipped.");
      console.log("[AGNIHOTRA][ALERT] mock-window-open-skip", {
        reason: "app-not-foreground",
      });
    }
    clearMockCountdownTimers();
  }, safeSeconds * 1000);
}

function refreshUpcomingEvents() {
  const todayTimes = document.getElementById("todayTimes");
  const tomorrowTimes = document.getElementById("tomorrowTimes");
  if (!todayTimes || !tomorrowTimes) return;
  const todayHeader = todayTimes.querySelector(".card-date-header");
  const tomorrowHeader = tomorrowTimes.querySelector(".card-date-header");
  if (!todayHeader || !tomorrowHeader) return;

  const todayData = {
    date: todayHeader.innerText,
    sunrise: todayTimes.querySelectorAll(".time-value")[0]?.innerText || "",
    sunset: todayTimes.querySelectorAll(".time-value")[1]?.innerText || "",
  };
  const tomorrowData = {
    date: tomorrowHeader.innerText,
    sunrise: tomorrowTimes.querySelectorAll(".time-value")[0]?.innerText || "",
    sunset: tomorrowTimes.querySelectorAll(".time-value")[1]?.innerText || "",
  };
  if (todayData.date && tomorrowData.date) {
    displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
  }
}

let upcomingRefreshTimeoutId = null;
function requestUpcomingEventsRefresh(reason = "countdown-elapsed") {
  const now = Date.now();
  const lastRefreshAt = Number(window.__agnihotraLastUpcomingRefreshAt || 0);
  if (now - lastRefreshAt < 1000) return;
  window.__agnihotraLastUpcomingRefreshAt = now;
  if (upcomingRefreshTimeoutId) return;
  upcomingRefreshTimeoutId = setTimeout(() => {
    upcomingRefreshTimeoutId = null;
    console.log("[AGNIHOTRA][COUNTDOWN] refreshing-upcoming-events", { reason });
    refreshUpcomingEvents();
  }, 0);
}

function setLocationLoading(isLoading) {
  const status = document.getElementById("locationStatus");
  if (!status) return;
  status.style.display = isLoading ? "inline-flex" : "none";
}

function setScheduleLoading(isLoading) {
  const status = document.getElementById("scheduleLoading");
  if (!status) return;
  status.style.display = isLoading ? "inline-flex" : "none";
}

// Function to check and get valid cached data
function getValidCachedData(lat, lng) {
  const cachedJSON = localStorage.getItem(CACHE_KEY);
  if (!cachedJSON) return null;

  try {
    const cache = JSON.parse(cachedJSON);
    const now = Date.now();

    // 1. Check if older than 6 months
    if (now - cache.lastUpdated > CACHE_EXPIRY_MS) {
      return null;
    }

    // 2. Check if location changed significantly (more than 0.05 degree, roughly 5.5 km / 3.4 miles)
    // If the user moves more than ~5 km, the cache is invalidated and timings are refetched/recalculated
    const latDiff = Math.abs(cache.lat - lat);
    const lngDiff = Math.abs(cache.lng - lng);
    if (latDiff > 0.05 || lngDiff > 0.05) {
      return null;
    }

    // 3. Check if we have data for today
    const todayStr = formatDateToDDMMYYYY(new Date());
    if (!cache.timings || !cache.timings[todayStr]) {
      return null;
    }

    return cache;
  } catch (e) {
    console.error("Error reading cache:", e);
    return null;
  }
}

// Function to save timings to cache
function saveTimingsToCache(timings, lat, lng, locationName = null) {
  const cacheData = {
    lastUpdated: Date.now(),
    lat: lat,
    lng: lng,
    locationName: locationName, // Store the place name
    timings: timings,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
}

let latestBackgroundTimingJob = 0;

function startBackgroundTimingGeneration(lat, lng, locationName, todayData, tomorrowData) {
  const myJobId = ++latestBackgroundTimingJob;
  const startedAt = performance.now();
  debugLog("background-3month:start", { jobId: myJobId, lat, lng });
  setScheduleLoading(true);
  setTimeout(async () => {
    try {
      const generatedTimings = await (window.AgnihotraTimingEngine?.generateRangeTimings
        ? window.AgnihotraTimingEngine.generateRangeTimings(lat, lng, 92, new Date())
        : Promise.resolve(generateLocal6MonthTimings(lat, lng)));

      if (myJobId !== latestBackgroundTimingJob || !generatedTimings) return;

      if (todayData?.date) generatedTimings[todayData.date] = todayData;
      if (tomorrowData?.date) generatedTimings[tomorrowData.date] = tomorrowData;

      saveTimingsToCache(generatedTimings, lat, lng, locationName);
      displayFullSchedule(generatedTimings);
      scheduleNativeRemindersFromTimings(generatedTimings);
      setScheduleLoading(false);
      debugLog("background-3month:done", {
        jobId: myJobId,
        days: Object.keys(generatedTimings).length,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    } catch (error) {
      console.warn("Background timing generation failed:", error);
      setScheduleLoading(false);
      debugLog("background-3month:error", {
        jobId: myJobId,
        error: error?.message || String(error)
      });
    }
  }, 0);
}

// Function to get sunrise and sunset - prioritize local precise calculation
async function getSunriseSunset(lat, lng, locationName = null) {
  if (!lat || !lng) {
    console.error("No coordinates provided to getSunriseSunset");
    return;
  }

  const startedAt = performance.now();
  debugLog("timings:start", { lat, lng });
  latestExportLocationMeta = {
    lat,
    lng,
    locationName: locationName || null,
  };

  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayFormatted = formatDateToDDMMYYYY(today);
    const tomorrowFormatted = formatDateToDDMMYYYY(tomorrow);

    // 1) Check cache first for instant display
    const cache = getValidCachedData(lat, lng);
    if (cache && cache.timings[todayFormatted]) {
      latestExportLocationMeta = {
        lat,
        lng,
        locationName: cache.locationName || locationName || null,
      };
      const todayData = cache.timings[todayFormatted];
      const tomorrowData = cache.timings[tomorrowFormatted];

      if (todayData) displaySunriseSunset(todayData, "todayTimes");
      if (tomorrowData) displaySunriseSunset(tomorrowData, "tomorrowTimes");

      if (todayData && tomorrowData) {
        displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
        displayFullSchedule(cache.timings);
        scheduleNativeRemindersFromTimings(cache.timings);
        setLocationLoading(false);
        setScheduleLoading(false);
        debugLog("timings:cache-hit", {
          elapsedMs: Math.round(performance.now() - startedAt),
          days: Object.keys(cache.timings || {}).length
        });
        return;
      }
    }

    // 2) Compute only today + tomorrow first (fast UX)
    const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
    let todayData = window.AgnihotraTimingEngine?.calculateDayTiming
      ? window.AgnihotraTimingEngine.calculateDayTiming(today, lat, lng, tzOffsetHours)
      : null;
    let tomorrowData = window.AgnihotraTimingEngine?.calculateDayTiming
      ? window.AgnihotraTimingEngine.calculateDayTiming(tomorrow, lat, lng, tzOffsetHours)
      : null;

    if (!todayData || !tomorrowData) {
      // Fallback source for immediate display if local calc fails
      await getSunriseSunsetFromSunAPI(lat, lng, todayData, tomorrowData);
      // Use the rendered values if fallback path handled it.
      return;
    }

    displaySunriseSunset(todayData, "todayTimes");
    displaySunriseSunset(tomorrowData, "tomorrowTimes");
    displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
    scheduleNativeRemindersFromTimings(
      {
        [todayData.date]: todayData,
        [tomorrowData.date]: tomorrowData,
      },
      { replaceExisting: true }
    );
    setLocationLoading(false);
    debugLog("timings:fast-path-ready", {
      elapsedMs: Math.round(performance.now() - startedAt)
    });

    // 3) Build the 3-month schedule in background
    startBackgroundTimingGeneration(lat, lng, locationName, todayData, tomorrowData);
  } catch (error) {
    console.error("Timing calculation/fetch failed:", error);
    setScheduleLoading(false);
    debugLog("timings:error", {
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error?.message || String(error)
    });
    await getSunriseSunsetFromSunAPI(lat, lng);
  }
}

// Function to fetch data from homatherapie.de for a date range
async function fetchSunriseSunsetData(date, lat, lng, endDate = null) {
  try {
    const year = date.split(".")[2];
    const actualEndDate = endDate || date;
    const url =
      "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results.html";

    // Get location name first
    let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Fallback to coordinates

    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );

      if (response.ok) {
        const data = await response.json();
        locationName = `${data.city || data.locality || "Unknown"}, ${
          data.principalSubdivision || data.countryName || "Unknown"
        }`;
      }
    } catch (geoError) {
      // Silently fail geo-naming
    }

    // Create form data
    const formData = new URLSearchParams();
    formData.append("yearDate", year);
    formData.append("location", locationName);
    formData.append("lat_deg", lat.toString());
    formData.append("lon_deg", lng.toString());
    formData.append("date", date);
    formData.append("end_date", actualEndDate);

    // Try deployed proxies first, then local proxy
    const proxyEndpoints = [
      "https://agnihotra-eternal-agni.vercel.app/api/agnihotra", // Deployed Vercel endpoint
      "http://localhost:8080/api/agnihotra", // Local development endpoint
    ];

    let response = null;
    let proxyUsed = null;

    for (const endpoint of proxyEndpoints) {
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (response.ok) {
          proxyUsed = endpoint;
          break;
        }
      } catch (proxyError) {
        continue;
      }
    }

    if (response && response.ok) {
      const htmlText = await response.text();

      const timingsMap = {};
      const lines = htmlText.split("\n");

      // Regex to find dates like DD.MM.YYYY
      const dateRegex = /(\d{2}\.\d{2}\.\d{4})/;
      // Regex to find times like HH:MM:SS
      const timeRegex = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;

      lines.forEach((line) => {
        const dateMatch = line.match(dateRegex);
        if (
          dateMatch &&
          line.includes("<td") &&
          line.includes('align="right"')
        ) {
          const dateFound = dateMatch[1];
          const times = [];
          let match;

          // Reset regex state for each line
          timeRegex.lastIndex = 0;
          while ((match = timeRegex.exec(line)) !== null) {
            const hour = match[1].padStart(2, "0");
            const minute = match[2];
            const second = match[3];
            times.push(`${hour}:${minute}:${second}`);
          }

          if (times.length >= 2) {
            timingsMap[dateFound] = {
              date: dateFound,
              sunrise: times[0],
              sunset: times[1],
            };
          }
        }
      });

      const count = Object.keys(timingsMap).length;
      if (count === 0) {
        return null;
      }

      return timingsMap;
    } else {
      // Since we can't reliably access homatherapie.de from browser,
      // we'll return null to trigger fallback to sunrisesunset.io
      throw new Error(
        "All proxy endpoints failed. Browser CORS policy prevents direct access to homatherapie.de API."
      );
    }
  } catch (error) {
    console.error(`Error fetching data for ${date}:`, error);
    return null;
  }
}

// Alternative function using sunrisesunset.io API (provides seconds precision)
async function getSunriseSunsetFromSunAPI(
  lat,
  lng,
  existingTodayData = null,
  existingTomorrowData = null
) {
  try {
    let todayData = existingTodayData;
    let tomorrowData = existingTomorrowData;

    // Only fetch missing data
    const fetchPromises = [];
    if (!todayData) {
      const apiUrlToday = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=today`;
      fetchPromises.push(fetch(apiUrlToday).then((r) => r.json()));
    } else {
      fetchPromises.push(Promise.resolve(null));
    }

    if (!tomorrowData) {
      const apiUrlTomorrow = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=tomorrow`;
      fetchPromises.push(fetch(apiUrlTomorrow).then((r) => r.json()));
    } else {
      fetchPromises.push(Promise.resolve(null));
    }

    const [todayResponse, tomorrowResponse] = await Promise.all(fetchPromises);

    // Use existing data or convert from API response
    if (!todayData && todayResponse) {
      const todayResults = todayResponse.results;
      todayData = {
        date: todayResults.date,
        sunrise: todayResults.sunrise,
        sunset: todayResults.sunset,
      };
    }

    if (!tomorrowData && tomorrowResponse) {
      const tomorrowResults = tomorrowResponse.results;
      tomorrowData = {
        date: tomorrowResults.date,
        sunrise: tomorrowResults.sunrise,
        sunset: tomorrowResults.sunset,
      };
    }

    displaySunriseSunset(todayData, "todayTimes");
    displaySunriseSunset(tomorrowData, "tomorrowTimes");
    displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
    scheduleNativeRemindersFromTimings(
      {
        [todayData.date]: todayData,
        [tomorrowData.date]: tomorrowData,
      },
      { replaceExisting: true }
    );
  } catch (error) {
    console.error("Error with sunrisesunset.io API:", error);
    setLocationLoading(false);
  }
}

function displaySunriseSunset(results, elementId) {
  const element = document.getElementById(elementId);
  element.innerHTML = ""; // Clear previous

  // Add Date Header once
  const dateHeader = document.createElement("div");
  dateHeader.className = "card-date-header";
  dateHeader.innerText = results.date;
  element.appendChild(dateHeader);

  const sunriseDiv = document.createElement("div");
  sunriseDiv.className = "time-item";
  sunriseDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-sun" style="color: #FFD700;"></i> ${t("timeLabels.sunrise", "SUNRISE")}</span>
        <span class="time-value">${formatTimeToAMPM(results.sunrise)}</span>
    `;

  const sunsetDiv = document.createElement("div");
  sunsetDiv.className = "time-item";
  sunsetDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-moon" style="color: #4B0082;"></i> ${t("timeLabels.sunset", "SUNSET")}</span>
        <span class="time-value">${formatTimeToAMPM(results.sunset)}</span>
    `;

  element.appendChild(sunriseDiv);
  element.appendChild(sunsetDiv);
}

function formatTimeToAMPM(timeStr) {
  if (!timeStr) return "--:--:--";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;

  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")} ${ampm}`;
}

function displayFullSchedule(timings) {
  const tableBody = document.getElementById("timingsTableBody");
  if (!tableBody) return;

  // Show the schedule section
  const scheduleSection =
    tableBody.closest(".schedule-section") ||
    tableBody.closest(".schedule-container");
  if (scheduleSection) {
    scheduleSection.style.display = "block";
  }

  // Clear existing rows
  tableBody.innerHTML = "";

  // Get today's date at midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter out past dates and sort remaining dates chronologically
  const sortedDates = Object.keys(timings)
    .filter((dateStr) => {
      const [day, month, year] = dateStr.split(".").map(Number);
      const rowDate = new Date(year, month - 1, day);
      return rowDate >= today;
    })
    .sort((a, b) => {
      const [dayA, monthA, yearA] = a.split(".").map(Number);
      const [dayB, monthB, yearB] = b.split(".").map(Number);
      return (
        new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB)
      );
    });

  // Add rows for each date
  sortedDates.forEach((dateStr) => {
    const data = timings[dateStr];
    const row = document.createElement("tr");

    // Highlight today's row
    const todayStr = formatDateToDDMMYYYY(new Date());
    if (dateStr === todayStr) {
      row.style.backgroundColor = "rgba(255, 165, 0, 0.2)";
      row.style.fontWeight = "bold";
    }

    row.innerHTML = `
            <td>${dateStr}</td>
            <td>${formatTimeToAMPM(data.sunrise)}</td>
            <td>${formatTimeToAMPM(data.sunset)}</td>
        `;
    tableBody.appendChild(row);
  });
}

function setScheduleExportStatus(message, isError = false) {
  const status = document.getElementById("scheduleExportStatus");
  if (!status) return;
  status.textContent = message || "";
  status.style.color = isError ? "#a02828" : "var(--copper)";
  exportLog("status", { message, isError });
}

function exportLog(event, payload = null) {
  if (payload == null) {
    console.log(`[AGNIHOTRA][EXPORT] ${event}`);
    return;
  }
  console.log(`[AGNIHOTRA][EXPORT] ${event} ${serializeForConsole(payload)}`);
}

function showExportToast(message, isError = false) {
  if (!message || typeof document === "undefined" || !document.body) return;
  const old = document.getElementById("scheduleExportToast");
  if (old) old.remove();
  const toast = document.createElement("div");
  toast.id = "scheduleExportToast";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.top = "84px";
  toast.style.transform = "translateX(-50%)";
  toast.style.zIndex = "9999";
  toast.style.maxWidth = "92vw";
  toast.style.padding = "12px 16px";
  toast.style.borderRadius = "12px";
  toast.style.fontSize = "0.95rem";
  toast.style.fontWeight = "700";
  toast.style.color = "#fff";
  toast.style.background = isError ? "rgba(164, 40, 40, 0.95)" : "rgba(62, 124, 48, 0.95)";
  toast.style.boxShadow = "0 12px 26px rgba(0,0,0,0.30)";
  toast.style.border = "1px solid rgba(255,255,255,0.18)";
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3600);
}

function showInstantExportFeedback(message, isError = false) {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("opening") || normalized.includes("tap delay")) {
    return;
  }
  showExportToast(message, isError);
}

function getEffectiveExportLocation() {
  if (latestExportLocationMeta?.lat && latestExportLocationMeta?.lng) {
    return latestExportLocationMeta;
  }
  const cacheRaw = localStorage.getItem(CACHE_KEY);
  if (!cacheRaw) return null;
  try {
    const cache = JSON.parse(cacheRaw);
    if (cache?.lat && cache?.lng) {
      return {
        lat: cache.lat,
        lng: cache.lng,
        locationName: cache.locationName || null,
      };
    }
  } catch (_) {}
  return null;
}

function resolveExportLocationName(rawName) {
  const candidate = String(rawName || "").trim();
  const genericLabel = String(t("dashboard.location", "Location") || "Location").trim();
  if (!candidate) return t("dashboard.currentLocation", "Current Location");
  const normalized = candidate.toLowerCase();
  const genericNormalized = genericLabel.toLowerCase();
  // Avoid placeholder-like labels in generated files.
  if (
    normalized === genericNormalized ||
    ["location", "current location", "स्थान", "ठिकाण", "लोकेशन"].includes(normalized)
  ) {
    return t("dashboard.currentLocation", "Current Location");
  }
  return candidate;
}

function isGenericExportLocationName(rawName) {
  const candidate = String(rawName || "").trim();
  if (!candidate) return true;
  const genericLabel = String(t("dashboard.location", "Location") || "Location").trim();
  const normalized = candidate.toLowerCase();
  const genericNormalized = genericLabel.toLowerCase();
  return (
    normalized === genericNormalized ||
    ["location", "current location", "स्थान", "ठिकाण", "लोकेशन"].includes(normalized)
  );
}

async function resolveExportLocationNameForCoordinates(lat, lng, rawName) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return resolveExportLocationName(rawName);
  }
  if (!isGenericExportLocationName(rawName)) {
    return resolveExportLocationName(rawName);
  }

  const nearby = getNearbyCachedLocationName(lat, lng);
  if (nearby && !isGenericExportLocationName(nearby)) {
    return resolveExportLocationName(nearby);
  }

  try {
    const bdcResponse = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (bdcResponse.ok) {
      const data = await bdcResponse.json();
      const bdcName = [
        data.city || data.locality || data.principalSubdivision,
        data.principalSubdivision || data.countryName,
      ]
        .filter(Boolean)
        .join(", ");
      if (bdcName && !isGenericExportLocationName(bdcName)) {
        saveLastKnownLocation(lat, lng, bdcName);
        return bdcName;
      }
    }
  } catch (_) {}

  try {
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } }
    );
    if (nominatimResponse.ok) {
      const data = await nominatimResponse.json();
      const address = data?.display_name || "";
      if (address && !isGenericExportLocationName(address)) {
        saveLastKnownLocation(lat, lng, address);
        return address;
      }
    }
  } catch (_) {}

  return resolveExportLocationName(rawName);
}

function formatDateInputValue(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInput(dateValue) {
  if (!dateValue || !dateValue.includes("-")) return null;
  const [yearStr, monthStr, dayStr] = dateValue.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function buildRangeTimingRows(startDateValue, endDateValue) {
  exportLog("build-range-start", {
    startDateValue,
    endDateValue,
  });
  const startDate = parseDateInput(startDateValue);
  const endDate = parseDateInput(endDateValue);
  if (!startDate || !endDate) return null;
  const exportLocation = getEffectiveExportLocation();
  if (!exportLocation?.lat || !exportLocation?.lng) return null;
  exportLog("location-name-resolve-start", {
    lat: exportLocation.lat,
    lng: exportLocation.lng,
    current: exportLocation.locationName || null,
  });
  exportLocation.locationName = await resolveExportLocationNameForCoordinates(
    exportLocation.lat,
    exportLocation.lng,
    exportLocation.locationName
  );
  latestExportLocationMeta = {
    lat: exportLocation.lat,
    lng: exportLocation.lng,
    locationName: exportLocation.locationName,
  };
  exportLog("location-name-resolve-done", {
    locationName: exportLocation.locationName || null,
  });

  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const daysInRange = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (daysInRange <= 0) return null;
  exportLog("build-range-meta", {
    startDate: formatDateInputValue(start),
    endDate: formatDateInputValue(end),
    daysInRange,
    lat: exportLocation.lat,
    lng: exportLocation.lng,
    locationName: exportLocation.locationName || null,
  });

  const timingsMap = window.AgnihotraTimingEngine?.generateRangeTimings
    ? await window.AgnihotraTimingEngine.generateRangeTimings(
        exportLocation.lat,
        exportLocation.lng,
        daysInRange,
        start
      )
    : generateLocal6MonthTimings(exportLocation.lat, exportLocation.lng);

  const rows = Object.values(timingsMap || {})
    .filter((row) => row?.date && row?.sunrise && row?.sunset)
    .sort((a, b) => parseDateTime(a.date, "00:00:00") - parseDateTime(b.date, "00:00:00"));
  exportLog("build-range-done", {
    rows: rows.length,
    firstDate: rows[0]?.date || null,
    lastDate: rows[rows.length - 1]?.date || null,
  });

  return {
    rows,
    exportLocation,
    startDate: start,
    endDate: end,
  };
}

function buildIcsContent(rows, locationName) {
  const icsExporter = window.AgnihotraIcsExport;
  if (!icsExporter?.buildIcsContent) {
    throw new Error("ICS exporter module unavailable.");
  }
  return icsExporter.buildIcsContent({
    rows,
    locationName,
    sunriseLabel: t("timeLabels.sunrise", "SUNRISE"),
    sunsetLabel: t("timeLabels.sunset", "SUNSET"),
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToBase64Payload(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read blob."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function saveExportRegistryEntry(entry) {
  try {
    const raw = localStorage.getItem(EXPORT_FILE_REGISTRY_KEY);
    const registry = raw ? JSON.parse(raw) : {};
    registry[entry.filename] = {
      filename: entry.filename,
      path: entry.path || null,
      uri: entry.uri || null,
      mime: entry.mime || null,
      bytes: Number(entry.bytes) || 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(EXPORT_FILE_REGISTRY_KEY, JSON.stringify(registry));
  } catch (_) {}
}

function getExportRegistryEntry(filename) {
  try {
    const raw = localStorage.getItem(EXPORT_FILE_REGISTRY_KEY);
    if (!raw) return null;
    const registry = JSON.parse(raw);
    return registry?.[filename] || null;
  } catch (_) {
    return null;
  }
}

async function saveFileInNativeStorage(blob, filename, mime) {
  if (!isNativeAppRuntime()) return null;
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  if (!filesystem?.writeFile) {
    exportLog("native-save-skipped", { filename, reason: "filesystem-plugin-missing" });
    return null;
  }

  const path = `EternalAgniExports/${filename}`;
  exportLog("native-save-start", {
    filename,
    path,
    bytes: blob.size,
    mime,
  });
  const base64Payload = await blobToBase64Payload(blob);
  await filesystem.writeFile({
    path,
    data: base64Payload,
    directory: "DOCUMENTS",
    recursive: true,
  });
  const uriResult = await filesystem.getUri({
    path,
    directory: "DOCUMENTS",
  });
  const saved = {
    filename,
    path,
    uri: uriResult?.uri || null,
    mime,
    bytes: blob.size,
  };
  saveExportRegistryEntry(saved);
  exportLog("native-save-complete", {
    filename,
    path,
    uri: saved.uri,
    bytes: blob.size,
  });
  return saved;
}

async function openExportFileFromNotification(extra = {}) {
  const filename = extra?.fileName || extra?.filename || null;
  let fileUri = extra?.fileUri || extra?.uri || null;
  let filePath = extra?.filePath || extra?.path || null;
  const mime = extra?.mime || null;

  if (filename && (!fileUri || !filePath)) {
    const fromRegistry = getExportRegistryEntry(filename);
    if (fromRegistry) {
      fileUri = fileUri || fromRegistry.uri;
      filePath = filePath || fromRegistry.path;
    }
  }

  if (!fileUri && filePath) {
    try {
      const filesystem = window.Capacitor?.Plugins?.Filesystem;
      if (filesystem?.getUri) {
        const uriResult = await filesystem.getUri({
          path: filePath,
          directory: "DOCUMENTS",
        });
        fileUri = uriResult?.uri || null;
      }
    } catch (error) {
      exportLog("open-from-notification-get-uri-failed", {
        filename,
        path: filePath,
        error: error?.message || String(error),
      });
    }
  }

  if (!fileUri) {
    exportLog("open-from-notification-missing-uri", {
      filename,
      path: filePath,
    });
    showInstantExportFeedback("Cannot open file: saved path not found.", true);
    return false;
  }

  const fileOpener = window.Capacitor?.Plugins?.FileOpener;
  if (fileOpener?.open) {
    try {
      await fileOpener.open({
        filePath: fileUri,
        contentType: mime || undefined,
      });
      exportLog("open-from-notification-file-opener", {
        filename,
        uri: fileUri,
        mime,
      });
      return true;
    } catch (error) {
      exportLog("open-from-notification-file-opener-failed", {
        filename,
        uri: fileUri,
        error: error?.message || String(error),
      });
    }
  }

  try {
    window.open(fileUri, "_blank");
    exportLog("open-from-notification-window", {
      filename,
      uri: fileUri,
      mime,
    });
    return true;
  } catch (error) {
    exportLog("open-from-notification-window-failed", {
      filename,
      uri: fileUri,
      error: error?.message || String(error),
    });
    showInstantExportFeedback("Unable to open file. Please use Files app.", true);
    return false;
  }
}

async function notifyNativeExportReady(savedFile, syncedMessage = "") {
  if (!isNativeAppRuntime()) return { scheduled: false };
  const localNotifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!localNotifications?.schedule) {
    exportLog("export-ready-notification-skipped", {
      filename: savedFile?.filename || null,
      reason: "local-notification-plugin-missing",
    });
    return { scheduled: false };
  }
  const permissionStatus = await localNotifications.checkPermissions();
  if (permissionStatus?.display !== "granted") {
    exportLog("export-ready-notification-skipped", {
      filename: savedFile?.filename || null,
      reason: "permission-not-granted",
      status: permissionStatus?.display || "unknown",
    });
    return { scheduled: false };
  }

  // Keep export notifications on a dedicated channel with Android default sound.
  // Do not set custom sound here, otherwise it inherits the Agnihotra bell channel.
  if (typeof localNotifications.createChannel === "function") {
    try {
      await localNotifications.createChannel({
        id: EXPORT_NOTIFICATION_CHANNEL_ID,
        name: "Export files",
        description: "Export completion notifications",
        importance: 5,
        visibility: 1,
        vibration: true,
      });
      exportLog("export-ready-channel-ok", {
        channelId: EXPORT_NOTIFICATION_CHANNEL_ID,
        sound: "android-default",
      });
    } catch (error) {
      exportLog("export-ready-channel-failed", {
        channelId: EXPORT_NOTIFICATION_CHANNEL_ID,
        error: error?.message || String(error),
      });
    }
  }

  const id = Math.floor(Date.now() % 1000000000);
  const sentAtMs = Date.now();
  const scheduledForMs = sentAtMs + 80;
  const messageForUser =
    syncedMessage || `${savedFile.filename} saved. Tap to open.`;
  await localNotifications.schedule({
    notifications: [
      {
        id,
        title: "EternalAgni Export Ready",
        body: messageForUser,
        schedule: { at: new Date(scheduledForMs) },
        ongoing: false,
        autoCancel: true,
        allowWhileIdle: true,
        channelId: EXPORT_NOTIFICATION_CHANNEL_ID,
        smallIcon: "ic_stat_notify",
        iconColor: "#E07B26",
        extra: {
          tag: "agnihotra-export-file-ready",
          sentAtMs,
          scheduledForMs,
          fileName: savedFile.filename,
          filePath: savedFile.path,
          fileUri: savedFile.uri,
          mime: savedFile.mime,
        },
      },
    ],
  });
  const scheduleResolvedAtMs = Date.now();
  exportLog("export-ready-notification-sent", {
    notificationId: id,
    sentAtMs,
    scheduledForMs,
    scheduleResolvedAtMs,
    scheduleApiLatencyMs: scheduleResolvedAtMs - sentAtMs,
    messageForUser,
    filename: savedFile.filename,
    path: savedFile.path,
    uri: savedFile.uri,
  });
  return {
    scheduled: true,
    notificationId: id,
    sentAtMs,
    scheduledForMs,
  };
}

function setupExportNotificationClickHandler() {
  if (!isNativeAppRuntime()) return;
  if (window.__agnihotraExportNotificationHandlerBound) return;
  const localNotifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (!localNotifications?.addListener) return;
  window.__agnihotraExportNotificationHandlerBound = true;
  localNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const extra = event?.notification?.extra || {};
    if (extra?.tag !== "agnihotra-export-file-ready") return;
    const clickedAtMs = Date.now();
    const sentAtMs = Number(extra?.sentAtMs || 0);
    const scheduledForMs = Number(extra?.scheduledForMs || 0);
    const tapDelayMs = sentAtMs > 0 ? clickedAtMs - sentAtMs : null;
    const scheduledToClickMs =
      scheduledForMs > 0 ? clickedAtMs - scheduledForMs : null;
    exportLog("export-ready-notification-click", {
      actionId: event?.actionId || null,
      clickedAtMs,
      sentAtMs: sentAtMs || null,
      scheduledForMs: scheduledForMs || null,
      tapDelayMs,
      scheduledToClickMs,
      filename: extra?.fileName || null,
      path: extra?.filePath || null,
      uri: extra?.fileUri || null,
    });
    const name = extra?.fileName || "file";
    const openStartMs = Date.now();
    const opened = await openExportFileFromNotification(extra);
    const openDurationMs = Date.now() - openStartMs;
    exportLog("open-from-notification-latency", {
      filename: name,
      opened,
      openDurationMs,
      tapDelayMs,
    });
    if (!opened) {
      showInstantExportFeedback(`Could not open ${name}.`, true);
    }
  });
  localNotifications.addListener("localNotificationReceived", async (event) => {
    const notification = event?.notification || {};
    const extra = notification.extra || {};
    if (extra?.tag !== "agnihotra-export-file-ready") return;
    const notificationId = Number(notification.id || 0);
    markExportNotificationReceived(notificationId, {
      source: "localNotificationReceived",
    });
    exportLog("export-ready-notification-received", {
      notificationId: notificationId || null,
      receivedAtMs: Date.now(),
      scheduledForMs: Number(extra?.scheduledForMs || 0) || null,
      filename: extra?.fileName || null,
    });
  });
  exportLog("export-ready-notification-listener-bound");
}

async function tryShareOrDownload(blob, filename, mime) {
  let nativeSaved = null;
  if (isNativeAppRuntime()) {
    try {
      nativeSaved = await saveFileInNativeStorage(blob, filename, mime);
      if (nativeSaved) {
        const notificationMeta = await notifyNativeExportReady(
          nativeSaved,
          `${filename} saved. Tap to open.`
        );
        return {
          mode: "native-saved",
          savedPath: nativeSaved.path,
          savedUri: nativeSaved.uri,
          notificationId: notificationMeta?.notificationId || null,
          notificationScheduledForMs: notificationMeta?.scheduledForMs || null,
        };
      }
    } catch (error) {
      exportLog("native-save-failed", {
        filename,
        error: error?.message || String(error),
      });
    }
  }

  triggerDownload(blob, filename);
  return { mode: "downloaded", savedPath: null, savedUri: null };
}

async function exportMonthAsPdf(
  rows,
  filename,
  locationName,
  rangeLabel
) {
  exportLog("pdf-start", {
    filename,
    locationName,
    rangeLabel,
    rows: rows.length,
  });
  const pdfExporter = window.AgnihotraPdfExport;
  if (!pdfExporter?.exportToPdf) {
    throw new Error("PDF exporter module unavailable.");
  }
  const blob = await pdfExporter.exportToPdf({
    rows: rows.map((row) => ({
      date: row.date,
      sunrise: formatTimeToAMPM(row.sunrise),
      sunset: formatTimeToAMPM(row.sunset),
    })),
    filename,
    locationName,
    rangeLabel,
  });
  const result = await tryShareOrDownload(blob, filename, "application/pdf");
  exportLog("pdf-complete", {
    filename,
    mode: result.mode,
    savedPath: result.savedPath,
    savedUri: result.savedUri,
    bytes: blob.size,
  });
  return result;
}

function setupScheduleExportControls() {
  const startDateInput = document.getElementById("scheduleExportStartDate");
  const endDateInput = document.getElementById("scheduleExportEndDate");
  const pdfBtn = document.getElementById("exportPdfBtn");
  const icsBtn = document.getElementById("exportIcsBtn");
  if (!startDateInput || !endDateInput || !pdfBtn || !icsBtn) return;

  const today = new Date();
  const startOfCurrentYear = new Date(today.getFullYear(), 0, 1);
  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  startDateInput.min = formatDateInputValue(startOfCurrentYear);
  endDateInput.max = formatDateInputValue(oneYearFromNow);

  const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  startDateInput.value = formatDateInputValue(firstDayCurrentMonth);
  endDateInput.value = formatDateInputValue(lastDayCurrentMonth);
  endDateInput.min = startDateInput.value;

  startDateInput.addEventListener("change", () => {
    endDateInput.min = startDateInput.value || startDateInput.min;
    if (endDateInput.value && startDateInput.value && endDateInput.value < startDateInput.value) {
      endDateInput.value = startDateInput.value;
    }
  });

  const setExportButtonsBusy = (busy, activeKind = "pdf") => {
    const allButtons = [pdfBtn, icsBtn];
    allButtons.forEach((button) => {
      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent || "";
      }
      button.disabled = busy;
      button.classList.toggle("is-busy", busy);
      button.classList.toggle("is-idle", !busy);
    });
    if (!busy) {
      allButtons.forEach((button) => {
        button.textContent = button.dataset.defaultLabel || button.textContent;
      });
      return;
    }
    if (activeKind === "ics") {
      icsBtn.textContent = "⏳ Generating ICS...";
      pdfBtn.textContent = "Please wait...";
    } else {
      pdfBtn.textContent = "⏳ Generating PDF...";
      icsBtn.textContent = "Please wait...";
    }
  };

  const runExport = async (kind) => {
    exportLog("trigger", { kind });
    const startValue = startDateInput.value;
    const endValue = endDateInput.value;
    if (!startValue || !endValue) {
      setScheduleExportStatus(
        t("schedule.export.selectRangeError", "Please select start and end dates."),
        true
      );
      return;
    }

    if (startValue < startDateInput.min) {
      setScheduleExportStatus(
        t(
          "schedule.export.startMinError",
          "Start date cannot be before January 1 of the current year."
        ),
        true
      );
      return;
    }

    if (endValue > endDateInput.max) {
      setScheduleExportStatus(
        t(
          "schedule.export.endMaxError",
          "End date cannot be beyond one year from today."
        ),
        true
      );
      return;
    }

    if (endValue < startValue) {
      setScheduleExportStatus(
        t("schedule.export.invalidRangeError", "End date must be on or after start date."),
        true
      );
      return;
    }

    setScheduleExportStatus(t("schedule.export.generating", "Generating export..."));
    setExportButtonsBusy(true, kind);
    try {
      const built = await buildRangeTimingRows(startValue, endValue);
      if (!built?.rows?.length) {
        setScheduleExportStatus(
          t(
            "schedule.export.noData",
            "No data available. Open location timings first."
          ),
          true
        );
        return;
      }
      const locationName = resolveExportLocationName(built.exportLocation.locationName);
      const safeRange = `${startValue.replace(/-/g, "")}-${endValue.replace(/-/g, "")}`;
      const rangeLabel = `${startValue} to ${endValue}`;
      if (kind === "ics") {
        const filename = `agnihotra-${safeRange}.ics`;
        const icsContent = buildIcsContent(built.rows, locationName);
        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const exportResult = await tryShareOrDownload(blob, filename, "text/calendar");
        exportLog("ics-complete", {
          filename,
          mode: exportResult.mode,
          savedPath: exportResult.savedPath,
          savedUri: exportResult.savedUri,
          bytes: blob.size,
        });
        const successMessage =
          exportResult.mode === "native-saved"
              ? "✅ ICS saved"
              : `✅ ICS downloaded: ${filename}. Check your Downloads folder.`;
        if (exportResult?.notificationId) {
          setScheduleExportStatus("Waiting for export notification...");
          const timeoutMs = Math.max(
            2000,
            Math.min(
              7000,
              Number(exportResult.notificationScheduledForMs || 0) - Date.now() + 4500
            )
          );
          exportLog("ui-wait-notification-popup", {
            kind: "ics",
            notificationId: exportResult.notificationId,
            timeoutMs,
          });
          const receipt = await waitForExportNotificationReceipt(
            exportResult.notificationId,
            timeoutMs
          );
          exportLog("ui-wait-notification-popup-done", {
            kind: "ics",
            notificationId: exportResult.notificationId,
            ...receipt,
          });
          if (receipt?.received) {
            setScheduleExportStatus(successMessage);
            showInstantExportFeedback(successMessage);
          } else {
            setScheduleExportStatus("ICS generated. Waiting for notification popup.");
          }
        } else {
          setScheduleExportStatus(successMessage);
          showInstantExportFeedback(successMessage);
        }
      } else {
        const filename = `agnihotra-${safeRange}.pdf`;
        const exportResult = await exportMonthAsPdf(
          built.rows,
          filename,
          locationName,
          rangeLabel
        );
        const pdfMessage =
          exportResult?.mode === "native-saved"
            ? "✅ PDF saved"
            : `✅ PDF ready: ${filename}. If not visible in app, check device Downloads/Files.`;
        if (exportResult?.notificationId) {
          setScheduleExportStatus("Waiting for export notification...");
          const timeoutMs = Math.max(
            2000,
            Math.min(
              7000,
              Number(exportResult.notificationScheduledForMs || 0) - Date.now() + 4500
            )
          );
          exportLog("ui-wait-notification-popup", {
            kind: "pdf",
            notificationId: exportResult.notificationId,
            timeoutMs,
          });
          const receipt = await waitForExportNotificationReceipt(
            exportResult.notificationId,
            timeoutMs
          );
          exportLog("ui-wait-notification-popup-done", {
            kind: "pdf",
            notificationId: exportResult.notificationId,
            ...receipt,
          });
          if (receipt?.received) {
            setScheduleExportStatus(pdfMessage);
            showInstantExportFeedback(pdfMessage);
          } else {
            setScheduleExportStatus("PDF generated. Waiting for notification popup.");
          }
        } else {
          setScheduleExportStatus(pdfMessage);
          showInstantExportFeedback(pdfMessage);
        }
      }
    } catch (error) {
      exportLog("failed", {
        error: error?.message || String(error),
        stack: error?.stack || null,
      });
      setScheduleExportStatus(
        t("schedule.export.failed", "Export failed. Please try again."),
        true
      );
      showInstantExportFeedback("❌ Export failed. Check logs and try again.", true);
    } finally {
      setExportButtonsBusy(false, kind);
    }
  };

  pdfBtn.addEventListener("click", () => runExport("pdf"));
  icsBtn.addEventListener("click", () => runExport("ics"));
}

function displayUpcomingTimings(todayResults, tomorrowResults, elementId) {
  const element = document.getElementById(elementId);
  const currentTime = Date.now();

  // Parse the date format DD.MM.YYYY and time format HH:MM:SS
  const todaySunriseTime = parseDateTime(
    todayResults.date,
    todayResults.sunrise
  );
  const todaySunsetTime = parseDateTime(todayResults.date, todayResults.sunset);
  const tomorrowSunriseTime = parseDateTime(
    tomorrowResults.date,
    tomorrowResults.sunrise
  );
  const tomorrowSunsetTime = parseDateTime(
    tomorrowResults.date,
    tomorrowResults.sunset
  );

  // Clear previous content and countdowns
  element.innerHTML = "";
  window.activeCountdowns = {}; // Clear all active countdowns
  window.countdownLabels = {};

  // Find the next upcoming event(s) based on current time
  const upcomingEvents = [];

  // Check what's coming next - always show the next 2 upcoming events
  if (currentTime < todaySunriseTime) {
    // Before today's sunrise - show today's sunrise and sunset
    upcomingEvents.push({
      id: "todayssunrise",
      label: t("events.todaysSunrise", "Today's Sunrise"),
      time: todaySunriseTime,
      isSunrise: true
    });
    upcomingEvents.push({
      id: "todayssunset",
      label: t("events.todaysSunset", "Today's Sunset"),
      time: todaySunsetTime,
      isSunrise: false
    });
  } else if (currentTime < todaySunsetTime) {
    // After today's sunrise but before today's sunset - show today's sunset and tomorrow's sunrise
    upcomingEvents.push({
      id: "todayssunset",
      label: t("events.todaysSunset", "Today's Sunset"),
      time: todaySunsetTime,
      isSunrise: false
    });
    upcomingEvents.push({
      id: "tomorrowssunrise",
      label: t("events.tomorrowsSunrise", "Tomorrow's Sunrise"),
      time: tomorrowSunriseTime,
      isSunrise: true
    });
  } else {
    // After today's sunset - show tomorrow's sunrise and sunset
    upcomingEvents.push({
      id: "tomorrowssunrise",
      label: t("events.tomorrowsSunrise", "Tomorrow's Sunrise"),
      time: tomorrowSunriseTime,
      isSunrise: true
    });
    upcomingEvents.push({
      id: "tomorrowssunset",
      label: t("events.tomorrowsSunset", "Tomorrow's Sunset"),
      time: tomorrowSunsetTime,
      isSunrise: false
    });
  }

  // Display the upcoming events
  upcomingEvents.forEach((eventItem) => {
    displayCountdownAndTime(
      element,
      eventItem.id,
      eventItem.label,
      eventItem.time,
      eventItem.isSunrise
    );
  });

  const nextEvent = upcomingEvents[0];
  if (nextEvent) {
    syncNativeHomescreenWidget(nextEvent);
  }

}

async function syncNativeHomescreenWidget(nextEvent) {
  if (!isNativeAppRuntime()) return;
  const widgetPlugin = window.Capacitor?.Plugins?.AgnihotraWidget;
  if (!widgetPlugin?.setNextTiming) return;

  try {
    await widgetPlugin.setNextTiming({
      label: nextEvent.label,
      targetMs: Number(nextEvent.time || 0),
      timeText: formatDateTimeToTimeOnly(nextEvent.time),
      widgetTitle: t("widget.title", "EternalAgni"),
      widgetCountdownLabel: "Countdown",
      widgetTimePassedLabel: t("widget.timePassed", "Time passed"),
      widgetNoTimingLabel: t("widget.noTiming", "Open app to load timing"),
    });
  } catch (error) {
    console.warn("[AGNIHOTRA][WIDGET] sync-failed", error);
  }
}

// Helper function to parse date and time into timestamp
function parseDateTime(dateStr, timeStr) {
  // Handle both DD.MM.YYYY and YYYY-MM-DD formats
  let day, month, year;

  if (dateStr.includes(".")) {
    // DD.MM.YYYY format from homatherapie.de
    [day, month, year] = dateStr.split(".").map(Number);
  } else if (dateStr.includes("-")) {
    // YYYY-MM-DD format from sunrisesunset.io API
    [year, month, day] = dateStr.split("-").map(Number);
  } else {
    console.error("Unknown date format:", dateStr);
    return Date.now(); // Return current time if parsing fails
  }

  // Parse time string - handle both "HH:MM:SS" and "H:MM:SS AM/PM" formats
  let hours,
    minutes,
    seconds = 0;

  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    // Handle AM/PM format like "6:04:27 AM"
    const isPM = timeStr.includes("PM");
    const timePart = timeStr.replace(/\s*(AM|PM)/i, "");

    const timeParts = timePart.split(":");
    hours = parseInt(timeParts[0]);
    minutes = parseInt(timeParts[1]);
    seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;

    // Convert to 24-hour format
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }
  } else {
    // Handle 24-hour format like "06:04:27"
    const timeParts = timeStr.split(":");
    hours = parseInt(timeParts[0]);
    minutes = parseInt(timeParts[1]);
    seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
  }

  // Validate parsed values
  if (
    isNaN(day) ||
    isNaN(month) ||
    isNaN(year) ||
    isNaN(hours) ||
    isNaN(minutes) ||
    isNaN(seconds)
  ) {
    console.error("Failed to parse date/time:", {
      dateStr,
      timeStr,
      day,
      month,
      year,
      hours,
      minutes,
      seconds,
    });
    return Date.now(); // Return current time if parsing fails
  }

  // Create date object (month is 0-indexed in JavaScript)
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  return date.getTime();
}

// Global object to store countdown data
window.activeCountdowns = window.activeCountdowns || {};
window.countdownLabels = window.countdownLabels || {};
window.playedAlerts = window.playedAlerts || new Set();
const PRE_ALERT_MINUTES = 10;
const ALERT_WINDOW_MS = 10000; // Trigger if app checks within 10s of target

// Persistent AudioContext to be initialized on user gesture. Unlocking it
// also lets the @capacitor-community/native-audio plugin play immediately on
// browsers that gate HTMLAudio behind a user interaction.
let audioCtx = null;
let wakeLockSentinel = null;
let wakeLockMonitorInterval = null;
let testReminderTimeoutId = null;
let testReminderCountdownIntervalId = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window['webkitAudioContext'];
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Unlock audio on common user interactions
["click", "touchstart", "mousedown", "keydown"].forEach((event) => {
  window.addEventListener(event, initAudio, { once: true });
});

async function requestScreenWakeLock(forceReacquire = false) {
  if (!('wakeLock' in navigator)) return false;
  if (document.visibilityState !== 'visible') return false;
  if (wakeLockSentinel && !forceReacquire) return true;

  try {
    if (wakeLockSentinel && forceReacquire) {
      try {
        await wakeLockSentinel.release();
      } catch (_) {}
      wakeLockSentinel = null;
    }

    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
      // Some mobile browsers release wake lock during lifecycle changes.
      // Re-acquire as soon as the page becomes active again.
      if (document.visibilityState === 'visible') {
        setTimeout(() => requestScreenWakeLock(), 300);
      }
    });
    return true;
  } catch (error) {
    console.warn("Wake lock request failed:", error);
    return false;
  }
}

function setupScreenWakeLock() {
  requestScreenWakeLock();

  // Retry once after initial page setup for slower mobile browsers.
  setTimeout(() => requestScreenWakeLock(), 1200);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestScreenWakeLock();
    }
  });

  window.addEventListener('focus', () => requestScreenWakeLock());
  window.addEventListener('pageshow', () => requestScreenWakeLock());

  ["click", "touchstart", "mousedown", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, () => requestScreenWakeLock());
  });

  // Keep checking periodically while app is open (phone-safe reliability).
  if (!wakeLockMonitorInterval) {
    wakeLockMonitorInterval = setInterval(() => {
      requestScreenWakeLock();
    }, 30000);
  }
}

function displayCountdownAndTime(element, id, label, time, isSunrise) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "time-item";

  const uniqueId = id;
  const iconClass = isSunrise ? "fas fa-sun" : "fas fa-moon";
  const iconColor = isSunrise ? "#FFD700" : "#4B0082";
  const atTemplate = t("countdown.atTime", "at {{time}}");
  const atText = interpolateTemplate(atTemplate, {
    time: formatDateTimeToTimeOnly(time),
  });

  itemDiv.innerHTML = `
        <span class="time-label"><i class="${iconClass}" style="color: ${iconColor};"></i> ${label.toUpperCase()}</span>
        <span id="${uniqueId}Countdown" class="countdown-value">--h --m --s</span>
        <span class="time-secondary">${atText}</span>
    `;

  element.appendChild(itemDiv);

  // Store countdown data globally
  window.activeCountdowns[uniqueId] = time;
  window.countdownLabels[uniqueId] = label;

  // Start the countdown immediately
  updateCountdown(uniqueId, time);
}

function formatDateTimeToTimeOnly(time) {
  const date = new Date(time);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}

// Global countdown updater - runs every second
if (!window.countdownInterval) {
  window.countdownInterval = setInterval(() => {
    for (const [countdownId, targetTime] of Object.entries(
      window.activeCountdowns
    )) {
      updateCountdown(countdownId, targetTime);
    }
  }, 1000);
}

function updateCountdown(type, targetTime) {
  const currentTime = Date.now();
  const timeDiff = targetTime - currentTime;
  const preAlertTime = targetTime - PRE_ALERT_MINUTES * 60 * 1000;
  const nativeRuntime = isNativeAppRuntime();

  const countdownElement = document.getElementById(`${type}Countdown`);

  if (!countdownElement) {
    return; // Element doesn't exist, skip update
  }

  const preAlertKey = `${type}_${targetTime}_pre${PRE_ALERT_MINUTES}`;
  const mainAlertKey = `${type}_${targetTime}_main`;
  const eventLabel = window.countdownLabels?.[type] || type;

  if (!window.playedAlerts.has(preAlertKey)) {
    const preAlertDelta = currentTime - preAlertTime;
    if (preAlertDelta >= 0 && preAlertDelta <= ALERT_WINDOW_MS) {
      // Native: the OS notification scheduled via Capacitor fires with the
      // channel sound (3x bell) automatically, both in foreground AND when the
      // app is closed. We do NOT play another bell from JS to avoid doubling.
      // Web: there's no scheduled OS notification, so we ring the 3x bell via
      // NativeAudio (HTMLAudio fallback) when the page is visible.
      if (!nativeRuntime) {
        const isForeground =
          typeof document !== "undefined" &&
          document.visibilityState === "visible";
        if (isForeground) {
          const reminderCopy = getReminderNotificationCopy(
            eventLabel,
            PRE_ALERT_MINUTES
          );
          window.AgnihotraNotifications?.show(
            reminderCopy.title,
            reminderCopy.body,
            preAlertKey
          );
          window.AgnihotraBell?.playTriple?.("pre-alert-web");
          console.log("[AGNIHOTRA][ALERT] pre-alert-web", {
            tag: preAlertKey,
            mode: "native-audio-3x",
          });
        }
      } else {
        console.log("[AGNIHOTRA][ALERT] pre-alert-native", {
          tag: preAlertKey,
          mode: "scheduled-notification-channel-sound-only",
        });
      }
      window.playedAlerts.add(preAlertKey);
    } else if (preAlertDelta > ALERT_WINDOW_MS) {
      window.playedAlerts.add(preAlertKey);
    }
  }

  if (!window.playedAlerts.has(mainAlertKey)) {
    const mainAlertDelta = currentTime - targetTime;
    if (mainAlertDelta >= 0 && mainAlertDelta <= ALERT_WINDOW_MS) {
      // Single bell "ting" the moment the agnihotra window opens.
      // Foreground-only: never raise an OS notification here, never play
      // when the app is closed/backgrounded.
      const isForeground =
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      if (isForeground) {
        ringSingleBellInstant("window-open");
        console.log("[AGNIHOTRA][ALERT] window-open-ting", {
          tag: mainAlertKey,
          runtime: nativeRuntime ? "native-foreground" : "web-foreground",
          mode: "single-bell-ting",
        });
      } else {
        console.log("[AGNIHOTRA][ALERT] window-open-skip", {
          tag: mainAlertKey,
          reason: "app-not-foreground",
        });
      }
      window.playedAlerts.add(mainAlertKey);
    } else if (mainAlertDelta > ALERT_WINDOW_MS) {
      window.playedAlerts.add(mainAlertKey);
    }
  }

  if (timeDiff > 0) {
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    const withDaysTemplate = t(
      "countdown.format.withDays",
      "{{days}}d {{hours}}h {{minutes}}m {{seconds}}s"
    );
    const noDaysTemplate = t(
      "countdown.format.noDays",
      "{{hours}}h {{minutes}}m {{seconds}}s"
    );
    let countdownText = "";
    if (days > 0) {
      countdownText = interpolateTemplate(withDaysTemplate, {
        days,
        hours,
        minutes,
        seconds,
      });
    } else {
      countdownText = interpolateTemplate(noDaysTemplate, {
        hours,
        minutes,
        seconds,
      });
    }

    countdownElement.innerText = countdownText;
  } else {
    // Never show "Time passed". Immediately rotate to the next upcoming slots.
    requestUpcomingEventsRefresh("event-window-passed");
  }
}

function formatDateTime(time) {
  const date = new Date(time);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedDate = `${date.toDateString()} ${
    hours % 12 || 12
  }:${minutes}:${seconds} ${ampm}`;
  return formattedDate;
}

async function getLocation() {
  setLocationLoading(true);
  const startedAt = performance.now();
  debugLog("location:start");
  locationLog("request-start");

  // Immediate bootstrap for reload reliability: show last known location/timings first.
  const lastKnown = getLastKnownLocation();
  if (lastKnown) {
    const fastLocationText =
      lastKnown.locationName || "Detecting nearby place...";
    document.getElementById("userLocation").innerText = `Your Location: ${fastLocationText}`;
    debugLog("location:last-known-bootstrap", {
      lat: lastKnown.lat,
      lng: lastKnown.lng,
      hasName: Boolean(lastKnown.locationName),
    });
    getSunriseSunset(lastKnown.lat, lastKnown.lng, lastKnown.locationName || null);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        debugLog("location:geolocation-success", {
          elapsedMs: Math.round(performance.now() - startedAt),
          accuracyMeters: position.coords.accuracy
        });
        locationLog("gps-success", {
          lat: latitude,
          lng: longitude,
          accuracyMeters: position.coords.accuracy,
          elapsedMs: Math.round(performance.now() - startedAt)
        });

        document.getElementById("userLocation").innerText =
          "Your Location: Detecting nearby place...";
        saveLastKnownLocation(latitude, longitude);
        // Prioritize timing visibility first; resolve readable address in parallel.
        const timingsPromise = getSunriseSunset(latitude, longitude);
        await reverseGeocode(latitude, longitude, true);
        await timingsPromise;
      },
      async (error) => {
        debugLog("location:geolocation-error", {
          elapsedMs: Math.round(performance.now() - startedAt),
          code: error?.code,
          message: error?.message
        });
        locationLog("gps-error", {
          code: error?.code,
          message: error?.message,
          elapsedMs: Math.round(performance.now() - startedAt)
        });

        // For timeout/unavailable GPS, attempt one immediate precise retry
        // before moving to city-level IP fallback.
        if (error?.code !== 1) {
          const recovered = await tryImmediatePreciseLocationRecovery();
          if (recovered) {
            document.getElementById("userLocation").innerText =
              "Your Location: Detecting nearby place...";
            saveLastKnownLocation(recovered.latitude, recovered.longitude);

            const timingsPromise = getSunriseSunset(recovered.latitude, recovered.longitude);
            await reverseGeocode(recovered.latitude, recovered.longitude, true);
            await timingsPromise;
            return;
          }
        }

        if (REQUIRE_MANDATORY_LOCATION_PERMISSION) {
          setLocationLoading(false);
          setPermissionGateVisible(
            true,
            "Location permission is required for accurate Agnihotra timings."
          );
          return;
        }

        locationLog("gps-fallback-started", { reason: `gps-error-${error?.code || "unknown"}` });
        await getApproximateLocation();
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 300000
      }
    );
  } else {
    debugLog("location:geolocation-not-supported");
    locationLog("geolocation-not-supported");
    document.getElementById("userLocation").innerText =
      "Geolocation not supported on this device.";
    setLocationLoading(false);
    if (REQUIRE_MANDATORY_LOCATION_PERMISSION) {
      setPermissionGateVisible(
        true,
        "Location permission is required, but geolocation is not available on this device."
      );
      return;
    }
    await getApproximateLocation();
  }
}

async function reverseGeocode(latitude, longitude, skipTimingFetch = false) {
  const startedAt = performance.now();
  debugLog("reverse-geocode:start", { skipTimingFetch });
  try {
    // Reuse cached place name if location drift is below threshold.
    const cachedLocationName = getNearbyCachedLocationName(latitude, longitude);
    if (cachedLocationName) {
      document.getElementById("userLocation").innerHTML = `
        <span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-bottom: 5px;">Detected Address:</span>
        <span style="font-weight: bold; font-size: 1.1rem; line-height: 1.4; display: block;">${cachedLocationName}</span>
      `;
      saveLastKnownLocation(latitude, longitude, cachedLocationName);
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude, cachedLocationName);
      }
      setLocationLoading(false);
      locationLog("source-location-name-cache", {
        elapsedMs: Math.round(performance.now() - startedAt),
        thresholdKm: LOCATION_NAME_REFRESH_DISTANCE_KM,
      });
      return;
    }

    // If offline, skip API calls and use cached data
    if (!navigator.onLine) {
      // Try to get cached location name
      const cache = getValidCachedData(latitude, longitude);
      const locationDisplay = cache && cache.locationName ? cache.locationName : "";
      document.getElementById("userLocation").innerHTML = locationDisplay
        ? `
        <span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-bottom: 5px;">Offline Mode:</span>
        <span style="font-weight: bold; font-size: 1.1rem; line-height: 1.4; display: block;">${locationDisplay}</span>
      `
        : `
        <span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-bottom: 5px;">Offline Mode:</span>
        <span style="font-weight: 600; font-size: 1rem; line-height: 1.4; display: block;">Place name unavailable offline. Connect once to fetch nearby city/state.</span>
      `;
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude);
      }
      setLocationLoading(false);
      debugLog("reverse-geocode:offline-cache", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      locationLog("source-offline-cache", { lat: latitude, lng: longitude });
      return;
    }

    // Use Nominatim (OpenStreetMap) for more precise address details
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          "Accept-Language": "en",
        },
      },
      7000
    );

    if (response.ok) {
      const data = await response.json();

      // Extract a clean, precise address
      const address = data.display_name;
      const shortAddress = address.split(",").slice(0, 4).join(",").trim(); // Get first few parts for cleaner display

      document.getElementById("userLocation").innerHTML = `
                <span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-bottom: 5px;">Detected Address:</span>
                <span style="font-weight: bold; font-size: 1.1rem; line-height: 1.4; display: block;">${address}</span>
            `;
      saveLastKnownLocation(latitude, longitude, address);

      // Call the async getSunriseSunset function and pass location name
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude, address);
      }
      debugLog("reverse-geocode:nominatim-success", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      locationLog("source-gps+nominatim", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    } else {
      // Fallback to original BigDataCloud service if Nominatim fails
      const bdcResponse = await fetchWithTimeout(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      if (bdcResponse.ok) {
        const bdcData = await bdcResponse.json();
        const location = `${
          bdcData.city || bdcData.locality || "Unknown City"
        }, ${bdcData.principalSubdivision || "Unknown State"}, ${
          bdcData.countryName || "Unknown Country"
        }`;
        document.getElementById(
          "userLocation"
        ).innerText = `Your Location: ${location}`;
        saveLastKnownLocation(latitude, longitude, location);
        if (!skipTimingFetch) {
          await getSunriseSunset(latitude, longitude, location);
        }
        debugLog("reverse-geocode:bdc-success", {
          elapsedMs: Math.round(performance.now() - startedAt)
        });
        locationLog("source-gps+bigdatacloud", {
          elapsedMs: Math.round(performance.now() - startedAt)
        });
      } else {
        throw new Error("All geocoding services failed");
      }
    }
  } catch (error) {
    // Fall back to generic location label (no coordinates in UI)
    document.getElementById("userLocation").innerText =
      "Your Location: Place name unavailable";
    if (!skipTimingFetch) {
      await getSunriseSunset(latitude, longitude);
    }
    debugLog("reverse-geocode:fallback-coordinates", {
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error?.message || String(error)
    });
    locationLog("source-gps-coordinates-fallback", {
      error: error?.message || String(error)
    });
  }

  setLocationLoading(false);
}

async function reverseGeocodeApproximate(latitude, longitude, skipTimingFetch = false) {
  const startedAt = performance.now();
  debugLog("reverse-geocode-approx:start", { skipTimingFetch });
  try {
    const cachedLocationName = getNearbyCachedLocationName(latitude, longitude);
    if (cachedLocationName) {
      document.getElementById("userLocation").innerText = `Your Location: ${cachedLocationName}`;
      saveLastKnownLocation(latitude, longitude, cachedLocationName);
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude, cachedLocationName);
      }
      setLocationLoading(false);
      locationLog("source-ip-location-name-cache", {
        elapsedMs: Math.round(performance.now() - startedAt),
        thresholdKm: LOCATION_NAME_REFRESH_DISTANCE_KM,
      });
      return;
    }

    // If offline, skip API call
    if (!navigator.onLine) {
      const cache = getValidCachedData(latitude, longitude);
      const locationDisplay = cache && cache.locationName ? `${cache.locationName}` : "";
      document.getElementById("userLocation").innerText = locationDisplay
        ? `Offline Mode: ${locationDisplay}`
        : "Offline Mode: Place name unavailable. Connect once to fetch nearby city/state.";
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude);
      }
      setLocationLoading(false);
      debugLog("reverse-geocode-approx:offline-cache", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      locationLog("source-ip-offline-cache", {
        lat: latitude,
        lng: longitude
      });
      return;
    }

    // Use the same reverse geocoding service but mark as approximate
    const response = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );

    if (response.ok) {
      const data = await response.json();
      const location = `${data.city || data.locality || "Unknown City"}, ${
        data.principalSubdivision || "Unknown State"
      }, ${data.countryName || "Unknown Country"}`;

      document.getElementById(
        "userLocation"
      ).innerText = `Your Location: ${location}`;
      saveLastKnownLocation(latitude, longitude, location);

      // Call the async getSunriseSunset function with approximate coordinates and location name
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude, location);
      }
      debugLog("reverse-geocode-approx:bdc-success", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      locationLog("source-ip+bigdatacloud", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    } else {
      // Fall back to generic location label (no coordinates in UI)
      document.getElementById("userLocation").innerText =
        "Your Location: Place name unavailable";
      saveLastKnownLocation(latitude, longitude);
      if (!skipTimingFetch) {
        await getSunriseSunset(latitude, longitude);
      }
      debugLog("reverse-geocode-approx:coordinates-only", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      locationLog("source-ip-coordinates-only", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    }
  } catch (error) {
    // Fall back to generic location label (no coordinates in UI)
    document.getElementById("userLocation").innerText =
      "Your Location: Place name unavailable";
    saveLastKnownLocation(latitude, longitude);
    if (!skipTimingFetch) {
      await getSunriseSunset(latitude, longitude);
    }
    debugLog("reverse-geocode-approx:fallback-coordinates", {
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error?.message || String(error)
    });
    locationLog("source-ip-fallback-error", {
      error: error?.message || String(error)
    });
  }

  setLocationLoading(false);
}

async function getApproximateLocation() {
  const startedAt = performance.now();
  debugLog("approx-location:start");
  try {
    // If offline, show message and use default location or cached data
    if (!navigator.onLine) {
      document.getElementById(
        "userLocation"
      ).innerText = `Offline Mode - Unable to detect location automatically. Showing cached timings if available.`;
      
      setLocationLoading(false);
      debugLog("approx-location:offline", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return;
    }

    // Try multiple IP geolocation services to get coordinates only
    const services = [
      "https://ipapi.co/json/",
      "https://geolocation-db.com/json/",
      "https://freeipapi.com/api/json",
      "https://ipgeolocation.abstractapi.com/v1/?api_key=",
      "https://ipwho.is/",
    ];

    let coordinates = null;

    for (const service of services) {
      try {
        const response = await fetchWithTimeout(service, {}, 3500);

        if (response.ok) {
          const data = await response.json();

          // Extract only coordinates from different API response formats
          if (data.latitude && data.longitude) {
            // ipapi.co, geolocation-db.com, ipwho.is format
            coordinates = {
              lat: parseFloat(data.latitude),
              lng: parseFloat(data.longitude),
            };
            locationLog("ip-service-selected", { service });
            break;
          } else if (data.lat && data.lon) {
            // Alternative lat/lon format
            coordinates = {
              lat: parseFloat(data.lat),
              lng: parseFloat(data.lon),
            };
            locationLog("ip-service-selected", { service });
            break;
          }
        }
      } catch (serviceError) {
        continue; // Try next service
      }
    }

    if (coordinates) {
      // Update location text to show we're identifying the place
      document.getElementById("userLocation").innerText =
        "Identifying nearby place...";

      // Use the same reverse geocoding function to identify the place
      const timingsPromise = getSunriseSunset(coordinates.lat, coordinates.lng);
      await reverseGeocodeApproximate(coordinates.lat, coordinates.lng, true);
      await timingsPromise;
      debugLog("approx-location:success", {
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    } else {
      throw new Error(
        "All IP geolocation services failed to provide coordinates"
      );
    }
  } catch (error) {
    console.error("IP geolocation failed:", error);
    // No fallback coordinates - require user to enable location
    document.getElementById(
      "userLocation"
    ).innerText = `Unable to detect location. Please refresh and allow location access for Agnihotra times.`;

    // Add a note about enabling location
    const upcomingElement = document.getElementById("upcomingTimes");
    if (upcomingElement) {
      upcomingElement.innerHTML =
        "<li>Location access required for accurate Agnihotra timing</li>";
    }

    setLocationLoading(false);
    debugLog("approx-location:error", {
      elapsedMs: Math.round(performance.now() - startedAt),
      error: error?.message || String(error)
    });
  }
}

async function showError(error) {
  document.getElementById(
    "userLocation"
  ).innerText = `Getting location...`;

  // Try to get approximate location using IP-based geolocation
  await getApproximateLocation();
}

      // Offline status monitoring
  function updateOnlineStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      if (isEffectivelyOnline()) {
        indicator.style.display = 'none';
        document.body.classList.remove('is-offline');
      } else {
        indicator.style.display = 'block';
        document.body.classList.add('is-offline');
      }
    }
  }

window.onload = () => {
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");
  if (document.body) {
    document.body.setAttribute("translate", "no");
    document.body.classList.add("notranslate");
  }
  debugLog("app:onload");
  setupForcedOfflineMode();
  setLocationLoading(true);
  setupLanguageToggle();
  setupTestReminderButton();
  setupScreenWakeLock();
  setupDebugOverlayLogger();
  bindPermissionGateActions();
  evaluateMandatoryPermissions({ forcePrompt: false }).then((granted) => {
    if (granted) {
      continueAppInitialization();
      return;
    }
    updateOnlineStatus();
  });
};

// Register Service Worker only for web/PWA.
// In Capacitor native runtime, SW caching can serve stale JS and break UI parity.
if ("serviceWorker" in navigator) {
  const isNativeRuntime = Boolean(
    window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()
  );
  if (isNativeRuntime) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .then(() =>
        console.log("[AGNIHOTRA][SW] unregistered-for-native-runtime")
      )
      .catch((err) =>
        console.warn("[AGNIHOTRA][SW] unregister-failed", err)
      );
  } else {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker registered", reg))
      .catch((err) => console.error("Service Worker registration failed", err));
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Format time in MM:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize audio player
function initAudioPlayer(audioId) {
  const audio = document.getElementById(audioId);
  const progressBar = document.getElementById(audioId.replace('-audio', '-progress-bar'));
  const progressFill = document.getElementById(audioId.replace('-audio', '-progress'));
  const currentTimeDisplay = document.getElementById(audioId.replace('-audio', '-current'));
  const durationDisplay = document.getElementById(audioId.replace('-audio', '-duration'));
  
  if (!audio) return;
  
  // Force preload metadata
  audio.preload = 'metadata';
  audio.load();
  
  // Function to update duration display
  const updateDuration = () => {
    if (durationDisplay && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      durationDisplay.textContent = formatTime(audio.duration);
    }
  };
  
  // Update progress and time
  audio.addEventListener('timeupdate', () => {
    if (!isNaN(audio.duration) && isFinite(audio.duration)) {
      const progress = (audio.currentTime / audio.duration) * 100;
      if (progressFill) {
        progressFill.style.width = Math.min(100, progress) + '%';
      }
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
      }
      // Update duration if not set yet
      updateDuration();
    }
  });
  
  // Load metadata
  audio.addEventListener('loadedmetadata', () => {
    updateDuration();
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = '0:00';
    }
  });
  
  // When audio is ready to play
  audio.addEventListener('canplay', updateDuration);
  
  // Also try on loadeddata
  audio.addEventListener('loadeddata', updateDuration);
  
  // Try immediately if already loaded
  if (audio.readyState >= 1) {
    updateDuration();
  }
  
  // Reset on end
  audio.addEventListener('ended', () => {
    const button = document.querySelector(`button[onclick*="${audioId}"]`);
    if (button) {
      const icon = button.querySelector('i');
      icon.classList.replace('fa-pause', 'fa-play');
      button.classList.remove('playing');
    }
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    if (currentTimeDisplay) {
      currentTimeDisplay.textContent = '0:00';
    }
  });
  
  // Seek functionality - click
  if (progressBar) {
    let isDragging = false;
    let animationFrameId = null;
    
    const handleSeek = (event) => {
      const rect = progressBar.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        // Update progress fill immediately for visual feedback during drag
        if (isDragging && progressFill) {
          progressFill.style.width = (percentage * 100) + '%';
        }
        
        // Update audio current time
        audio.currentTime = percentage * audio.duration;
      }
    };
    
    progressBar.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleSeek(event);
    });
    
    // Seek functionality - drag with RAF for smoothness
    const startDrag = (e) => {
      e.preventDefault();
      isDragging = true;
      progressBar.classList.add('dragging');
      handleSeek(e);
    };
    
    const moveDrag = (e) => {
      if (isDragging) {
        // Cancel previous animation frame if any
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        // Use requestAnimationFrame for smooth updates
        animationFrameId = requestAnimationFrame(() => {
          handleSeek(e);
        });
      }
    };
    
    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        progressBar.classList.remove('dragging');
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      }
    };
    
    progressBar.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch support for mobile
    progressBar.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDragging = true;
      progressBar.classList.add('dragging');
      const touch = e.touches[0];
      handleSeek(touch);
    });
    
    document.addEventListener('touchmove', (e) => {
      if (isDragging) {
        e.preventDefault();
        
        // Cancel previous animation frame if any
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        // Use requestAnimationFrame for smooth updates
        const touch = e.touches[0];
        animationFrameId = requestAnimationFrame(() => {
          handleSeek(touch);
        });
      }
    }, { passive: false });
    
    document.addEventListener('touchend', endDrag);
  }
}

// Custom Audio Player Controls
function toggleAudio(audioId, button) {
  const audio = document.getElementById(audioId);
  const icon = button.querySelector('i');
  
  if (audio.paused) {
    // Pause any other playing audio
    document.querySelectorAll('.mantra-audio').forEach(a => {
      if (a.id !== audioId && !a.paused) {
        a.pause();
        const otherBtn = document.querySelector(`button[onclick*="${a.id}"]`);
        if (otherBtn) {
          otherBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
          otherBtn.classList.remove('playing');
        }
      }
    });
    
    audio.play();
    icon.classList.replace('fa-play', 'fa-pause');
    button.classList.add('playing');
  } else {
    audio.pause();
    icon.classList.replace('fa-pause', 'fa-play');
    button.classList.remove('playing');
  }
}

function pauseAllAppAudio() {
  document.querySelectorAll('.mantra-audio').forEach((audio) => {
    if (!audio.paused) {
      audio.pause();
    }
  });

  document.querySelectorAll('.play-btn').forEach((button) => {
    const icon = button.querySelector('i');
    if (icon && icon.classList.contains('fa-pause')) {
      icon.classList.replace('fa-pause', 'fa-play');
    }
    button.classList.remove('playing');
  });

  activeBellPlayers.forEach((player) => {
    try {
      player.pause();
      player.currentTime = 0;
    } catch (_) {}
  });
  activeBellPlayers.clear();
}

function setupNativeAppAudioLifecycle() {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform || !capacitor.isNativePlatform()) return;

  const appPlugin = capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;

  appPlugin.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) pauseAllAppAudio();
  });

  appPlugin.addListener('pause', () => {
    pauseAllAppAudio();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      pauseAllAppAudio();
    }
  });
}

function setupMobileMenuToggle() {
  const nav = document.querySelector("nav");
  const navCheck = document.getElementById("nav-check");
  const navIcon = document.querySelector(".nav-icon");
  const navLabel = navIcon?.querySelector("label");
  if (!nav || !navCheck || !navIcon || !navLabel) return;
  let lastToggleTs = 0;

  const logMenu = (message, meta = {}) => {
    const navLinks = document.querySelector(".nav-links");
    const computed = navLinks ? getComputedStyle(navLinks) : null;
    const payload = {
      checked: navCheck.checked,
      menuOpenClass: nav.classList.contains("menu-open"),
      navLinksVisible: computed?.visibility || "unknown",
      navLinksTransform: computed?.transform || "unknown",
      ...meta,
    };
    console.log(`[AGNIHOTRA][MENU] ${message} ${serializeForConsole(payload)}`);
  };

  const setMenuOpen = (open, source) => {
    window.__agnihotraMenuLastToggleAt = Date.now();
    navCheck.checked = open;
    nav.classList.toggle("menu-open", open);
    logMenu(open ? "open" : "close", { source });
  };

  const toggleMenu = (event, source) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const now = Date.now();
    if (now - lastToggleTs < 350) {
      logMenu("toggle-skipped-dedupe", { source });
      return;
    }
    lastToggleTs = now;
    const nextOpen = !nav.classList.contains("menu-open");
    const targetInfo =
      event?.target instanceof Element
        ? {
            targetTag: event.target.tagName,
            targetClass: event.target.className || "",
          }
        : {};
    logMenu("toggle-request", { source, ...targetInfo });
    setMenuOpen(nextOpen, source);
  };

  // Drive checkbox with one primary tap path to avoid double-toggle in Android WebView.
  navIcon.addEventListener("touchend", (event) => toggleMenu(event, "touchend"));
  navIcon.addEventListener("pointerup", (event) => toggleMenu(event, "pointerup"));
  navIcon.addEventListener("click", (event) => toggleMenu(event, "click-fallback"));
  navLabel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      toggleMenu(event, "keyboard");
    }
  });

  navCheck.addEventListener("change", () => {
    const isOpen = Boolean(navCheck.checked);
    nav.classList.toggle("menu-open", isOpen);
    logMenu("checkbox-change", { syncedOpen: isOpen });
  });
  logMenu("setup-complete");
}

function setupMobileMenuOutsideClose() {
  const nav = document.querySelector("nav");
  const navCheck = document.getElementById("nav-check");
  const navLinks = document.querySelector(".nav-links");
  const navIcon = document.querySelector(".nav-icon");
  if (!nav || !navCheck || !navLinks || !navIcon) return;

  const closeMenu = () => {
    window.__agnihotraMenuLastToggleAt = Date.now();
    navCheck.checked = false;
    nav.classList.remove("menu-open");
    console.log("[AGNIHOTRA][MENU]", "outside-close", {
      checked: navCheck.checked,
    });
  };

  document.addEventListener("click", (event) => {
    if (!navCheck.checked) return;
    const lastToggleAt = Number(window.__agnihotraMenuLastToggleAt || 0);
    if (Date.now() - lastToggleAt < 450) {
      console.log("[AGNIHOTRA][MENU]", "outside-close-skipped-recent-toggle");
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) return;
    const isInsideMenu = navLinks.contains(target) || navIcon.contains(target);
    if (!isInsideMenu) closeMenu();
  });

  navLinks.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("a,button")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navCheck.checked) {
      closeMenu();
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // Initialize audio players
  initAudioPlayer('sunrise-audio');
  initAudioPlayer('sunset-audio');
  initAudioPlayer('panchasheel-audio');
  initAudioPlayer('saptashloki-audio');
  initAudioPlayer('trisatya-audio');
  setupNativeAppAudioLifecycle();
  setupExportNotificationClickHandler();
  setupMobileMenuToggle();
  setupMobileMenuOutsideClose();
  setupScheduleExportControls();
  
  const fadeElements = document.querySelectorAll(".fade-in");

  function checkScroll() {
    fadeElements.forEach((element) => {
      const elementTop = element.getBoundingClientRect().top;

      if (elementTop < window.innerHeight - 50) {
        element.classList.add("active");
      }
    });
  }

  window.addEventListener("scroll", checkScroll);
  checkScroll();
});
