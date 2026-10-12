/**
 * Agnihotra Timing Engine
 *
 * Bridges calculation calls directly into the secure native C++ compiled binary
 * (libagnihotra_core.so) via window.AgnihotraNativeCore.
 */
(() => {
  function getBridge() {
    return window.AgnihotraNativeCore || null;
  }

  function calculateDayTiming(date, lat, lng, tzOffsetHours) {
    const bridge = getBridge();
    if (bridge && typeof bridge.calculateDay === "function") {
      try {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const jsonStr = bridge.calculateDay(y, m, d, lat, lng, tzOffsetHours);
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.isValid !== false) {
          return {
            date: parsed.date,
            sunrise: parsed.sunrise,
            sunset: parsed.sunset
          };
        }
      } catch (err) {
        console.error("[NativeTimingEngine] calculateDay error:", err);
      }
    } else {
      console.warn("[NativeTimingEngine] bridge not available yet during calculateDay");
    }
    return null;
  }

  async function generateRangeTimings(lat, lng, days = 92, startDate = new Date()) {
    const bridge = getBridge();
    if (bridge && typeof bridge.calculateRange === "function") {
      try {
        const y = startDate.getFullYear();
        const m = startDate.getMonth() + 1;
        const d = startDate.getDate();
        const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
        const jsonStr = bridge.calculateRange(y, m, d, days, lat, lng, tzOffsetHours);
        return JSON.parse(jsonStr);
      } catch (err) {
        console.error("[NativeTimingEngine] calculateRange error:", err);
      }
    } else {
      console.warn("[NativeTimingEngine] bridge not available yet during generateRangeTimings");
    }
    return {};
  }

  window.AgnihotraTimingEngine = {
    calculateDayTiming,
    generateRangeTimings
  };
})();
