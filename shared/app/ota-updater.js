/**
 * Self-hosted OTA live updates for EternalAgni (free, GitHub Releases).
 *
 * Design goals (must never be violated):
 *   1. NORMAL FUNCTIONING IS NEVER HARMED. Every network call is best-effort,
 *      deferred until after the app is fully usable, time-boxed, and wrapped in
 *      try/catch. Offline / slow / failing network => silently do nothing and
 *      keep running the bundle we already have.
 *   2. THE RUNNING SESSION IS NEVER INTERRUPTED. We use download() + next() from
 *      @capgo/capacitor-updater. next() only queues the new bundle; it is applied
 *      when the app is naturally backgrounded or relaunched. We NEVER call set()
 *      or reload(), so the user is never yanked out of the app mid-Agnihotra.
 *   3. BAD BUNDLES ROLL BACK. notifyAppReady() runs on every page within seconds
 *      of load. If a freshly applied bundle fails to boot, the plugin reverts to
 *      the last known-good bundle automatically.
 *
 * No Capgo cloud, no account, no subscription. Bundles are plain zip files
 * hosted as GitHub Release assets; updates are described by a tiny version.json.
 */
(function () {
  const LOG_PREFIX = "[AGNIHOTRA][OTA]";

  // version.json + dist.zip are published as assets on the LATEST GitHub
  // Release of the public repo. The "/releases/latest/download/" path always
  // resolves to the newest published (non-draft, non-prerelease) release.
  const MANIFEST_URL =
    "https://github.com/codesmith17/AGNIHOTRA/releases/latest/download/version.json";

  const CHECK_TIMEOUT_MS = 8000; // abort a stuck manifest fetch
  const CHECK_START_DELAY_MS = 6000; // let the app become fully interactive first
  const MIN_CHECK_INTERVAL_MS = 60 * 60 * 1000; // throttle: at most once per hour

  // Agnihotra blackout: never touch updates around sunrise/sunset. Even though
  // updates only apply on background/restart, downloading or queuing right
  // before the user sets the app down for the ritual is risky. We pause the
  // whole OTA flow in a window around each event and retry afterwards.
  const BLACKOUT_BEFORE_MS = 45 * 60 * 1000; // 45 min before the event
  const BLACKOUT_AFTER_MS = 30 * 60 * 1000; // 30 min after the event

  // Fallback blackout used ONLY when sunrise/sunset timings are unknown (e.g.
  // brand new install, cache not populated yet). Deliberately wide so we never
  // risk updating around a ritual we can't see. [startHour, endHour) local time.
  const DEFAULT_BLACKOUT_WINDOWS = [
    [4, 12], // morning: 4:00 AM – 12:00 PM
    [16, 21], // evening: 4:00 PM – 9:00 PM
  ];

  const PENDING_VERSION_KEY = "agnihotra_ota_pending_version_v1";
  const APPLIED_VERSION_KEY = "agnihotra_ota_applied_version_v1";
  const LAST_CHECK_KEY = "agnihotra_ota_last_check_v1";
  // Same cache script.js writes today's/tomorrow's sunrise & sunset into.
  const TIMINGS_CACHE_KEY = "agnihotra_timings_cache";

  let started = false;

  function log(message, meta) {
    try {
      if (meta === undefined) {
        console.log(`${LOG_PREFIX} ${message}`);
      } else {
        console.log(`${LOG_PREFIX} ${message} ${JSON.stringify(meta)}`);
      }
    } catch (_) {
      console.log(`${LOG_PREFIX} ${message}`);
    }
  }

  function isNativeCapacitor() {
    try {
      return Boolean(
        window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()
      );
    } catch (_) {
      return false;
    }
  }

  function getUpdaterPlugin() {
    return (
      window.Capacitor?.Plugins?.CapacitorUpdater ||
      window.CapacitorUpdater ||
      null
    );
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  // Loose semver compare. Returns 1 if a>b, -1 if a<b, 0 if equal.
  // Non-numeric / missing segments are treated as 0 so it never throws.
  function compareVersions(a, b) {
    const pa = String(a || "0").split(".");
    const pb = String(b || "0").split(".");
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = parseInt(pa[i], 10) || 0;
      const nb = parseInt(pb[i], 10) || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  /**
   * Rollback protection. MUST run quickly on every entry page. With autoUpdate
   * off this simply confirms the active bundle booted fine; if a queued bundle
   * was just applied and is broken, the plugin will roll back on the next start.
   */
  async function notifyReady() {
    if (!isNativeCapacitor()) {
      log("skip-notify (web runtime)");
      return { ok: false, reason: "web" };
    }
    const updater = getUpdaterPlugin();
    if (!updater?.notifyAppReady) {
      log("notify-skip plugin-missing");
      return { ok: false, reason: "plugin-missing" };
    }
    try {
      await updater.notifyAppReady();
      log("notify-success");
      return { ok: true };
    } catch (error) {
      log("notify-failed", { message: error?.message || String(error) });
      return { ok: false, reason: "error" };
    }
  }

  // Build a local Date at an "HH:MM:SS" clock time on the given base day.
  function localTimeToDate(hms, baseDate) {
    const parts = String(hms || "").split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10) || 0;
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const d = baseDate ? new Date(baseDate) : new Date();
    d.setHours(h, m, s, 0);
    return d;
  }

  function ddmmyyyy(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${date.getFullYear()}`;
  }

  function timingsRowFor(date) {
    try {
      const raw = readStorage(TIMINGS_CACHE_KEY);
      if (!raw) return null;
      const timings = JSON.parse(raw)?.timings;
      if (!timings || typeof timings !== "object") return null;
      return timings[ddmmyyyy(date)] || null;
    } catch (_) {
      return null;
    }
  }

  // Default {start,end} windows for a day when timings are unknown.
  function defaultWindowsForDay(baseDate) {
    return DEFAULT_BLACKOUT_WINDOWS.map(([startHour, endHour]) => {
      const start = new Date(baseDate);
      start.setHours(startHour, 0, 0, 0);
      const end = new Date(baseDate);
      end.setHours(endHour, 0, 0, 0);
      return { start: start.getTime(), end: end.getTime() };
    });
  }

  // Blackout windows for one day: tight windows around real sunrise/sunset when
  // known, otherwise the wide safe defaults.
  function windowsForDay(baseDate) {
    const row = timingsRowFor(baseDate);
    const sunrise = localTimeToDate(row?.sunrise, baseDate);
    const sunset = localTimeToDate(row?.sunset, baseDate);
    if (sunrise && sunset) {
      return [
        { start: sunrise.getTime() - BLACKOUT_BEFORE_MS, end: sunrise.getTime() + BLACKOUT_AFTER_MS },
        { start: sunset.getTime() - BLACKOUT_BEFORE_MS, end: sunset.getTime() + BLACKOUT_AFTER_MS },
      ];
    }
    return defaultWindowsForDay(baseDate);
  }

  // Today + tomorrow windows (tomorrow covers the late-night-near-sunrise case).
  function getBlackoutWindows() {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return [...windowsForDay(today), ...windowsForDay(tomorrow)];
  }

  /**
   * True when "now" is inside any sunrise/sunset blackout window (or a default
   * window when timings are unknown).
   */
  function isWithinAgnihotraBlackout() {
    const now = Date.now();
    return getBlackoutWindows().some((w) => now >= w.start && now <= w.end);
  }

  /**
   * If a blackout window starts within the next `lookaheadMs` (or is active),
   * return the ISO time at which the soonest such window ends. Used to hold an
   * already-queued bundle so it can't be applied (on background) during a ritual.
   */
  function imminentBlackoutEndISO(lookaheadMs) {
    const now = Date.now();
    let soonestEnd = null;
    for (const w of getBlackoutWindows()) {
      if (w.end > now && w.start <= now + lookaheadMs) {
        if (soonestEnd === null || w.end < soonestEnd) soonestEnd = w.end;
      }
    }
    return soonestEnd === null ? null : new Date(soonestEnd).toISOString();
  }

  function parseManifestData(data) {
    if (data == null) return null;
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (_) {
        return null;
      }
    }
    return typeof data === "object" ? data : null;
  }

  // Native HTTP via Capacitor core — not subject to WebView CORS, which a plain
  // fetch() to GitHub release assets would be (they send no ACAO header).
  // Returns: parsed manifest, null on a genuine failure, or undefined when the
  // native HTTP plugin is unavailable (so the caller can fall back to fetch()).
  async function fetchManifestViaNativeHttp() {
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    if (!http?.get) return undefined;
    try {
      const res = await http.get({
        url: MANIFEST_URL,
        headers: { Accept: "application/json" },
        connectTimeout: CHECK_TIMEOUT_MS,
        readTimeout: CHECK_TIMEOUT_MS,
        disableRedirects: false,
      });
      const status = Number(res?.status);
      if (!status || status < 200 || status >= 300) return null;
      return parseManifestData(res?.data);
    } catch (_) {
      return null;
    }
  }

  async function fetchManifestViaFetch() {
    let controller = null;
    let timer = null;
    try {
      controller = new AbortController();
      timer = setTimeout(() => {
        try {
          controller.abort();
        } catch (_) {}
      }, CHECK_TIMEOUT_MS);
      const res = await fetch(MANIFEST_URL, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!res || !res.ok) return null;
      return parseManifestData(await res.json());
    } catch (_) {
      return null; // offline / timeout / CORS / bad JSON — stay on current bundle
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchManifest() {
    const viaNative = await fetchManifestViaNativeHttp();
    if (viaNative !== undefined) return viaNative; // native handled it (data or null)
    return fetchManifestViaFetch(); // web runtime fallback
  }

  async function getCurrentState(updater) {
    try {
      const cur = await updater.current();
      return {
        version: cur?.bundle?.version || "0.0.0",
        native: cur?.native || "0.0.0",
        id: cur?.bundle?.id || "builtin",
      };
    } catch (_) {
      return { version: "0.0.0", native: "0.0.0", id: "builtin" };
    }
  }

  function result(status, extra) {
    return { status, ...(extra || {}) };
  }

  /**
   * The whole flow. Anything unexpected just aborts quietly — there is no path
   * here that can block, crash, or reload the app the user is using.
   *
   * opts:
   *   - trigger: string label for logs ("startup" | "resume" | "online" | "manual-force")
   *   - force:   when true, ignore the throttle AND the Agnihotra blackout. Used
   *              only by the manual test button. The flow stays session-safe
   *              (download + next, never set/reload).
   *
   * Returns a { status, ... } object describing the outcome.
   */
  async function checkAndDownload(opts) {
    const trigger = opts?.trigger || "auto";
    const force = Boolean(opts?.force);

    if (!isNativeCapacitor()) {
      log("skip web-runtime", { trigger });
      return result("web");
    }

    const updater = getUpdaterPlugin();
    if (!updater?.download || !updater?.next || !updater?.current) {
      log("skip plugin-incomplete", { trigger });
      return result("plugin-incomplete");
    }

    let online = true;
    try {
      online = navigator.onLine !== false;
    } catch (_) {}
    if (!online && !force) {
      log("skip offline", { trigger });
      return result("offline");
    }

    // Never run around sunrise/sunset — retry on the next resume/online tick.
    // The force path (test button) intentionally bypasses this.
    if (!force && isWithinAgnihotraBlackout()) {
      log("skip agnihotra-blackout", { trigger });
      return result("blackout");
    }

    const lastCheck = Number(readStorage(LAST_CHECK_KEY) || 0);
    if (
      !force &&
      Number.isFinite(lastCheck) &&
      Date.now() - lastCheck < MIN_CHECK_INTERVAL_MS
    ) {
      log("skip throttled", { trigger });
      return result("throttled");
    }

    const state = await getCurrentState(updater);

    // Reconcile: if a previously queued bundle has now booted, clear the flag.
    const pending = readStorage(PENDING_VERSION_KEY);
    if (pending && compareVersions(state.version, pending) >= 0) {
      removeStorage(PENDING_VERSION_KEY);
      writeStorage(APPLIED_VERSION_KEY, state.version);
      log("pending-applied", { version: state.version });
    }

    const manifest = await fetchManifest();
    if (!manifest || !manifest.version || !manifest.url) {
      log("no-manifest", { trigger });
      return result("no-manifest");
    }
    writeStorage(LAST_CHECK_KEY, String(Date.now()));

    // Don't re-download a version that's already queued for next launch.
    const stillPending = readStorage(PENDING_VERSION_KEY);
    if (stillPending && compareVersions(manifest.version, stillPending) <= 0) {
      log("already-queued", { version: stillPending });
      return result("already-queued", { version: stillPending });
    }

    // Already on (or ahead of) the published version.
    if (compareVersions(manifest.version, state.version) <= 0) {
      log("up-to-date", { current: state.version, latest: manifest.version });
      return result("up-to-date", { current: state.version, latest: manifest.version });
    }

    // Guard: a bundle that needs a newer NATIVE shell (new plugin / permission)
    // must not be applied to an older APK, or it could break. Ship a new APK
    // first; only then will manifest.minNative <= native allow the OTA.
    if (manifest.minNative && compareVersions(manifest.minNative, state.native) > 0) {
      log("blocked-needs-new-apk", {
        minNative: manifest.minNative,
        native: state.native,
      });
      return result("blocked-needs-new-apk", {
        minNative: manifest.minNative,
        native: state.native,
      });
    }

    let bundle = null;
    try {
      // Downloads to local storage WITHOUT activating. Safe to fail.
      bundle = await updater.download({
        version: String(manifest.version),
        url: String(manifest.url),
        ...(manifest.checksum ? { checksum: String(manifest.checksum) } : {}),
      });
    } catch (error) {
      log("download-failed", { message: error?.message || String(error) });
      return result("download-failed", { message: error?.message || String(error) });
    }

    if (!bundle || !bundle.id) {
      log("download-no-bundle");
      return result("download-failed", { message: "no bundle returned" });
    }

    try {
      // Queue for the NEXT natural background/restart. Does not touch the
      // current session — the user keeps using the app uninterrupted.
      await updater.next({ id: bundle.id });
      writeStorage(PENDING_VERSION_KEY, String(manifest.version));
      log("queued-for-next-launch", { version: manifest.version, id: bundle.id });

      // Defensive second layer: if a ritual window starts soon, hold the
      // queued bundle until after it ends, so even backgrounding mid-ritual
      // can't swap the bundle. Plain background-apply otherwise.
      const holdUntil = imminentBlackoutEndISO(90 * 60 * 1000);
      if (holdUntil && updater.setMultiDelay) {
        try {
          await updater.setMultiDelay({
            delayConditions: [
              { kind: "date", value: holdUntil },
              { kind: "background" },
            ],
          });
          log("apply-delayed-past-ritual", { until: holdUntil });
        } catch (delayError) {
          log("set-delay-failed", {
            message: delayError?.message || String(delayError),
          });
        }
      }
      return result("queued", { version: manifest.version, heldUntil: holdUntil || null });
    } catch (error) {
      log("next-failed", { message: error?.message || String(error) });
      return result("next-failed", { message: error?.message || String(error) });
    }
  }

  /**
   * Manual test trigger — ignores throttle + Agnihotra blackout. Still queues
   * via next() (no immediate reload). Returns the outcome for UI display.
   */
  async function forceCheck() {
    log("force-check requested");
    try {
      return await checkAndDownload({ trigger: "manual-force", force: true });
    } catch (error) {
      log("force-check-error", { message: error?.message || String(error) });
      return result("error", { message: error?.message || String(error) });
    }
  }

  function scheduleFirstCheck() {
    const kickoff = () => {
      setTimeout(() => {
        checkAndDownload({ trigger: "startup" }).catch(() => {});
      }, CHECK_START_DELAY_MS);
    };
    try {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(kickoff, { timeout: 4000 });
      } else {
        kickoff();
      }
    } catch (_) {
      kickoff();
    }
  }

  function listenForResume() {
    try {
      const App = window.Capacitor?.Plugins?.App;
      App?.addListener?.("appStateChange", (state) => {
        if (state && state.isActive) {
          checkAndDownload({ trigger: "resume" }).catch(() => {});
        }
      });
    } catch (_) {}
    try {
      window.addEventListener("online", () => {
        checkAndDownload({ trigger: "online" }).catch(() => {});
      });
    } catch (_) {}
  }

  function start() {
    if (started) return;
    started = true;

    // Rollback protection first, on every page, as early as possible.
    notifyReady();

    if (!isNativeCapacitor()) {
      log("idle (web runtime)");
      return;
    }

    scheduleFirstCheck();
    listenForResume();
  }

  const api = {
    isNativeCapacitor,
    notifyReady,
    checkAndDownload,
    forceCheck,
    start,
  };
  window.AgnihotraOTA = api;
  // Backwards-compatible aliases for any code that referenced the old module.
  window.AgnihotraCapgo = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
