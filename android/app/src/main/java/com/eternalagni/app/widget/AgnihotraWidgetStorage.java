package com.eternalagni.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

public final class AgnihotraWidgetStorage {
    private static final String PREFS_NAME = "agnihotra_widget_prefs";
    private static final String KEY_LABEL = "next_label";
    private static final String KEY_TARGET_MS = "next_target_ms";
    private static final String KEY_TIME_TEXT = "next_time_text";
    private static final String KEY_UPDATED_AT_MS = "updated_at_ms";
    private static final String KEY_WIDGET_TITLE = "widget_title";
    private static final String KEY_WIDGET_COUNTDOWN_LABEL = "widget_countdown_label";
    private static final String KEY_WIDGET_TIME_PASSED_LABEL = "widget_time_passed_label";
    private static final String KEY_WIDGET_NO_TIMING_LABEL = "widget_no_timing_label";

    private AgnihotraWidgetStorage() {}

    public static void saveNextTiming(
            Context context,
            String label,
            long targetMs,
            String timeText,
            String widgetTitle,
            String widgetCountdownLabel,
            String widgetTimePassedLabel,
            String widgetNoTimingLabel
    ) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_LABEL, label == null ? "" : label)
                .putLong(KEY_TARGET_MS, targetMs)
                .putString(KEY_TIME_TEXT, timeText == null ? "" : timeText)
                .putString(KEY_WIDGET_TITLE, widgetTitle == null ? "" : widgetTitle)
                .putString(KEY_WIDGET_COUNTDOWN_LABEL, widgetCountdownLabel == null ? "" : widgetCountdownLabel)
                .putString(KEY_WIDGET_TIME_PASSED_LABEL, widgetTimePassedLabel == null ? "" : widgetTimePassedLabel)
                .putString(KEY_WIDGET_NO_TIMING_LABEL, widgetNoTimingLabel == null ? "" : widgetNoTimingLabel)
                .putLong(KEY_UPDATED_AT_MS, System.currentTimeMillis())
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
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        WidgetPayload payload = new WidgetPayload();
        payload.label = prefs.getString(KEY_LABEL, "");
        payload.targetMs = prefs.getLong(KEY_TARGET_MS, 0L);
        payload.timeText = prefs.getString(KEY_TIME_TEXT, "");
        payload.widgetTitle = prefs.getString(KEY_WIDGET_TITLE, "");
        payload.widgetCountdownLabel = prefs.getString(KEY_WIDGET_COUNTDOWN_LABEL, "");
        payload.widgetTimePassedLabel = prefs.getString(KEY_WIDGET_TIME_PASSED_LABEL, "");
        payload.widgetNoTimingLabel = prefs.getString(KEY_WIDGET_NO_TIMING_LABEL, "");
        payload.updatedAtMs = prefs.getLong(KEY_UPDATED_AT_MS, 0L);
        return payload;
    }

    public static final class WidgetPayload {
        public String label;
        public long targetMs;
        public String timeText;
        public String widgetTitle;
        public String widgetCountdownLabel;
        public String widgetTimePassedLabel;
        public String widgetNoTimingLabel;
        public long updatedAtMs;

        public boolean hasTiming() {
            return targetMs > 0L && label != null && !label.isEmpty();
        }
    }
}
