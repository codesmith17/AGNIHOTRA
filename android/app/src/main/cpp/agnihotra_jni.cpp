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

    /**
     * Checks /proc/self/status to detect if Frida, GDB, or LLDB is attached.
     * When attached, TracerPid is greater than 0.
     */
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
                    return true; // Debugger / Frida detected!
                }
            }
        }
        return false;
    }

    /**
     * Prevents external debugging tools from attaching via ptrace.
     */
    inline void enforceAntiDebug() __attribute__((always_inline));
    inline void enforceAntiDebug() {
        // Attempt to trace self. If another tracer is already attached, this will fail.
        #ifndef NDEBUG
        // allow debug in developer mode if needed
        #else
        ptrace(PTRACE_TRACEME, 0, 1, 0);
        #endif

        if (isDebuggerAttached()) {
            // Tamper detected: Exit process immediately without stack trace
            _exit(1);
        }
    }
}

extern "C" {

/**
 * JNI Export: Calculate single day timings.
 * Exported symbol is minimal and hidden from general symbol tables.
 */
JNIEXPORT jstring JNICALL
Java_com_eternalagni_app_AgnihotraNativeTimingPlugin_nativeCalculateDay(
    JNIEnv* env,
    jobject /* thiz */,
    jint year,
    jint month,
    jint day,
    jdouble latitude,
    jdouble longitude,
    jdouble timezoneOffsetHours
) {
    enforceAntiDebug();

    DailyTimingResult result = AgnihotraTimingEngine::calculateDay(
        year, month, day, latitude, longitude, timezoneOffsetHours
    );

    std::ostringstream json;
    json << "{\"date\":\"" << result.date << "\","
         << "\"sunrise\":\"" << result.sunrise << "\","
         << "\"sunset\":\"" << result.sunset << "\","
         << "\"isValid\":" << (result.isValid ? "true" : "false") << "}";

    return env->NewStringUTF(json.str().c_str());
}

/**
 * JNI Export: Calculate range of days and return compact JSON.
 */
JNIEXPORT jstring JNICALL
Java_com_eternalagni_app_AgnihotraNativeTimingPlugin_nativeCalculateRange(
    JNIEnv* env,
    jobject /* thiz */,
    jint startYear,
    jint startMonth,
    jint startDay,
    jint totalDays,
    jdouble latitude,
    jdouble longitude,
    jdouble timezoneOffsetHours
) {
    enforceAntiDebug();

    std::vector<DailyTimingResult> results = AgnihotraTimingEngine::calculateRange(
        startYear, startMonth, startDay, totalDays, latitude, longitude, timezoneOffsetHours
    );

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

    return env->NewStringUTF(json.str().c_str());
}

} // extern "C"
