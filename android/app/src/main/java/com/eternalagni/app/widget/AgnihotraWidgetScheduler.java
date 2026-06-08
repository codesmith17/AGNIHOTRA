package com.eternalagni.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
public final class AgnihotraWidgetScheduler {

    public static final String ACTION_WIDGET_REFRESH = "com.eternalagni.app.action.WIDGET_REFRESH";
    private static final int REQUEST_TRANSITION = 44001;
    private static final int REQUEST_MIDNIGHT = 44002;
    private static final long TRANSITION_BUFFER_MS = 2_000L;

    private AgnihotraWidgetScheduler() {}

    public static void refreshAndReschedule(Context context) {
        Context appContext = context.getApplicationContext();
        AgnihotraWidgetScheduleResolver.resolveAndPersist(appContext);
        AgnihotraWidgetProvider.updateAllWidgets(appContext);

        AgnihotraWidgetStorage.WidgetPayload payload = AgnihotraWidgetStorage.read(appContext);
        if (payload.hasTiming()) {
            scheduleTransitionRefresh(appContext, payload.targetMs + TRANSITION_BUFFER_MS);
        } else {
            cancelTransitionRefresh(appContext);
        }
        scheduleMidnightRefresh(appContext);
    }

    private static void scheduleTransitionRefresh(Context context, long triggerAtMs) {
        long now = System.currentTimeMillis();
        if (triggerAtMs <= now) {
            triggerAtMs = now + 60_000L;
        }
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        PendingIntent pendingIntent = buildPendingIntent(context, REQUEST_TRANSITION);
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
}
