/**
 * Comprehensive support payload builder.
 *
 * Collects every relevant piece of runtime state so a customer-shared support
 * report tells the operator EXACTLY what was happening on the device — app
 * version, OS/manufacturer, permissions (notifications/location/exact alarm),
 * notification channels, pending alarms, location history, timing cache,
 * audio/bell state, network/online state, app lifecycle history, recent
 * errors, and the captured console logs.
 *
 * Used by:
 *   - script.js  -> buildSupportLogExportPayload()
 *   - shared/settings/settings-page.js -> buildPayload()
 *
 * Available as: window.AgnihotraSupportPayload.build({ logs, reason })
 */
(() => {
  const SCHEMA_VERSION = "2.0";
  const SUPPORT_LOG_STORAGE_KEY = "agnihotra_support_logs_v1";
  const SUPPORT_INSTALL_ID_KEY = "agnihotra_support_install_id_v1";
  const SUPPORT_SESSION_ID_KEY = "agnihotra_support_session_id_v1";
  const REMINDER_LEAD_STORAGE_KEY = "agnihotra_reminder_lead_v1";
  const REMINDER_VIBRATE_STORAGE_KEY = "agnihotra_reminder_vibrate_v1";
  const WATCH_ALERT_STORAGE_KEY = "agnihotra_watch_alert_v1";
  const TIME_FORMAT_STORAGE_KEY = "agnihotra_time_format_v1";
  const LANGUAGE_STORAGE_KEY = "agnihotra_language";
  const LAST_KNOWN_LOCATION_KEY = "agnihotra_last_known_location";
  const TIMINGS_CACHE_KEY = "agnihotra_timings_cache";
  const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

  // ───────────────────────────── helpers ────────────────────────────────

  function safeJson(value, fallback = null) {
    try {
      if (typeof value !== "string") return value ?? fallback;
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function safeReadStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function bool(v) {
    return Boolean(v);
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function isoNow() {
    return new Date().toISOString();
  }

  // Best-effort timeout wrapper so a flaky native plugin can't hang the
  // export. Returns null if the promise rejects or times out.
  function withTimeout(promise, ms = 1500, fallback = null) {
    if (!promise || typeof promise.then !== "function") return Promise.resolve(fallback);
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(fallback);
      }, ms);
      promise
        .then((value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        });
    });
  }

  function parseAndroidVersionFromUA(ua) {
    const match = String(ua || "").match(/Android\s+([0-9]+(?:\.[0-9]+){0,2})/i);
    return match ? match[1] : null;
  }

  function parseDeviceModelFromUA(ua) {
    // Matches "; OPPO CPH2563 Build/" or "; SM-G991B)"
    const match = String(ua || "").match(/;\s*([^)/;]+?)\s+Build\//i);
    return match ? match[1].trim() : null;
  }

  // ───────────────────────────── section: app ──────────────────────────

  function buildAppSection(ctx) {
    const config = window.AGNI_RUNTIME_CONFIG || {};
    const language =
      ctx?.getCurrentLanguage?.() ||
      safeReadStorage(LANGUAGE_STORAGE_KEY) ||
      "en";
    const timeFormat =
      (safeReadStorage(TIME_FORMAT_STORAGE_KEY) || "ampm").toLowerCase() === "24h"
        ? "24h"
        : "ampm";
    const leadRaw = safeReadStorage(REMINDER_LEAD_STORAGE_KEY);
    const leadMinutes = leadRaw === null ? 15 : Math.max(2, Math.min(60, parseInt(leadRaw, 10) || 15));
    const startedAt = window.__agnihotraAppStartedAtMs || null;

    return {
      release: String(config.appRelease || "dev"),
      environment: String(config.appEnvironment || "production"),
      buildVariant: window.__agnihotraBuildVariant || "unknown",
      language,
      timeFormat,
      reminderLeadMinutes: leadMinutes,
      reminderVibrate: safeReadStorage(REMINDER_VIBRATE_STORAGE_KEY) !== "false",
      watchAlert: safeReadStorage(WATCH_ALERT_STORAGE_KEY) === "true",
      installId: safeReadStorage(SUPPORT_INSTALL_ID_KEY) || null,
      sessionId: window.__agnihotraSupportSessionId || null,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      uptimeMs: startedAt ? Date.now() - startedAt : null,
      timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || null,
      generatedAt: isoNow(),
    };
  }

  // ───────────────────────────── section: device ───────────────────────

  async function buildDeviceSection() {
    const ua = String(navigator.userAgent || "");
    let info = null;

    const devicePlugin = window.Capacitor?.Plugins?.Device;
    if (devicePlugin?.getInfo) {
      info = await withTimeout(devicePlugin.getInfo(), 1500, null);
    }

    const isNative = bool(window.Capacitor?.isNativePlatform?.());
    return {
      runtime: isNative ? "native" : "web",
      capacitorPlatform: window.Capacitor?.getPlatform?.() || (isNative ? "android" : "web"),
      userAgent: ua,
      platform: navigator.platform || null,
      manufacturer: info?.manufacturer || null,
      model: info?.model || parseDeviceModelFromUA(ua),
      osName: info?.operatingSystem || (isNative ? "android" : null),
      osVersion: info?.osVersion || parseAndroidVersionFromUA(ua) || null,
      appVersion: info?.appVersion || null,
      appBuild: info?.appBuild || null,
      isVirtual: info?.isVirtual ?? null,
      memUsed: info?.memUsed ?? null,
      diskFree: info?.diskFree ?? null,
      diskTotal: info?.diskTotal ?? null,
      languagePreferred: navigator.language || null,
      languages: Array.isArray(navigator.languages) ? navigator.languages.slice(0, 5) : null,
      screen: {
        width: window.screen?.width || null,
        height: window.screen?.height || null,
        dpr: window.devicePixelRatio || null,
        orientation: window.screen?.orientation?.type || null,
      },
    };
  }

  // ─────────────────────────── section: permissions ────────────────────

  async function buildPermissionsSection(ctx) {
    const result = {
      notifications: "unknown",
      location: "unknown",
      exactAlarm: "unknown",
      checkedAt: isoNow(),
    };

    // Notifications
    const localNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (localNotifications?.checkPermissions) {
      const perm = await withTimeout(localNotifications.checkPermissions(), 1500, null);
      if (perm) result.notifications = perm.display || "unknown";
    } else if (typeof Notification !== "undefined") {
      result.notifications = Notification.permission || "unknown";
    }

    // Location
    if (ctx?.getLocationPermissionState) {
      try {
        const v = await withTimeout(Promise.resolve(ctx.getLocationPermissionState()), 1500, null);
        if (v) result.location = String(v);
      } catch (_) {}
    } else if (navigator.permissions?.query) {
      const status = await withTimeout(
        navigator.permissions.query({ name: "geolocation" }),
        1500,
        null
      );
      if (status) result.location = status.state || "unknown";
    }

    // Exact-alarm (Android only). Capacitor LocalNotifications doesn't expose
    // a check API for this, so we infer from the LocalNotifications plugin
    // checkPermissions extras when available.
    if (localNotifications?.checkExactNotificationSetting) {
      const r = await withTimeout(localNotifications.checkExactNotificationSetting(), 1500, null);
      if (r) result.exactAlarm = r.exact || r.state || "unknown";
    }

    return result;
  }

  // ─────────────────────────── section: network ────────────────────────

  function buildNetworkSection(ctx) {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    return {
      online: bool(navigator.onLine),
      forceOffline: bool(ctx?.isForcedOfflineModeEnabled?.()),
      connectionType: conn?.type || null,
      effectiveType: conn?.effectiveType || null,
      downlinkMbps: num(conn?.downlink),
      rttMs: num(conn?.rtt),
      saveData: bool(conn?.saveData),
    };
  }

  // ─────────────────────────── section: location ───────────────────────

  function buildLocationSection(ctx) {
    const lastKnownRaw = safeReadStorage(LAST_KNOWN_LOCATION_KEY);
    const lastKnown = safeJson(lastKnownRaw, null);
    let lastKnownAgeMs = null;
    if (lastKnown?.savedAt) {
      lastKnownAgeMs = Math.max(0, Date.now() - Number(lastKnown.savedAt));
    }
    return {
      lastKnown: lastKnown
        ? {
            lat: num(lastKnown.lat),
            lng: num(lastKnown.lng),
            locationName: lastKnown.locationName || null,
            savedAt: lastKnown.savedAt
              ? new Date(Number(lastKnown.savedAt)).toISOString()
              : null,
            ageMs: lastKnownAgeMs,
          }
        : null,
      lastEvent: window.__agnihotraLastLocationMeta || null,
      history: Array.isArray(window.__agnihotraLocationHistory)
        ? window.__agnihotraLocationHistory.slice(-25)
        : [],
    };
  }

  // ─────────────────────────── section: timing cache ───────────────────

  function buildTimingSection() {
    const cacheRaw = safeReadStorage(TIMINGS_CACHE_KEY);
    const parsed = safeJson(cacheRaw, null);
    if (!parsed) return { exists: false };

    const timings = parsed?.timings && typeof parsed.timings === "object" ? parsed.timings : {};
    const dates = Object.keys(timings);
    const lastUpdated = num(parsed?.lastUpdated);
    const ageMs = lastUpdated ? Math.max(0, Date.now() - lastUpdated) : null;
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const todayKey = `${dd}.${mm}.${yyyy}`;
    const todayRow = timings[todayKey] || null;

    return {
      exists: true,
      lat: num(parsed?.lat),
      lng: num(parsed?.lng),
      locationName: parsed?.locationName || null,
      totalDays: dates.length,
      hasToday: bool(todayRow),
      todayRow: todayRow
        ? {
            sunrise: todayRow.sunrise || null,
            sunset: todayRow.sunset || null,
          }
        : null,
      firstDate: dates[0] || null,
      lastDate: dates[dates.length - 1] || null,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
      ageMs,
      expiresInMs: lastUpdated ? Math.max(0, CACHE_EXPIRY_MS - ageMs) : null,
    };
  }

  // ─────────────────────────── section: notifications ──────────────────

  async function buildNotificationsSection(ctx) {
    const result = {
      channels: [],
      pending: { count: 0, sample: [] },
      activeCountdowns: num(ctx?.getActiveCountdownCount?.()) || 0,
      playedAlerts: num(ctx?.getPlayedAlertsCount?.()) || 0,
      upcomingRefreshAt: ctx?.getUpcomingRefreshAt?.() || null,
      nativeReminderEventsLoaded: 0,
      lastScheduledAt: window.__agnihotraLastReminderScheduledAt || null,
      lastFiredAt: window.__agnihotraLastReminderFiredAt || null,
      lastCancelledAt: window.__agnihotraLastReminderCancelledAt || null,
      mockReminderHistory: Array.isArray(window.__agnihotraMockReminderHistory)
        ? window.__agnihotraMockReminderHistory.slice(-10)
        : [],
    };

    try {
      const evt = ctx?.getLatestTimingsForNativeReminders?.();
      if (Array.isArray(evt)) result.nativeReminderEventsLoaded = evt.length;
      else if (evt && typeof evt === "object") result.nativeReminderEventsLoaded = Object.keys(evt).length;
    } catch (_) {}

    const localNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (localNotifications?.listChannels) {
      const channels = await withTimeout(localNotifications.listChannels(), 1500, { channels: [] });
      if (channels?.channels) {
        result.channels = channels.channels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          importance: num(ch.importance),
          visibility: num(ch.visibility),
          sound: ch.sound || null,
          vibration: bool(ch.vibration),
          lights: bool(ch.lights),
        }));
      }
    }

    if (localNotifications?.getPending) {
      const pending = await withTimeout(localNotifications.getPending(), 1500, { notifications: [] });
      if (pending?.notifications) {
        result.pending.count = pending.notifications.length;
        result.pending.sample = pending.notifications.slice(0, 10).map((n) => ({
          id: n.id,
          title: n.title || null,
          body: n.body || null,
          scheduleAt: n.schedule?.at
            ? typeof n.schedule.at === "string"
              ? n.schedule.at
              : new Date(n.schedule.at).toISOString()
            : null,
          extra: n.extra || null,
        }));
      }
    }

    return result;
  }

  // ─────────────────────────── section: audio / bell ───────────────────

  function buildAudioSection() {
    const nativeAudio = window.Capacitor?.Plugins?.NativeAudio;
    return {
      nativeAudioAvailable: bool(nativeAudio),
      preloadedAssets: Array.isArray(window.__agnihotraBellPreloaded)
        ? window.__agnihotraBellPreloaded.slice(-10)
        : [],
      lastBellPlayedAt: window.__agnihotraLastBellPlayedAt || null,
      lastBellKind: window.__agnihotraLastBellKind || null,
      lastBellDecision: window.__agnihotraLastBellDecision || null,
      audioContextState: (() => {
        try {
          return window.__agnihotraAudioContext?.state || null;
        } catch (_) {
          return null;
        }
      })(),
    };
  }

  // ─────────────────────────── section: lifecycle ──────────────────────

  function buildLifecycleSection() {
    return {
      visibility: document.visibilityState || null,
      hidden: bool(document.hidden),
      transitions: Array.isArray(window.__agnihotraVisibilityTransitions)
        ? window.__agnihotraVisibilityTransitions.slice(-30)
        : [],
      networkEvents: Array.isArray(window.__agnihotraNetworkEvents)
        ? window.__agnihotraNetworkEvents.slice(-20)
        : [],
    };
  }

  // ─────────────────────────── section: errors ─────────────────────────

  function buildErrorsSection() {
    const errors = Array.isArray(window.__agnihotraRecentErrors)
      ? window.__agnihotraRecentErrors
      : [];
    return {
      count: errors.length,
      recent: errors.slice(-15),
    };
  }

  // ─────────────────────────── section: logs ───────────────────────────

  function readPersistedLogs() {
    try {
      const raw = safeReadStorage(SUPPORT_LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function buildLogsSection(providedLogs) {
    const logs = Array.isArray(providedLogs) && providedLogs.length
      ? providedLogs
      : readPersistedLogs();
    return {
      count: logs.length,
      // ship the most recent 750 entries; older entries already auto-pruned
      // by 30-day retention so this caps payload size around ~250 KB max.
      entries: logs.slice(-750),
    };
  }

  // ─────────────────────────── public API ──────────────────────────────

  async function build(options = {}) {
    const { logs = null, reason = "manual", extra = null, ctx = window.__agnihotraSupportCtx || {} } = options;

    const result = {
      schemaVersion: SCHEMA_VERSION,
      reason: String(reason || "manual"),
    };

    // gather all sections — fire async ones in parallel for speed
    const [device, permissions, notifications] = await Promise.all([
      buildDeviceSection().catch(() => null),
      buildPermissionsSection(ctx).catch(() => null),
      buildNotificationsSection(ctx).catch(() => null),
    ]);

    result.app = buildAppSection(ctx);
    result.device = device || {};
    result.permissions = permissions || {};
    result.network = buildNetworkSection(ctx);
    result.location = buildLocationSection(ctx);
    result.timing = buildTimingSection();
    result.notifications = notifications || {};
    result.audio = buildAudioSection();
    result.lifecycle = buildLifecycleSection();
    result.errors = buildErrorsSection();
    result.logs = buildLogsSection(logs);

    if (extra && typeof extra === "object") {
      result.extra = extra;
    }

    return result;
  }

  window.AgnihotraSupportPayload = {
    SCHEMA_VERSION,
    build,
  };
})();
