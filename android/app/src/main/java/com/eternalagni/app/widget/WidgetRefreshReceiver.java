package com.eternalagni.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class WidgetRefreshReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        try {
            AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
        } catch (Throwable ignored) {
            // Best-effort refresh; never crash the broadcast (e.g. during boot).
        }
    }
}
