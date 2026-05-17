package com.eternalagni.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import com.eternalagni.app.MainActivity;
import com.eternalagni.app.R;

public class AgnihotraWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, options));
        }
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
        updateAllWidgets(context);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, AgnihotraWidgetProvider.class);
        int[] appWidgetIds = manager.getAppWidgetIds(provider);
        if (appWidgetIds == null || appWidgetIds.length == 0) return;

        for (int appWidgetId : appWidgetIds) {
            Bundle options = manager.getAppWidgetOptions(appWidgetId);
            RemoteViews views = buildRemoteViews(context, options);
            manager.updateAppWidget(appWidgetId, views);
        }
    }

    private static RemoteViews buildRemoteViews(Context context, Bundle options) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.agnihotra_widget);
        AgnihotraWidgetStorage.WidgetPayload payload = AgnihotraWidgetStorage.read(context);
        applyResponsiveTypography(views, options);
        views.setTextViewText(
                R.id.widget_title,
                fallback(payload.widgetTitle, context.getString(R.string.widget_title))
        );
        views.setTextViewText(
                R.id.widget_countdown_label,
                fallback(payload.widgetCountdownLabel, context.getString(R.string.widget_countdown_title))
        );

        if (payload.hasTiming()) {
            views.setTextViewText(R.id.widget_event_label, payload.label);
            views.setTextViewText(R.id.widget_event_time, payload.timeText);
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
            views.setTextViewText(R.id.widget_event_time, "--");
            views.setTextViewText(R.id.widget_countdown, "--");
            views.setViewVisibility(R.id.widget_countdown, View.VISIBLE);
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

    private static void applyResponsiveTypography(RemoteViews views, Bundle options) {
        // Fixed-size widget: keep consistent clean typography and spacing.
        views.setViewPadding(R.id.widget_root, 14, 8, 14, 8);
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
