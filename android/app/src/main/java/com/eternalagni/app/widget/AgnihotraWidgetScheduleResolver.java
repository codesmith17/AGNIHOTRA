package com.eternalagni.app.widget;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AgnihotraWidgetScheduleResolver {

    // Mirror the in-app behaviour: after an event fires, keep showing it in a
    // "moment complete" state for this long before advancing to the next event
    // (script.js JUST_PASSED_GRACE_MS).
    public static final long JUST_PASSED_GRACE_MS = 15_000L;

    private AgnihotraWidgetScheduleResolver() {}

    public static AgnihotraWidgetStorage.WidgetPayload resolveAndPersist(Context context) {
        AgnihotraWidgetStorage.WidgetPayload payload = AgnihotraWidgetStorage.read(context);
        long now = System.currentTimeMillis();

        // A freshly-passed event (within the grace window) wins: hold it so the
        // widget shows "moment complete" instead of jumping or counting negative.
        ScheduledEvent justPassed = pickJustPassedEvent(payload.upcomingEventsJson, now);
        if (justPassed != null) {
            payload.label = justPassed.label;
            payload.targetMs = justPassed.targetMs;
            payload.timeText = justPassed.timeText;
            payload.isSunrise = justPassed.isSunrise;
            AgnihotraWidgetStorage.saveActiveTiming(
                    context, justPassed.label, justPassed.targetMs, justPassed.timeText, justPassed.isSunrise);
            return payload;
        }

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

        // No upcoming-events array: keep the active timing while it's upcoming OR
        // still inside its post-event grace window (so the completed state shows).
        if (payload.hasTiming() && payload.targetMs > now - JUST_PASSED_GRACE_MS) {
            return payload;
        }

        payload.label = "";
        payload.targetMs = 0L;
        payload.timeText = "";
        payload.isSunrise = true;
        AgnihotraWidgetStorage.clearActiveTiming(context);
        return payload;
    }

    /** Most recently passed event whose time is still within the grace window. */
    private static ScheduledEvent pickJustPassedEvent(String json, long now) {
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
                // Passed, but not longer ago than the grace window.
                if (targetMs <= 0L || targetMs > now || targetMs <= now - JUST_PASSED_GRACE_MS) {
                    continue;
                }
                ScheduledEvent candidate = new ScheduledEvent(
                        item.optString("label", ""),
                        targetMs,
                        item.optString("timeText", ""),
                        item.optBoolean("isSunrise", true)
                );
                if (best == null || candidate.targetMs > best.targetMs) {
                    best = candidate;
                }
            }
            return best;
        } catch (Exception ignored) {
            return null;
        }
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
