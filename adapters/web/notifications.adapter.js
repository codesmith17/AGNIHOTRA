(() => {
  const shared = window.AgnihotraNotificationShared;

  async function requestWebPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    if (shared.notificationPermissionRequested) return false;

    shared.notificationPermissionRequested = true;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.warn("Notification permission request failed:", error);
      return false;
    }
  }

  async function showWebNotification(title, body, tag) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    shared.showInAppAlertToast(title, body);

    const options = {
      body,
      tag,
      renotify: true,
      icon: "assets/images/app-icon.png",
      badge: "assets/images/app-icon.png",
      vibrate: [300, 200, 300],
      requireInteraction: true,
    };

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    } catch (error) {
      console.warn("Service worker notification failed:", error);
    }

    try {
      new Notification(title, options);
    } catch (error) {
      console.warn("Notification failed:", error);
    }
  }

  window.AgnihotraNotificationWeb = {
    requestWebPermission,
    showWebNotification,
  };
})();
