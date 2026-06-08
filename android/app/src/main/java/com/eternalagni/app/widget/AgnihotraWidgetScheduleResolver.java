package com.eternalagni.app.widget;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AgnihotraWidgetScheduleResolver {

    private AgnihotraWidgetScheduleResolver() {}

    public static AgnihotraWidgetStorage.WidgetPayload resolveAndPersist(Context context) {
        AgnihotraWidgetStorage.WidgetPayload payload = AgnihotraWidgetStorage.read(context);
        long now = System.currentTimeMillis();
        ScheduledEvent next = pickNextEvent(payload.upcomingEventsJson, now);

        if (next != null) {
            payload.label = next.label;
            payload.targetMs = next.targetMs;
            payload.timeText = next.timeText;
            payload.isSunrise = next.isSunrise;
            AgnihotraWidgetStorage.saveActiveTiming(
                    context,
                    next.label,
                    next.targetMs,
                    next.timeText,
                    next.isSunrise
            );
            return payload;
        }

        if (payload.hasTiming() && payload.targetMs > now) {
            return payload;
        }

        payload.label = "";
        payload.targetMs = 0L;
        payload.timeText = "";
        payload.isSunrise = true;
        AgnihotraWidgetStorage.clearActiveTiming(context);
        return payload;
    }

    private static ScheduledEvent pickNextEvent(String json, long now) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        try {
            JSONArray array = new JSONArray(json);
            ScheduledEvent best = null;
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.optJSONObject(i);
                if (item == null) continue;
                long targetMs = item.optLong("targetMs", 0L);
                if (targetMs <= now) continue;
                ScheduledEvent candidate = new ScheduledEvent(
                        item.optString("label", ""),
                        targetMs,
                        item.optString("timeText", ""),
                        item.optBoolean("isSunrise", true)
                );
                if (best == null || candidate.targetMs < best.targetMs) {
                    best = candidate;
                }
            }
            return best;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static final class ScheduledEvent {
        final String label;
        final long targetMs;
        final String timeText;
        final boolean isSunrise;

        ScheduledEvent(String label, long targetMs, String timeText, boolean isSunrise) {
            this.label = label == null ? "" : label;
            this.targetMs = targetMs;
            this.timeText = timeText == null ? "" : timeText;
            this.isSunrise = isSunrise;
        }
    }
}
