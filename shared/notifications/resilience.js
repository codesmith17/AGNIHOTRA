(() => {
  const shared = window.AgnihotraNotificationShared;
  const TIMINGS_CACHE_KEY = "agnihotra_timings_cache";
  const SCHEDULE_META_KEY = "agnihotra_reminder_schedule_meta_v1";
  const MIN_RESCHEDULE_GAP_MS = 12_000;
  const MIDNIGHT_BUFFER_MS = 2_500;

  let started = false;
  let midnightTimerId = null;
  let rescheduleInFlight = null;
  let lastRescheduleAt = 0;
  let lastKnownDateKey = null;

  function log(event, meta = {}) {
    let serialized = "";
    try {
      serialized = JSON.stringify(meta ?? {});
    } catch (_) {
      serialized = String(meta);
    }
    console.log(`[AGNIHOTRA][NOTIFY] resilience-${event} ${serialized}`);
  }

  function todayDateKey(referenceDate = new Date()) {
    const day = String(referenceDate.getDate()).padStart(2, "0");
    const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
    const year = referenceDate.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function readScheduleMeta() {
    try {
      const raw = localStorage.getItem(SCHEDULE_META_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function msUntilNextMidnight(bufferMs = MIDNIGHT_BUFFER_MS) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(bufferMs, next.getTime() - now.getTime() + bufferMs);
  }

  async function consumeNativeRescheduleFlag() {
    try {
      const plugin = window.Capacitor?.Plugins?.AgnihotraReminder;
      if (!plugin?.consumeRescheduleFlag) return null;
      return await plugin.consumeRescheduleFlag();
    } catch (error) {
      return { needsReschedule: false, error: error?.message || String(error) };
    }
  }

  async function countPendingReminders() {
    const native = window.AgnihotraNotificationNative;
    if (native?.countPendingReminders) {
      return native.countPendingReminders();
    }
    return 0;
  }

  function hasTimingsCache() {
    try {
      const raw = localStorage.getItem(TIMINGS_CACHE_KEY);
      if (!raw) return false;
      const cache = JSON.parse(raw);
      return Boolean(cache?.timings && typeof cache.timings === "object");
    } catch (_) {
      return false;
    }
  }

  async function evaluateRescheduleNeed(reason) {
    const todayKey = todayDateKey();
    const meta = readScheduleMeta();
    const pending = await countPendingReminders();
    const bootFlag = await consumeNativeRescheduleFlag();

    if (bootFlag?.needsReschedule) {
      return {
        should: true,
        why: `native-flag:${bootFlag.trigger || "unknown"}`,
        todayKey,
        pending,
      };
    }

    if (reason === "midnight") {
      return { should: true, why: "midnight-timer", todayKey, pending };
    }

    if (meta?.dateKey && meta.dateKey !== todayKey) {
      return { should: true, why: "date-key-changed", todayKey, pending, previousKey: meta.dateKey };
    }

    if (lastKnownDateKey && lastKnownDateKey !== todayKey) {
      return { should: true, why: "sliding-date-window", todayKey, pending, previousKey: lastKnownDateKey };
    }

    if (pending === 0 && hasTimingsCache()) {
      return { should: true, why: "pending-empty", todayKey, pending };
    }

    if (reason === "startup" && hasTimingsCache() && pending < 2) {
      return { should: true, why: "pending-low-on-startup", todayKey, pending };
    }

    return { should: false, why: "no-op", todayKey, pending };
  }

  function scheduleMidnightTimer() {
    if (midnightTimerId) {
      clearTimeout(midnightTimerId);
      midnightTimerId = null;
    }
    const delayMs = msUntilNextMidnight();
    log("midnight-timer-armed", { delayMs, firesAt: new Date(Date.now() + delayMs).toISOString() });
    midnightTimerId = setTimeout(() => {
      midnightTimerId = null;
      maybeRescheduleReminders("midnight").finally(() => {
        try {
          window.requestUpcomingEventsRefresh?.("midnight-reschedule");
        } catch (_) {}
        scheduleMidnightTimer();
      });
    }, delayMs);
  }

  async function maybeRescheduleReminders(reason = "unknown") {
    if (!shared?.isCapacitorNativeRuntime?.()) return { ok: false, skipped: "not-native" };
    if (!hasTimingsCache()) return { ok: false, skipped: "no-cache" };

    const now = Date.now();
    if (rescheduleInFlight) return rescheduleInFlight;
    if (reason !== "midnight" && now - lastRescheduleAt < MIN_RESCHEDULE_GAP_MS) {
      return { ok: false, skipped: "throttled" };
    }

    rescheduleInFlight = (async () => {
      const evaluation = await evaluateRescheduleNeed(reason);
      lastKnownDateKey = evaluation.todayKey || todayDateKey();
      if (!evaluation.should) {
        log("skip", { reason, ...evaluation });
        return { ok: false, skipped: evaluation.why };
      }

      const reschedule = window.AgnihotraRescheduleReminders;
      if (typeof reschedule !== "function") {
        log("skip-no-hook", { reason, ...evaluation });
        return { ok: false, skipped: "hook-missing" };
      }

      log("reschedule-start", { reason, ...evaluation });
      const result = await reschedule(reason, evaluation);
      lastRescheduleAt = Date.now();
      log("reschedule-done", { reason, result });
      return result;
    })().finally(() => {
      rescheduleInFlight = null;
    });

    return rescheduleInFlight;
  }

  function markScheduled(meta = {}) {
    try {
      localStorage.setItem(
        SCHEDULE_META_KEY,
        JSON.stringify({
          dateKey: todayDateKey(),
          scheduledAt: Date.now(),
          ...meta,
        })
      );
      lastKnownDateKey = todayDateKey();
    } catch (_) {}
  }

  function listenForLifecycle() {
    try {
      const App = window.Capacitor?.Plugins?.App;
      App?.addListener?.("appStateChange", (state) => {
        if (state?.isActive) {
          maybeRescheduleReminders("resume").catch(() => {});
        }
      });
    } catch (_) {}

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const todayKey = todayDateKey();
      if (lastKnownDateKey && lastKnownDateKey !== todayKey) {
        maybeRescheduleReminders("visibility-date-changed").catch(() => {});
      }
      lastKnownDateKey = todayKey;
    });
  }

  function start() {
    if (started) return;
    started = true;
    if (!shared?.isCapacitorNativeRuntime?.()) return;

    lastKnownDateKey = todayDateKey();
    listenForLifecycle();
    scheduleMidnightTimer();

    setTimeout(() => {
      maybeRescheduleReminders("startup").catch(() => {});
    }, 2_500);
  }

  window.AgnihotraReminderResilience = {
    start,
    maybeRescheduleReminders,
    markScheduled,
    todayDateKey,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
