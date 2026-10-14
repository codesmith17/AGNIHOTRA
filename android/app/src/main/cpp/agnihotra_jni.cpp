#include <jni.h>
#include <string>
#include <sstream>
#include <unistd.h>
#include <sys/ptrace.h>
#include <sys/types.h>
#include <fcntl.h>
#include <android/log.h>
#include "AgnihotraTimingEngine.h"

#define LOG_TAG "AgnihotraNative"

namespace {
    // -------------------------------------------------------------------------
    // ANTI-REVERSE-ENGINEERING & ANTI-DEBUGGING MEASURES
    // -------------------------------------------------------------------------

    inline bool isDebuggerAttached() __attribute__((always_inline));
    inline bool isDebuggerAttached() {
        int fd = open("/proc/self/status", O_RDONLY);
        if (fd == -1) {
            return false;
        }

        char buffer[1024];
        ssize_t bytesRead = read(fd, buffer, sizeof(buffer) - 1);
        close(fd);

        if (bytesRead <= 0) {
            return false;
        }
        buffer[bytesRead] = '\0';

        const char* tracerPidStr = strstr(buffer, "TracerPid:");
        if (tracerPidStr) {
            int tracerPid = 0;
            if (sscanf(tracerPidStr, "TracerPid:\t%d", &tracerPid) == 1) {
                if (tracerPid > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    inline void enforceAntiDebug() __attribute__((always_inline));
    inline void enforceAntiDebug() {
        #ifndef NDEBUG
        // allow debugging in dev mode
        #else
        ptrace(PTRACE_TRACEME, 0, 1, 0);
        #endif

        if (isDebuggerAttached()) {
            _exit(1);
        }
    }

    std::string internalCalculateDayJson(int year, int month, int day, double latitude, double longitude, double timezoneOffsetHours) {
        DailyTimingResult result = AgnihotraTimingEngine::calculateDay(
            year, month, day, latitude, longitude, timezoneOffsetHours
        );

        std::ostringstream json;
        json << "{\"date\":\"" << result.date << "\","
             << "\"sunrise\":\"" << result.sunrise << "\","
             << "\"sunset\":\"" << result.sunset << "\","
             << "\"isValid\":" << (result.isValid ? "true" : "false") << "}";
        return json.str();
    }

    std::string internalCalculateRangeJson(int startYear, int startMonth, int startDay, int totalDays, double latitude, double longitude, double timezoneOffsetHours) {
        std::vector<DailyTimingResult> results = AgnihotraTimingEngine::calculateRange(
            startYear, startMonth, startDay, totalDays, latitude, longitude, timezoneOffsetHours
        );

        __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, "[JNI] calculateRange: %zu days calculated for start %04d-%02d-%02d",
            results.size(), startYear, startMonth, startDay);

        std::ostringstream json;
        json << "{";
        for (size_t i = 0; i < results.size(); ++i) {
            if (i > 0) json << ",";
            json << "\"" << results[i].date << "\":{"
                 << "\"date\":\"" << results[i].date << "\","
                 << "\"sunrise\":\"" << results[i].sunrise << "\","
                 << "\"sunset\":\"" << results[i].sunset << "\"}";
        }
        json << "}";
        return json.str();
    }
}

extern "C" {

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* /* vm */, void* /* reserved */) {
    __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "[JNI] JNI_OnLoad: libagnihotra_core.so initialized successfully");
    return JNI_VERSION_1_6;
}

// -----------------------------------------------------------------------------
// JNI Exports for AgnihotraNativeBridge (WebView direct bridge)
// -----------------------------------------------------------------------------

JNIEXPORT jstring JNICALL
Java_com_eternalagni_app_AgnihotraNativeBridge_nativeCalculateDay(
    JNIEnv* env,
    jclass /* clazz */,
    jint year,
    jint month,
    jint day,
    jdouble latitude,
    jdouble longitude,
    jdouble timezoneOffsetHours
) {
    enforceAntiDebug();
    std::string jsonStr = internalCalculateDayJson(year, month, day, latitude, longitude, timezoneOffsetHours);
    return env->NewStringUTF(jsonStr.c_str());
}

JNIEXPORT jstring JNICALL
Java_com_eternalagni_app_AgnihotraNativeBridge_nativeCalculateRange(
    JNIEnv* env,
    jclass /* clazz */,
    jint startYear,
    jint startMonth,
    jint startDay,
    jint totalDays,
    jdouble latitude,
    jdouble longitude,
    jdouble timezoneOffsetHours
) {
    enforceAntiDebug();
    std::string jsonStr = internalCalculateRangeJson(startYear, startMonth, startDay, totalDays, latitude, longitude, timezoneOffsetHours);
    return env->NewStringUTF(jsonStr.c_str());
}

// -----------------------------------------------------------------------------
// JNI Exports for AgnihotraNativeTimingPlugin (Capacitor plugin)
// -----------------------------------------------------------------------------

JNIEXPORT jstring JNICALL
Java_com_eternalagni_app_AgnihotraNativeTimingPlugin_nativeCalculateDay(
    JNIEnv* env,
    jclass /* clazz */,
    jint year,
    jint month,
    jint day,
    jdouble latitude,
    jdouble longitude,
    jdouble timezoneOffsetHours
) {
    enforceAntiDebug();
    std::string jsonStr = internalCalculateDayJson(year, month, day, latitude, longitude, timezoneOffsetHours);
    return env->NewStringUTF(jsonStr.c_str());
}

JNIEXPORT jstring JNICALL
Java_com_eternalagni_app_AgnihotraNativeTimingPlugin_nativeCalculateRange(
    JNIEnv* env,
    jclass /* clazz */,
    jint startYear,
    jint startMonth,
    jint startDay,
    jint totalDays,
    jdouble latitude,
    jdouble longitude,
    jdouble timezoneOffsetHours
) {
    enforceAntiDebug();
    std::string jsonStr = internalCalculateRangeJson(startYear, startMonth, startDay, totalDays, latitude, longitude, timezoneOffsetHours);
    return env->NewStringUTF(jsonStr.c_str());
}

} // extern "C"
