package com.eternalagni.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives the exact alarm armed by {@link StyledReminderScheduler} and posts
 * the themed reminder notification at the precise reminder instant.
 */
public class ReminderAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !StyledReminderScheduler.ACTION_FIRE.equals(intent.getAction())) {
            return;
        }
        int id = intent.getIntExtra(StyledReminderScheduler.EXTRA_ID, 0);
        if (id == 0) return;

        // One-shot (test) reminders carry their content in the intent so they
        // never touch the persisted upcoming-reminder schedule.
        if (intent.getBooleanExtra(StyledReminderScheduler.EXTRA_ONESHOT, false)) {
            ReminderStyledNotifier.post(
                    context,
                    id,
                    intent.getStringExtra(StyledReminderScheduler.EXTRA_EYEBROW),
                    intent.getStringExtra(StyledReminderScheduler.EXTRA_TITLE),
                    intent.getStringExtra(StyledReminderScheduler.EXTRA_BODY),
                    intent.getStringExtra(StyledReminderScheduler.EXTRA_CHANNEL),
                    intent.getBooleanExtra(StyledReminderScheduler.EXTRA_VIBRATE, true)
            );
            return;
        }

        StyledReminderScheduler.onFired(context, id);
    }
}
