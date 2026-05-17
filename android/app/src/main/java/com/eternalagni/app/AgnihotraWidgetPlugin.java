package com.eternalagni.app;

import com.eternalagni.app.widget.AgnihotraWidgetProvider;
import com.eternalagni.app.widget.AgnihotraWidgetStorage;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgnihotraWidget")
public class AgnihotraWidgetPlugin extends Plugin {

    @PluginMethod
    public void setNextTiming(PluginCall call) {
        String label = call.getString("label", "");
        long targetMs = call.getLong("targetMs", 0L);
        String timeText = call.getString("timeText", "");
        String widgetTitle = call.getString("widgetTitle", "");
        String widgetCountdownLabel = call.getString("widgetCountdownLabel", "");
        String widgetTimePassedLabel = call.getString("widgetTimePassedLabel", "");
        String widgetNoTimingLabel = call.getString("widgetNoTimingLabel", "");

        if (targetMs <= 0L || label == null || label.isEmpty()) {
            call.reject("Valid label and targetMs are required");
            return;
        }

        AgnihotraWidgetStorage.saveNextTiming(
                getContext(),
                label,
                targetMs,
                timeText,
                widgetTitle,
                widgetCountdownLabel,
                widgetTimePassedLabel,
                widgetNoTimingLabel
        );
        AgnihotraWidgetProvider.updateAllWidgets(getContext());

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
        AgnihotraWidgetProvider.updateAllWidgets(getContext());

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}
