package com.eternalagni.app;

import android.webkit.JavascriptInterface;
import android.util.Log;

public class AgnihotraNativeBridge {
    private static final String TAG = "AgnihotraNative";

    static {
        try {
            System.loadLibrary("agnihotra_core");
            Log.i(TAG, "libagnihotra_core.so loaded successfully");
        } catch (Throwable t) {
            Log.e(TAG, "Failed to load libagnihotra_core.so", t);
        }
    }

    public static native String nativeCalculateDay(
        int year, int month, int day, double lat, double lng, double tzOffset
    );

    public static native String nativeCalculateRange(
        int startYear, int startMonth, int startDay, int days, double lat, double lng, double tzOffset
    );

    @JavascriptInterface
    public String calculateDay(int year, int month, int day, double lat, double lng, double tzOffset) {
        try {
            String result = nativeCalculateDay(year, month, day, lat, lng, tzOffset);
            return result;
        } catch (Throwable t) {
            Log.e(TAG, "nativeCalculateDay error", t);
            return "{\"isValid\":false}";
        }
    }

    @JavascriptInterface
    public String calculateRange(int startYear, int startMonth, int startDay, int days, double lat, double lng, double tzOffset) {
        try {
            String result = nativeCalculateRange(startYear, startMonth, startDay, days, lat, lng, tzOffset);
            return result;
        } catch (Throwable t) {
            Log.e(TAG, "nativeCalculateRange error", t);
            return "{}";
        }
    }
}
