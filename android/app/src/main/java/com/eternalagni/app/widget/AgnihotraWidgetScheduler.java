package com.eternalagni.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.eternalagni.app.MainActivity;
import com.eternalagni.app.support.AgniLog;

public final class AgnihotraWidgetScheduler {

    private static final String TAG = "AgniWidget";

    public static final String ACTION_WIDGET_REFRESH = "com.eternalagni.app.action.WIDGET_REFRESH";
    private static final int REQUEST_TRANSITION = 44001;
    private static final int REQUEST_MIDNIGHT = 44002;
    private static final int REQUEST_SKY = 44003;
    private static final int REQUEST_TRANSITION_BACKUP = 44004;
    private static final int REQUEST_SHOW = 44005;
    private static final long TRANSITION_BUFFER_MS = 2_000L;
    // A second, permission-free alarm fired shortly after the exact one so the
    // widget still flips to "moment complete" (and then the next event) even if
    // the exact alarm is throttled or exact-alarm scheduling is unavailable.
    private static final long TRANSITION_BACKUP_DELAY_MS = 1_500L;
    private static final long SKY_INTERVAL_MS = 45 * 60 * 1000L;

    private AgnihotraWidgetScheduler() {}

    public static void refreshAndReschedule(Context context) {
        Context appContext = context.getApplicationContext();
        AgnihotraWidgetScheduleResolver.resolveAndPersist(appContext);
        AgnihotraWidgetProvider.updateAllWidgets(appContext);
        // Keep the optional lock-screen / status-bar countdown in sync. It reuses
        // the same resolved timing and alarms, so it rolls over automatically.
        LockCountdownNotifier.update(appContext);

        AgnihotraWidgetStorage.WidgetPayload payload = AgnihotraWidgetStorage.read(appContext);
        long now = System.currentTimeMillis();
        AgniLog.i(appContext, TAG, "refreshAndReschedule hasTiming=" + payload.hasTiming()
                + " label=" + payload.label
                + " targetMs=" + payload.targetMs
                + " now=" + now
                + " remainingMs=" + (payload.targetMs - now));
        if (payload.hasTiming()) {
            if (payload.targetMs > now) {
                // Fire EXACTLY at the event so the live countdown is replaced by
                // the "moment complete" state at zero — never a negative number.
                AgniLog.i(appContext, TAG, "scheduling transition AT target (future event), inMs="
                        + (payload.targetMs - now));
                scheduleTransitionRefresh(appContext, payload.targetMs);
            } else {
                // Already in the post-event grace window: refresh once it ends so
                // we advance to the next event after "moment complete" has shown.
                long graceEnd = payload.targetMs + AgnihotraWidgetScheduleResolver.JUST_PASSED_GRACE_MS;
                long trigger = Math.max(graceEnd, now + 1_000L);
                AgniLog.i(appContext, TAG, "scheduling transition at graceEnd (passed event), graceEnd="
                        + graceEnd + " trigger=" + trigger + " inMs=" + (trigger - now));
                scheduleTransitionRefresh(appContext, trigger);
            }
        } else {
            AgniLog.i(appContext, TAG, "no timing -> cancelling transition alarms");
            cancelTransitionRefresh(appContext);
            cancelTransitionBackup(appContext);
        }
        scheduleMidnightRefresh(appContext);
        scheduleSkyRefresh(appContext);
    }

    /**
     * Keeps the time-of-day "sky" background drifting by re-rendering the widget
     * roughly every 45 minutes. Uses an inexact, battery-friendly alarm since the
     * colour change is gradual and does not need to fire on an exact instant.
     */
    private static void scheduleSkyRefresh(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        long triggerAtMs = System.currentTimeMillis() + SKY_INTERVAL_MS;
        PendingIntent pendingIntent = buildPendingIntent(context, REQUEST_SKY);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC, triggerAtMs, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC, triggerAtMs, pendingIntent);
            }
        } catch (SecurityException ignored) {
            alarmManager.set(AlarmManager.RTC, triggerAtMs, pendingIntent);
        }
    }

    private static void scheduleTransitionRefresh(Context context, long triggerAtMs) {
        long now = System.currentTimeMillis();
        if (triggerAtMs <= now) {
            triggerAtMs = now + 60_000L;
        }
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            AgniLog.w(context, TAG, "scheduleTransitionRefresh: AlarmManager null");
            return;
        }

        boolean canExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            canExact = alarmManager.canScheduleExactAlarms();
        }
        AgniLog.i(context, TAG, "scheduleTransitionRefresh triggerAtMs=" + triggerAtMs
                + " inMs=" + (triggerAtMs - now)
                + " sdk=" + Build.VERSION.SDK_INT
                + " canScheduleExactAlarms=" + canExact);

        PendingIntent pendingIntent = buildPendingIntent(context, REQUEST_TRANSITION);

        // Primary: setAlarmClock(). This is the ONLY alarm type that aggressive
        // OEM battery managers (e.g. ColorOS) and Doze do not defer — it is
        // treated like a user alarm and fires on time. That punctual refresh is
        // what flips the live countdown to "moment complete" at zero instead of
        // letting the launcher-rendered chronometer tick into negative numbers.
        boolean alarmClockSet = false;
        try {
            AlarmManager.AlarmClockInfo info =
                    new AlarmManager.AlarmClockInfo(triggerAtMs, buildShowIntent(context));
            alarmManager.setAlarmClock(info, pendingIntent);
            alarmClockSet = true;
            AgniLog.i(context, TAG, "primary alarm set via setAlarmClock");
        } catch (Throwable t) {
            AgniLog.w(context, TAG, "setAlarmClock failed; falling back to exact alarm", t);
        }

        // Fallback if setAlarmClock is somehow unavailable.
        if (!alarmClockSet) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            triggerAtMs,
                            pendingIntent
                    );
                    AgniLog.i(context, TAG, "fallback alarm set via setExactAndAllowWhileIdle");
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent);
                    AgniLog.i(context, TAG, "fallback alarm set via setExact");
                }
            } catch (SecurityException e) {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent);
                AgniLog.w(context, TAG, "exact alarm denied -> fell back to inexact set()", e);
            }
        }

        // Belt-and-suspenders: a non-exact alarm a moment later guarantees the
        // widget leaves the countdown state even when the exact alarm is denied
        // or deferred, so the user never keeps staring at a negative timer.
        PendingIntent backup = buildPendingIntent(context, REQUEST_TRANSITION_BACKUP);
        long backupAtMs = triggerAtMs + TRANSITION_BACKUP_DELAY_MS;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, backupAtMs, backup);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, backupAtMs, backup);
            }
            AgniLog.i(context, TAG, "backup alarm set at=" + backupAtMs
                    + " inMs=" + (backupAtMs - now));
        } catch (Throwable t) {
            // The exact alarm above remains as the primary trigger.
            AgniLog.w(context, TAG, "backup alarm failed to set", t);
        }
    }

    private static void cancelTransitionBackup(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        alarmManager.cancel(buildPendingIntent(context, REQUEST_TRANSITION_BACKUP));
    }

    private static void scheduleMidnightRefresh(Context context) {
        long triggerAtMs = nextLocalMidnightMs() + TRANSITION_BUFFER_MS;
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        PendingIntent pendingIntent = buildPendingIntent(context, REQUEST_MIDNIGHT);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerAtMs,
                        pendingIntent
                );
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent);
            }
        } catch (SecurityException ignored) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent);
        }
    }

    private static long nextLocalMidnightMs() {
        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.add(java.util.Calendar.DAY_OF_YEAR, 1);
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 0);
        calendar.set(java.util.Calendar.MINUTE, 0);
        calendar.set(java.util.Calendar.SECOND, 0);
        calendar.set(java.util.Calendar.MILLISECOND, 0);
        return calendar.getTimeInMillis();
    }

    private static void cancelTransitionRefresh(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        alarmManager.cancel(buildPendingIntent(context, REQUEST_TRANSITION));
    }

    private static PendingIntent buildPendingIntent(Context context, int requestCode) {
        Intent intent = new Intent(context, WidgetRefreshReceiver.class);
        intent.setAction(ACTION_WIDGET_REFRESH);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, requestCode, intent, flags);
    }

    /**
     * The activity shown if the user taps the status-bar alarm-clock icon that
     * setAlarmClock() surfaces. Opening the app is the most sensible action.
     */
    private static PendingIntent buildShowIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, REQUEST_SHOW, intent, flags);
    }
}
