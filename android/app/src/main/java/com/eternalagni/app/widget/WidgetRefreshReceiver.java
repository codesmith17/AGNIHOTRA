package com.eternalagni.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.eternalagni.app.support.AgniLog;

public class WidgetRefreshReceiver extends BroadcastReceiver {

    private static final String TAG = "AgniWidget";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        String action = intent != null ? intent.getAction() : null;
        AgniLog.i(context, TAG, "WidgetRefreshReceiver.onReceive action=" + action
                + " atMs=" + System.currentTimeMillis());
        try {
            AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
        } catch (Throwable t) {
            // Best-effort refresh; never crash the broadcast (e.g. during boot).
            AgniLog.w(context, TAG, "WidgetRefreshReceiver.onReceive refresh failed", t);
        }
    }
}
