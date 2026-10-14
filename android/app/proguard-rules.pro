# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve JavaScript interface annotations & bridge methods
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve native JNI methods so C++ symbols can resolve them
-keepclasseswithmembernames class * {
    native <methods>;
}

# Preserve Capacitor core, bridge and plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public void *(com.getcapacitor.PluginCall);
}

# Preserve all app classes, receivers, and native bridge
-keep class com.eternalagni.app.** { *; }

# Preserve Cordova compatibility plugins
-keep class org.apache.cordova.** { *; }

# Preserve AndroidX Splashscreen
-keep class androidx.core.splashscreen.** { *; }
-keepclassmembers class androidx.core.splashscreen.** { *; }

# Line numbers for crash stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
