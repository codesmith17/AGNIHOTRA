package com.eternalagni.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgnihotraWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        // Keep the device screen awake whenever the app's window is in the
        // foreground. This is automatically cleared when the activity is
        // backgrounded by the OS, so the phone goes to sleep normally once
        // the user leaves the app.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
