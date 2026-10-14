package com.eternalagni.app;

import android.webkit.JavascriptInterface;
import android.util.Log;

public class AgnihotraNativeBridge {
    private static final String TAG = "AgnihotraNativeBridge";
    private static volatile boolean isLibraryLoaded = false;
    private static String libraryLoadError = null;

    static {
        try {
            System.loadLibrary("agnihotra_core");
            isLibraryLoaded = true;
            Log.i(TAG, "[INIT] libagnihotra_core.so loaded successfully into process");
        } catch (Throwable t) {
            libraryLoadError = t.getMessage();
            Log.e(TAG, "[INIT] CRITICAL: Failed to load libagnihotra_core.so", t);
        }
    }

    public static native String nativeCalculateDay(
        int year, int month, int day, double lat, double lng, double tzOffset
    );

    public static native String nativeCalculateRange(
        int startYear, int startMonth, int startDay, int days, double lat, double lng, double tzOffset
    );

    @JavascriptInterface
    public boolean isReady() {
        return isLibraryLoaded;
    }

    @JavascriptInterface
    public String getStatus() {
        if (isLibraryLoaded) {
            return "{\"ready\":true,\"library\":\"agnihotra_core\"}";
        } else {
            return "{\"ready\":false,\"error\":\"" + (libraryLoadError != null ? libraryLoadError : "unknown") + "\"}";
        }
    }

    @JavascriptInterface
    public String calculateDay(int year, int month, int day, double lat, double lng, double tzOffset) {
        long startTime = System.currentTimeMillis();
        try {
            if (!isLibraryLoaded) {
                Log.e(TAG, "[CALC_DAY] Library not loaded, aborting calculation for " + year + "-" + month + "-" + day);
                return "{\"isValid\":false,\"error\":\"library_not_loaded\"}";
            }

            String result = nativeCalculateDay(year, month, day, lat, lng, tzOffset);
            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, String.format("[CALC_DAY] Date: %04d-%02d-%02d | Lat: %.4f | Lng: %.4f | TZ: %.2f | Elapsed: %d ms | Result: %s",
                year, month, day, lat, lng, tzOffset, elapsed, (result != null ? result : "null")));
            return result != null ? result : "{\"isValid\":false}";
        } catch (Throwable t) {
            Log.e(TAG, String.format("[CALC_DAY] Exception during calculation for %04d-%02d-%02d (lat=%.4f, lng=%.4f)",
                year, month, day, lat, lng), t);
            return "{\"isValid\":false}";
        }
    }

    @JavascriptInterface
    public String calculateRange(int startYear, int startMonth, int startDay, int days, double lat, double lng, double tzOffset) {
        long startTime = System.currentTimeMillis();
        try {
            if (!isLibraryLoaded) {
                Log.e(TAG, "[CALC_RANGE] Library not loaded, aborting range calculation");
                return "{}";
            }

            Log.i(TAG, String.format("[CALC_RANGE] Starting: start=%04d-%02d-%02d, days=%d, lat=%.4f, lng=%.4f, tz=%.2f",
                startYear, startMonth, startDay, days, lat, lng, tzOffset));

            String result = nativeCalculateRange(startYear, startMonth, startDay, days, lat, lng, tzOffset);
            long elapsed = System.currentTimeMillis() - startTime;
            int payloadLen = (result != null) ? result.length() : 0;

            Log.i(TAG, String.format("[CALC_RANGE] Finished: %d days generated in %d ms (payload: %d bytes)",
                days, elapsed, payloadLen));

            return result != null ? result : "{}";
        } catch (Throwable t) {
            Log.e(TAG, String.format("[CALC_RANGE] Exception during range calculation for start=%04d-%02d-%02d (days=%d)",
                startYear, startMonth, startDay, days), t);
            return "{}";
        }
    }
}

