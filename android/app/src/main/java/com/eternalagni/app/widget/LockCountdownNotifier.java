package com.eternalagni.app.widget;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.eternalagni.app.MainActivity;
import com.eternalagni.app.R;
import com.eternalagni.app.support.AgniLog;

/**
 * Shows an optional persistent notification with a prominent live countdown to
 * the next Agnihotra moment. It uses a custom decorated layout so the COUNTDOWN
 * is the main element (large chronometer) with the clock time as a secondary
 * line, ticking natively with no per-second work. A delete-intent re-posts it if
 * swiped (Flipkart-style stickiness), since Android 14+ lets users dismiss
 * ongoing notifications. Driven by {@link AgnihotraWidgetScheduler}, so it rolls
 * over to the next sunrise/sunset on the same alarms as the home-screen widget.
 */
public final class LockCountdownNotifier {

    private static final String TAG = "AgniWidget";
    private static final String CHANNEL_ID = "agnihotra_lock_countdown";
    private static final int NOTIFICATION_ID = 73101;

    // Matches the widget tolerance: within this of zero we show "moment complete".
    private static final long PASSED_TOLERANCE_MS = 1_000L;

    private LockCountdownNotifier() {}

    /**
     * Builds/updates or cancels the lock-screen countdown notification to match
     * the current stored timing and the user's enable preference.
     */
    public static void update(Context context) {
        Context appContext = context.getApplicationContext();
        if (!AgnihotraWidgetStorage.isLockCountdownEnabled(appContext)) {
            cancel(appContext);
            return;
        }

        AgnihotraWidgetStorage.WidgetPayload payload;
        try {
            payload = AgnihotraWidgetStorage.read(appContext);
        } catch (Throwable t) {
            AgniLog.w(appContext, TAG, "lockCountdown read failed", t);
            return;
        }

        if (!payload.hasTiming()) {
            cancel(appContext);
            return;
        }

        ensureChannel(appContext);

        long now = System.currentTimeMillis();
        long remainingMs = payload.targetMs - now;
        boolean passed = remainingMs <= PASSED_TOLERANCE_MS;

        String eventName = shortEventName(payload);
        String place = trimToNull(payload.locationTag);
        String title = place != null ? (eventName + " · " + place) : eventName;
        String passedText = firstNonEmpty(payload.widgetTimePassedLabel, "Agnihotra moment complete");

        RemoteViews content = new RemoteViews(appContext.getPackageName(), R.layout.notification_lock_countdown);
        content.setTextViewText(R.id.lock_countdown_title, title);

        if (passed) {
            content.setViewVisibility(R.id.lock_countdown_chrono, View.GONE);
            content.setViewVisibility(R.id.lock_countdown_at, View.GONE);
            content.setViewVisibility(R.id.lock_countdown_complete, View.VISIBLE);
            content.setTextViewText(R.id.lock_countdown_complete, passedText);
        } else {
            content.setViewVisibility(R.id.lock_countdown_complete, View.GONE);
            content.setViewVisibility(R.id.lock_countdown_chrono, View.VISIBLE);
            long base = SystemClock.elapsedRealtime() + remainingMs;
            content.setChronometer(R.id.lock_countdown_chrono, base, null, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                content.setChronometerCountDown(R.id.lock_countdown_chrono, true);
            }
            String at = trimToNull(payload.timeText);
            if (at != null) {
                content.setViewVisibility(R.id.lock_countdown_at, View.VISIBLE);
                content.setTextViewText(R.id.lock_countdown_at, "at " + at);
            } else {
                content.setViewVisibility(R.id.lock_countdown_at, View.GONE);
            }
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(appContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(0xFFB87333) // warm copper accent to match the app theme
                .setColorized(false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setLocalOnly(true)
                .setShowWhen(false)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(content)
                .setCustomBigContentView(content)
                .setContentIntent(buildContentIntent(appContext))
                .setDeleteIntent(buildDeleteIntent(appContext));

        try {
            NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID, builder.build());
            AgniLog.i(appContext, TAG, "lockCountdown posted passed=" + passed
                    + " remainingMs=" + remainingMs + " targetMs=" + payload.targetMs);
        } catch (Throwable t) {
            AgniLog.w(appContext, TAG, "lockCountdown notify failed", t);
        }
    }

    public static void cancel(Context context) {
        try {
            NotificationManagerCompat.from(context.getApplicationContext()).cancel(NOTIFICATION_ID);
        } catch (Throwable ignored) {
        }
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Agnihotra countdown",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Persistent countdown to the next Agnihotra moment.");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private static PendingIntent buildContentIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent, pendingIntentFlags(false));
    }

    private static PendingIntent buildDeleteIntent(Context context) {
        Intent intent = new Intent(context, LockCountdownDismissReceiver.class);
        return PendingIntent.getBroadcast(context, 1, intent, pendingIntentFlags(false));
    }

    private static int pendingIntentFlags(boolean mutable) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= mutable ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private static String shortEventName(AgnihotraWidgetStorage.WidgetPayload payload) {
        String label = payload.label == null ? "" : payload.label.trim();
        String lower = label.toLowerCase();
        if (lower.contains("sunrise")) return "Sunrise";
        if (lower.contains("sunset")) return "Sunset";
        return label.isEmpty() ? (payload.isSunrise ? "Sunrise" : "Sunset") : label;
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String firstNonEmpty(String value, String fallback) {
        return (value == null || value.trim().isEmpty()) ? fallback : value.trim();
    }
}
