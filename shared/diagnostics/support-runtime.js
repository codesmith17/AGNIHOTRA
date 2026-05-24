(() => {
  function parseAndroidVersionFromUserAgent(ua) {
    const text = String(ua || "");
    const match = text.match(/Android\s+([0-9]+(?:\.[0-9]+){0,2})/i);
    return match ? match[1] : null;
  }

  function normalizeSentryLevel(level) {
    const raw = String(level || "info").toLowerCase();
    if (["fatal", "error", "warning", "log", "debug", "info"].includes(raw)) {
      return raw;
    }
    if (raw === "warn") return "warning";
    return "info";
  }

  function fallbackSerialize(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function create(context) {
    const ctx = context || {};
    const serialize = (value) =>
      typeof ctx.serializeForConsole === "function"
        ? ctx.serializeForConsole(value)
        : fallbackSerialize(value);

    async function collectSupportDiagnosticSnapshot(reason = "manual", extra = {}) {
      const ua = String(navigator.userAgent || "");
      const isNative = Boolean(ctx.isNativeAppRuntime?.());
      const notificationStatus = await (ctx.getNotificationPermissionStatus?.() || "unknown");
      const locationPermissionState = await (ctx.getLocationPermissionState?.() || "unknown");

      let deviceInfo = null;
      try {
        const devicePlugin = window.Capacitor?.Plugins?.Device;
        if (devicePlugin?.getInfo) {
          deviceInfo = await devicePlugin.getInfo();
        }
      } catch (_) {
        deviceInfo = null;
      }

      const androidVersion = deviceInfo?.osVersion || parseAndroidVersionFromUserAgent(ua) || null;
      const releaseTag = String(window.AGNI_RUNTIME_CONFIG?.appRelease || "dev");
      const cache = ctx.getTimingCacheDiagnostics?.() || { exists: false };

      return {
        reason,
        at: new Date().toISOString(),
        release: releaseTag,
        environment: String(window.AGNI_RUNTIME_CONFIG?.appEnvironment || "production"),
        runtime: isNative ? "native" : "web",
        platform: window.Capacitor?.getPlatform?.() || (isNative ? "android" : "web"),
        androidVersion,
        appBuildVersion: deviceInfo?.appBuild || null,
        appVersion: deviceInfo?.appVersion || null,
        model: deviceInfo?.model || null,
        manufacturer: deviceInfo?.manufacturer || null,
        osName: deviceInfo?.operatingSystem || null,
        online: Boolean(ctx.isEffectivelyOnline?.()),
        forceOffline: Boolean(ctx.isForcedOfflineModeEnabled?.()),
        language: String(ctx.getCurrentLanguage?.() || "en"),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        installId: ctx.ensureSupportInstallId?.() || null,
        sessionId: ctx.getSupportSessionId?.() || null,
        notificationPermission: notificationStatus,
        locationPermission: locationPermissionState,
        locationMeta: window.__agnihotraLastLocationMeta || null,
        lastKnownLocation: ctx.getLastKnownLocation?.() || null,
        timingCache: cache,
        nativeReminderEventsLoaded: (() => {
          const timings = ctx.getLatestTimingsForNativeReminders?.();
          if (Array.isArray(timings)) return timings.length;
          if (timings && typeof timings === "object") return Object.keys(timings).length;
          return 0;
        })(),
        activeCountdowns: Number(ctx.getActiveCountdownCount?.() || 0),
        playedAlerts: Number(ctx.getPlayedAlertsCount?.() || 0),
        upcomingRefreshAt: ctx.getUpcomingRefreshAt?.() || null,
        extra: extra && typeof extra === "object" ? extra : { value: String(extra || "") },
      };
    }

    function captureDiagnosticBreadcrumb(category, message, data = {}, level = "info") {
      if (!window.__agnihotraSentryEnabled || !window.Sentry) return;
      try {
        window.Sentry.addBreadcrumb({
          category: String(category || "agnihotra"),
          message: String(message || "event"),
          level: normalizeSentryLevel(level),
          data: data && typeof data === "object" ? data : { value: data },
          timestamp: Date.now() / 1000,
        });
      } catch (_) {}
    }

    function captureDiagnosticMessage(message, level = "info", extras = {}) {
      if (!window.__agnihotraSentryEnabled || !window.Sentry) return;
      try {
        window.Sentry.withScope((scope) => {
          Object.entries(extras || {}).forEach(([key, value]) => scope.setExtra(key, value));
          window.Sentry.captureMessage(String(message || "diagnostic-message"), normalizeSentryLevel(level));
        });
      } catch (_) {}
    }

    function captureDiagnosticException(error, contextTag = "diagnostic-exception", extras = {}) {
      if (!window.__agnihotraSentryEnabled || !window.Sentry || !error) return;
      try {
        window.Sentry.withScope((scope) => {
          scope.setTag("context", String(contextTag || "diagnostic-exception"));
          Object.entries(extras || {}).forEach(([key, value]) => scope.setExtra(key, value));
          window.Sentry.captureException(error);
        });
      } catch (_) {}
    }

    function emitSupportSnapshot(reason = "manual", extra = {}) {
      collectSupportDiagnosticSnapshot(reason, extra)
        .then((snapshot) => {
          console.info(`[SUPPORT][DIAG] ${serialize(snapshot)}`);
          captureDiagnosticMessage(`support-snapshot:${reason}`, "info", snapshot);
        })
        .catch((error) => {
          captureDiagnosticException(error, "support-snapshot-failed", { reason });
        });
    }

    function reportBellDecision(reason, details = {}, level = "info") {
      const payload = details && typeof details === "object" ? details : { value: details };
      console.info(`[SUPPORT][BELL] ${reason} ${serialize(payload)}`);
      captureDiagnosticMessage(`bell:${reason}`, level, payload);
      emitSupportSnapshot(`bell-${reason}`, payload);
    }

    function initSentryDiagnostics() {
      if (window.__agnihotraSentryInitDone) return;
      window.__agnihotraSentryInitDone = true;

      const enabled = Boolean(
        ctx.getRuntimeBoolean?.(
          window.AGNI_RUNTIME_CONFIG?.enableRemoteLogCapture,
          window.AGNI_ENABLE_REMOTE_LOG_CAPTURE
        )
      );
      const sentry = window.Sentry;
      const dsn = String(window.AGNI_RUNTIME_CONFIG?.sentryDsn || "").trim();
      if (!enabled || !sentry || !dsn) return;

      try {
        sentry.init({
          dsn,
          tracesSampleRate: 0.05,
          environment: String(window.AGNI_RUNTIME_CONFIG?.appEnvironment || "production"),
          release: String(window.AGNI_RUNTIME_CONFIG?.appRelease || "dev"),
          beforeSend(event) {
            if (event?.request?.headers) delete event.request.headers.Authorization;
            return event;
          },
        });
        sentry.setTag("app", "eternalagni");
        sentry.setTag("platform", ctx.isNativeAppRuntime?.() ? "android" : "web");
        sentry.setTag("forced_offline", String(Boolean(ctx.isForcedOfflineModeEnabled?.())));
        sentry.setTag("language", String(ctx.getStoredLanguagePreference?.() || "en"));
        sentry.setTag("android_version", parseAndroidVersionFromUserAgent(navigator.userAgent) || "unknown");
        sentry.setTag("install_id", ctx.ensureSupportInstallId?.() || "unknown");
        sentry.setTag("session_id", ctx.getSupportSessionId?.() || "unknown");
        window.__agnihotraSentryEnabled = true;
        console.log("[SENTRY] diagnostics initialized");
      } catch (error) {
        console.warn("[SENTRY] init-failed", serialize(error));
      }
    }

    function wireGlobalErrorHandlers() {
      if (window.__agnihotraSupportErrorHandlersBound) return;
      window.__agnihotraSupportErrorHandlersBound = true;

      window.addEventListener("error", (event) => {
        captureDiagnosticException(
          event?.error || new Error(String(event?.message || "window-error")),
          "window-error",
          {
            filename: event?.filename || null,
            lineno: event?.lineno || null,
            colno: event?.colno || null,
          }
        );
      });

      window.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason instanceof Error
          ? event.reason
          : new Error(serialize(event?.reason || "unhandled-rejection"));
        captureDiagnosticException(reason, "unhandledrejection");
      });
    }

    return {
      initSentryDiagnostics,
      captureDiagnosticBreadcrumb,
      captureDiagnosticMessage,
      captureDiagnosticException,
      emitSupportSnapshot,
      reportBellDecision,
      wireGlobalErrorHandlers,
    };
  }

  window.AgnihotraSupportRuntime = {
    create,
  };
})();
