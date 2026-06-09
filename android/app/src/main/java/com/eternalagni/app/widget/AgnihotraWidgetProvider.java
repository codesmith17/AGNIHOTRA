package com.eternalagni.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.RemoteViews;

import com.eternalagni.app.MainActivity;
import com.eternalagni.app.R;

public class AgnihotraWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        // Render from cached data FIRST so the widget always appears populated,
        // even during the fragile boot-restore window. Doing this before any
        // scheduling work guarantees the widget host never sees a crash/empty
        // update that could cause it to drop the widget on reboot.
        renderFromCache(context, appWidgetManager, appWidgetIds);
        try {
            AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
        } catch (Throwable ignored) {
            // Best-effort: the cached render above keeps the widget visible.
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
        try {
            appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, newOptions));
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        try {
            AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
        } catch (Throwable ignored) {
        }
    }

    /**
     * Pushes RemoteViews built purely from previously-cached storage (no schedule
     * resolution or alarm scheduling), guarding every step so a single bad widget
     * id or unavailable preference store can never crash the boot broadcast.
     */
    private static void renderFromCache(
            Context context,
            AppWidgetManager appWidgetManager,
            int[] appWidgetIds
    ) {
        if (appWidgetManager == null || appWidgetIds == null) return;

        AgnihotraWidgetStorage.WidgetPayload payload;
        try {
            payload = AgnihotraWidgetStorage.read(context.getApplicationContext());
        } catch (Throwable t) {
            payload = new AgnihotraWidgetStorage.WidgetPayload();
        }

        for (int appWidgetId : appWidgetIds) {
            try {
                Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
                appWidgetManager.updateAppWidget(
                        appWidgetId,
                        buildRemoteViews(context, options, payload)
                );
            } catch (Throwable ignored) {
            }
        }
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
        // Single polished layout for every size; the sky background is drawn to
        // fit the actual widget dimensions in applySky().
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.agnihotra_widget_compact);

        applySky(context, views, options);

        String location = prettyLocationTag(context, payload.locationTag);

        if (payload.hasTiming()) {
            views.setViewVisibility(R.id.widget_loading, View.GONE);

            String shortLabel = shortenEventLabel(payload.label);
            // Exact HH:MM:SS, already formatted to the app's 12h/24h preference.
            String fullTime = shortenTimeForWidget(payload.timeText);

            // Line 1: event + time, e.g. "Sunset 6:40:50 PM".
            String topLine = buildTopLine(shortLabel, fullTime);
            views.setViewVisibility(R.id.widget_event_label, View.VISIBLE);
            views.setTextViewText(R.id.widget_event_label, topLine);

            // Line 2: place name.
            views.setViewVisibility(R.id.widget_location_tag, View.VISIBLE);
            views.setTextViewText(R.id.widget_location_tag, location);

            // Legacy fields (used by the larger fallback layout).
            if (fullTime.isEmpty()) {
                views.setViewVisibility(R.id.widget_event_time, View.GONE);
            } else {
                views.setViewVisibility(R.id.widget_event_time, View.VISIBLE);
                views.setTextViewText(R.id.widget_event_time, fullTime);
            }
            views.setTextViewText(R.id.widget_context, buildContextLine(shortLabel, fullTime, location));

            bindEventIcon(views, payload.isSunrise);
            bindCountdown(
                    views,
                    payload.targetMs,
                    fallback(payload.widgetTimePassedLabel, context.getString(R.string.widget_countdown_passed))
            );
        } else if (isLoadingState(payload)) {
            // Freshly added widget — the app hasn't pushed any timings yet.
            // Show an animated spinner instead of a blank/error state.
            String loading = context.getString(R.string.widget_loading);
            views.setViewVisibility(R.id.widget_event_label, View.VISIBLE);
            views.setTextViewText(R.id.widget_event_label, loading);
            views.setTextViewText(R.id.widget_context, loading);
            views.setViewVisibility(R.id.widget_location_tag, View.GONE);
            views.setViewVisibility(R.id.widget_event_time, View.GONE);
            views.setViewVisibility(R.id.widget_event_icon, View.GONE);
            views.setViewVisibility(R.id.widget_countdown, View.GONE);
            views.setViewVisibility(R.id.widget_countdown_chronometer, View.GONE);
            views.setViewVisibility(R.id.widget_loading, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_loading, View.GONE);
            String noTiming = fallback(payload.widgetNoTimingLabel, context.getString(R.string.widget_no_timing));
            views.setViewVisibility(R.id.widget_event_label, View.VISIBLE);
            views.setTextViewText(R.id.widget_event_label, noTiming);
            views.setTextViewText(R.id.widget_context, noTiming);
            views.setViewVisibility(R.id.widget_location_tag, View.GONE);
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

    private static String buildTopLine(String label, String time) {
        StringBuilder sb = new StringBuilder();
        if (label != null && !label.trim().isEmpty()) {
            sb.append(label.trim());
        }
        if (time != null && !time.trim().isEmpty()) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(time.trim());
        }
        return sb.toString();
    }

    private static String buildContextLine(String label, String time, String location) {
        StringBuilder sb = new StringBuilder();
        if (label != null && !label.trim().isEmpty()) {
            sb.append(label.trim());
        }
        if (time != null && !time.trim().isEmpty()) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(time.trim());
        }
        if (location != null && !location.trim().isEmpty()) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(location.trim());
        }
        return sb.toString();
    }

    private static String shortenTimeForWidget(String timeText) {
        if (timeText == null) return "";
        String time = timeText.trim();
        if (time.isEmpty()) return "";
        // Keep the exact HH:MM:SS (and any AM/PM); only trim a leading zero on the hour.
        return time.replaceFirst("^0(\\d)(:|\\s)", "$1$2");
    }

    /**
     * Builds the small location chip text. Uses the first segment of the saved
     * place name (e.g. "Saroj Nagar, Pune" -> "Saroj Nagar") and falls back to a
     * cute default when the user hasn't tagged a location.
     */
    private static String prettyLocationTag(Context context, String rawTag) {
        String tag = rawTag == null ? "" : rawTag.trim();
        if (tag.isEmpty()) {
            return context.getString(R.string.widget_location_default);
        }
        int comma = tag.indexOf(',');
        if (comma > 0) {
            tag = tag.substring(0, comma).trim();
        }
        if (tag.length() > 22) {
            tag = tag.substring(0, 21).trim() + "…";
        }
        return tag.isEmpty()
                ? context.getString(R.string.widget_location_default)
                : tag;
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
                isSunrise ? R.drawable.ic_widget_sunrise_sea : R.drawable.ic_widget_sunset_sea
        );
    }

    /**
     * Paints the time-of-day "sky" gradient as the widget background and tints
     * all text/icon ink so it stays readable against the current sky colour.
     * The colour is derived from the exact current time, so it drifts smoothly
     * through the day on each refresh instead of snapping between fixed themes.
     */
    private static void applySky(Context context, RemoteViews views, Bundle options) {
        SkyPalette.Sky sky = SkyPalette.now();

        try {
            Bitmap bg = buildSkyBitmap(context, options, sky);
            if (bg != null) {
                views.setImageViewBitmap(R.id.widget_bg, bg);
            }
        } catch (Throwable ignored) {
            // If bitmap generation fails the layout's static sky drawable shows.
        }

        views.setTextColor(R.id.widget_location_tag, sky.locationInk);
        views.setTextColor(R.id.widget_event_label, sky.ink);
        views.setTextColor(R.id.widget_countdown, sky.ink);
        views.setTextColor(R.id.widget_countdown_chronometer, sky.ink);
        views.setTextColor(R.id.widget_event_time, sky.inkSoft);
        views.setInt(R.id.widget_event_icon, "setColorFilter", sky.ink);
    }

    private static Bitmap buildSkyBitmap(Context context, Bundle options, SkyPalette.Sky sky) {
        DisplayMetrics dm = context.getResources().getDisplayMetrics();
        float density = dm.density <= 0f ? 2f : dm.density;

        int wDp = 150;
        int hDp = 56;
        if (options != null) {
            int maxW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
            int minH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            if (maxW > 0) wDp = maxW;
            if (minH > 0) hDp = minH;
        }

        int w = Math.max(1, Math.round(wDp * density));
        int h = Math.max(1, Math.round(hDp * density));
        // Guard against pathological sizes.
        w = Math.min(w, 1400);
        h = Math.min(h, 700);

        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);

        float radius = Math.min(22f * density, Math.min(w, h) * 0.5f);

        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setShader(new LinearGradient(0f, 0f, w * 0.35f, h, sky.top, sky.bottom, Shader.TileMode.CLAMP));
        RectF rect = new RectF(0f, 0f, w, h);
        canvas.drawRoundRect(rect, radius, radius, fill);

        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(1f, density));
        stroke.setColor(sky.stroke);
        float inset = stroke.getStrokeWidth() / 2f;
        canvas.drawRoundRect(
                new RectF(inset, inset, w - inset, h - inset),
                radius, radius, stroke
        );
        return bmp;
    }

    private static boolean isLoadingState(AgnihotraWidgetStorage.WidgetPayload payload) {
        // No timing AND the app has never synced data into the widget yet.
        return !payload.hasTiming() && payload.updatedAtMs <= 0L;
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
