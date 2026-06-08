package com.eternalagni.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import com.eternalagni.app.MainActivity;
import com.eternalagni.app.R;

public class AgnihotraWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context,
            AppWidgetManager appWidgetManager,
            int appWidgetId,
            Bundle newOptions
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, newOptions));
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, AgnihotraWidgetProvider.class);
        int[] appWidgetIds = manager.getAppWidgetIds(provider);
        if (appWidgetIds == null || appWidgetIds.length == 0) return;

        AgnihotraWidgetStorage.WidgetPayload payload =
                AgnihotraWidgetScheduleResolver.resolveAndPersist(context.getApplicationContext());

        for (int appWidgetId : appWidgetIds) {
            Bundle options = manager.getAppWidgetOptions(appWidgetId);
            RemoteViews views = buildRemoteViews(context, options, payload);
            manager.updateAppWidget(appWidgetId, views);
        }
    }

    private static RemoteViews buildRemoteViews(Context context, Bundle options) {
        AgnihotraWidgetStorage.WidgetPayload payload =
                AgnihotraWidgetScheduleResolver.resolveAndPersist(context.getApplicationContext());
        return buildRemoteViews(context, options, payload);
    }

    private static RemoteViews buildRemoteViews(
            Context context,
            Bundle options,
            AgnihotraWidgetStorage.WidgetPayload payload
    ) {
        int layoutId = isCompactWidget(options)
                ? R.layout.agnihotra_widget_compact
                : R.layout.agnihotra_widget;
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        boolean sunriseTheme = !payload.hasTiming() || payload.isSunrise;
        applyTheme(context, views, sunriseTheme);

        if (payload.hasTiming()) {
            views.setTextViewText(
                    R.id.widget_event_label,
                    shortenEventLabel(payload.label)
            );
            String time = shortenTimeForWidget(payload.timeText);
            if (time.isEmpty()) {
                views.setViewVisibility(R.id.widget_event_time, View.GONE);
            } else {
                views.setViewVisibility(R.id.widget_event_time, View.VISIBLE);
                views.setTextViewText(R.id.widget_event_time, time);
            }
            bindEventIcon(views, payload.isSunrise);
            bindCountdown(
                    views,
                    payload.targetMs,
                    fallback(payload.widgetTimePassedLabel, context.getString(R.string.widget_countdown_passed))
            );
        } else {
            views.setTextViewText(
                    R.id.widget_event_label,
                    fallback(payload.widgetNoTimingLabel, context.getString(R.string.widget_no_timing))
            );
            views.setViewVisibility(R.id.widget_event_time, View.GONE);
            views.setTextViewText(R.id.widget_countdown, "--");
            views.setViewVisibility(R.id.widget_countdown, View.VISIBLE);
            views.setViewVisibility(R.id.widget_countdown_chronometer, View.GONE);
            views.setViewVisibility(R.id.widget_event_icon, View.GONE);
        }

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        return views;
    }

    static String formatEventLine(String label, String timeText) {
        String shortLabel = shortenEventLabel(label);
        String time = shortenTimeForWidget(timeText);
        if (time.isEmpty()) return shortLabel;
        return shortLabel + " · " + time;
    }

    private static String shortenTimeForWidget(String timeText) {
        if (timeText == null) return "";
        String time = timeText.trim();
        if (time.isEmpty()) return "";
        time = time.replaceAll("(\\d{1,2}:\\d{2}):\\d{2}(\\s*(?:AM|PM|am|pm))?", "$1$2");
        return time.replaceFirst("^0(\\d)(:|\\s)", "$1$2");
    }

    private static String shortenEventLabel(String label) {
        if (label == null) return "";
        String trimmed = label.trim();
        if (trimmed.isEmpty()) return trimmed;

        String lower = trimmed.toLowerCase();
        boolean tomorrow = lower.contains("tomorrow");
        if (lower.contains("sunrise")) {
            return tomorrow ? "Sunrise tomorrow" : "Sunrise";
        }
        if (lower.contains("sunset")) {
            return tomorrow ? "Sunset tomorrow" : "Sunset";
        }
        return trimmed
                .replace("Today's ", "")
                .replace("Tomorrows ", "Tomorrow ")
                .replace("Tomorrow's ", "Tomorrow ");
    }

    private static void bindEventIcon(RemoteViews views, boolean isSunrise) {
        views.setViewVisibility(R.id.widget_event_icon, View.VISIBLE);
        views.setImageViewResource(
                R.id.widget_event_icon,
                isSunrise ? R.drawable.ic_widget_sun : R.drawable.ic_widget_moon
        );
    }

    private static void applyTheme(Context context, RemoteViews views, boolean sunrise) {
        int bg = sunrise
                ? R.drawable.widget_background_sunrise
                : R.drawable.widget_background_sunset;
        int ink = context.getColor(sunrise ? R.color.widget_ink : R.color.widget_sunset_ink);
        int inkSoft = context.getColor(sunrise ? R.color.widget_ink_soft : R.color.widget_sunset_ink_soft);

        views.setInt(R.id.widget_root, "setBackgroundResource", bg);
        views.setTextColor(R.id.widget_event_label, ink);
        views.setTextColor(R.id.widget_countdown, ink);
        views.setTextColor(R.id.widget_countdown_chronometer, ink);
        views.setTextColor(R.id.widget_event_time, inkSoft);
        views.setInt(R.id.widget_event_icon, "setColorFilter", ink);
    }

    private static boolean isCompactWidget(Bundle options) {
        if (options == null) return false;
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
        return minHeight < 100;
    }

    private static String fallback(String value, String fallback) {
        if (value == null || value.trim().isEmpty()) return fallback;
        return value;
    }

    private static void bindCountdown(RemoteViews views, long targetMs, String passedText) {
        long remainingMs = targetMs - System.currentTimeMillis();
        if (remainingMs <= 0L) {
            views.setTextViewText(R.id.widget_countdown, passedText);
            views.setViewVisibility(R.id.widget_countdown, View.VISIBLE);
            views.setViewVisibility(R.id.widget_countdown_chronometer, View.GONE);
            return;
        }

        long base = SystemClock.elapsedRealtime() + remainingMs;
        views.setViewVisibility(R.id.widget_countdown, View.GONE);
        views.setViewVisibility(R.id.widget_countdown_chronometer, View.VISIBLE);
        views.setChronometer(R.id.widget_countdown_chronometer, base, null, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            views.setBoolean(R.id.widget_countdown_chronometer, "setCountDown", true);
        }
    }
}
