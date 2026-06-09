package com.eternalagni.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

public final class AgnihotraWidgetStorage {
    private static final String PREFS_NAME = "agnihotra_widget_prefs";
    private static final String KEY_LABEL = "next_label";
    private static final String KEY_TARGET_MS = "next_target_ms";
    private static final String KEY_TIME_TEXT = "next_time_text";
    private static final String KEY_IS_SUNRISE = "next_is_sunrise";
    private static final String KEY_UPDATED_AT_MS = "updated_at_ms";
    private static final String KEY_WIDGET_TITLE = "widget_title";
    private static final String KEY_WIDGET_COUNTDOWN_LABEL = "widget_countdown_label";
    private static final String KEY_WIDGET_TIME_PASSED_LABEL = "widget_time_passed_label";
    private static final String KEY_WIDGET_NO_TIMING_LABEL = "widget_no_timing_label";
    private static final String KEY_UPCOMING_EVENTS_JSON = "upcoming_events_json";
    private static final String KEY_LOCATION_TAG = "location_tag";

    private AgnihotraWidgetStorage() {}

    public static void saveNextTiming(
            Context context,
            String label,
            long targetMs,
            String timeText,
            boolean isSunrise,
            String widgetTitle,
            String widgetCountdownLabel,
            String widgetTimePassedLabel,
            String widgetNoTimingLabel,
            String upcomingEventsJson,
            String locationTag
    ) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit()
                .putString(KEY_LABEL, label == null ? "" : label)
                .putLong(KEY_TARGET_MS, targetMs)
                .putString(KEY_TIME_TEXT, timeText == null ? "" : timeText)
                .putBoolean(KEY_IS_SUNRISE, isSunrise)
                .putString(KEY_WIDGET_TITLE, widgetTitle == null ? "" : widgetTitle)
                .putString(KEY_WIDGET_COUNTDOWN_LABEL, widgetCountdownLabel == null ? "" : widgetCountdownLabel)
                .putString(KEY_WIDGET_TIME_PASSED_LABEL, widgetTimePassedLabel == null ? "" : widgetTimePassedLabel)
                .putString(KEY_WIDGET_NO_TIMING_LABEL, widgetNoTimingLabel == null ? "" : widgetNoTimingLabel)
                .putString(KEY_LOCATION_TAG, locationTag == null ? "" : locationTag)
                .putLong(KEY_UPDATED_AT_MS, System.currentTimeMillis());
        if (upcomingEventsJson != null && !upcomingEventsJson.trim().isEmpty()) {
            editor.putString(KEY_UPCOMING_EVENTS_JSON, upcomingEventsJson);
        }
        editor.apply();
    }

    public static void saveActiveTiming(
            Context context,
            String label,
            long targetMs,
            String timeText,
            boolean isSunrise
    ) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_LABEL, label == null ? "" : label)
                .putLong(KEY_TARGET_MS, targetMs)
                .putString(KEY_TIME_TEXT, timeText == null ? "" : timeText)
                .putBoolean(KEY_IS_SUNRISE, isSunrise)
                .putLong(KEY_UPDATED_AT_MS, System.currentTimeMillis())
                .apply();
    }

    public static void clearActiveTiming(Context context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_LABEL, "")
                .putLong(KEY_TARGET_MS, 0L)
                .putString(KEY_TIME_TEXT, "")
                .apply();
    }

    public static void saveLocalization(
            Context context,
            String widgetTitle,
            String widgetCountdownLabel,
            String widgetTimePassedLabel,
            String widgetNoTimingLabel
    ) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_WIDGET_TITLE, widgetTitle == null ? "" : widgetTitle)
                .putString(KEY_WIDGET_COUNTDOWN_LABEL, widgetCountdownLabel == null ? "" : widgetCountdownLabel)
                .putString(KEY_WIDGET_TIME_PASSED_LABEL, widgetTimePassedLabel == null ? "" : widgetTimePassedLabel)
                .putString(KEY_WIDGET_NO_TIMING_LABEL, widgetNoTimingLabel == null ? "" : widgetNoTimingLabel)
                .putLong(KEY_UPDATED_AT_MS, System.currentTimeMillis())
                .apply();
    }

    public static WidgetPayload read(Context context) {
        WidgetPayload payload = new WidgetPayload();
        SharedPreferences prefs;
        try {
            prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        } catch (Throwable t) {
            // Credential-encrypted prefs can be unavailable before the user
            // unlocks the device (direct boot). Return safe defaults so the
            // widget still renders instead of crashing the boot broadcast.
            payload.label = "";
            payload.timeText = "";
            payload.isSunrise = true;
            payload.widgetTitle = "";
            payload.widgetCountdownLabel = "";
            payload.widgetTimePassedLabel = "";
            payload.widgetNoTimingLabel = "";
            payload.upcomingEventsJson = "";
            payload.locationTag = "";
            return payload;
        }
        payload.label = prefs.getString(KEY_LABEL, "");
        payload.targetMs = prefs.getLong(KEY_TARGET_MS, 0L);
        payload.timeText = prefs.getString(KEY_TIME_TEXT, "");
        payload.isSunrise = prefs.getBoolean(KEY_IS_SUNRISE, true);
        payload.widgetTitle = prefs.getString(KEY_WIDGET_TITLE, "");
        payload.widgetCountdownLabel = prefs.getString(KEY_WIDGET_COUNTDOWN_LABEL, "");
        payload.widgetTimePassedLabel = prefs.getString(KEY_WIDGET_TIME_PASSED_LABEL, "");
        payload.widgetNoTimingLabel = prefs.getString(KEY_WIDGET_NO_TIMING_LABEL, "");
        payload.upcomingEventsJson = prefs.getString(KEY_UPCOMING_EVENTS_JSON, "");
        payload.locationTag = prefs.getString(KEY_LOCATION_TAG, "");
        payload.updatedAtMs = prefs.getLong(KEY_UPDATED_AT_MS, 0L);
        return payload;
    }

    public static final class WidgetPayload {
        public String label;
        public long targetMs;
        public String timeText;
        public boolean isSunrise;
        public String widgetTitle;
        public String widgetCountdownLabel;
        public String widgetTimePassedLabel;
        public String widgetNoTimingLabel;
        public String upcomingEventsJson;
        public String locationTag;
        public long updatedAtMs;

        public boolean hasTiming() {
            return targetMs > 0L && label != null && !label.isEmpty();
        }
    }
}
