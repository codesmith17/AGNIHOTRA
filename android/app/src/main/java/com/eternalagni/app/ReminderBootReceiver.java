package com.eternalagni.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;
import com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver;
import com.eternalagni.app.widget.AgnihotraWidgetScheduler;

/**
 * Marks that ritual reminders should be rebuilt from the cached timings table.
 * Capacitor's LocalNotificationRestoreReceiver re-arms stored alarms on boot;
 * this flag ensures JS regenerates the rolling schedule (fresh dates after
 * midnight / reboot) on the next app start or resume.
 */
public class ReminderBootReceiver extends BroadcastReceiver {

    public static final String PREFS_NAME = "agnihotra_reminder_prefs";
    public static final String KEY_NEEDS_RESCHEDULE = "needs_reschedule";
    public static final String KEY_TRIGGER = "reschedule_trigger";
    public static final String KEY_FLAGGED_AT_MS = "flagged_at_ms";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        UserManager um = context.getSystemService(UserManager.class);
        if (um == null || !um.isUserUnlocked()) {
            return;
        }

        String action = intent.getAction();
        boolean relevant =
            Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action);
        if (!relevant) {
            return;
        }

        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_NEEDS_RESCHEDULE, true)
            .putString(KEY_TRIGGER, action)
            .putLong(KEY_FLAGGED_AT_MS, System.currentTimeMillis())
            .apply();

        if (
            Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
        ) {
            try {
                new LocalNotificationRestoreReceiver().onReceive(context, intent);
            } catch (Throwable ignored) {
                // Capacitor restore is best-effort; JS rebuilds on next launch.
            }
        }

        if (
            Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
        ) {
            try {
                AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
            } catch (Throwable ignored) {
                // Widget refresh is best-effort until the app syncs timings again.
            }
        }

        // Re-arm the natively-rendered ritual reminders from their persisted
        // schedule. AlarmManager alarms are cleared on reboot, so without this
        // the next reminder would be lost until the app is reopened.
        try {
            StyledReminderScheduler.rescheduleFromStorage(context.getApplicationContext());
        } catch (Throwable ignored) {
            // Best-effort; JS rebuilds the full schedule on next launch.
        }
    }
}
