/**
 * Agnihotra Timing Engine
 *
 * Bridges calculation calls directly into the secure native C++ compiled binary
 * (libagnihotra_core.so) via window.AgnihotraNativeCore.
 */
(() => {
  const LOG_TAG = "[AGNIHOTRA][NATIVE-TIMING]";

  function getBridge() {
    return window.AgnihotraNativeCore || null;
  }

  function getTimestamp() {
    return (typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now();
  }

  function calculateDayTiming(date, lat, lng, tzOffsetHours) {
    const bridge = getBridge();
    if (!bridge || typeof bridge.calculateDay !== "function") {
      console.warn(LOG_TAG, "Native bridge is not available yet for calculateDay", {
        hasNativeCore: Boolean(window.AgnihotraNativeCore),
        date: date ? date.toISOString?.() : null
      });
      return null;
    }

    try {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const t0 = getTimestamp();

      const jsonStr = bridge.calculateDay(y, m, d, lat, lng, tzOffsetHours);
      const elapsed = Math.round(getTimestamp() - t0);

      if (!jsonStr) {
        console.warn(LOG_TAG, "Bridge returned null/empty payload for calculateDay", { y, m, d });
        return null;
      }

      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.isValid !== false) {
        console.debug?.(LOG_TAG, "calculateDay success", {
          date: parsed.date,
          sunrise: parsed.sunrise,
          sunset: parsed.sunset,
          elapsedMs: elapsed
        });
        return {
          date: parsed.date,
          sunrise: parsed.sunrise,
          sunset: parsed.sunset
        };
      } else {
        console.warn(LOG_TAG, "calculateDay returned invalid or unparseable result", {
          date: `${y}-${m}-${d}`,
          raw: jsonStr
        });
      }
    } catch (err) {
      console.error(LOG_TAG, "Error in calculateDayTiming:", err);
    }
    return null;
  }

  async function generateRangeTimings(lat, lng, days = 92, startDate = new Date()) {
    const bridge = getBridge();
    if (!bridge || typeof bridge.calculateRange !== "function") {
      console.warn(LOG_TAG, "Native bridge is not available yet for generateRangeTimings", {
        hasNativeCore: Boolean(window.AgnihotraNativeCore),
        days
      });
      return {};
    }

    try {
      const y = startDate.getFullYear();
      const m = startDate.getMonth() + 1;
      const d = startDate.getDate();
      const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
      const t0 = getTimestamp();

      console.info(LOG_TAG, "generateRangeTimings starting", {
        startDate: `${y}-${m}-${d}`,
        days,
        lat: Number(Number(lat).toFixed(4)),
        lng: Number(Number(lng).toFixed(4)),
        tzOffsetHours
      });

      const jsonStr = bridge.calculateRange(y, m, d, days, lat, lng, tzOffsetHours);
      const elapsed = Math.round(getTimestamp() - t0);

      if (!jsonStr) {
        console.warn(LOG_TAG, "Bridge returned empty range result");
        return {};
      }

      const parsed = JSON.parse(jsonStr);
      const generatedCount = Object.keys(parsed || {}).length;

      console.info(LOG_TAG, "generateRangeTimings complete", {
        daysComputed: generatedCount,
        elapsedMs: elapsed
      });

      return parsed;
    } catch (err) {
      console.error(LOG_TAG, "Error in generateRangeTimings:", err);
    }
    return {};
  }

  window.AgnihotraTimingEngine = {
    calculateDayTiming,
    generateRangeTimings
  };
})();
