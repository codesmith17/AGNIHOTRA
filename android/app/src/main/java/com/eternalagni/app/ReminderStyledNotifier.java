package com.eternalagni.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.eternalagni.app.support.AgniLog;

/**
 * Posts a ritual reminder using the same calm, modern typographic theme as the
 * lock-screen countdown (custom {@link RemoteViews} body decorated by the
 * system). It posts on the EXISTING reminder channel created by the JS layer so
 * the configured custom sound, vibration, and high importance (heads-up) are
 * inherited unchanged — only the visual styling differs from the previous
 * stock Capacitor reminder.
 */
public final class ReminderStyledNotifier {

    private static final String TAG = "AgniReminder";
    private static final int ACCENT = 0xFFB87333; // warm copper, matches the app theme

    private ReminderStyledNotifier() {}

    public static void post(
            Context context,
            int notificationId,
            String eyebrow,
            String title,
            String body,
            String channelId,
            boolean vibrate
    ) {
        Context appContext = context.getApplicationContext();
        String safeChannel = trimToNull(channelId);
        if (safeChannel == null) {
            AgniLog.w(appContext, TAG, "styled reminder skipped: missing channelId id=" + notificationId);
            return;
        }

        String eyebrowText = firstNonEmpty(eyebrow, "Agnihotra reminder");
        String titleText = firstNonEmpty(title, "Time for Agnihotra");
        String bodyText = trimToNull(body);

        RemoteViews content = new RemoteViews(appContext.getPackageName(), R.layout.notification_reminder);
        content.setTextViewText(R.id.reminder_eyebrow, eyebrowText);
        content.setTextViewText(R.id.reminder_title, titleText);
        if (bodyText != null) {
            content.setViewVisibility(R.id.reminder_body, android.view.View.VISIBLE);
            content.setTextViewText(R.id.reminder_body, bodyText);
        } else {
            content.setViewVisibility(R.id.reminder_body, android.view.View.GONE);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(appContext, safeChannel)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(ACCENT)
                .setContentTitle(titleText)
                .setContentText(bodyText != null ? bodyText : eyebrowText)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(content)
                .setCustomBigContentView(content)
                .setContentIntent(buildContentIntent(appContext, notificationId));

        // Pre-O has no channels, so sound/vibration must be set on the builder.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Uri sound = resolveSound(appContext);
            if (sound != null) {
                builder.setSound(sound);
            }
            if (vibrate) {
                builder.setVibrate(new long[] {0, 400, 200, 400});
            }
            builder.setDefaults(vibrate ? NotificationCompat.DEFAULT_LIGHTS : NotificationCompat.DEFAULT_LIGHTS);
        }

        try {
            NotificationManagerCompat.from(appContext).notify(notificationId, builder.build());
            AgniLog.i(appContext, TAG, "styled reminder posted id=" + notificationId
                    + " channel=" + safeChannel + " title=" + titleText);
        } catch (Throwable t) {
            AgniLog.w(appContext, TAG, "styled reminder notify failed id=" + notificationId, t);
        }
    }

    private static Uri resolveSound(Context context) {
        try {
            int resId = context.getResources().getIdentifier(
                    "agnihotra_bell_3x", "raw", context.getPackageName());
            if (resId != 0) {
                return Uri.parse("android.resource://" + context.getPackageName() + "/" + resId);
            }
        } catch (Throwable ignored) {
        }
        return null;
    }

    private static PendingIntent buildContentIntent(Context context, int notificationId) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, notificationId, intent, flags);
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
