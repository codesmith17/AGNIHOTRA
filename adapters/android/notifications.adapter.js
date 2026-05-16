(() => {
  const shared = window.AgnihotraNotificationShared;
  const REMINDER_CATCHUP_DELAY_MS = 3000;

  function logNotify(message, meta = {}) {
    let serialized = "";
    try {
      serialized = JSON.stringify(meta ?? {});
    } catch (_) {
      serialized = String(meta);
    }
    console.log(`[AGNIHOTRA][NOTIFY] ${message} ${serialized}`);
  }

  async function ensureCapacitorChannel() {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return;
    try {
      logNotify("channel-create-start", {
        channelId: shared.CAPACITOR_CHANNEL_ID,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
      });
      await localNotifications.createChannel({
        id: shared.CAPACITOR_CHANNEL_ID,
        name: "Agnihotra Reminders",
        description: "Sunrise and sunset reminders",
        importance: 5,
        visibility: 1,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        vibration: true,
      });
      logNotify("channel-create-done", {
        channelId: shared.CAPACITOR_CHANNEL_ID,
      });
    } catch (error) {
      console.warn("Capacitor channel setup skipped:", error);
    }
  }

  async function requestCapacitorPermission(options = {}) {
    const { forcePrompt = false } = options;
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return false;
    try {
      const current = await localNotifications.checkPermissions();
      logNotify("permission-check", { ...(current || {}), forcePrompt });
      if (current.display === "granted") return true;
      if (current.display === "denied" && !forcePrompt) return false;
      const requested = await localNotifications.requestPermissions();
      logNotify("permission-request-result", requested || {});
      return requested.display === "granted";
    } catch (error) {
      console.warn("Capacitor notification permission failed:", error);
      return false;
    }
  }

  async function ensureExactAlarmSupport(localNotifications) {
    if (!localNotifications) return;
    if (
      typeof localNotifications.checkExactNotificationSetting !== "function" ||
      typeof localNotifications.changeExactNotificationSetting !== "function"
    ) {
      return;
    }

    try {
      const exact = await localNotifications.checkExactNotificationSetting();
      const exactValue = exact?.value || exact?.exact_alarm;
      return exactValue === "granted";
    } catch (error) {
      // Not fatal: some Android versions/devices don't expose this flow.
      console.warn("Exact alarm setting check skipped:", error);
      return false;
    }
  }

  async function showNativeNotification(title, body, tag) {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return;
    const granted = await requestCapacitorPermission();
    if (!granted) return;
    await ensureCapacitorChannel();

    shared.showInAppAlertToast(title, body);

    try {
      logNotify("show-immediate-native", {
        tag,
        channelId: shared.CAPACITOR_CHANNEL_ID,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
      });
      await localNotifications.schedule({
        notifications: [
          {
            id: shared.toCapacitorNotificationId(`immediate-${tag}`),
            title,
            body,
            schedule: {
              at: new Date(Date.now() + 100),
              allowWhileIdle: true,
            },
            channelId: shared.CAPACITOR_CHANNEL_ID,
            group: shared.CAPACITOR_NOTIFICATION_GROUP,
            sound: shared.CAPACITOR_NOTIFICATION_SOUND,
            extra: { tag },
          },
        ],
      });
    } catch (error) {
      console.warn("Capacitor immediate notification failed:", error);
    }
  }

  async function scheduleUpcomingReminders(events, options = 10) {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!shared.isCapacitorNativeRuntime() || !localNotifications) return;

    const granted = await requestCapacitorPermission();
    if (!granted || !Array.isArray(events) || events.length === 0) return;
    await ensureCapacitorChannel();

    const now = Date.now();
    const leadMinutes =
      typeof options === "number"
        ? options
        : Number(options?.leadMinutes || 10);
    const replaceExisting =
      typeof options === "object" ? options?.replaceExisting !== false : true;
    const reminderLeadMs = leadMinutes * 60 * 1000;

    if (replaceExisting) {
      try {
        const pending = await localNotifications.getPending();
        const reminderIds = (pending.notifications || [])
          .filter(
            (n) =>
              n?.group === shared.CAPACITOR_NOTIFICATION_GROUP ||
              String(n?.extra?.tag || "").includes("native-reminder")
          )
          .map((n) => ({ id: n.id }));
        if (reminderIds.length > 0) {
          await localNotifications.cancel({ notifications: reminderIds });
        }
      } catch (error) {
        console.warn("Unable to clear previous native reminders:", error);
      }
    }

    const notifications = events
      .flatMap((event) => {
        const reminderAt = Number(event.time) - reminderLeadMs;
        if (!Number.isFinite(reminderAt)) return [];
        const eventTime = Number(event.time);
        if (!Number.isFinite(eventTime)) return [];

        const missedReminderButEventUpcoming =
          reminderAt <= now + 5000 && eventTime > now + 15000;
        if (reminderAt <= now + 5000 && !missedReminderButEventUpcoming) return [];

        const firstFireAt = missedReminderButEventUpcoming
          ? now + REMINDER_CATCHUP_DELAY_MS
          : reminderAt;
        const tag = `native-reminder-${event.id}-${event.time}-pre${leadMinutes}`;
        return {
          id: shared.toCapacitorNotificationId(tag),
          title: event.reminderTitle || "Agnihotra reminder",
          body:
            event.reminderBody || `${event.label} starts in ${leadMinutes} minutes.`,
          schedule: {
            at: new Date(firstFireAt),
            allowWhileIdle: true,
          },
          channelId: shared.CAPACITOR_CHANNEL_ID,
          group: shared.CAPACITOR_NOTIFICATION_GROUP,
          sound: shared.CAPACITOR_NOTIFICATION_SOUND,
          extra: {
            tag,
            eventId: event.id,
            eventTime,
            catchUp: missedReminderButEventUpcoming,
          },
        };
      })
      .filter(Boolean);

    if (notifications.length === 0) return;

    try {
      logNotify("schedule-upcoming-native", {
        count: notifications.length,
        channelId: shared.CAPACITOR_CHANNEL_ID,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        firstTag: notifications[0]?.extra?.tag || null,
      });
      await localNotifications.schedule({ notifications });
    } catch (error) {
      console.warn("Failed to schedule native reminders:", error);
    }
  }

  async function scheduleTestReminder({
    delaySeconds = 30,
    title = "Test reminder",
    body = "Reminder check",
    tag = "agnihotra-test-reminder",
  } = {}) {
    const safeDelaySeconds = Math.max(1, Number(delaySeconds) || 30);
    const scheduleAt = new Date(Date.now() + safeDelaySeconds * 1000);

    if (!shared.isCapacitorNativeRuntime()) return false;
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return false;
    const granted = await requestCapacitorPermission();
    if (!granted) return false;
    await ensureCapacitorChannel();

    try {
      const notification = {
        id: shared.toCapacitorNotificationId(`${tag}-${Date.now()}`),
        title,
        body,
        schedule: { at: scheduleAt, allowWhileIdle: true },
        channelId: shared.CAPACITOR_CHANNEL_ID,
        group: shared.CAPACITOR_NOTIFICATION_GROUP,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        extra: { tag },
      };
      logNotify("schedule-test-native", {
        tag,
        scheduleAt: scheduleAt.toISOString(),
        channelId: shared.CAPACITOR_CHANNEL_ID,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
      });
      await localNotifications.schedule({
        notifications: [notification],
      });
      return true;
    } catch (error) {
      console.warn("Failed to schedule native test reminder:", error);
      return false;
    }
  }

  window.AgnihotraNotificationNative = {
    ensureCapacitorChannel,
    requestCapacitorPermission,
    ensureExactAlarmSupport,
    showNativeNotification,
    scheduleUpcomingReminders,
    scheduleTestReminder,
  };
})();
