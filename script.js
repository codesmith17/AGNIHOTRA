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
 *    Calculated at solar-elevation angle -0.833° to account for atmospheric refraction and the sun's radius.
 *
 * 2. AGNIHOTRA SUNRISE: Occurs when the CENTER of the sun's disk is exactly on the mathematical horizon.
 *    Calculated at solar-elevation angle 0.0° with NO atmospheric refraction.
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
     * sunApparentDeclination: The Sun's angle relative to the Equator. Determines day length.
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

  // Hour Angle for solar-elevation angle = 0° (Mathematical Horizon):
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
const TIME_FORMAT_STORAGE_KEY = "agnihotra_time_format_v1";
const SUPPORT_LOG_STORAGE_KEY = "agnihotra_support_logs_v1";
const LAST_KNOWN_LOCATION_KEY = "agnihotra_last_known_location";
const SUPPORT_INSTALL_ID_KEY = "agnihotra_support_install_id_v1";
const SUPPORT_SESSION_ID_KEY = "agnihotra_support_session_id_v1";
const EXPORT_FILE_REGISTRY_KEY = "agnihotra_export_file_registry_v1";
const EXPORT_NOTIFICATION_CHANNEL_ID = "agnihotra-export-headsup-v5";
const EXPORT_NATIVE_DIRECTORY = "DATA";
const LOCATION_NAME_REFRESH_DISTANCE_KM = 3;
const REQUIRE_MANDATORY_LOCATION_PERMISSION = true;
const REQUIRE_MANDATORY_NOTIFICATION_PERMISSION = true;
const LOCATION_PERMISSION_MAX_RETRIES = 3;
const SUPPORT_LOG_MAX_ENTRIES = 1200;
const SUPPORT_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
let translations = {};
let latestTimingsForNativeReminders = null;
let latestExportLocationMeta = null;
let agnihotraMainInitStarted = false;
let currentTimeFormatPreference = "ampm";
let supportLogCaptureBound = false;
const supportLogEntries = [];
let supportLogPersistTimer = null;
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

function getStoredTimeFormatPreference() {
  const saved = String(localStorage.getItem(TIME_FORMAT_STORAGE_KEY) || "")
    .trim()
    .toLowerCase();
  return saved === "24h" ? "24h" : "ampm";
}

function ensureSupportInstallId() {
  try {
    const existing = localStorage.getItem(SUPPORT_INSTALL_ID_KEY);
    if (existing) return existing;
    const created =
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : `inst-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    localStorage.setItem(SUPPORT_INSTALL_ID_KEY, created);
    return created;
  } catch (_) {
    return `inst-ephemeral-${Date.now()}`;
  }
}

function createSupportSessionId() {
  return `sess-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function getSupportSessionId() {
  try {
    const existing = sessionStorage.getItem(SUPPORT_SESSION_ID_KEY);
    if (existing) return existing;
    const created = createSupportSessionId();
    sessionStorage.setItem(SUPPORT_SESSION_ID_KEY, created);
    return created;
  } catch (_) {
    return createSupportSessionId();
  }
}

function getTimingCacheDiagnostics() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { exists: false };
    const parsed = JSON.parse(raw);
    const timings = parsed?.timings && typeof parsed.timings === "object" ? parsed.timings : {};
    const todayKey = formatDateToDDMMYYYY(new Date());
    const totalDays = Object.keys(timings).length;
    const lastUpdated = Number(parsed?.lastUpdated || 0) || null;
    const ageMs = lastUpdated ? Math.max(0, Date.now() - lastUpdated) : null;
    return {
      exists: true,
      lat: Number(parsed?.lat) || null,
      lng: Number(parsed?.lng) || null,
      locationName: parsed?.locationName || null,
      totalDays,
      hasToday: Boolean(timings?.[todayKey]),
      lastUpdated,
      ageMs,
      expiresInMs: lastUpdated ? Math.max(0, CACHE_EXPIRY_MS - ageMs) : null,
    };
  } catch (error) {
    return {
      exists: true,
      parseError: error?.message || String(error),
    };
  }
}

let currentLanguage = getStoredLanguagePreference();
currentTimeFormatPreference = getStoredTimeFormatPreference();

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

let getLocationPermissionState = async () => "unknown";
let evaluateMandatoryPermissions = async () => true;
let bindPermissionGateActions = () => {};
let isPermissionGateVisible = () => false;
let setPermissionGateVisible = () => {};

const supportDiagnosticsContext = {
  getRuntimeBoolean,
  isNativeAppRuntime,
  isForcedOfflineModeEnabled,
  isEffectivelyOnline,
  getStoredLanguagePreference,
  ensureSupportInstallId,
  getSupportSessionId,
  getTimingCacheDiagnostics,
  getLastKnownLocation,
  getCurrentLanguage: () => currentLanguage,
  getLatestTimingsForNativeReminders: () => latestTimingsForNativeReminders,
  getUpcomingRefreshAt: () => Number(window.__agnihotraLastUpcomingRefreshAt || 0) || null,
  getActiveCountdownCount: () => Object.keys(window.activeCountdowns || {}).length,
  getPlayedAlertsCount: () => window.playedAlerts?.size || 0,
  getLocationPermissionState: () => getLocationPermissionState(),
  getNotificationPermissionStatus: async () =>
    (await window.AgnihotraNotifications?.getPermissionStatus?.()) || "unknown",
  serializeForConsole: (value) => {
    if (typeof serializeForConsole === "function") return serializeForConsole(value);
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  },
};

// Exposed so support-payload-builder.js (loaded on every page including
// settings.html / support.html) can read this app's live state without having
// to import script.js.
window.__agnihotraSupportCtx = supportDiagnosticsContext;

const supportRuntime = window.AgnihotraSupportRuntime?.create?.(supportDiagnosticsContext) || null;

const initSentryDiagnostics =
  supportRuntime?.initSentryDiagnostics?.bind(supportRuntime) || (() => {});
const captureDiagnosticBreadcrumb =
  supportRuntime?.captureDiagnosticBreadcrumb?.bind(supportRuntime) || (() => {});
const captureDiagnosticMessage =
  supportRuntime?.captureDiagnosticMessage?.bind(supportRuntime) || (() => {});
const captureDiagnosticException =
  supportRuntime?.captureDiagnosticException?.bind(supportRuntime) || (() => {});
const emitSupportSnapshot =
  supportRuntime?.emitSupportSnapshot?.bind(supportRuntime) || (() => {});
const reportBellDecision =
  supportRuntime?.reportBellDecision?.bind(supportRuntime) || (() => {});

window.AgnihotraDiagnostics = {
  captureBreadcrumb: captureDiagnosticBreadcrumb,
  captureMessage: captureDiagnosticMessage,
  captureException: captureDiagnosticException,
  emitSnapshot: emitSupportSnapshot,
};

window.captureAgnihotraSupportSnapshot = function(reason = "manual-console") {
  emitSupportSnapshot(reason, { triggeredFrom: "window.captureAgnihotraSupportSnapshot" });
};

supportRuntime?.wireGlobalErrorHandlers?.();

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

function pruneSupportLogsInMemory(nowMs = Date.now()) {
  const minTs = nowMs - SUPPORT_LOG_RETENTION_MS;
  const filtered = supportLogEntries.filter((entry) => {
    const ts = Date.parse(entry?.at || "");
    return Number.isFinite(ts) && ts >= minTs;
  });
  supportLogEntries.splice(0, supportLogEntries.length, ...filtered);
  if (supportLogEntries.length > SUPPORT_LOG_MAX_ENTRIES) {
    supportLogEntries.splice(0, supportLogEntries.length - SUPPORT_LOG_MAX_ENTRIES);
  }
}

function persistSupportLogsToStorageSoon() {
  if (supportLogPersistTimer) return;
  supportLogPersistTimer = setTimeout(() => {
    supportLogPersistTimer = null;
    try {
      pruneSupportLogsInMemory();
      localStorage.setItem(SUPPORT_LOG_STORAGE_KEY, JSON.stringify(supportLogEntries));
    } catch (_) {}
  }, 1200);
}

function hydrateSupportLogsFromStorage() {
  try {
    const raw = localStorage.getItem(SUPPORT_LOG_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    supportLogEntries.splice(0, supportLogEntries.length);
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      supportLogEntries.push({
        at: String(entry.at || new Date().toISOString()),
        level: String(entry.level || "log"),
        message: String(entry.message || ""),
      });
    });
    pruneSupportLogsInMemory();
    localStorage.setItem(SUPPORT_LOG_STORAGE_KEY, JSON.stringify(supportLogEntries));
  } catch (_) {}
}

function appendSupportLogEntry(level, args) {
  if (!Array.isArray(args) || args.length === 0) return;
  const message = args.map((arg) => serializeForConsole(arg)).join(" ").trim();
  if (!message) return;
  // Capture rules:
  //   - Always capture warnings and errors (these are critical signals for
  //     customer support; they include library errors, capacitor failures,
  //     network errors, geolocation errors, etc.)
  //   - Capture anything explicitly tagged with [AGNIHOTRA] regardless of
  //     level (our own structured diagnostic stream)
  //   - Skip other low-signal info/log spam to keep the log under the
  //     SUPPORT_LOG_MAX_ENTRIES cap.
  const isAgniTagged = message.includes("[AGNIHOTRA]");
  const isLoudLevel = level === "warn" || level === "error";
  if (!isAgniTagged && !isLoudLevel) return;
  supportLogEntries.push({
    at: new Date().toISOString(),
    level,
    message: message.length > 4000 ? `${message.slice(0, 4000)}...[truncated]` : message,
  });
  if (supportLogEntries.length > SUPPORT_LOG_MAX_ENTRIES) {
    supportLogEntries.splice(0, supportLogEntries.length - SUPPORT_LOG_MAX_ENTRIES);
  }
  pruneSupportLogsInMemory();
  persistSupportLogsToStorageSoon();
}

function setupSupportLogCapture() {
  if (supportLogCaptureBound) return;
  supportLogCaptureBound = true;
  hydrateSupportLogsFromStorage();
  ["log", "info", "warn", "error"].forEach((methodName) => {
    const original = console[methodName];
    if (typeof original !== "function") return;
    console[methodName] = (...args) => {
      original.apply(console, args);
      try {
        appendSupportLogEntry(methodName, args);
      } catch (_) {}
    };
  });
}

function debugLog(stage, payload = null) {
  if (!isDebugEnabled()) return;
  captureDiagnosticBreadcrumb("debug", stage, payload || {}, "debug");
  if (payload === null) {
    console.log(`[AGNIHOTRA][${stage}]`);
  } else {
    console.log(`[AGNIHOTRA][${stage}] ${serializeForConsole(payload)}`);
  }
}

function locationLog(stage, payload = null) {
  captureDiagnosticBreadcrumb("location", stage, payload || {}, "info");
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
  // Keep a rolling history (last ~50 entries) for the support report so we
  // can see GPS attempts, fallbacks, errors and timing-cache hits over time.
  window.AgnihotraInstrumentation?.recordLocation?.(stage, payload);
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
    window.AGNI_ENABLE_DEBUG_OVERLAY
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

async function continueAppInitialization() {
  if (agnihotraMainInitStarted) return;
  agnihotraMainInitStarted = true;
  window.AgnihotraNotifications?.setup();
  // Preload the native bell on app start so .playInstant() is gapless later.
  window.AgnihotraBell?.preload?.().catch((err) =>
    console.warn("[AGNIHOTRA][BELL] preload-init-failed", err?.message)
  );
  setupAndroidBackButton();
  getLocation();
  updateOnlineStatus();
  loadTranslations().then(() => {
    applyTranslations();
    refreshUpcomingEvents();
  });
}

/**
 * On Android, the hardware/gesture back button is intercepted by the WebView
 * and does nothing by default, leaving users stranded. This wires it so:
 *  - If there is browser history to go back to, go back.
 *  - Otherwise, minimise the app (bring to background) — never close/kill it.
 */
function setupAndroidBackButton() {
  if (!isNativeAppRuntime()) return;
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!appPlugin?.addListener) return;
  appPlugin.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      appPlugin.minimizeApp?.().catch(() => {});
    }
  });
  debugLog("[AGNIHOTRA][INIT] android-back-button-wired");
}

const permissionsGate = window.AgnihotraPermissionsGate?.create?.({
  locationPermissionMaxRetries: LOCATION_PERMISSION_MAX_RETRIES,
  requireMandatoryLocationPermission: REQUIRE_MANDATORY_LOCATION_PERMISSION,
  requireMandatoryNotificationPermission: REQUIRE_MANDATORY_NOTIFICATION_PERMISSION,
  captureDiagnosticBreadcrumb,
  captureDiagnosticMessage,
  captureDiagnosticException,
  emitSupportSnapshot,
  getCurrentPositionAsync,
  saveLastKnownLocation,
  locationLog,
  setLocationLoading,
  openNativeAppSettings,
  continueAppInitialization,
  requestNotificationPermission: (options) =>
    window.AgnihotraNotifications?.requestPermission?.(options),
  getNotificationPermissionStatus: () =>
    window.AgnihotraNotifications?.getPermissionStatus?.(),
  ensureNotificationPermissionBootstrap: () =>
    window.AgnihotraNotifications?.ensurePermissionBootstrap?.(),
});

if (permissionsGate) {
  getLocationPermissionState = permissionsGate.getLocationPermissionState;
  evaluateMandatoryPermissions = permissionsGate.evaluateMandatoryPermissions;
  bindPermissionGateActions = permissionsGate.bindPermissionGateActions;
  isPermissionGateVisible = permissionsGate.isPermissionGateVisible;
  setPermissionGateVisible = permissionsGate.setPermissionGateVisible;
}


window.enableAgnihotraDebug = function() {
  localStorage.setItem(DEBUG_STORAGE_KEY, "1");
  console.log("[AGNIHOTRA] Debug logging enabled.");
};

window.disableAgnihotraDebug = function() {
  localStorage.removeItem(DEBUG_STORAGE_KEY);
  console.log("[AGNIHOTRA] Debug logging disabled.");
};

function saveLastKnownLocation(lat, lng, locationName = null, locationDetail = null) {
  try {
    const existing = getLastKnownLocation();
    localStorage.setItem(
      LAST_KNOWN_LOCATION_KEY,
      JSON.stringify({
        lat,
        lng,
        locationName,
        locationDetail: locationDetail ?? existing?.locationDetail ?? null,
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

function getReminderNotificationCopy(eventName, minutes) {
  const titleTemplate = t(
    "notifications.reminderTitle",
    "{{event}} Agnihotra in {{minutes}} mins"
  );
  const bodyTemplate = t(
    "notifications.reminderBody",
    "Tap to open timings."
  );
  return {
    title: interpolateTemplate(titleTemplate, { event: eventName, minutes }),
    body: interpolateTemplate(bodyTemplate, { event: eventName, minutes }),
  };
}

function getTestReminderNotificationCopy(seconds = 30) {
  const titleTemplate = t("notifications.testTitle", "Test Agnihotra reminder");
  const bodyTemplate = t(
    "notifications.testBody",
    "Rings in {{seconds}} seconds."
  );
  return {
    title: interpolateTemplate(titleTemplate, { seconds }),
    body: interpolateTemplate(bodyTemplate, { seconds }),
  };
}

function getNowNotificationCopy(eventLabel) {
  const titleTemplate = t("notifications.nowTitle", "{{event}} Agnihotra now");
  const bodyTemplate = t(
    "notifications.nowBody",
    "Begin Agnihotra now."
  );
  return {
    title: interpolateTemplate(titleTemplate, { event: eventLabel }),
    body: interpolateTemplate(bodyTemplate, { event: eventLabel }),
  };
}

function buildNativeReminderEventsFromTimings(timings, daysAhead = 30) {
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
        t("timeLabels.sunrise", "Sunrise"),
        getPreAlertMinutes()
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
        t("timeLabels.sunset", "Sunset"),
        getPreAlertMinutes()
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
    30
  );
  captureDiagnosticBreadcrumb("notify", "native-reminder-build", {
    events: events.length,
    replaceExisting: options.replaceExisting !== false,
  });
  window.AgnihotraNotifications?.getPermissionStatus?.()
    .then((status) => {
      emitSupportSnapshot("native-reminder-build", {
        events: events.length,
        replaceExisting: options.replaceExisting !== false,
        leadMinutes: getPreAlertMinutes(),
        notificationPermission: status || "unknown",
      });
    })
    .catch(() => {
      emitSupportSnapshot("native-reminder-build", {
        events: events.length,
        replaceExisting: options.replaceExisting !== false,
        leadMinutes: getPreAlertMinutes(),
        notificationPermission: "unknown",
      });
    });
  if (events.length === 0) {
    reportBellDecision("notification-not-scheduled-no-events", {
      reason: "no-future-events-built",
      leadMinutes: getPreAlertMinutes(),
    }, "warning");
    return;
  }
  emitSupportSnapshot("native-reminder-schedule-request", {
    events: events.length,
    replaceExisting: options.replaceExisting !== false,
    leadMinutes: getPreAlertMinutes(),
  });
  window.AgnihotraNotifications?.scheduleUpcomingReminders(events, {
    leadMinutes: getPreAlertMinutes(),
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
  const mockReminderBtn = document.getElementById("mockReminderBtn");
  const leadMinutes = getPreAlertMinutes();

  if (button) {
    const seconds = getTestReminderSeconds();
    const buttonTemplate = t(
      "notifications.testButtonTemplate",
      "Test reminder in {{seconds}}s"
    );
    button.textContent = interpolateTemplate(buttonTemplate, { seconds });
  }

  if (mockReminderBtn) {
    mockReminderBtn.textContent = `Mock ${leadMinutes}m reminder`;
  }
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
  console.log(`[AGNIHOTRA][ALERT] test-reminder-schedule-result ${serializeForConsole({
    scheduled: Boolean(scheduled),
    isNative,
    delaySeconds: seconds,
  })}`);

  if (!scheduled) {
    reportBellDecision("test-reminder-schedule-failed", {
      isNative,
      delaySeconds: seconds,
      reason: "scheduleTestReminder-returned-false",
    }, "warning");
    clearTestReminderTimers();
    setTestReminderStatus("Unable to schedule test reminder.");
    return;
  }
  reportBellDecision("test-reminder-scheduled", {
    isNative,
    delaySeconds: seconds,
    mode: isNative ? "notification-channel-sound-only" : "web-notification-and-triple-bell",
  });

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
      console.log(`[AGNIHOTRA][ALERT] test-reminder-trigger-native ${serializeForConsole({
        mode: "notification-channel-sound-only",
      })}`);
      reportBellDecision("test-reminder-native-triggered", {
        delaySeconds: seconds,
        mode: "notification-channel-sound-only",
      });
      setTestReminderStatus("Test notification triggered.");
    } else {
      window.AgnihotraBell?.playTriple?.("test-reminder-web");
      console.log(`[AGNIHOTRA][ALERT] test-reminder-trigger-web ${serializeForConsole({
        mode: "native-audio-3x",
      })}`);
      reportBellDecision("test-reminder-web-triggered", {
        delaySeconds: seconds,
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
  const mockSunriseBtn = document.getElementById("mockSunriseBtn");
  const mockSunsetBtn = document.getElementById("mockSunsetBtn");
  const mockReminderBtn = document.getElementById("mockReminderBtn");
  if (!button && !mockSunriseBtn && !mockSunsetBtn && !mockReminderBtn) return;
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
  if (mockSunriseBtn) {
    mockSunriseBtn.addEventListener("click", () => {
      initAudio();
      runMockWindowOpenTest(10, true);
    });
  }
  if (mockSunsetBtn) {
    mockSunsetBtn.addEventListener("click", () => {
      initAudio();
      runMockWindowOpenTest(10, false);
    });
  }
  if (mockReminderBtn) {
    mockReminderBtn.addEventListener("click", () => {
      initAudio();
      runMockReminderTest(15);
    });
  }
}

let mockReminderIntervalId = null;

function runMockReminderTest(seconds = 15) {
  console.log(`[AGNIHOTRA][MOCK] trigger-clicked ${serializeForConsole({ seconds })}`);
  if (mockReminderIntervalId) {
    clearInterval(mockReminderIntervalId);
  }

  const safeSeconds = Math.max(1, Number(seconds) || 15);
  let secondsLeft = safeSeconds;
  const leadMinutes = getPreAlertMinutes();
  const requestedAt = Date.now();

  window.AgnihotraInstrumentation?.recordMockReminder?.({
    delaySeconds: safeSeconds,
    leadMinutes,
    requestedAt: new Date(requestedAt).toISOString(),
  });

  setTestReminderStatus(`Scheduling mock ${leadMinutes}m reminder in ${secondsLeft}s...`);

  window.AgnihotraNotifications?.scheduleTestReminder({
    delaySeconds: safeSeconds,
    title: `Mock ${leadMinutes}m Reminder`,
    body: `This is a test of the ${leadMinutes}-minute bell. It should ring once.`,
    tag: `mock-${leadMinutes}m-reminder`,
  }).then((success) => {
    console.info(
      `[AGNIHOTRA][MOCK] schedule-result ${serializeForConsole({
        success,
        delaySeconds: safeSeconds,
        leadMinutes,
        elapsedMs: Date.now() - requestedAt,
      })}`
    );
    if (success) {
      mockReminderIntervalId = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(mockReminderIntervalId);
          setTestReminderStatus("Mock reminder triggered!");
          console.info(`[AGNIHOTRA][MOCK] countdown-complete`);
        } else {
          setTestReminderStatus(`Mock reminder scheduled. Ringing in ${secondsLeft}s... You can close the app.`);
        }
      }, 1000);
    } else {
      setTestReminderStatus("Failed to schedule mock reminder. Check permissions.");
      console.warn("[AGNIHOTRA][MOCK] schedule-failed");
    }
  });
}

let mockCountdownIntervalId = null;
let mockCountdownTimeoutId = null;
let mockCountdownRestoreTimeoutId = null;

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
  if (mockCountdownRestoreTimeoutId) {
    clearTimeout(mockCountdownRestoreTimeoutId);
    mockCountdownRestoreTimeoutId = null;
  }
}

function runMockCountdownVisualPreview(seconds = 10, isSunrise = false) {
  const countdownElement = document.getElementById("upcomingCountdown");
  if (!countdownElement) return;
  const safeSeconds = Math.max(1, Number(seconds) || 10);
  countdownElement.innerHTML = "";
  window.activeCountdowns = {};
  window.countdownLabels = {};
  displayCountdownAndTime(
    countdownElement,
    "mockwindowmain",
    isSunrise ? "Sunrise Preview" : "Sunset Preview",
    Date.now() + safeSeconds * 1000,
    isSunrise,
    true
  );
  mockCountdownRestoreTimeoutId = setTimeout(() => {
    refreshUpcomingEvents();
    setMockCountdownStatus("");
    mockCountdownRestoreTimeoutId = null;
  }, (safeSeconds + 16) * 1000);
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

function runMockWindowOpenTest(seconds = 10, isSunrise = false) {
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

  console.log(`[AGNIHOTRA][MOCK] tap ${serializeForConsole({
    seconds: safeSeconds,
    runtime: isNativeAppRuntime() ? "native" : "web",
    visibility:
      typeof document !== "undefined" ? document.visibilityState : "n/a",
    audioCtxState: audioCtx?.state || "none",
    bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
  })}`);
  reportBellDecision("mock-window-start", {
    seconds: safeSeconds,
    runtime: isNativeAppRuntime() ? "native" : "web",
    visibility:
      typeof document !== "undefined" ? document.visibilityState : "n/a",
    bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
  });

  runMockCountdownVisualPreview(safeSeconds, isSunrise);

  setMockCountdownStatus(
    interpolateTemplate(template, { seconds: secondsLeft })
  );

  mockCountdownIntervalId = setInterval(() => {
    secondsLeft -= 1;
    console.log(`[AGNIHOTRA][MOCK] tick ${serializeForConsole({
      secondsLeft,
      elapsedMs: Date.now() - startedAt,
      visibility: document.visibilityState,
      bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
    })}`);
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
    console.log(`[AGNIHOTRA][MOCK] zero-mark-fire ${serializeForConsole({
      elapsedMs: Date.now() - startedAt,
      visibility: document.visibilityState,
      bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
      willRing: isForeground,
    })}`);
    if (isForeground) {
      const rung = ringSingleBellInstant("mock-zero-mark");
      reportBellDecision("mock-zero-mark-fire", {
        elapsedMs: Date.now() - startedAt,
        visibility: document.visibilityState,
        bellReady: window.AgnihotraBell?.isReady?.() ?? "n/a",
        willRing: true,
        ringCallReturned: rung,
      });
      setMockCountdownStatus("Mock window opened — single bell ting.");
    } else {
      // App is backgrounded/closed: never ring the single ting.
      setMockCountdownStatus("App not foreground — single ting skipped.");
      console.log(`[AGNIHOTRA][ALERT] mock-window-open-skip ${serializeForConsole({
        reason: "app-not-foreground",
      })}`);
      reportBellDecision("mock-zero-mark-skipped", {
        reason: "app-not-foreground",
        elapsedMs: Date.now() - startedAt,
        visibility: document.visibilityState,
      }, "warning");
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
  if (!cachedJSON) {
    emitSupportSnapshot("cache-miss", { reason: "no-cache" });
    return null;
  }

  try {
    const cache = JSON.parse(cachedJSON);
    const now = Date.now();

    // 1. Check if older than 6 months
    if (now - cache.lastUpdated > CACHE_EXPIRY_MS) {
      emitSupportSnapshot("cache-miss", {
        reason: "expired",
        cacheAgeMs: now - cache.lastUpdated,
      });
      return null;
    }

    // 2. Check if location changed significantly (more than 0.05 degree, roughly 5.5 km / 3.4 miles)
    // If the user moves more than ~5 km, the cache is invalidated and timings are refetched/recalculated
    const latDiff = Math.abs(cache.lat - lat);
    const lngDiff = Math.abs(cache.lng - lng);
    if (latDiff > 0.05 || lngDiff > 0.05) {
      emitSupportSnapshot("cache-miss", {
        reason: "location-shift",
        latDiff,
        lngDiff,
      });
      return null;
    }

    // 3. Check if we have data for today
    const todayStr = formatDateToDDMMYYYY(new Date());
    if (!cache.timings || !cache.timings[todayStr]) {
      emitSupportSnapshot("cache-miss", {
        reason: "today-not-present",
        today: todayStr,
        hasTimings: Boolean(cache.timings),
      });
      return null;
    }

    emitSupportSnapshot("cache-hit", {
      today: todayStr,
      locationName: cache.locationName || null,
    });
    return cache;
  } catch (e) {
    console.error("Error reading cache:", e);
    emitSupportSnapshot("cache-miss", {
      reason: "parse-error",
      error: e?.message || String(e),
    });
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
      console.error("[Timings] Engine returned null — polar region or bad coordinates?", { lat, lng });
      setLocationLoading(false);
      setScheduleLoading(false);
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
    setLocationLoading(false);
    setScheduleLoading(false);
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
  const normalized = String(timeStr).trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return normalized;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || "0");
  const meridiem = match[4] ? match[4].toUpperCase() : null;
  if (meridiem) {
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }

  if (currentTimeFormatPreference === "24h") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")} ${ampm}`;
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
  captureDiagnosticBreadcrumb("export", event, payload || {}, "info");
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
  toast.style.padding = "9px 13px";
  toast.style.borderRadius = "999px";
  toast.style.fontSize = "0.86rem";
  toast.style.fontWeight = "600";
  toast.style.color = isError ? "#7d1d1d" : "#3f2a14";
  toast.style.background = "rgba(255, 252, 246, 0.96)";
  toast.style.boxShadow = "0 8px 20px rgba(61, 35, 12, 0.16)";
  toast.style.border = `1px solid ${isError ? "rgba(164, 40, 40, 0.26)" : "rgba(184, 115, 51, 0.22)"}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2400);
}

function showInstantExportFeedback(message, isError = false) {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("opening") || normalized.includes("tap delay")) {
    return;
  }
  let toastMessage = String(message || "").replace(/^[✅❌]\s*/, "").trim();
  if (normalized.includes("pdf")) {
    toastMessage = isError ? "PDF failed" : "PDF saved";
  } else if (normalized.includes("ics")) {
    toastMessage = isError ? "ICS failed" : "ICS saved";
  } else if (isError) {
    toastMessage = "Export failed";
  } else if (normalized.includes("saved") || normalized.includes("ready")) {
    toastMessage = "Export saved";
  }
  showExportToast(toastMessage, isError);
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
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "en", Accept: "application/json" } }
    );
    if (nominatimResponse.ok) {
      const data = await nominatimResponse.json();
      const addr = data?.address || {};
      const place = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
      const state = addr.state || "";
      const resolved = [place, state].filter(Boolean).join(", ") || data.display_name || "";
      if (resolved && !isGenericExportLocationName(resolved)) {
        saveLastKnownLocation(lat, lng, resolved);
        return resolved;
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

function formatDateForDisplay(isoValue) {
  const parsed = parseDateInput(isoValue);
  if (!parsed) return "";
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = parsed.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function ensureScheduleDatePickerModal() {
  let modal = document.getElementById("agniCalendarModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "agniCalendarModal";
  modal.className = "agni-calendar-modal";
  modal.innerHTML = `
    <div class="agni-calendar-card" role="dialog" aria-modal="true" aria-label="Select date">
      <div class="agni-calendar-header">
        <button type="button" class="agni-calendar-nav" id="agniCalendarPrev" aria-label="Previous month">‹</button>
        <div class="agni-calendar-title" id="agniCalendarTitle"></div>
        <button type="button" class="agni-calendar-nav" id="agniCalendarNext" aria-label="Next month">›</button>
      </div>
      <div class="agni-calendar-weekdays">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>
      <div class="agni-calendar-grid" id="agniCalendarGrid"></div>
      <div class="agni-calendar-footer">
        <button type="button" class="agni-calendar-cancel" id="agniCalendarCancel">Cancel</button>
        <button type="button" class="agni-calendar-apply" id="agniCalendarApply">Apply</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function openThemedDatePicker({
  input,
  initialIso,
  minIso,
  maxIso,
  onApply,
}) {
  const modal = ensureScheduleDatePickerModal();
  const titleNode = document.getElementById("agniCalendarTitle");
  const gridNode = document.getElementById("agniCalendarGrid");
  const prevBtn = document.getElementById("agniCalendarPrev");
  const nextBtn = document.getElementById("agniCalendarNext");
  const cancelBtn = document.getElementById("agniCalendarCancel");
  const applyBtn = document.getElementById("agniCalendarApply");
  if (!titleNode || !gridNode || !prevBtn || !nextBtn || !cancelBtn || !applyBtn) return;

  const minDate = parseDateInput(minIso);
  const maxDate = parseDateInput(maxIso);
  const selected = parseDateInput(initialIso) || new Date();
  selected.setHours(0, 0, 0, 0);
  let workingSelected = new Date(selected);
  let monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);

  const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const inRange = (d) => {
    if (minDate && d < minDate) return false;
    if (maxDate && d > maxDate) return false;
    return true;
  };

  const render = () => {
    titleNode.textContent = monthCursor.toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    });
    gridNode.innerHTML = "";
    const firstWeekday = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      1
    ).getDay();
    const daysInMonth = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + 1,
      0
    ).getDate();

    for (let i = 0; i < firstWeekday; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "agni-calendar-day is-outside";
      cell.disabled = true;
      cell.textContent = "";
      gridNode.appendChild(cell);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
      d.setHours(0, 0, 0, 0);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "agni-calendar-day";
      btn.textContent = String(day);
      if (!inRange(d)) btn.disabled = true;
      if (d.getTime() === today.getTime()) btn.classList.add("is-today");
      if (d.getTime() === workingSelected.getTime()) btn.classList.add("is-selected");
      btn.addEventListener("click", () => {
        workingSelected = d;
        render();
      });
      gridNode.appendChild(btn);
    }
  };

  const close = () => {
    modal.classList.remove("is-open");
    prevBtn.removeEventListener("click", onPrev);
    nextBtn.removeEventListener("click", onNext);
    cancelBtn.removeEventListener("click", onCancel);
    applyBtn.removeEventListener("click", onApplyClick);
    modal.removeEventListener("click", onBackdrop);
    window.removeEventListener("keydown", onEscapeClose);
  };

  const onPrev = () => {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    render();
  };
  const onNext = () => {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    render();
  };
  const onCancel = () => close();
  const onApplyClick = () => {
    const iso = toIso(workingSelected);
    input.dataset.isoValue = iso;
    input.value = formatDateForDisplay(iso);
    onApply?.(iso);
    close();
  };
  const onBackdrop = (event) => {
    if (event.target === modal) close();
  };
  const onEscapeClose = (event) => {
    if (event.key === "Escape") close();
  };

  prevBtn.addEventListener("click", onPrev);
  nextBtn.addEventListener("click", onNext);
  cancelBtn.addEventListener("click", onCancel);
  applyBtn.addEventListener("click", onApplyClick);
  modal.addEventListener("click", onBackdrop);
  window.addEventListener("keydown", onEscapeClose);
  render();
  modal.classList.add("is-open");
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

function getExportCoordinateKey(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(5) : "unknown";
}

function getExportLocationKey(location) {
  const latKey = getExportCoordinateKey(location?.lat);
  const lngKey = getExportCoordinateKey(location?.lng);
  return `lat${latKey.replace(".", "_")}-lng${lngKey.replace(".", "_")}`;
}

function buildExportIdentity(kind, startValue, endValue, location) {
  const latKey = getExportCoordinateKey(location?.lat);
  const lngKey = getExportCoordinateKey(location?.lng);
  return {
    kind,
    startDate: startValue,
    endDate: endValue,
    latKey,
    lngKey,
    locationKey: getExportLocationKey(location),
    exportKey: `${kind}|${startValue}|${endValue}|${latKey}|${lngKey}`,
  };
}

function saveExportRegistryEntry(entry) {
  try {
    const raw = localStorage.getItem(EXPORT_FILE_REGISTRY_KEY);
    const registry = raw ? JSON.parse(raw) : {};
    const registryKey = entry.exportKey || entry.filename;
    registry[registryKey] = {
      filename: entry.filename,
      path: entry.path || null,
      directory: entry.directory || EXPORT_NATIVE_DIRECTORY,
      uri: entry.uri || null,
      mime: entry.mime || null,
      bytes: Number(entry.bytes) || 0,
      exportKey: entry.exportKey || null,
      kind: entry.kind || null,
      startDate: entry.startDate || null,
      endDate: entry.endDate || null,
      latKey: entry.latKey || null,
      lngKey: entry.lngKey || null,
      locationKey: entry.locationKey || null,
      savedAt: Date.now(),
    };
    localStorage.setItem(EXPORT_FILE_REGISTRY_KEY, JSON.stringify(registry));
  } catch (_) {}
}

function getExportRegistryEntry(filename, exportKey = null) {
  try {
    const raw = localStorage.getItem(EXPORT_FILE_REGISTRY_KEY);
    if (!raw) return null;
    const registry = JSON.parse(raw);
    if (exportKey && registry?.[exportKey]) return registry[exportKey];
    return registry?.[filename] || null;
  } catch (_) {
    return null;
  }
}

async function findExistingNativeExportEntry(exportKey) {
  if (!exportKey) return null;
  let entry = null;
  try {
    const raw = localStorage.getItem(EXPORT_FILE_REGISTRY_KEY);
    if (!raw) return null;
    const registry = JSON.parse(raw);
    entry = registry?.[exportKey] || null;
  } catch (_) {
    return null;
  }
  if (!entry || !entry.path) return null;
  if (!isNativeAppRuntime()) return entry;
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  if (!filesystem?.stat) return entry;
  try {
    await filesystem.stat({
      path: entry.path,
      directory: entry.directory || EXPORT_NATIVE_DIRECTORY,
    });
    exportLog("native-existing-export-found", {
      exportKey,
      path: entry.path,
      filename: entry.filename,
    });
    return entry;
  } catch (error) {
    exportLog("native-existing-export-missing-on-disk", {
      exportKey,
      path: entry.path,
      error: error?.message || String(error),
    });
    return null;
  }
}

async function deleteExistingNativeExport(exportKey) {
  if (!isNativeAppRuntime() || !exportKey) return;
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  if (!filesystem?.deleteFile) return;
  try {
    const raw = localStorage.getItem(EXPORT_FILE_REGISTRY_KEY);
    if (!raw) return;
    const registry = JSON.parse(raw);
    const entries = Object.entries(registry || {}).filter(
      ([, item]) => item?.exportKey === exportKey && item?.path
    );
    for (const [registryKey, entry] of entries) {
      try {
        await filesystem.deleteFile({
          path: entry.path,
          directory: entry.directory || EXPORT_NATIVE_DIRECTORY,
        });
        exportLog("native-existing-export-deleted", {
          exportKey,
          path: entry.path,
        });
      } catch (error) {
        exportLog("native-existing-export-delete-skipped", {
          exportKey,
          path: entry.path,
          error: error?.message || String(error),
        });
      }
      delete registry[registryKey];
    }
    localStorage.setItem(EXPORT_FILE_REGISTRY_KEY, JSON.stringify(registry));
  } catch (error) {
    exportLog("native-existing-export-delete-failed", {
      exportKey,
      error: error?.message || String(error),
    });
  }
}

async function saveFileInNativeStorage(blob, filename, mime, metadata = {}) {
  if (!isNativeAppRuntime()) return null;
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  if (!filesystem?.writeFile) {
    exportLog("native-save-skipped", { filename, reason: "filesystem-plugin-missing" });
    return null;
  }

  const path = `EternalAgniExports/${metadata.locationKey || "current-location"}/${filename}`;
  await deleteExistingNativeExport(metadata.exportKey);
  exportLog("native-save-start", {
    filename,
    path,
    bytes: blob.size,
    mime,
    exportKey: metadata.exportKey || null,
  });
  const base64Payload = await blobToBase64Payload(blob);
  await filesystem.writeFile({
    path,
    data: base64Payload,
    directory: EXPORT_NATIVE_DIRECTORY,
    recursive: true,
  });
  const uriResult = await filesystem.getUri({
    path,
    directory: EXPORT_NATIVE_DIRECTORY,
  });
  const saved = {
    filename,
    path,
    directory: EXPORT_NATIVE_DIRECTORY,
    uri: uriResult?.uri || null,
    mime,
    bytes: blob.size,
    ...metadata,
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
  const exportKey = extra?.exportKey || null;
  let fileUri = extra?.fileUri || extra?.uri || null;
  let filePath = extra?.filePath || extra?.path || null;
  let fileDirectory = extra?.fileDirectory || extra?.directory || EXPORT_NATIVE_DIRECTORY;
  const mime = extra?.mime || null;

  if (filename && (!fileUri || !filePath)) {
    const fromRegistry = getExportRegistryEntry(filename, exportKey);
    if (fromRegistry) {
      fileUri = fileUri || fromRegistry.uri;
      filePath = filePath || fromRegistry.path;
      fileDirectory = fromRegistry.directory || fileDirectory;
    }
  }

  if (!fileUri && filePath) {
    try {
      const filesystem = window.Capacitor?.Plugins?.Filesystem;
      if (filesystem?.getUri) {
        const uriResult = await filesystem.getUri({
          path: filePath,
          directory: fileDirectory,
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

  // Keep export notifications on a dedicated channel. The Capacitor plugin is
  // patched so that when this channel is created without an explicit `sound`,
  // it falls back to Android's default notification sound — required for
  // heads-up popups on Android 15 / ColorOS / MIUI.
  if (typeof localNotifications.createChannel === "function") {
    // Tear down older stale channels so they don't accumulate in the user's
    // notification settings. Channel settings are immutable after creation,
    // so we rev the channel id whenever its config changes.
    if (typeof localNotifications.deleteChannel === "function") {
      const staleChannelIds = [
        "agnihotra-export-headsup",
        "agnihotra-export-headsup-v1",
        "agnihotra-export-headsup-v2",
        "agnihotra-export-headsup-v3",
        "agnihotra-export-headsup-v4",
      ].filter((id) => id !== EXPORT_NOTIFICATION_CHANNEL_ID);
      for (const staleId of staleChannelIds) {
        try {
          await localNotifications.deleteChannel({ id: staleId });
        } catch (_) {}
      }
    }
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

  // Cancel any previously-posted export notification so Android does not
  // suppress this one due to Android 15 "notification cooldown" rate-limiting
  // applied to the same notification id.
  if (
    typeof window.__agnihotraLastExportNotificationId === "number" &&
    typeof localNotifications.cancel === "function"
  ) {
    const prevId = window.__agnihotraLastExportNotificationId;
    try {
      await localNotifications.cancel({
        notifications: [{ id: prevId }],
      });
      exportLog("export-ready-prev-cancelled", { prevId });
    } catch (error) {
      exportLog("export-ready-prev-cancel-failed", {
        prevId,
        error: error?.message || String(error),
      });
    }
  }

  const id = Math.floor(Date.now() % 1000000000);
  const sentAtMs = Date.now();
  const scheduledForMs = sentAtMs;
  const messageForUser =
    syncedMessage || `${savedFile.filename} saved. Tap to open.`;
  window.__agnihotraLastExportNotificationId = id;
  await localNotifications.schedule({
    notifications: [
      {
        id,
        title: "EternalAgni Export Ready",
        body: messageForUser,
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
          fileDirectory: savedFile.directory || EXPORT_NATIVE_DIRECTORY,
          exportKey: savedFile.exportKey || null,
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

async function tryShareOrDownload(blob, filename, mime, metadata = {}) {
  let nativeSaved = null;
  if (isNativeAppRuntime()) {
    try {
      nativeSaved = await saveFileInNativeStorage(blob, filename, mime, metadata);
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
  rangeLabel,
  metadata = {}
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
  const result = await tryShareOrDownload(blob, filename, "application/pdf", metadata);
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

  const minIso = formatDateInputValue(startOfCurrentYear);
  const maxIso = formatDateInputValue(oneYearFromNow);
  startDateInput.dataset.minIso = minIso;
  startDateInput.dataset.maxIso = maxIso;
  endDateInput.dataset.minIso = minIso;
  endDateInput.dataset.maxIso = maxIso;

  const firstDayCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startDefaultIso = formatDateInputValue(firstDayCurrentMonth);
  const endDefaultIso = formatDateInputValue(lastDayCurrentMonth);
  startDateInput.dataset.isoValue = startDefaultIso;
  endDateInput.dataset.isoValue = endDefaultIso;
  startDateInput.value = formatDateForDisplay(startDefaultIso);
  endDateInput.value = formatDateForDisplay(endDefaultIso);
  startDateInput.dataset.lastValidValue = startDefaultIso;
  endDateInput.dataset.lastValidValue = endDefaultIso;

  const restoreIfCleared = (input, fallbackValue) => {
    const iso = input.dataset.isoValue || "";
    if (iso) {
      input.dataset.lastValidValue = iso;
      return false;
    }
    const restored = input.dataset.lastValidValue || fallbackValue || "";
    input.dataset.isoValue = restored;
    input.value = formatDateForDisplay(restored);
    return true;
  };

  const handleStartSelection = () => {
    const wasCleared = restoreIfCleared(startDateInput, startDefaultIso);
    if (wasCleared) {
      setScheduleExportStatus("Start date cannot be cleared.", true);
    }
    endDateInput.dataset.minIso = startDateInput.dataset.isoValue || minIso;
    if (
      endDateInput.dataset.isoValue &&
      startDateInput.dataset.isoValue &&
      endDateInput.dataset.isoValue < startDateInput.dataset.isoValue
    ) {
      endDateInput.dataset.isoValue = startDateInput.dataset.isoValue;
      endDateInput.value = formatDateForDisplay(endDateInput.dataset.isoValue);
      endDateInput.dataset.lastValidValue = endDateInput.dataset.isoValue;
    }
  };

  const handleEndSelection = () => {
    const wasCleared = restoreIfCleared(endDateInput, endDefaultIso);
    if (wasCleared) {
      setScheduleExportStatus("End date cannot be cleared.", true);
    }
    if (endDateInput.dataset.isoValue < startDateInput.dataset.isoValue) {
      endDateInput.dataset.isoValue = startDateInput.dataset.isoValue;
      endDateInput.value = formatDateForDisplay(endDateInput.dataset.isoValue);
    }
    endDateInput.dataset.lastValidValue = endDateInput.dataset.isoValue;
  };

  startDateInput.addEventListener("click", () => {
    openThemedDatePicker({
      input: startDateInput,
      initialIso: startDateInput.dataset.isoValue || startDefaultIso,
      minIso: startDateInput.dataset.minIso || minIso,
      maxIso: startDateInput.dataset.maxIso || maxIso,
      onApply: (iso) => {
        startDateInput.dataset.isoValue = iso;
        handleStartSelection();
      },
    });
  });
  startDateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startDateInput.click();
    }
  });

  endDateInput.addEventListener("click", () => {
    openThemedDatePicker({
      input: endDateInput,
      initialIso: endDateInput.dataset.isoValue || endDefaultIso,
      minIso: endDateInput.dataset.minIso || startDateInput.dataset.isoValue || minIso,
      maxIso: endDateInput.dataset.maxIso || maxIso,
      onApply: (iso) => {
        endDateInput.dataset.isoValue = iso;
        handleEndSelection();
      },
    });
  });
  endDateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      endDateInput.click();
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
    const startValue = startDateInput.dataset.isoValue || "";
    const endValue = endDateInput.dataset.isoValue || "";
    if (!startValue || !endValue) {
      setScheduleExportStatus(
        t("schedule.export.selectRangeError", "Please select start and end dates."),
        true
      );
      return;
    }

    if (startValue < minIso) {
      setScheduleExportStatus(
        t(
          "schedule.export.startMinError",
          "Start date cannot be before January 1 of the current year."
        ),
        true
      );
      return;
    }

    if (endValue > maxIso) {
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
      const exportIdentity = buildExportIdentity(
        kind,
        startValue,
        endValue,
        built.exportLocation
      );

      // If a file with the same kind + date range + lat/lng already exists on
      // disk, skip regeneration and just re-fire the notification + toast.
      // Toast and notification fire together because there is no PDF/ICS
      // generation delay between them.
      const existingExport = await findExistingNativeExportEntry(
        exportIdentity.exportKey
      );
      if (existingExport && existingExport.filename) {
        const savedFile = {
          filename: existingExport.filename,
          path: existingExport.path,
          directory: existingExport.directory || EXPORT_NATIVE_DIRECTORY,
          uri: existingExport.uri,
          mime:
            existingExport.mime ||
            (kind === "ics" ? "text/calendar" : "application/pdf"),
          bytes: existingExport.bytes || 0,
          ...exportIdentity,
        };
        const reuseMessage = kind === "ics" ? "ICS saved" : "PDF saved";
        const notificationMeta = await notifyNativeExportReady(
          savedFile,
          `${savedFile.filename} saved. Tap to open.`
        );
        exportLog("export-reused-existing", {
          kind,
          exportKey: exportIdentity.exportKey,
          filename: savedFile.filename,
          notificationId: notificationMeta?.notificationId || null,
        });
        setScheduleExportStatus(reuseMessage);
        showInstantExportFeedback(reuseMessage);
        return;
      }

      if (kind === "ics") {
        const filename = `agnihotra-${safeRange}.ics`;
        const icsContent = buildIcsContent(built.rows, locationName);
        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const exportResult = await tryShareOrDownload(
          blob,
          filename,
          "text/calendar",
          exportIdentity
        );
        exportLog("ics-complete", {
          filename,
          mode: exportResult.mode,
          savedPath: exportResult.savedPath,
          savedUri: exportResult.savedUri,
          bytes: blob.size,
        });
        const successMessage =
          exportResult.mode === "native-saved"
              ? "ICS saved"
              : `ICS ready: ${filename}. Check your Downloads folder.`;
        if (exportResult?.notificationId) {
          setScheduleExportStatus(successMessage);
          showInstantExportFeedback(successMessage);
          exportLog("ui-feedback-synced-with-notification", {
            kind: "ics",
            notificationId: exportResult.notificationId,
            shownAtMs: Date.now(),
          });
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
          rangeLabel,
          exportIdentity
        );
        const pdfMessage =
          exportResult?.mode === "native-saved"
            ? "PDF saved"
            : `PDF ready: ${filename}. If not visible in app, check device Downloads/Files.`;
        if (exportResult?.notificationId) {
          setScheduleExportStatus(pdfMessage);
          showInstantExportFeedback(pdfMessage);
          exportLog("ui-feedback-synced-with-notification", {
            kind: "pdf",
            notificationId: exportResult.notificationId,
            shownAtMs: Date.now(),
          });
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
      showInstantExportFeedback("Export failed. Check logs and try again.", true);
    } finally {
      setExportButtonsBusy(false, kind);
    }
  };

  pdfBtn.addEventListener("click", () => runExport("pdf"));
  icsBtn.addEventListener("click", () => runExport("ics"));
}

function refreshVisibleTimingBlocks() {
  try {
    const cacheRaw = localStorage.getItem(CACHE_KEY);
    if (!cacheRaw) return;
    const cache = JSON.parse(cacheRaw);
    const timings = cache?.timings;
    if (!timings || typeof timings !== "object") return;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayKey = formatDateToDDMMYYYY(today);
    const tomorrowKey = formatDateToDDMMYYYY(tomorrow);
    const todayRow = timings[todayKey];
    const tomorrowRow = timings[tomorrowKey];
    if (todayRow?.sunrise && todayRow?.sunset) {
      displaySunriseSunset(
        {
          date: todayKey,
          sunrise: todayRow.sunrise,
          sunset: todayRow.sunset,
        },
        "todayTimes"
      );
    }
    if (tomorrowRow?.sunrise && tomorrowRow?.sunset) {
      displaySunriseSunset(
        {
          date: tomorrowKey,
          sunrise: tomorrowRow.sunrise,
          sunset: tomorrowRow.sunset,
        },
        "tomorrowTimes"
      );
    }
    displayFullSchedule(timings);
    if (todayRow && tomorrowRow) {
      displayUpcomingTimings(
        {
          date: todayKey,
          sunrise: todayRow.sunrise,
          sunset: todayRow.sunset,
        },
        {
          date: tomorrowKey,
          sunrise: tomorrowRow.sunrise,
          sunset: tomorrowRow.sunset,
        },
        "upcomingTimes"
      );
    } else {
      requestUpcomingEventsRefresh("settings-time-format-updated");
    }
  } catch (_) {
    requestUpcomingEventsRefresh("settings-time-format-updated-fallback");
  }
}

function setSupportLogExportStatus(message, isError = false) {
  const statusNode = document.getElementById("supportLogExportStatus");
  if (!statusNode) return;
  statusNode.textContent = message || "";
  statusNode.style.color = isError ? "#9c1d1d" : "#5d3414";
}

async function buildSupportLogExportPayload(reason = "manual") {
  pruneSupportLogsInMemory();

  // Prefer the unified comprehensive builder when available — it captures
  // every relevant slice of state (device / permissions / channels / pending
  // / location / timing / lifecycle / errors / logs). Fall back to the
  // legacy minimal shape if the module didn't load for some reason.
  if (window.AgnihotraSupportPayload?.build) {
    try {
      return await window.AgnihotraSupportPayload.build({
        logs: supportLogEntries.slice(-750),
        reason,
        ctx: supportDiagnosticsContext,
      });
    } catch (error) {
      console.warn("[AGNIHOTRA][SUPPORT] payload-builder-failed", error);
    }
  }

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    appRelease: window.AGNI_RUNTIME_CONFIG?.appRelease || "unknown",
    appEnvironment: window.AGNI_RUNTIME_CONFIG?.appEnvironment || "unknown",
    language: currentLanguage,
    timeFormat: currentTimeFormatPreference,
    installId: ensureSupportInstallId(),
    sessionId: getSupportSessionId(),
    locationMeta: window.__agnihotraLastLocationMeta || null,
    cacheDiagnostics: getTimingCacheDiagnostics(),
    logCount: supportLogEntries.length,
    logs: supportLogEntries.slice(-500),
  };
}

async function exportSupportLogsFromSettings() {
  const payload = await buildSupportLogExportPayload("export-from-settings");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `agnihotra-support-report-${stamp}.json`;
  const content = JSON.stringify(payload, null, 2);
  const mime = "application/json";
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });

  try {
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: "Agnihotra support report",
        text: "Support report for debugging reminder/timing issues.",
        files: [file],
      });
      setSupportLogExportStatus("Support report shared successfully.");
      captureDiagnosticBreadcrumb("support", "report-shared", { filename }, "info");
      return;
    }
  } catch (error) {
    captureDiagnosticException(error, "support-report-share-failed", { filename });
  }

  triggerDownload(blob, filename);
  setSupportLogExportStatus("Support report downloaded. Please share this file.");
  captureDiagnosticBreadcrumb("support", "report-downloaded", { filename }, "info");
}

function openSupportEmailDraft() {
  const subject = "Agnihotra App Support Report";
  const bodyLines = [
    "Hello Support Team,",
    "",
    "I am facing an issue in the Agnihotra app.",
    "",
    "Issue summary:",
    "-",
    "",
    "Steps to reproduce:",
    "1)",
    "2)",
    "",
    "Please find attached:",
    "- support report file",
    "- screenshot (if available)",
    "",
    "Device details:",
    `- App release: ${window.AGNI_RUNTIME_CONFIG?.appRelease || "unknown"}`,
    `- Language: ${currentLanguage}`,
    `- Time format: ${currentTimeFormatPreference}`,
    "",
    "Thank you.",
  ];
  const mailto = `mailto:kanchanlatakrishna@gmail.com?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
  window.location.href = mailto;
}

function setupSettingsPanel() {
  const formatButtons = Array.from(document.querySelectorAll("[data-time-format]"));
  const exportBtn = document.getElementById("exportSupportLogsBtn");
  const emailBtn = document.getElementById("emailSupportBtn");
  if (!formatButtons.length || !exportBtn || !emailBtn) return;

  const syncTimeFormatUi = () => {
    formatButtons.forEach((button) => {
      const selected = button.getAttribute("data-time-format") === currentTimeFormatPreference;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  };

  syncTimeFormatUi();

  formatButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextFormat = button.getAttribute("data-time-format");
      if (nextFormat !== "ampm" && nextFormat !== "24h") return;
      currentTimeFormatPreference = nextFormat;
      localStorage.setItem(TIME_FORMAT_STORAGE_KEY, nextFormat);
      syncTimeFormatUi();
      refreshVisibleTimingBlocks();
      captureDiagnosticBreadcrumb("settings", "time-format-updated", { nextFormat }, "info");
    });
  });

  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    setSupportLogExportStatus("Preparing support report...");
    try {
      await exportSupportLogsFromSettings();
    } catch (error) {
      setSupportLogExportStatus("Unable to create support report. Try again.", true);
      captureDiagnosticException(error, "support-report-export-failed");
    } finally {
      exportBtn.disabled = false;
    }
  });

  emailBtn.addEventListener("click", () => {
    openSupportEmailDraft();
    setSupportLogExportStatus("Email draft opened. Attach report/screenshot and send.");
  });
}

function buildUpcomingEvents(todayResults, tomorrowResults, currentTime = Date.now()) {
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

  return upcomingEvents;
}

function displayUpcomingTimings(todayResults, tomorrowResults, elementId) {
  const element = document.getElementById(elementId);
  const countdownElement = document.getElementById("upcomingCountdown");
  const upcomingEvents = buildUpcomingEvents(todayResults, tomorrowResults);

  // Clear previous content and countdowns
  element.innerHTML = "";
  if (countdownElement) countdownElement.innerHTML = "";
  window.activeCountdowns = {}; // Clear all active countdowns
  window.countdownLabels = {};

  const nextEvent = upcomingEvents[0];
  if (nextEvent && countdownElement) {
    displayCountdownAndTime(
      countdownElement,
      `${nextEvent.id}main`,
      nextEvent.label,
      nextEvent.time,
      nextEvent.isSunrise,
      true
    );
  }

  // Display upcoming timings only — no countdown inside these two boxes
  upcomingEvents.forEach((eventItem) => {
    displayUpcomingTimeOnly(
      element,
      eventItem.label,
      eventItem.time,
      eventItem.isSunrise,
      false
    );
  });

  if (nextEvent) {
    syncNativeHomescreenWidget(nextEvent);
  }

}

function refreshUpcomingTimeOnlyCardsFromCache(reason = "time-window-open") {
  try {
    const element = document.getElementById("upcomingTimes");
    if (!element) return false;
    const cacheRaw = localStorage.getItem(CACHE_KEY);
    if (!cacheRaw) return false;
    const cache = JSON.parse(cacheRaw);
    const timings = cache?.timings;
    if (!timings || typeof timings !== "object") return false;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayKey = formatDateToDDMMYYYY(today);
    const tomorrowKey = formatDateToDDMMYYYY(tomorrow);
    const todayRow = timings[todayKey];
    const tomorrowRow = timings[tomorrowKey];
    if (!todayRow?.sunrise || !todayRow?.sunset || !tomorrowRow?.sunrise || !tomorrowRow?.sunset) {
      return false;
    }
    const upcomingEvents = buildUpcomingEvents(
      {
        date: todayKey,
        sunrise: todayRow.sunrise,
        sunset: todayRow.sunset,
      },
      {
        date: tomorrowKey,
        sunrise: tomorrowRow.sunrise,
        sunset: tomorrowRow.sunset,
      },
      Date.now()
    );
    element.innerHTML = "";
    upcomingEvents.forEach((eventItem) => {
      displayUpcomingTimeOnly(
        element,
        eventItem.label,
        eventItem.time,
        eventItem.isSunrise,
        false
      );
    });
    if (upcomingEvents[0]) syncNativeHomescreenWidget(upcomingEvents[0]);
    debugLog("upcoming-time-only:refreshed", { reason });
    return true;
  } catch (error) {
    debugLog("upcoming-time-only:error", {
      reason,
      error: error?.message || String(error),
    });
    return false;
  }
}

function displayUpcomingTimeOnly(element, label, time, isSunrise, isNext = false) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "time-item time-item--simple" + (isNext ? " is-upcoming" : "");

  const iconClass = isSunrise ? "fas fa-sun" : "fas fa-moon";
  const iconColor = isSunrise ? "#FFD700" : "#4B0082";
  itemDiv.innerHTML = `
        <span class="time-label"><i class="${iconClass}" style="color: ${iconColor};"></i> ${label.toUpperCase()}</span>
        <span class="time-value">${formatDateTimeToTimeOnly(time)}</span>
    `;

  element.appendChild(itemDiv);
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
    // DD.MM.YYYY format (our engine output)
    [day, month, year] = dateStr.split(".").map(Number);
  } else if (dateStr.includes("-")) {
    // YYYY-MM-DD format (ISO)
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
window.refreshedUpcomingTimeOnlyTargets = window.refreshedUpcomingTimeOnlyTargets || new Set();

function getPreAlertMinutes() {
  try {
    const saved = localStorage.getItem("agnihotra_reminder_lead_v1");
    if (saved === null) return 15;
    const val = parseInt(saved, 10);
    if (isNaN(val)) return 15;
    return Math.max(2, Math.min(60, val));
  } catch (_) {
    return 15;
  }
}

const ALERT_WINDOW_MS = 10000; // Trigger if app checks within 10s of target
const ENABLE_NATIVE_ZERO_WINDOW_TING = true;

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

function displayCountdownAndTime(element, id, label, time, isSunrise, isNext = false) {
  const itemDiv = document.createElement("div");
  itemDiv.className = `time-item ${isSunrise ? "time-item--sunrise" : "time-item--sunset"}` + (isNext ? " is-upcoming" : "");

  const uniqueId = id;
  const iconClass = isSunrise ? "fas fa-sun" : "fas fa-moon";
  const iconColor = isSunrise ? "#FFD700" : "#4B0082";
  const atTemplate = t("countdown.atTime", "at {{time}}");
  const atText = interpolateTemplate(atTemplate, {
    time: formatDateTimeToTimeOnly(time),
  });

  itemDiv.innerHTML = `
        <span class="fire-countdown-bg" aria-hidden="true"></span>
        <span class="time-label"><i class="${iconClass}" style="color: ${iconColor};"></i> ${label.toUpperCase()}</span>
        <span id="${uniqueId}Countdown" class="countdown-value"><span class="cd-h">--</span>h <span class="cd-m">--</span>m <span class="cd-s">--</span>s</span>
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
  if (currentTimeFormatPreference === "24h") {
    return `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`;
  }
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}

function setCountdownFireState(countdownElement, isActive) {
  const card = countdownElement?.closest?.(".time-item");
  if (!card) return;
  card.classList.toggle("is-fire-window", Boolean(isActive));
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
  const preAlertTime = targetTime - getPreAlertMinutes() * 60 * 1000;
  const nativeRuntime = isNativeAppRuntime();

  const countdownElement = document.getElementById(`${type}Countdown`);

  if (!countdownElement) {
    return; // Element doesn't exist, skip update
  }

  const preAlertKey = `${type}_${targetTime}_pre${getPreAlertMinutes()}`;
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
            getPreAlertMinutes()
          );
      window.AgnihotraNotifications?.show(
            reminderCopy.title,
            reminderCopy.body,
        preAlertKey
      );
          window.AgnihotraBell?.playTriple?.("pre-alert-web");
          captureDiagnosticMessage("pre-alert-web-fired", "info", {
            tag: preAlertKey,
            eventLabel,
            reminderMinutes: getPreAlertMinutes(),
          });
          reportBellDecision("pre-alert-web-rang", {
            tag: preAlertKey,
            eventLabel,
            runtime: "web",
            reminderMinutes: getPreAlertMinutes(),
            preAlertDelta,
          });
          console.log("[AGNIHOTRA][ALERT] pre-alert-web", {
            tag: preAlertKey,
            mode: "native-audio-3x",
          });
        } else {
          reportBellDecision("pre-alert-web-skipped-background", {
            tag: preAlertKey,
            eventLabel,
            runtime: "web",
            reason: "document-not-visible",
            preAlertDelta,
          }, "warning");
        }
      } else {
        captureDiagnosticMessage("pre-alert-native-window-hit", "info", {
          tag: preAlertKey,
          eventLabel,
          reminderMinutes: getPreAlertMinutes(),
        });
        reportBellDecision("pre-alert-native-expected-os-notification", {
          tag: preAlertKey,
          eventLabel,
          runtime: "native",
          reason: "bell-comes-from-notification-channel",
          preAlertDelta,
        });
        console.log("[AGNIHOTRA][ALERT] pre-alert-native", {
          tag: preAlertKey,
          mode: "scheduled-notification-channel-sound-only",
        });
      }
      window.playedAlerts.add(preAlertKey);
    } else if (preAlertDelta > ALERT_WINDOW_MS) {
      reportBellDecision("pre-alert-window-missed", {
        tag: preAlertKey,
        eventLabel,
        preAlertDelta,
        alertWindowMs: ALERT_WINDOW_MS,
        reason: "app-checked-after-window",
      }, "warning");
      window.playedAlerts.add(preAlertKey);
    }
  }

  if (!window.playedAlerts.has(mainAlertKey)) {
    const mainAlertDelta = currentTime - targetTime;
    if (mainAlertDelta >= 0 && mainAlertDelta <= ALERT_WINDOW_MS) {
      if (nativeRuntime && !ENABLE_NATIVE_ZERO_WINDOW_TING) {
        reportBellDecision("zero-window-native-ting-disabled", {
          tag: mainAlertKey,
          runtime: "native",
          reason: "only-pre-alert-enabled",
          mainAlertDelta,
        });
        window.playedAlerts.add(mainAlertKey);
        return;
      }
      // Single bell "ting" the moment the agnihotra window opens.
      // Foreground-only: never raise an OS notification here, never play
      // when the app is closed/backgrounded.
      const isForeground =
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      if (isForeground) {
        ringSingleBellInstant("window-open");
        captureDiagnosticMessage("window-open-ting", "info", {
          tag: mainAlertKey,
          runtime: nativeRuntime ? "native-foreground" : "web-foreground",
        });
        reportBellDecision("zero-window-ting-fired", {
          tag: mainAlertKey,
          runtime: nativeRuntime ? "native-foreground" : "web-foreground",
          mainAlertDelta,
          alertWindowMs: ALERT_WINDOW_MS,
        });
        console.log("[AGNIHOTRA][ALERT] window-open-ting", {
          tag: mainAlertKey,
          runtime: nativeRuntime ? "native-foreground" : "web-foreground",
          mode: "single-bell-ting",
        });
      } else {
        captureDiagnosticBreadcrumb("alert", "window-open-skip", {
          tag: mainAlertKey,
          reason: "app-not-foreground",
        });
        reportBellDecision("zero-window-ting-skipped", {
          tag: mainAlertKey,
          runtime: nativeRuntime ? "native-background" : "web-background",
          reason: "app-not-foreground",
          mainAlertDelta,
        }, "warning");
        console.log("[AGNIHOTRA][ALERT] window-open-skip", {
          tag: mainAlertKey,
          reason: "app-not-foreground",
        });
      }
      window.playedAlerts.add(mainAlertKey);
    } else if (mainAlertDelta > ALERT_WINDOW_MS) {
      reportBellDecision("zero-window-missed", {
        tag: mainAlertKey,
        runtime: nativeRuntime ? "native" : "web",
        mainAlertDelta,
        alertWindowMs: ALERT_WINDOW_MS,
        reason: "app-checked-after-window",
      }, "warning");
      window.playedAlerts.add(mainAlertKey);
    }
  }

  const JUST_PASSED_GRACE_MS = 15000; // show "Agnihotra moment complete" for 15s, in sync with the 15s fire animation

  if (timeDiff > 0) {
    setCountdownFireState(countdownElement, false);
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    // Update individual fixed-width spans to avoid layout shifts
    const hSpan = countdownElement.querySelector(".cd-h");
    const mSpan = countdownElement.querySelector(".cd-m");
    const sSpan = countdownElement.querySelector(".cd-s");
    if (hSpan && mSpan && sSpan) {
      const hVal = days > 0 ? `${days}d ${String(hours).padStart(2,"0")}` : String(hours).padStart(2,"0");
      hSpan.textContent = hVal;
      mSpan.textContent = String(minutes).padStart(2,"0");
      sSpan.textContent = String(seconds).padStart(2,"0");
    } else {
      // Fallback if spans aren't present (older renders)
      countdownElement.textContent = days > 0
        ? `${days}d ${String(hours).padStart(2,"0")}h ${String(minutes).padStart(2,"0")}m ${String(seconds).padStart(2,"0")}s`
        : `${String(hours).padStart(2,"0")}h ${String(minutes).padStart(2,"0")}m ${String(seconds).padStart(2,"0")}s`;
    }
  } else if (timeDiff > -JUST_PASSED_GRACE_MS) {
    const refreshKey = `${type}:${targetTime}`;
    if (!String(type).includes("mockwindow") && !window.refreshedUpcomingTimeOnlyTargets.has(refreshKey)) {
      window.refreshedUpcomingTimeOnlyTargets.add(refreshKey);
      refreshUpcomingTimeOnlyCardsFromCache("main-countdown-zero");
    }
    // Show a polished completion state for 15 seconds after the event
    setCountdownFireState(countdownElement, true);
    countdownElement.innerHTML = `<span class="cd-passed">${t("countdown.justPassed", "Agnihotra moment complete")}</span>`;
  } else {
    setCountdownFireState(countdownElement, false);
    // 7-second grace expired — rotate to the next upcoming slots
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

function escapeLocationHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uniqueLocationParts(parts) {
  const seen = new Set();
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderLocationCard({ label = "", primary = "", secondary = "" } = {}) {
  const userLocationNode = document.getElementById("userLocation");
  if (!userLocationNode) return;
  const detailParts = String(secondary || "")
    .split(" • ")
    .map((part) => part.trim())
    .filter(Boolean);
  userLocationNode.innerHTML = `
    <span class="location-card-label">${escapeLocationHtml(label)}</span>
    <span class="location-card-primary">${escapeLocationHtml(primary)}</span>
    ${
      detailParts.length
        ? `<span class="location-card-details">${escapeLocationHtml(detailParts.join(" • "))}</span>`
        : ""
    }
  `;
}

function buildDetailedAddress(data, latitude, longitude) {
  const addr = data?.address || {};
  const namedPlace = data?.namedetails?.name || data?.name || "";
  const buildingLine = uniqueLocationParts([
    namedPlace,
    addr.building,
    addr.apartments,
    addr.residential,
    addr.amenity,
    addr.shop,
    addr.office,
    addr.tourism,
    addr.leisure,
  ])[0] || "";
  const roadLine = uniqueLocationParts([
    addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : "",
    !addr.house_number ? addr.road : "",
    addr.pedestrian,
    addr.footway,
    addr.path,
  ])[0] || "";
  const locality = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_block || addr.hamlet || "";
  const city = addr.city || addr.town || addr.village || addr.municipality || "";
  const district = addr.city_district || addr.state_district || addr.county || "";
  const state = addr.state || "";
  const postcode = addr.postcode ? `PIN ${addr.postcode}` : "";
  const country = addr.country || "";
  const coordinates = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;

  const primaryParts = uniqueLocationParts([buildingLine, locality, city, district, state]);
  const primary = primaryParts.slice(0, 3).join(", ") || uniqueLocationParts([city, district, state]).join(", ");
  const detail = uniqueLocationParts([
    buildingLine,
    roadLine,
    addr.residential,
    addr.neighbourhood,
    addr.suburb,
    addr.quarter,
    addr.city_block,
    addr.hamlet,
    locality,
    city,
    addr.municipality,
    district,
    state,
    postcode,
    country,
    coordinates,
  ]).join(" • ");

  return {
    primary: primary || "GPS location detected",
    detail,
  };
}

async function getLocation() {
  const startedAt = performance.now();
  debugLog("location:start");
  locationLog("request-start");

  // ── STEP 1: Show cached data IMMEDIATELY — no spinner if we have a cached location ──
  const lastKnown = getLastKnownLocation();
  if (lastKnown?.lat && lastKnown?.lng) {
    const cachedName = lastKnown.locationName || null;
    const cachedDetail = lastKnown.locationDetail || null;
    if (cachedName) {
      renderLocationCard({
        label: "Detected Address:",
        primary: cachedName,
        secondary: cachedDetail,
      });
    } else {
      document.getElementById("userLocation").innerText = "Detecting nearby place...";
    }
    // Hide spinner immediately — GPS verify runs silently in background
    setLocationLoading(false);
    debugLog("location:cache-bootstrap", { lat: lastKnown.lat, lng: lastKnown.lng, cachedName });
    locationLog("cache-bootstrap", { lat: lastKnown.lat, lng: lastKnown.lng, hasName: Boolean(cachedName) });
    getSunriseSunset(lastKnown.lat, lastKnown.lng, cachedName);
  } else {
    // No cache at all — show spinner so user knows we're working
    setLocationLoading(true);
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

        // ── STEP 2: 3 km distance check vs cached position ─────────────────
        // If user has barely moved, keep showing the cached name and timings (no re-geocode).
        // Only spend network + time on a full refresh when they have meaningfully moved.
        const distFromCache = lastKnown?.lat
          ? haversineDistanceKm(latitude, longitude, lastKnown.lat, lastKnown.lng)
          : Infinity;
        const locationChanged = distFromCache > LOCATION_NAME_REFRESH_DISTANCE_KM;

        debugLog("location:distance-check", {
          distKm: Number(distFromCache.toFixed(3)),
          locationChanged,
          threshold: LOCATION_NAME_REFRESH_DISTANCE_KM
        });
        locationLog("distance-check", {
          distKm: Number(distFromCache.toFixed(3)),
          locationChanged
        });

        if (!locationChanged && lastKnown?.locationName) {
          // Still at same place — just silently update coords in storage,
          // keep showing the cached name and timings (already on screen from Step 1).
          saveLastKnownLocation(latitude, longitude, lastKnown.locationName, lastKnown.locationDetail || null);
          setLocationLoading(false);
          debugLog("location:same-place-cache-kept", { distKm: distFromCache.toFixed(3) });
          return;
        }

        // ── STEP 3: Location changed > 3 km — full refresh ────────────────
        saveLastKnownLocation(latitude, longitude, null);
        // Recalculate timings with new coords while geocoding runs in parallel
        const timingsPromise = getSunriseSunset(latitude, longitude, null);
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

        // GPS timed out or unavailable — attempt one precise retry before IP fallback
        if (error?.code !== 1) {
          const recovered = await tryImmediatePreciseLocationRecovery();
          if (recovered) {
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

        // If we already showed cached data in Step 1, GPS error is silent — no IP fallback needed
        if (lastKnown?.lat) {
          setLocationLoading(false);
          debugLog("location:gps-error-cache-kept", { code: error?.code });
          return;
        }

        locationLog("gps-fallback-started", { reason: `gps-error-${error?.code || "unknown"}` });
        await getApproximateLocation();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000   // Accept a GPS fix up to 1 min old — fast on Android
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
  const toCoordinateFallback = () => "GPS location detected";
  const startedAt = performance.now();
  debugLog("reverse-geocode:start", { skipTimingFetch });

  // ── Nominatim reverse geocoding (OpenStreetMap) ───────────────────────────
  // On any failure (network error, 4xx, 5xx, timeout) fall back to plain coordinates.
  let resolvedName = null;
  let resolvedDetail = null;
  try {
    if (navigator.onLine) {
      const resp = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        { headers: { "Accept-Language": "en", "Accept": "application/json" } },
        9000
      );
      if (resp.ok) {
        const data = await resp.json();
        const detailedAddress = buildDetailedAddress(data, latitude, longitude);
        resolvedName = detailedAddress.primary;
        resolvedDetail = detailedAddress.detail;
        if (resolvedName) {
          locationLog("source-gps+nominatim", { elapsedMs: Math.round(performance.now() - startedAt) });
        }
      }
    }
  } catch (_) {}

  if (resolvedName) {
    renderLocationCard({ label: "Detected Address:", primary: resolvedName, secondary: resolvedDetail });
    saveLastKnownLocation(latitude, longitude, resolvedName, resolvedDetail);
    if (!skipTimingFetch) await getSunriseSunset(latitude, longitude, resolvedName);
    debugLog("reverse-geocode:success", { name: resolvedName, elapsedMs: Math.round(performance.now() - startedAt) });
      } else {
    // Nominatim absent / error — show plain coordinates, timings still work
    const coordDetail = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
    const coords = toCoordinateFallback();
    renderLocationCard({ label: "Your Location:", primary: coords, secondary: coordDetail });
    saveLastKnownLocation(latitude, longitude, coords, coordDetail);
    if (!skipTimingFetch) await getSunriseSunset(latitude, longitude, coords);
    debugLog("reverse-geocode:coord-fallback", { elapsedMs: Math.round(performance.now() - startedAt) });
    locationLog("source-gps-coordinates-fallback", {});
  }

  setLocationLoading(false);
}

async function reverseGeocodeApproximate(latitude, longitude, skipTimingFetch = false) {
  // IP-based path: reuse Nominatim for the name lookup, same rules as GPS path.
  await reverseGeocode(latitude, longitude, skipTimingFetch);
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
  initSentryDiagnostics();
  setupSupportLogCapture();
  emitSupportSnapshot("app-onload", {
    testReminderEnabled: isTestReminderEnabled(),
    debugOverlayEnabled: getRuntimeBoolean(
      window.AGNI_RUNTIME_CONFIG?.enableDebugOverlay,
      window.AGNI_ENABLE_DEBUG_OVERLAY
    ),
  });
  // Boot fingerprint: persists in support log so customer reports tell us
  // when the app session started + which build it was running.
  console.info(
    `[AGNIHOTRA][BOOT] app-onload ${serializeForConsole({
      release: String(window.AGNI_RUNTIME_CONFIG?.appRelease || "dev"),
      environment: String(window.AGNI_RUNTIME_CONFIG?.appEnvironment || "production"),
      runtime: isNativeAppRuntime() ? "native" : "web",
      platform: window.Capacitor?.getPlatform?.() || "web",
      sessionId: getSupportSessionId(),
      installId: ensureSupportInstallId(),
      online: navigator.onLine,
      forceOffline: isForcedOfflineModeEnabled(),
      testReminderEnabled: isTestReminderEnabled(),
      language: currentLanguage,
      timeFormat: currentTimeFormatPreference,
      timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || null,
      userAgent: navigator.userAgent,
    })}`
  );
  debugLog("app:onload");
  setupForcedOfflineMode();
  // Only show location spinner on startup if there's no cached location — otherwise
  // getLocation() will show cached data instantly and hide the spinner itself.
  const _startupCache = getLastKnownLocation();
  if (!_startupCache?.lat) setLocationLoading(true);
  setupLanguageToggle();
  setupSettingsPanel();
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

const appAudioControls = window.AgnihotraAudioControls?.create?.() || null;

function initAudioPlayer(audioId) {
  appAudioControls?.initAudioPlayer?.(audioId);
}

function toggleAudio(audioId, button) {
  appAudioControls?.toggleAudio?.(audioId, button);
}

window.toggleAudio = toggleAudio;

function setupNativeAppAudioLifecycle() {
  appAudioControls?.setupNativeAppAudioLifecycle?.();
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
