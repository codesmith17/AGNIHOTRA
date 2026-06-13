package com.eternalagni.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import com.eternalagni.app.support.AgniLog;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Schedules ritual reminders as native exact alarms and posts them through
 * {@link ReminderStyledNotifier}, replacing the stock Capacitor reminder render
 * so reminders share the app's modern notification theme.
 *
 * <p>Reliability is preserved by: (1) persisting the full schedule in
 * SharedPreferences so it can be re-armed after a reboot (see
 * {@link ReminderBootReceiver}); (2) using the same punctual alarm strategy as
 * the widget — {@link AlarmManager#setAlarmClock} first (not deferred by Doze /
 * aggressive OEM battery managers) with an exact-allow-while-idle fallback; and
 * (3) posting on the existing reminder channel so the configured custom sound,
 * vibration, and high importance are inherited unchanged.
 */
public final class StyledReminderScheduler {

    private static final String TAG = "AgniReminder";

    static final String ACTION_FIRE = "com.eternalagni.app.action.REMINDER_FIRE";
    static final String SCHEME = "agnihotra-reminder";

    private static final String KEY_LIST = "styled_reminders_json";
    private static final String KEY_CHANNEL = "styled_reminders_channel";
    private static final String KEY_VIBRATE = "styled_reminders_vibrate";

    static final String EXTRA_ID = "id";
    static final String EXTRA_EYEBROW = "eyebrow";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_CHANNEL = "channel";
    static final String EXTRA_VIBRATE = "vibrate";
    static final String EXTRA_ONESHOT = "oneshot";

    private StyledReminderScheduler() {}

    /**
     * Arms a single, self-contained reminder whose content travels in the alarm
     * intent extras. Used for the test reminder so it does NOT disturb the
     * persisted upcoming-reminder schedule.
     */
    public static void scheduleOneShot(
            Context context,
            int id,
            long atMs,
            String eyebrow,
            String title,
            String body,
            String channelId,
            boolean vibrate
    ) {
        Context appContext = context.getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) appContext.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(appContext, ReminderAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.setData(Uri.parse(SCHEME + "://oneshot/" + id));
        intent.putExtra(EXTRA_ID, id);
        intent.putExtra(EXTRA_ONESHOT, true);
        intent.putExtra(EXTRA_EYEBROW, eyebrow);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_BODY, body);
        intent.putExtra(EXTRA_CHANNEL, channelId);
        intent.putExtra(EXTRA_VIBRATE, vibrate);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(appContext, id, intent, flags);

        try {
            AlarmManager.AlarmClockInfo info =
                    new AlarmManager.AlarmClockInfo(atMs, buildShowIntent(appContext, id));
            alarmManager.setAlarmClock(info, pi);
        } catch (Throwable t) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, atMs, pi);
                }
            } catch (SecurityException e) {
                alarmManager.set(AlarmManager.RTC_WAKEUP, atMs, pi);
            }
        }
        AgniLog.i(appContext, TAG, "styled one-shot reminder armed id=" + id + " atMs=" + atMs);
    }

    /**
     * Replaces the whole styled-reminder schedule with {@code reminders}.
     * Each item: {id:int, eyebrow:string, title:string, body:string, atMs:long}.
     */
    public static int schedule(Context context, JSONArray reminders, String channelId, boolean vibrate) {
        Context appContext = context.getApplicationContext();
        cancelArmedAlarms(appContext, readList(appContext));

        SharedPreferences prefs = prefs(appContext);
        JSONArray persisted = new JSONArray();
        long now = System.currentTimeMillis();
        int armed = 0;

        if (reminders != null) {
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject item = reminders.optJSONObject(i);
                if (item == null) continue;
                int id = item.optInt("id", 0);
                long atMs = item.optLong("atMs", 0L);
                if (id == 0 || atMs <= now) continue;
                persisted.put(item);
                armOne(appContext, id, atMs);
                armed++;
            }
        }

        prefs.edit()
                .putString(KEY_LIST, persisted.toString())
                .putString(KEY_CHANNEL, channelId == null ? "" : channelId)
                .putBoolean(KEY_VIBRATE, vibrate)
                .apply();

        AgniLog.i(appContext, TAG, "styled reminders scheduled armed=" + armed
                + " channel=" + channelId + " vibrate=" + vibrate);
        return armed;
    }

    public static void cancelAll(Context context) {
        Context appContext = context.getApplicationContext();
        cancelArmedAlarms(appContext, readList(appContext));
        prefs(appContext).edit()
                .remove(KEY_LIST)
                .remove(KEY_CHANNEL)
                .remove(KEY_VIBRATE)
                .apply();
        AgniLog.i(appContext, TAG, "styled reminders cancelled (all)");
    }

    /** Re-arms persisted future reminders. Called after reboot / time change. */
    public static void rescheduleFromStorage(Context context) {
        Context appContext = context.getApplicationContext();
        JSONArray list = readList(appContext);
        long now = System.currentTimeMillis();
        int armed = 0;
        JSONArray kept = new JSONArray();
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null) continue;
            int id = item.optInt("id", 0);
            long atMs = item.optLong("atMs", 0L);
            if (id == 0 || atMs <= now) continue;
            kept.put(item);
            armOne(appContext, id, atMs);
            armed++;
        }
        prefs(appContext).edit().putString(KEY_LIST, kept.toString()).apply();
        AgniLog.i(appContext, TAG, "styled reminders re-armed from storage armed=" + armed);
    }

    /** Handles a fired alarm: posts the styled notification, drops it from storage. */
    static void onFired(Context context, int id) {
        Context appContext = context.getApplicationContext();
        SharedPreferences prefs = prefs(appContext);
        JSONArray list = readList(appContext);
        String channelId = prefs.getString(KEY_CHANNEL, "");
        boolean vibrate = prefs.getBoolean(KEY_VIBRATE, true);

        JSONObject match = null;
        JSONArray remaining = new JSONArray();
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null) continue;
            if (item.optInt("id", 0) == id && match == null) {
                match = item;
            } else {
                remaining.put(item);
            }
        }
        prefs.edit().putString(KEY_LIST, remaining.toString()).apply();

        if (match == null) {
            AgniLog.w(appContext, TAG, "styled reminder fired but no stored entry id=" + id);
            return;
        }

        ReminderStyledNotifier.post(
                appContext,
                id,
                match.optString("eyebrow", ""),
                match.optString("title", ""),
                match.optString("body", ""),
                channelId,
                vibrate
        );
    }

    private static void armOne(Context context, int id, long atMs) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        PendingIntent pi = buildFirePendingIntent(context, id);

        boolean alarmClockSet = false;
        try {
            AlarmManager.AlarmClockInfo info =
                    new AlarmManager.AlarmClockInfo(atMs, buildShowIntent(context, id));
            alarmManager.setAlarmClock(info, pi);
            alarmClockSet = true;
        } catch (Throwable t) {
            AgniLog.w(context, TAG, "setAlarmClock failed id=" + id + "; falling back", t);
        }

        if (!alarmClockSet) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, atMs, pi);
                }
            } catch (SecurityException e) {
                alarmManager.set(AlarmManager.RTC_WAKEUP, atMs, pi);
                AgniLog.w(context, TAG, "exact alarm denied id=" + id + " -> inexact set()", e);
            }
        }
    }

    private static void cancelArmedAlarms(Context context, JSONArray list) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.optJSONObject(i);
            if (item == null) continue;
            int id = item.optInt("id", 0);
            if (id == 0) continue;
            alarmManager.cancel(buildFirePendingIntent(context, id));
        }
    }

    private static PendingIntent buildFirePendingIntent(Context context, int id) {
        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.setData(Uri.parse(SCHEME + "://" + id));
        intent.putExtra(EXTRA_ID, id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, id, intent, flags);
    }

    private static PendingIntent buildShowIntent(Context context, int id) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, 90000 + id, intent, flags);
    }

    private static JSONArray readList(Context context) {
        try {
            String raw = prefs(context).getString(KEY_LIST, "[]");
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (Throwable t) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(ReminderBootReceiver.PREFS_NAME, Context.MODE_PRIVATE);
    }
}
