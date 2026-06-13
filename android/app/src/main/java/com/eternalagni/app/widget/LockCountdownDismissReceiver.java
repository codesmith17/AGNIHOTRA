package com.eternalagni.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Re-posts the persistent Agnihotra countdown notification if the user swipes it
 * away. On Android 14+ {@code setOngoing(true)} no longer blocks dismissal, so we
 * use this delete-intent trick (the same pattern apps like Flipkart use) to keep
 * the countdown effectively sticky. The user can still turn it off via Settings.
 */
public class LockCountdownDismissReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        LockCountdownNotifier.update(context.getApplicationContext());
    }
}
