package com.eternalagni.app;

import android.webkit.JavascriptInterface;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AgnihotraNativeTiming")
public class AgnihotraNativeTimingPlugin extends Plugin {

    static {
        try {
            System.loadLibrary("agnihotra_core");
        } catch (UnsatisfiedLinkError e) {
            android.util.Log.e("AgnihotraNative", "Failed to load native library agnihotra_core", e);
        }
    }

    // Native C++ methods compiled in libagnihotra_core.so
    public static native String nativeCalculateDay(
        int year, int month, int day, double lat, double lng, double tzOffset
    );

    public static native String nativeCalculateRange(
        int startYear, int startMonth, int startDay, int days, double lat, double lng, double tzOffset
    );

    @Override
    public void load() {
        super.load();
        // Injects high-performance synchronous JavaScript interface into WebView
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                getBridge().getWebView().addJavascriptInterface(new NativeTimingBridgeInterface(), "AgnihotraNativeCore");
            });
        }
    }

    public static class NativeTimingBridgeInterface {
        @JavascriptInterface
        public String calculateDay(int year, int month, int day, double lat, double lng, double tzOffset) {
            try {
                return nativeCalculateDay(year, month, day, lat, lng, tzOffset);
            } catch (Throwable t) {
                return "{\"isValid\":false}";
            }
        }

        @JavascriptInterface
        public String calculateRange(int startYear, int startMonth, int startDay, int days, double lat, double lng, double tzOffset) {
            try {
                return nativeCalculateRange(startYear, startMonth, startDay, days, lat, lng, tzOffset);
            } catch (Throwable t) {
                return "{}";
            }
        }
    }

    @PluginMethod
    public void calculateDay(PluginCall call) {
        try {
            int year = call.getInt("year", 2026);
            int month = call.getInt("month", 1);
            int day = call.getInt("day", 1);
            double lat = call.getDouble("lat", 0.0);
            double lng = call.getDouble("lng", 0.0);
            double tzOffset = call.getDouble("tzOffset", 5.5);

            String jsonStr = nativeCalculateDay(year, month, day, lat, lng, tzOffset);
            JSObject res = new JSObject(jsonStr);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Native calculation failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void calculateRange(PluginCall call) {
        try {
            int startYear = call.getInt("startYear", 2026);
            int startMonth = call.getInt("startMonth", 1);
            int startDay = call.getInt("startDay", 1);
            int days = call.getInt("days", 92);
            double lat = call.getDouble("lat", 0.0);
            double lng = call.getDouble("lng", 0.0);
            double tzOffset = call.getDouble("tzOffset", 5.5);

            String jsonStr = nativeCalculateRange(startYear, startMonth, startDay, days, lat, lng, tzOffset);
            JSObject res = new JSObject(jsonStr);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Native range calculation failed: " + e.getMessage(), e);
        }
    }
}
