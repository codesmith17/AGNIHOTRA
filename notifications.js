(() => {
  let notificationPermissionRequested = false;

  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    if (notificationPermissionRequested) return false;

    notificationPermissionRequested = true;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (error) {
      console.warn("Notification permission request failed:", error);
      return false;
    }
  }

  function showInAppAlertToast(title, body) {
    if (document.visibilityState !== "visible") return;

    let container = document.getElementById("agnihotra-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "agnihotra-toast-container";
      container.style.position = "fixed";
      container.style.top = "16px";
      container.style.right = "16px";
      container.style.zIndex = "9999";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";
      container.style.maxWidth = "320px";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.style.background = "rgba(20, 20, 20, 0.92)";
    toast.style.color = "#fff";
    toast.style.border = "1px solid rgba(255,255,255,0.16)";
    toast.style.borderRadius = "12px";
    toast.style.padding = "12px 14px";
    toast.style.boxShadow = "0 8px 26px rgba(0,0,0,0.35)";
    toast.style.fontFamily = "Montserrat, sans-serif";
    toast.style.transform = "translateY(-8px)";
    toast.style.opacity = "0";
    toast.style.transition = "all 220ms ease";
    toast.innerHTML = `<div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">${title}</div><div style="font-size:0.85rem; opacity:0.92;">${body}</div>`;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-8px)";
      setTimeout(() => toast.remove(), 250);
    }, 6500);
  }

  async function show(title, body, tag) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // In-app fallback so alerts are visible even when OS shows panel-only notifications.
    showInAppAlertToast(title, body);

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

  function setup() {
    // Initial attempt may be ignored by some browsers until user gesture.
    requestPermission();
    ["click", "touchstart", "mousedown", "keydown"].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        requestPermission();
      });
    });
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

  window.AgnihotraNotifications = {
    requestPermission,
    show,
    setup,
    test,
  };

  // Backward-compatible test helper in browser console
  window.testNotification = test;
})();
