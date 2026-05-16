(() => {
  const shared = window.AgnihotraNotificationShared;
  const web = window.AgnihotraNotificationWeb;
  const native = window.AgnihotraNotificationNative;
  let permissionRequestInFlight = null;
  let gestureRetryBound = false;

  async function requestPermission(options = {}) {
    const { force = false } = options;

    if (permissionRequestInFlight) {
      return permissionRequestInFlight;
    }

    if (shared.notificationPermissionRequested && !force) {
      return true;
    }

    permissionRequestInFlight = (async () => {
      try {
        let granted;
        if (shared.isCapacitorNativeRuntime()) {
          granted = await native.requestCapacitorPermission({ forcePrompt: force });
        } else {
          granted = await web.requestWebPermission();
        }
        shared.notificationPermissionRequested = true;
        return Boolean(granted);
      } finally {
        permissionRequestInFlight = null;
      }
    })();

    return permissionRequestInFlight;
  }

  function bindSingleGesturePermissionRetry() {
    if (gestureRetryBound) return;
    gestureRetryBound = true;

    const retry = () => {
      requestPermission({ force: true });
      gestureRetryBound = false;
    };

    // One-time retry for platforms that prefer a user gesture.
    window.addEventListener("pointerdown", retry, { once: true, passive: true });
    window.addEventListener("keydown", retry, { once: true });
  }

  async function ensurePermissionBootstrap() {
    if (shared.isCapacitorNativeRuntime()) {
      await native.ensureCapacitorChannel();
    }
    const granted = await requestPermission();
    if (!granted) {
      bindSingleGesturePermissionRetry();
    }
    return granted;
  }

  async function getPermissionStatus() {
    try {
      if (shared.isCapacitorNativeRuntime()) {
        const localNotifications = shared.getCapacitorLocalNotifications();
        if (!localNotifications) return "unavailable";
        const current = await localNotifications.checkPermissions();
        return current?.display || "unknown";
      }
      if (!("Notification" in window)) return "unavailable";
      return Notification.permission || "default";
    } catch (_) {
      return "unknown";
    }
  }

  async function show(title, body, tag) {
    if (shared.isCapacitorNativeRuntime()) {
      return native.showNativeNotification(title, body, tag);
    }
    return web.showWebNotification(title, body, tag);
  }

  function setup() {
    ensurePermissionBootstrap();
  }

  async function test() {
    const granted = await requestPermission();
    if (!granted) {
      console.warn("Notification permission not granted.");
      return false;
    }

    await show(
      "Agnihotra test notification",
      "Notifications are working on this device/browser.",
      "agnihotra-test-notification"
    );
    return true;
  }

  async function scheduleUpcomingReminders(events, options = 10) {
    if (!shared.isCapacitorNativeRuntime()) return;
    return native.scheduleUpcomingReminders(events, options);
  }

  async function scheduleTestReminder(options = {}) {
    if (shared.isCapacitorNativeRuntime()) {
      return native.scheduleTestReminder(options);
    }

    const safeDelaySeconds = Math.max(3, Number(options.delaySeconds) || 30);
    const title = options.title || "Test reminder";
    const body = options.body || "Reminder check";
    const tag = options.tag || "agnihotra-test-reminder";

    setTimeout(() => {
      show(title, body, `${tag}-${Date.now()}`);
    }, safeDelaySeconds * 1000);
    return true;
  }

  window.AgnihotraNotifications = {
    requestPermission,
    getPermissionStatus,
    ensurePermissionBootstrap,
    show,
    setup,
    test,
    scheduleUpcomingReminders,
    scheduleTestReminder,
  };

  window.testNotification = test;
})();
