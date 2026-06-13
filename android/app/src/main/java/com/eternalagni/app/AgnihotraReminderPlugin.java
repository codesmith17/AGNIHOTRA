package com.eternalagni.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "AgnihotraReminder")
public class AgnihotraReminderPlugin extends Plugin {

    /**
     * Replaces the whole styled-reminder schedule. Expects:
     * { reminders: [{ id, eyebrow, title, body, atMs }], channelId, vibrate }.
     * Reminders are rendered natively with the app's notification theme.
     */
    @PluginMethod
    public void scheduleStyledReminders(PluginCall call) {
        try {
            JSArray reminders = call.getArray("reminders", new JSArray());
            String channelId = call.getString("channelId", "");
            boolean vibrate = Boolean.TRUE.equals(call.getBoolean("vibrate", true));
            JSONArray asJson = reminders == null ? new JSONArray() : reminders;
            int armed = StyledReminderScheduler.schedule(getContext(), asJson, channelId, vibrate);
            JSObject result = new JSObject();
            result.put("scheduled", armed);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to schedule styled reminders: " + e.getMessage(), e);
        }
    }

    /**
     * Arms a single themed reminder without disturbing the upcoming schedule.
     * Expects: { id, atMs, eyebrow, title, body, channelId, vibrate }.
     */
    @PluginMethod
    public void scheduleStyledTestReminder(PluginCall call) {
        try {
            int id = call.getInt("id", 0);
            long atMs = (long) (double) call.getDouble("atMs", 0.0);
            if (id == 0 || atMs <= 0L) {
                call.reject("Invalid test reminder id/atMs");
                return;
            }
            StyledReminderScheduler.scheduleOneShot(
                    getContext(),
                    id,
                    atMs,
                    call.getString("eyebrow", "Agnihotra reminder"),
                    call.getString("title", "Test reminder"),
                    call.getString("body", ""),
                    call.getString("channelId", ""),
                    Boolean.TRUE.equals(call.getBoolean("vibrate", true))
            );
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to schedule styled test reminder: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cancelStyledReminders(PluginCall call) {
        try {
            StyledReminderScheduler.cancelAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to cancel styled reminders: " + e.getMessage(), e);
        }
    }

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
