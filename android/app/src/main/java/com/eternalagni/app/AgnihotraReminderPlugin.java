package com.eternalagni.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgnihotraReminder")
public class AgnihotraReminderPlugin extends Plugin {

    @PluginMethod
    public void consumeRescheduleFlag(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(ReminderBootReceiver.PREFS_NAME, Context.MODE_PRIVATE);
        boolean needs = prefs.getBoolean(ReminderBootReceiver.KEY_NEEDS_RESCHEDULE, false);
        String trigger = prefs.getString(ReminderBootReceiver.KEY_TRIGGER, "");
        long flaggedAtMs = prefs.getLong(ReminderBootReceiver.KEY_FLAGGED_AT_MS, 0L);

        if (needs) {
            prefs
                .edit()
                .remove(ReminderBootReceiver.KEY_NEEDS_RESCHEDULE)
                .remove(ReminderBootReceiver.KEY_TRIGGER)
                .remove(ReminderBootReceiver.KEY_FLAGGED_AT_MS)
                .apply();
        }

        JSObject result = new JSObject();
        result.put("needsReschedule", needs);
        result.put("trigger", trigger == null ? "" : trigger);
        result.put("flaggedAtMs", flaggedAtMs);
        call.resolve(result);
    }
}
