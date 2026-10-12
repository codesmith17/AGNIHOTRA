/**
 * Agnihotra Timing Engine
 *
 * Bridges calculation calls directly into the secure native C++ compiled binary
 * (libagnihotra_core.so) via window.AgnihotraNativeCore.
 *
 * All astronomical calculations and constants are compiled into native machine code.
 */
(() => {
  function calculateDayTiming(date, lat, lng, tzOffsetHours) {
    if (window.AgnihotraNativeCore && typeof window.AgnihotraNativeCore.calculateDay === "function") {
      try {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const jsonStr = window.AgnihotraNativeCore.calculateDay(y, m, d, lat, lng, tzOffsetHours);
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
    }
    return null;
  }

  async function generateRangeTimings(lat, lng, days = 92, startDate = new Date()) {
    if (window.AgnihotraNativeCore && typeof window.AgnihotraNativeCore.calculateRange === "function") {
      try {
        const y = startDate.getFullYear();
        const m = startDate.getMonth() + 1;
        const d = startDate.getDate();
        const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
        const jsonStr = window.AgnihotraNativeCore.calculateRange(y, m, d, days, lat, lng, tzOffsetHours);
        return JSON.parse(jsonStr);
      } catch (err) {
        console.error("[NativeTimingEngine] calculateRange error:", err);
      }
    }
    return {};
  }

  window.AgnihotraTimingEngine = {
    calculateDayTiming,
    generateRangeTimings
  };
})();
