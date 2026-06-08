package com.eternalagni.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class WidgetRefreshReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        AgnihotraWidgetScheduler.refreshAndReschedule(context.getApplicationContext());
    }
}
