/**
 * Platform detection — web (browser / Vercel) vs native (Capacitor Android).
 * Sets documentElement class early so CSS can show/hide platform-specific UI.
 */
(function () {
  function detectNative() {
    try {
      return Boolean(
        window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()
      );
    } catch (_) {
      return false;
    }
  }

  const isNative = detectNative();
  const isWeb = !isNative;
  const root = document.documentElement;

  root.classList.remove("agni-platform-native", "agni-platform-web");
  root.classList.add(isNative ? "agni-platform-native" : "agni-platform-web");

  window.AgnihotraRuntime = {
    isNative,
    isWeb,
    platform: isNative ? "native" : "web",
  };
})();
