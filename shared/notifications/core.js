(() => {
  window.AgnihotraNotificationShared = {
    // Bump channel id when changing Android channel sound settings (Android keeps channels immutable).
    CAPACITOR_CHANNEL_ID: "agnihotra-reminders-bell-v4",
    CAPACITOR_WEAR_CHANNEL_ID: "agnihotra-watch-nudge-v1",
    CAPACITOR_NOTIFICATION_GROUP: "agnihotra-reminder",
    // Android custom sound should be a filename from android/app/src/main/res/raw without extension.
    CAPACITOR_NOTIFICATION_SOUND: "agnihotra_bell_3x",
    notificationPermissionRequested: false,

    isCapacitorNativeRuntime() {
      return Boolean(
        window.Capacitor?.isNativePlatform &&
          window.Capacitor.isNativePlatform()
      );
    },

    getCapacitorLocalNotifications() {
      return window.Capacitor?.Plugins?.LocalNotifications || null;
    },

    toCapacitorNotificationId(tag) {
      let hash = 0;
      for (let i = 0; i < tag.length; i += 1) {
        hash = (hash * 31 + tag.charCodeAt(i)) | 0;
      }
      return (Math.abs(hash) % 1000000000) + 1000;
    },

    showInAppAlertToast(title, body) {
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
    },
  };
})();
