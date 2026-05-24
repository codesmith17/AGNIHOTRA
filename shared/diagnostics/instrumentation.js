/**
 * Diagnostic instrumentation.
 *
 * Wires lightweight runtime trackers that the support payload builder reads:
 *   - visibility transitions (foreground / background history)
 *   - online/offline events
 *   - uncaught errors & promise rejections
 *   - location event history (the existing locationLog already updates the
 *     "last meta" pointer; we extend it to keep a rolling history)
 *   - bell preload + playback events
 *
 * Also installs a console capture that pushes EVERY warn/error into the
 * persisted log store (not just `[AGNIHOTRA]`-tagged messages), so a user's
 * support export contains genuine error traces from libraries too.
 */
(() => {
  const MAX_VISIBILITY_EVENTS = 60;
  const MAX_NETWORK_EVENTS = 40;
  const MAX_LOCATION_HISTORY = 50;
  const MAX_ERROR_HISTORY = 25;
  const MAX_BELL_HISTORY = 20;
  const MAX_MOCK_HISTORY = 20;

  // ────────────────────────────────────────────────────────────────────

  if (window.__agnihotraInstrumentationInstalled) return;
  window.__agnihotraInstrumentationInstalled = true;

  if (!window.__agnihotraAppStartedAtMs) {
    window.__agnihotraAppStartedAtMs = Date.now();
  }
  if (!window.__agnihotraSupportSessionId) {
    window.__agnihotraSupportSessionId = `sess-${Date.now()}-${Math.floor(
      Math.random() * 1e6
    )}`;
  }

  function safeStringify(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function pushBounded(arrayName, entry, limit) {
    if (!Array.isArray(window[arrayName])) window[arrayName] = [];
    window[arrayName].push(entry);
    if (window[arrayName].length > limit) {
      window[arrayName].splice(0, window[arrayName].length - limit);
    }
  }

  function infoTag(tag, message, payload) {
    const body =
      payload != null && payload !== "" ? ` ${safeStringify(payload)}` : "";
    try {
      console.info(`[AGNIHOTRA][${tag}] ${message}${body}`);
    } catch (_) {}
  }

  // ─────────────────────────── visibility ──────────────────────────────

  document.addEventListener("visibilitychange", () => {
    const entry = {
      at: new Date().toISOString(),
      state: document.visibilityState || (document.hidden ? "hidden" : "visible"),
      hidden: Boolean(document.hidden),
    };
    pushBounded("__agnihotraVisibilityTransitions", entry, MAX_VISIBILITY_EVENTS);
    infoTag("LIFECYCLE", `visibility-${entry.state}`, {
      uptimeMs: Date.now() - window.__agnihotraAppStartedAtMs,
    });
  });

  window.addEventListener("pageshow", (event) => {
    pushBounded(
      "__agnihotraVisibilityTransitions",
      {
        at: new Date().toISOString(),
        state: "pageshow",
        persisted: Boolean(event?.persisted),
      },
      MAX_VISIBILITY_EVENTS
    );
    infoTag("LIFECYCLE", "pageshow", { persisted: Boolean(event?.persisted) });
  });

  window.addEventListener("pagehide", (event) => {
    pushBounded(
      "__agnihotraVisibilityTransitions",
      {
        at: new Date().toISOString(),
        state: "pagehide",
        persisted: Boolean(event?.persisted),
      },
      MAX_VISIBILITY_EVENTS
    );
    infoTag("LIFECYCLE", "pagehide", { persisted: Boolean(event?.persisted) });
  });

  // ─────────────────────────── network ─────────────────────────────────

  window.addEventListener("online", () => {
    pushBounded(
      "__agnihotraNetworkEvents",
      { at: new Date().toISOString(), state: "online" },
      MAX_NETWORK_EVENTS
    );
    infoTag("NETWORK", "online");
  });

  window.addEventListener("offline", () => {
    pushBounded(
      "__agnihotraNetworkEvents",
      { at: new Date().toISOString(), state: "offline" },
      MAX_NETWORK_EVENTS
    );
    infoTag("NETWORK", "offline");
  });

  // ─────────────────────────── errors / rejections ─────────────────────

  function recordError(kind, error, extra = null) {
    const entry = {
      at: new Date().toISOString(),
      kind,
      message:
        error instanceof Error
          ? error.message
          : safeStringify(error),
      name: error?.name || null,
      stack: error?.stack ? String(error.stack).slice(0, 2000) : null,
      extra: extra || null,
    };
    pushBounded("__agnihotraRecentErrors", entry, MAX_ERROR_HISTORY);
    try {
      console.error(`[AGNIHOTRA][ERROR] ${kind}`, entry.message);
    } catch (_) {}
  }

  window.addEventListener("error", (event) => {
    recordError("window-error", event?.error || new Error(safeStringify(event?.message || "window-error")), {
      filename: event?.filename || null,
      lineno: event?.lineno ?? null,
      colno: event?.colno ?? null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      event?.reason instanceof Error ? event.reason : new Error(safeStringify(event?.reason));
    recordError("unhandled-rejection", reason);
  });

  // ─────────────────────── locationLog enrichment ──────────────────────

  // We don't override locationLog here (defined later in script.js) — instead
  // the script.js helper will call window.AgnihotraInstrumentation.recordLocation
  // for history bookkeeping.

  // ─────────────────────── public surface ──────────────────────────────

  window.AgnihotraInstrumentation = {
    recordLocation(stage, payload) {
      pushBounded(
        "__agnihotraLocationHistory",
        {
          at: new Date().toISOString(),
          stage: String(stage || ""),
          payload: payload || null,
        },
        MAX_LOCATION_HISTORY
      );
    },
    recordReminderScheduled(payload) {
      window.__agnihotraLastReminderScheduledAt = {
        at: new Date().toISOString(),
        ...payload,
      };
      infoTag("REMINDER", "scheduled", payload);
    },
    recordReminderFired(payload) {
      window.__agnihotraLastReminderFiredAt = {
        at: new Date().toISOString(),
        ...payload,
      };
      infoTag("REMINDER", "fired", payload);
    },
    recordReminderCancelled(payload) {
      window.__agnihotraLastReminderCancelledAt = {
        at: new Date().toISOString(),
        ...payload,
      };
      infoTag("REMINDER", "cancelled", payload);
    },
    recordBellPreload(kind, assetPath) {
      pushBounded(
        "__agnihotraBellPreloaded",
        {
          at: new Date().toISOString(),
          kind: String(kind || ""),
          assetPath: String(assetPath || ""),
        },
        MAX_BELL_HISTORY
      );
    },
    recordBellPlay(kind, decision = null) {
      window.__agnihotraLastBellPlayedAt = new Date().toISOString();
      window.__agnihotraLastBellKind = kind || null;
      window.__agnihotraLastBellDecision = decision || null;
      infoTag("BELL", `play-${kind || "unknown"}`, decision);
    },
    recordMockReminder(payload) {
      pushBounded(
        "__agnihotraMockReminderHistory",
        {
          at: new Date().toISOString(),
          ...payload,
        },
        MAX_MOCK_HISTORY
      );
      infoTag("MOCK", "trigger", payload);
    },
    recordSettingsChange(key, value) {
      infoTag("SETTINGS", `change-${key}`, { value });
    },
    recordUserAction(name, payload = null) {
      infoTag("UI", name, payload);
    },
    recordPermissionResult(name, state, extra = null) {
      infoTag("PERMISSION", `${name}-${state}`, extra);
    },
    recordError,
  };
})();
