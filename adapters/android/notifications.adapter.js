(() => {
  const shared = window.AgnihotraNotificationShared;
  const REMINDER_LEAD_STORAGE_KEY = "agnihotra_reminder_lead_v1";
  const REMINDER_VIBRATE_STORAGE_KEY = "agnihotra_reminder_vibrate_v1";
  const DEFAULT_LEAD_MINUTES = 15;
  const STRICT_SCHEDULE_GRACE_MS = 1500;

  function getReminderLeadMinutes() {
    try {
      const saved = localStorage.getItem(REMINDER_LEAD_STORAGE_KEY);
      if (saved === null) return DEFAULT_LEAD_MINUTES;
      const val = parseInt(saved, 10);
      if (isNaN(val)) return DEFAULT_LEAD_MINUTES;
      // Clamp to 2-60 mins as per requirements.
      return Math.max(2, Math.min(60, val));
    } catch (_) {
      return DEFAULT_LEAD_MINUTES;
    }
  }

  let observersBound = false;
  const seenPostedNotificationIds = new Set();

  function getBooleanSetting(key, defaultValue) {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return defaultValue;
      return saved === "true";
    } catch (_) {
      return defaultValue;
    }
  }

  function isReminderVibrationEnabled() {
    return getBooleanSetting(REMINDER_VIBRATE_STORAGE_KEY, true);
  }

  function getReminderChannelId() {
    return `${shared.CAPACITOR_CHANNEL_ID}-${isReminderVibrationEnabled() ? "vibrate" : "silent"}`;
  }

  // Native plugin that renders reminders with the app's modern notification
  // theme (custom RemoteViews + DecoratedCustomViewStyle), matching the
  // lock-screen countdown. When present we post reminders through it instead of
  // the stock Capacitor render; it posts on the SAME reminder channel created
  // here, so the configured custom sound / vibration / importance are inherited.
  function getStyledReminderPlugin() {
    const plugin = window.Capacitor?.Plugins?.AgnihotraReminder;
    return plugin && typeof plugin.scheduleStyledReminders === "function"
      ? plugin
      : null;
  }

  function shortEventLabel(event = {}) {
    const label = String(event.label || "").trim();
    const lower = label.toLowerCase();
    if (lower.includes("sunrise")) return "Sunrise";
    if (lower.includes("sunset")) return "Sunset";
    return label || "Agnihotra";
  }

  // Maps an event + lead time onto the styled layout's three-line hierarchy:
  // a short uppercase eyebrow, a light-weight hero title, and a muted subline.
  function toStyledReminder(event, id, atMs, leadMinutes) {
    const label = shortEventLabel(event);
    const minuteWord = leadMinutes === 1 ? "minute" : "minutes";
    const heroTitle =
      event.reminderTitle && event.reminderTitle !== "Agnihotra reminder"
        ? event.reminderTitle
        : `Starts in ${leadMinutes} ${minuteWord}`;
    const body =
      event.reminderBody || `${label} begins in ${leadMinutes} ${minuteWord}.`;
    return {
      id,
      atMs,
      eyebrow: `${label} reminder`,
      title: heroTitle,
      body,
    };
  }

  // Best-effort removal of any pending Capacitor-rendered reminders so the
  // native styled path never double-posts alongside legacy stock reminders.
  async function clearPendingCapacitorReminders() {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return;
    try {
      const pending = await localNotifications.getPending();
      const toCancel = (pending.notifications || [])
        .filter((n) => {
          const tagStr = String(n?.extra?.tag || "");
          return (
            n?.group === shared.CAPACITOR_NOTIFICATION_GROUP ||
            tagStr.includes("native-reminder") ||
            tagStr.includes("agnihotra")
          );
        })
        .map((n) => ({ id: n.id }));
      if (toCancel.length > 0) {
        await localNotifications.cancel({ notifications: toCancel });
      }
    } catch (error) {
      console.warn("Unable to clear pending Capacitor reminders:", error);
    }
  }

  // Serialize schedule/cancel operations so concurrent callers can't create
  // duplicate notifications (cache-hit path + fast path + background 3-month).
  let schedulingMutex = Promise.resolve();
  function runExclusively(taskFn) {
    const next = schedulingMutex.then(() => taskFn()).catch((error) => {
      console.warn("Scheduling task failed:", error);
    });
    schedulingMutex = next;
    return next;
  }

  function isReminderNotification(notification = {}) {
    const tagStr = String(notification?.extra?.tag || "");
    return (
      notification?.group === shared.CAPACITOR_NOTIFICATION_GROUP ||
      tagStr.includes("native-reminder") ||
      tagStr.includes("agnihotra-test-reminder")
    );
  }

  async function countPendingReminders() {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications?.getPending) return 0;
    try {
      const pending = await localNotifications.getPending();
      const list = pending?.notifications || [];
      return list.filter((notification) => isReminderNotification(notification)).length;
    } catch (_) {
      return 0;
    }
  }

  function logNotify(message, meta = {}) {
    let serialized = "";
    try {
      serialized = JSON.stringify(meta ?? {});
    } catch (_) {
      serialized = String(meta);
    }
    console.log(`[AGNIHOTRA][NOTIFY] ${message} ${serialized}`);
    try {
      window.AgnihotraDiagnostics?.captureBreadcrumb?.(
        "notify",
        message,
        meta || {},
        "info"
      );
    } catch (_) {}
  }

  function logVibrate(event, meta = {}, level = "info") {
    let serialized = "";
    try {
      serialized = JSON.stringify(meta ?? {});
    } catch (_) {
      serialized = String(meta);
    }
    const line = `[AGNIHOTRA][VIBRATE] ${event} ${serialized}`;
    if (level === "error" || level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
    try {
      window.AgnihotraDiagnostics?.captureBreadcrumb?.(
        "vibrate",
        event,
        meta || {},
        level
      );
    } catch (_) {}
    if (level === "error") {
      try {
        window.AgnihotraDiagnostics?.captureMessage?.(event, "warning", meta || {});
      } catch (_) {}
    }
  }

  async function verifyReminderChannelVibration(localNotifications, channelId, expected) {
    if (!localNotifications?.listChannels) {
      return { ok: false, reason: "listChannels-unavailable", expected };
    }
    try {
      const listed = await localNotifications.listChannels();
      const channels = listed?.channels || [];
      const match = channels.find((ch) => ch.id === channelId);
      if (!match) {
        return { ok: false, reason: "channel-not-found", channelId, expected };
      }
      const actual = Boolean(match.vibration);
      const ok = actual === Boolean(expected);
      return {
        ok,
        reason: ok ? "channel-vibration-match" : "channel-vibration-mismatch",
        channelId,
        expected,
        actual,
      };
    } catch (error) {
      return {
        ok: false,
        reason: "listChannels-failed",
        channelId,
        expected,
        error: error?.message || String(error),
      };
    }
  }

  function emitOsDeliveryDiagnostics(eventName, payload = {}, level = "info") {
    try {
      window.AgnihotraDiagnostics?.captureMessage?.(eventName, level, payload);
    } catch (_) {}
    try {
      window.AgnihotraDiagnostics?.captureBreadcrumb?.(
        "notify-os",
        eventName,
        payload || {},
        level
      );
    } catch (_) {}
  }

  function normalizeNotificationPayload(notification = {}) {
    const extra = notification?.extra || {};
    return {
      notificationId: Number(notification?.id || 0) || null,
      title: notification?.title || null,
      channelId: notification?.channelId || null,
      tag: extra?.tag || null,
      eventId: extra?.eventId || null,
      eventTime: Number(extra?.eventTime || 0) || null,
      catchUp: Boolean(extra?.catchUp),
      wearNudge: Boolean(extra?.wearNudge),
      source: "localNotificationReceived",
    };
  }

  function setupNativeNotificationObservers() {
    if (observersBound) return;
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!shared.isCapacitorNativeRuntime() || !localNotifications?.addListener) return;
    observersBound = true;

    localNotifications.addListener("localNotificationReceived", (event) => {
      const notification = event?.notification || {};
      const payload = normalizeNotificationPayload(notification);
      const dedupeKey = String(payload.notificationId || "") + "::" + String(payload.tag || "");
      if (seenPostedNotificationIds.has(dedupeKey)) return;
      seenPostedNotificationIds.add(dedupeKey);
      if (seenPostedNotificationIds.size > 200) {
        seenPostedNotificationIds.clear();
        seenPostedNotificationIds.add(dedupeKey);
      }

      logNotify("notification-posted-by-os", payload);
      emitOsDeliveryDiagnostics("notification-posted-by-os", payload, "info");
      const vibrationEnabled = isReminderVibrationEnabled();
      const expectedChannelId = getReminderChannelId();
      emitOsDeliveryDiagnostics(
        "sound-attempted",
        {
          ...payload,
          expectedSound: shared.CAPACITOR_NOTIFICATION_SOUND,
          expectedChannelId,
          expectedVibration: vibrationEnabled,
          note: "OS handles actual playback policy and may suppress during call/DND.",
        },
        "info"
      );
      const channelMatches =
        !payload.channelId || payload.channelId === expectedChannelId;
      const vibrationLikelyOk =
        vibrationEnabled && channelMatches && payload.channelId;
      logVibrate(
        vibrationLikelyOk ? "reminder-fired-vibration-expected" : "reminder-fired-vibration-skipped",
        {
          notificationId: payload.notificationId,
          tag: payload.tag,
          channelId: payload.channelId,
          expectedChannelId,
          vibrationEnabled,
          channelMatches,
          note: vibrationEnabled
            ? "Vibration requested on channel; OS may still mute (DND, silent mode, battery saver)."
            : "Vibration disabled in app settings or wrong channel.",
        },
        vibrationLikelyOk ? "info" : "warn"
      );
      try {
        window.AgnihotraInstrumentation?.recordReminderFired?.(payload);
      } catch (_) {}
    });

    localNotifications.addListener("localNotificationActionPerformed", (event) => {
      const notification = event?.notification || {};
      const payload = normalizeNotificationPayload(notification);
      payload.source = "localNotificationActionPerformed";
      payload.actionId = event?.actionId || null;
      logNotify("notification-action-performed", payload);
      emitOsDeliveryDiagnostics("notification-action-performed", payload, "info");
    });
  }

  async function ensureCapacitorChannel() {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return;
    const reminderChannelId = getReminderChannelId();
    const vibrationEnabled = isReminderVibrationEnabled();
    try {
      // Delete old channels (including the retired watch-nudge channel) to ensure
      // a clean state and single-notification behavior.
      try {
        const channels = await localNotifications.listChannels();
        for (const ch of channels.channels || []) {
          if (ch.id.includes("agnihotra") && ch.id !== reminderChannelId) {
            await localNotifications.deleteChannel({ id: ch.id });
          }
        }
      } catch (e) {
        console.warn("Failed to cleanup old channels:", e);
      }

      logVibrate("channel-create-start", {
        channelId: reminderChannelId,
        vibrationRequested: vibrationEnabled,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
      });
      await localNotifications.createChannel({
        id: reminderChannelId,
        name: "Agnihotra Reminders",
        description: "Sunrise and sunset reminders",
        importance: 5,
        visibility: 1,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        vibration: vibrationEnabled,
      });
      const verify = await verifyReminderChannelVibration(
        localNotifications,
        reminderChannelId,
        vibrationEnabled
      );
      if (verify.ok) {
        logVibrate("channel-create-success", verify);
      } else {
        logVibrate("channel-create-verify-failed", verify, "warn");
      }
    } catch (error) {
      logVibrate(
        "channel-create-failed",
        {
          channelId: reminderChannelId,
          vibrationRequested: vibrationEnabled,
          error: error?.message || String(error),
        },
        "error"
      );
      console.warn("Capacitor channel setup skipped:", error);
      window.AgnihotraDiagnostics?.captureException?.(
        error,
        "notify-channel-setup",
        { channelId: reminderChannelId, vibrationEnabled }
      );
    }
  }

  async function requestCapacitorPermission(options = {}) {
    const { forcePrompt = false } = options;
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return false;
    try {
      const current = await localNotifications.checkPermissions();
      logNotify("permission-check", { ...(current || {}), forcePrompt });
      if (current.display === "granted") {
        window.AgnihotraInstrumentation?.recordPermissionResult?.("notifications", "granted");
        return true;
      }
      if (current.display === "denied" && !forcePrompt) {
        window.AgnihotraInstrumentation?.recordPermissionResult?.("notifications", "denied-no-prompt");
        return false;
      }
      const requested = await localNotifications.requestPermissions();
      logNotify("permission-request-result", requested || {});
      window.AgnihotraInstrumentation?.recordPermissionResult?.(
        "notifications",
        requested?.display === "granted" ? "granted" : "denied",
        requested || {}
      );
      return requested.display === "granted";
    } catch (error) {
      console.warn("Capacitor notification permission failed:", error);
      window.AgnihotraDiagnostics?.captureException?.(
        error,
        "notify-permission-request"
      );
      return false;
    }
  }

  async function showNativeNotification(title, body, tag) {
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return;
    const granted = await requestCapacitorPermission();
    if (!granted) return;
    await ensureCapacitorChannel();
    const reminderChannelId = getReminderChannelId();

    shared.showInAppAlertToast(title, body);

    try {
      logNotify("show-immediate-native", {
        tag,
        channelId: reminderChannelId,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        vibration: isReminderVibrationEnabled(),
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
            channelId: reminderChannelId,
            group: shared.CAPACITOR_NOTIFICATION_GROUP,
            sound: shared.CAPACITOR_NOTIFICATION_SOUND,
            smallIcon: "ic_stat_notify",
            iconColor: "#B87333",
            extra: { tag },
          },
        ],
      });
    } catch (error) {
      console.warn("Capacitor immediate notification failed:", error);
      window.AgnihotraDiagnostics?.captureException?.(
        error,
        "notify-immediate-schedule",
        { tag }
      );
    }
  }

  async function scheduleUpcomingReminders(events, options = 15) {
    return runExclusively(async () => {
      const localNotifications = shared.getCapacitorLocalNotifications();
      if (!shared.isCapacitorNativeRuntime() || !localNotifications) return;

      const granted = await requestCapacitorPermission();
      if (!granted || !Array.isArray(events) || events.length === 0) return;
      await ensureCapacitorChannel();
      const currentLeadMinutes = getReminderLeadMinutes();
      const reminderChannelId = getReminderChannelId();
      const vibrationEnabled = isReminderVibrationEnabled();

      const now = Date.now();
      const replaceExisting =
        typeof options === "object" ? options?.replaceExisting !== false : true;
      const reminderLeadMs = currentLeadMinutes * 60 * 1000;

      // Preferred path: render reminders natively with the app's notification
      // theme. Same lead-time math and strict (no catch-up) policy as below.
      const styledPlugin = getStyledReminderPlugin();
      if (styledPlugin) {
        const styledSeen = new Set();
        const styledReminders = events
          .flatMap((event) => {
            const eventTime = Number(event.time);
            if (!Number.isFinite(eventTime)) return [];
            const reminderAt = eventTime - reminderLeadMs;
            if (!Number.isFinite(reminderAt)) return [];
            if (reminderAt <= now + STRICT_SCHEDULE_GRACE_MS) return [];
            const tag = `native-reminder-${event.id}-${event.time}-pre${currentLeadMinutes}`;
            const id = shared.toCapacitorNotificationId(tag);
            if (styledSeen.has(id)) return [];
            styledSeen.add(id);
            return [toStyledReminder(event, id, reminderAt, currentLeadMinutes)];
          })
          .filter(Boolean);

        if (styledReminders.length === 0) {
          try {
            await styledPlugin.cancelStyledReminders();
          } catch (_) {}
          return;
        }

        await clearPendingCapacitorReminders();
        try {
          logNotify("schedule-upcoming-styled", {
            count: styledReminders.length,
            channelId: reminderChannelId,
            vibration: vibrationEnabled,
            leadMinutes: currentLeadMinutes,
            firstAt: new Date(styledReminders[0].atMs).toISOString(),
          });
          const res = await styledPlugin.scheduleStyledReminders({
            reminders: styledReminders,
            channelId: reminderChannelId,
            vibrate: vibrationEnabled,
          });
          window.AgnihotraReminderResilience?.markScheduled?.({
            count: styledReminders.length,
            channelId: reminderChannelId,
            source: "schedule-upcoming-styled",
          });
          window.AgnihotraInstrumentation?.recordReminderScheduled?.({
            count: res?.scheduled ?? styledReminders.length,
            channelId: reminderChannelId,
            leadMinutes: currentLeadMinutes,
            source: "schedule-upcoming-styled",
            firstAt: new Date(styledReminders[0].atMs).toISOString(),
            lastAt: new Date(
              styledReminders[styledReminders.length - 1].atMs
            ).toISOString(),
          });
        } catch (error) {
          console.warn("Failed to schedule styled reminders:", error);
          window.AgnihotraDiagnostics?.captureException?.(
            error,
            "notify-schedule-upcoming-styled",
            { count: styledReminders.length }
          );
        }
        return;
      }

      const seenIds = new Set();
      const notifications = events
        .flatMap((event) => {
          const reminderAt = Number(event.time) - reminderLeadMs;
          if (!Number.isFinite(reminderAt)) return [];
          const eventTime = Number(event.time);
          if (!Number.isFinite(eventTime)) return [];

          // Strict mode: never catch-up late. If exact lead-minute slot is gone,
          // skip scheduling this reminder instead of firing delayed.
          if (reminderAt <= now + STRICT_SCHEDULE_GRACE_MS) return [];
          const tag = `native-reminder-${event.id}-${event.time}-pre${currentLeadMinutes}`;
          const id = shared.toCapacitorNotificationId(tag);
          if (seenIds.has(id)) return [];
          seenIds.add(id);
          const primary = {
            id,
            title: event.reminderTitle || "Agnihotra reminder",
            body:
              event.reminderBody ||
              `${event.label} starts in ${currentLeadMinutes} minutes.`,
            schedule: {
              at: new Date(reminderAt),
              allowWhileIdle: true,
            },
            channelId: reminderChannelId,
            group: shared.CAPACITOR_NOTIFICATION_GROUP,
            sound: shared.CAPACITOR_NOTIFICATION_SOUND,
            smallIcon: "ic_stat_notify",
            iconColor: "#B87333",
            extra: {
              tag,
              eventId: event.id,
              eventTime,
              catchUp: false,
              strictLeadMinutes: currentLeadMinutes,
              vibrationEnabled,
            },
          };
          // A connected Wear OS watch automatically mirrors this primary
          // reminder, so we no longer post a separate companion notification
          // (it surfaced as a duplicate "Agnihotra" card on the phone).
          return [primary];
        })
        .filter(Boolean);

      if (notifications.length === 0) return;

      if (replaceExisting) {
        try {
          const pending = await localNotifications.getPending();
          const pendingReminderNotifications = (pending.notifications || []).filter((n) => {
            const tagStr = String(n?.extra?.tag || "");
            return (
              n?.group === shared.CAPACITOR_NOTIFICATION_GROUP ||
              tagStr.includes("native-reminder") ||
              tagStr.includes("agnihotra")
            );
          });
          const pendingIds = pendingReminderNotifications.map((n) => ({ id: n.id }));
          const pendingIdSet = new Set(pendingReminderNotifications.map((n) => Number(n.id)));
          const nextIdSet = new Set(notifications.map((n) => Number(n.id)));
          const scheduleIsIdentical =
            pendingIdSet.size === nextIdSet.size &&
            [...nextIdSet].every((id) => pendingIdSet.has(id));

          if (scheduleIsIdentical) {
            logNotify("schedule-upcoming-native-skipped-identical", {
              count: notifications.length,
              leadMinutes: currentLeadMinutes,
            });
            return;
          }

          if (pendingIds.length > 0) {
            logNotify("cancel-previous-native", { count: pendingIds.length });
            window.AgnihotraInstrumentation?.recordReminderCancelled?.({
              count: pendingIds.length,
              source: "schedule-upcoming-replace",
            });
            await localNotifications.cancel({ notifications: pendingIds });
          }
        } catch (error) {
          console.warn("Unable to clear previous native reminders:", error);
          window.AgnihotraDiagnostics?.captureException?.(
            error,
            "notify-cancel-previous"
          );
        }
      }

      try {
        logNotify("schedule-upcoming-native", {
          count: notifications.length,
          channelId: reminderChannelId,
          sound: shared.CAPACITOR_NOTIFICATION_SOUND,
          vibration: vibrationEnabled,
          leadMinutes: currentLeadMinutes,
          firstTag: notifications[0]?.extra?.tag || null,
        });
        logVibrate("schedule-upcoming", {
          ok: true,
          count: notifications.length,
          channelId: reminderChannelId,
          vibrationEnabled,
        });
        await localNotifications.schedule({ notifications });
        window.AgnihotraReminderResilience?.markScheduled?.({
          count: notifications.length,
          channelId: reminderChannelId,
          source: "schedule-upcoming-native",
        });
        window.AgnihotraInstrumentation?.recordReminderScheduled?.({
          count: notifications.length,
          channelId: reminderChannelId,
          leadMinutes: currentLeadMinutes,
          source: "schedule-upcoming-native",
          firstAt: notifications[0]?.schedule?.at
            ? new Date(notifications[0].schedule.at).toISOString()
            : null,
          lastAt: notifications[notifications.length - 1]?.schedule?.at
            ? new Date(notifications[notifications.length - 1].schedule.at).toISOString()
            : null,
        });
      } catch (error) {
        logVibrate(
          "schedule-upcoming-failed",
          {
            ok: false,
            vibrationEnabled,
            channelId: reminderChannelId,
            error: error?.message || String(error),
          },
          "error"
        );
        console.warn("Failed to schedule native reminders:", error);
        window.AgnihotraDiagnostics?.captureException?.(
          error,
          "notify-schedule-upcoming",
          { notifications: notifications.length }
        );
      }
    });
  }

  async function scheduleTestReminder({
    delaySeconds = 30,
    title = "Test reminder",
    body = "Reminder check",
    tag = "agnihotra-test-reminder",
  } = {}) {
    console.log(`[AGNIHOTRA] scheduleTestReminder native called: delay=${delaySeconds} title=${title}`);
    const safeDelaySeconds = Math.max(1, Number(delaySeconds) || 30);
    const scheduleAt = new Date(Date.now() + safeDelaySeconds * 1000);

    if (!shared.isCapacitorNativeRuntime()) return false;
    const localNotifications = shared.getCapacitorLocalNotifications();
    if (!localNotifications) return false;
    const granted = await requestCapacitorPermission();
    if (!granted) return false;
    await ensureCapacitorChannel();
    const reminderChannelId = getReminderChannelId();
    const vibrationEnabled = isReminderVibrationEnabled();

    // Preferred path: themed native reminder, same look as scheduled reminders.
    const styledPlugin = getStyledReminderPlugin();
    if (styledPlugin) {
      const id = shared.toCapacitorNotificationId(`${tag}-${Date.now()}`);
      try {
        logNotify("schedule-test-styled", {
          tag,
          scheduleAt: scheduleAt.toISOString(),
          channelId: reminderChannelId,
          vibration: vibrationEnabled,
        });
        await styledPlugin.scheduleStyledTestReminder({
          id,
          atMs: scheduleAt.getTime(),
          eyebrow: "Agnihotra · Test",
          title: title || "Test reminder",
          body: body || "Reminder check",
          channelId: reminderChannelId,
          vibrate: vibrationEnabled,
        });
        window.AgnihotraInstrumentation?.recordReminderScheduled?.({
          count: 1,
          channelId: reminderChannelId,
          source: "schedule-test-styled",
          tag,
          firstAt: scheduleAt.toISOString(),
          lastAt: scheduleAt.toISOString(),
        });
        return true;
      } catch (error) {
        console.warn("Failed to schedule styled test reminder:", error);
        window.AgnihotraDiagnostics?.captureException?.(
          error,
          "notify-schedule-test-styled"
        );
        // Fall through to the Capacitor path below as a safety net.
      }
    }

    try {
      console.log(`[AGNIHOTRA] scheduleTestReminder native: scheduling at ${scheduleAt.toISOString()} on channel ${reminderChannelId} with sound ${shared.CAPACITOR_NOTIFICATION_SOUND}`);
      const notification = {
        id: shared.toCapacitorNotificationId(`${tag}-${Date.now()}`),
        title,
        body,
        schedule: { at: scheduleAt, allowWhileIdle: true },
        channelId: reminderChannelId,
        group: shared.CAPACITOR_NOTIFICATION_GROUP,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        smallIcon: "ic_stat_notify",
        iconColor: "#B87333",
        extra: { tag, vibrationEnabled },
      };
      const notifications = [notification];
      console.log(`[AGNIHOTRA] scheduleTestReminder native: notification object: ${JSON.stringify(notification)}`);
      logNotify("schedule-test-native", {
        tag,
        scheduleAt: scheduleAt.toISOString(),
        channelId: reminderChannelId,
        sound: shared.CAPACITOR_NOTIFICATION_SOUND,
        vibration: vibrationEnabled,
      });
      await localNotifications.schedule({
        notifications,
      });
      logVibrate("schedule-test-success", {
        ok: true,
        tag,
        channelId: reminderChannelId,
        vibrationEnabled,
        scheduleAt: scheduleAt.toISOString(),
      });
      window.AgnihotraInstrumentation?.recordReminderScheduled?.({
        count: notifications.length,
        channelId: reminderChannelId,
        source: "schedule-test-native",
        tag,
        firstAt: scheduleAt.toISOString(),
        lastAt: scheduleAt.toISOString(),
      });
      return true;
    } catch (error) {
      logVibrate(
        "schedule-test-failed",
        {
          ok: false,
          vibrationEnabled,
          channelId: reminderChannelId,
          error: error?.message || String(error),
        },
        "error"
      );
      console.warn("Failed to schedule native test reminder:", error);
      window.AgnihotraDiagnostics?.captureException?.(
        error,
        "notify-schedule-test"
      );
      return false;
    }
  }

  window.AgnihotraNotificationNative = {
    ensureCapacitorChannel,
    requestCapacitorPermission,
    showNativeNotification,
    scheduleUpcomingReminders,
    scheduleTestReminder,
    setupNativeNotificationObservers,
    countPendingReminders,
  };
})();
