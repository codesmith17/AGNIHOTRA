package com.eternalagni.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
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
    public void setLockScreenCountdown(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        AgnihotraWidgetStorage.setLockCountdownEnabled(getContext(), enabled);
        // Refresh drives LockCountdownNotifier.update(), which posts the ongoing
        // countdown when enabled or cancels it when disabled.
        AgnihotraWidgetScheduler.refreshAndReschedule(getContext());

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void getLockScreenCountdown(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", AgnihotraWidgetStorage.isLockCountdownEnabled(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void areNotificationsEnabled(PluginCall call) {
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to open notification settings", e);
        }
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
