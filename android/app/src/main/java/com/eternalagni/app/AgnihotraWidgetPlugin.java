package com.eternalagni.app;

import com.eternalagni.app.widget.AgnihotraWidgetScheduler;
import com.eternalagni.app.widget.AgnihotraWidgetStorage;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "AgnihotraWidget")
public class AgnihotraWidgetPlugin extends Plugin {

    @PluginMethod
    public void setNextTiming(PluginCall call) {
        String label = call.getString("label", "");
        long targetMs = call.getLong("targetMs", 0L);
        String timeText = call.getString("timeText", "");
        boolean isSunrise = call.getBoolean("isSunrise", true);
        String widgetTitle = call.getString("widgetTitle", "");
        String widgetCountdownLabel = call.getString("widgetCountdownLabel", "");
        String widgetTimePassedLabel = call.getString("widgetTimePassedLabel", "");
        String widgetNoTimingLabel = call.getString("widgetNoTimingLabel", "");
        String locationTag = call.getString("locationTag", "");
        String upcomingEventsJson = serializeUpcomingEvents(call.getArray("upcomingEvents"));

        if (targetMs <= 0L || label == null || label.isEmpty()) {
            call.reject("Valid label and targetMs are required");
            return;
        }

        AgnihotraWidgetStorage.saveNextTiming(
                getContext(),
                label,
                targetMs,
                timeText,
                isSunrise,
                widgetTitle,
                widgetCountdownLabel,
                widgetTimePassedLabel,
                widgetNoTimingLabel,
                upcomingEventsJson,
                locationTag
        );
        AgnihotraWidgetScheduler.refreshAndReschedule(getContext());

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setLocalizationStrings(PluginCall call) {
        String widgetTitle = call.getString("widgetTitle", "");
        String widgetCountdownLabel = call.getString("widgetCountdownLabel", "");
        String widgetTimePassedLabel = call.getString("widgetTimePassedLabel", "");
        String widgetNoTimingLabel = call.getString("widgetNoTimingLabel", "");

        AgnihotraWidgetStorage.saveLocalization(
                getContext(),
                widgetTitle,
                widgetCountdownLabel,
                widgetTimePassedLabel,
                widgetNoTimingLabel
        );
        AgnihotraWidgetScheduler.refreshAndReschedule(getContext());

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    private static String serializeUpcomingEvents(JSArray upcomingEvents) {
        if (upcomingEvents == null) {
            return "";
        }
        try {
            JSONArray json = new JSONArray(upcomingEvents.toString());
            return json.toString();
        } catch (Exception ignored) {
            return "";
        }
    }
}
