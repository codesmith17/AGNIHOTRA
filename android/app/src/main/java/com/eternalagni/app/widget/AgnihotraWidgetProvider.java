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
import com.eternalagni.app.support.AgniLog;

public class AgnihotraWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "AgniWidget";

    // Fallback sky size (dp) used only when the launcher hasn't reported the
    // widget's actual cell dimensions yet.
    private static final int DEFAULT_SKY_WIDTH_DP = 180;
    private static final int DEFAULT_SKY_HEIGHT_DP = 80;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        AgniLog.i(context, TAG, "onUpdate ids=" + java.util.Arrays.toString(appWidgetIds));
        // Render from cached data FIRST so the widget always appears populated,
        // even during the fragile boot-restore window. Doing this before any
        // scheduling work guarantees the widget host never sees a crash/empty
        // update that could cause it to drop the widget on reboot.
        renderFromCache(context, appWidgetManager, appWidgetIds);
        try {
            AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
        } catch (Throwable t) {
            // Best-effort: the cached render above keeps the widget visible.
            AgniLog.w(context, TAG, "onUpdate reschedule failed", t);
        }
    }

    @Override
    public void onRestored(Context context, int[] oldWidgetIds, int[] newWidgetIds) {
        super.onRestored(context, oldWidgetIds, newWidgetIds);
        AgniLog.i(context, TAG, "onRestored old=" + java.util.Arrays.toString(oldWidgetIds)
                + " new=" + java.util.Arrays.toString(newWidgetIds));
        // Paint the restored widget(s) from cache immediately so they are never
        // blank right after a reboot/restore — don't wait for the follow-up
        // onUpdate, which some launchers delay or skip.
        try {
            renderFromCache(context, AppWidgetManager.getInstance(context), newWidgetIds);
        } catch (Throwable t) {
            AgniLog.w(context, TAG, "onRestored render failed", t);
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
        if (newOptions != null) {
            AgniLog.i(context, TAG, "onAppWidgetOptionsChanged id=" + appWidgetId
                    + " minW=" + newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, -1)
                    + " maxW=" + newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, -1)
                    + " minH=" + newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, -1)
                    + " maxH=" + newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, -1));
        }
        try {
            appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, newOptions));
        } catch (Throwable t) {
            AgniLog.w(context, TAG, "onAppWidgetOptionsChanged update failed id=" + appWidgetId, t);
        }
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        AgniLog.i(context, TAG, "onEnabled");
        try {
            AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
        } catch (Throwable t) {
            AgniLog.w(context, TAG, "onEnabled reschedule failed", t);
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        super.onDeleted(context, appWidgetIds);
        AgniLog.i(context, TAG, "onDeleted ids=" + java.util.Arrays.toString(appWidgetIds));
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        AgniLog.i(context, TAG, "onDisabled (last widget removed)");
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
            AgniLog.w(context, TAG, "renderFromCache read failed; using empty payload", t);
        }
        AgniLog.i(context, TAG, "renderFromCache ids=" + appWidgetIds.length
                + " hasTiming=" + payload.hasTiming()
                + " location=" + payload.locationTag);

        for (int appWidgetId : appWidgetIds) {
            try {
                Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
                appWidgetManager.updateAppWidget(
                        appWidgetId,
                        buildRemoteViews(context, options, payload)
                );
            } catch (Throwable t) {
                AgniLog.w(context, TAG, "renderFromCache update failed id=" + appWidgetId, t);
            }
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, AgnihotraWidgetProvider.class);
        int[] appWidgetIds = manager.getAppWidgetIds(provider);
        if (appWidgetIds == null || appWidgetIds.length == 0) {
            AgniLog.i(context, TAG, "updateAllWidgets: no widgets placed");
            return;
        }
        AgniLog.i(context, TAG, "updateAllWidgets count=" + appWidgetIds.length);

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

        String state = payload.hasTiming() ? "timing" : (isLoadingState(payload) ? "loading" : "no-timing");
        AgniLog.i(context, TAG, "buildRemoteViews state=" + state
                + " label=" + payload.label
                + " time=" + payload.timeText
                + " targetMs=" + payload.targetMs);

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

            // Line 2: place name — only when a real place is known. Otherwise
            // hide the chip rather than showing a generic placeholder.
            if (location != null && !location.isEmpty()) {
                views.setViewVisibility(R.id.widget_location_tag, View.VISIBLE);
                views.setTextViewText(R.id.widget_location_tag, location);
            } else {
                views.setViewVisibility(R.id.widget_location_tag, View.GONE);
            }

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
     * Builds the small location chip text from the first segment of the saved
     * place name (e.g. "Saroj Nagar, Pune" -> "Saroj Nagar"). Returns an empty
     * string when no real place has been resolved yet — the caller then hides
     * the chip entirely rather than showing a generic "Your sky" placeholder.
     */
    private static String prettyLocationTag(Context context, String rawTag) {
        String tag = rawTag == null ? "" : rawTag.trim();
        if (tag.isEmpty()) {
            return "";
        }
        int comma = tag.indexOf(',');
        if (comma > 0) {
            tag = tag.substring(0, comma).trim();
        }
        if (tag.length() > 22) {
            tag = tag.substring(0, 21).trim() + "…";
        }
        return tag;
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

        // Paint the gradient to the widget's ACTUAL cell size so it stays crisp
        // and fills the card as the user resizes the widget.
        int wDp = DEFAULT_SKY_WIDTH_DP;
        int hDp = DEFAULT_SKY_HEIGHT_DP;
        if (options != null) {
            int maxW = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
            int maxH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
            int minH = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            if (maxW > 0) wDp = maxW;
            // Prefer the larger reported height so portrait/landscape both fill.
            int hCandidate = Math.max(maxH, minH);
            if (hCandidate > 0) hDp = hCandidate;
        }

        int w = Math.max(1, Math.round(wDp * density));
        int h = Math.max(1, Math.round(hDp * density));
        // Guard against pathological sizes.
        w = Math.min(w, 1600);
        h = Math.min(h, 900);

        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);

        float radius = Math.min(22f * density, Math.min(w, h) * 0.5f);

        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        // Vertical sky -> horizon gradient (realistic), with the warm/bright
        // horizon band kept to the lower half via a 3-stop curve so the upper
        // sky stays its true colour instead of washing into one flat blend.
        int mid = blend(sky.top, sky.bottom, 0.32f);
        fill.setShader(new LinearGradient(
                0f, 0f, 0f, h,
                new int[] { sky.top, mid, sky.bottom },
                new float[] { 0f, 0.52f, 1f },
                Shader.TileMode.CLAMP));
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

    /** Linear ARGB blend of two colours (t in 0..1). */
    private static int blend(int a, int b, float t) {
        int aa = (a >>> 24) & 0xFF, ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
        int ba = (b >>> 24) & 0xFF, br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
        int ca = Math.round(aa + (ba - aa) * t);
        int cr = Math.round(ar + (br - ar) * t);
        int cg = Math.round(ag + (bg - ag) * t);
        int cb = Math.round(ab + (bb - ab) * t);
        return (ca << 24) | (cr << 16) | (cg << 8) | cb;
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
