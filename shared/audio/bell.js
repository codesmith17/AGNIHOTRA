(() => {
  // Assets registered with @capacitor-community/native-audio. On Android each
  // assetPath resolves under android/app/src/main/assets/. On Web the plugin's
  // HTMLAudio fallback fetches <webDir>/<assetPath>, so we keep matching files
  // under public/assets/audio/alerts/ for that path.
  const ASSETS = {
    single: {
      id: "agnihotra-single-bell",
      nativePath: "agnihotra-single-bell.mp3",
      webPath: "assets/audio/alerts/agnihotra-single-bell.mp3",
      volume: 0.9,
    },
    triple: {
      id: "agnihotra-bell-3x",
      nativePath: "agnihotra-bell-3x.mp3",
      webPath: "assets/audio/alerts/agnihotra-bell-3x.mp3",
      volume: 0.9,
    },
  };

  const state = {
    preloaded: { single: false, triple: false },
    preloadPromises: { single: null, triple: null },
    lastError: null,
  };

  function isNativeRuntime() {
    return Boolean(
      window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === "function" &&
        window.Capacitor.isNativePlatform()
    );
  }

  function getPlugin() {
    const plugins = window.Capacitor?.Plugins;
    if (!plugins) return null;
    return plugins.NativeAudio || null;
  }

  function logBell(message, meta = {}) {
    let serialized = "";
    try {
      serialized = JSON.stringify(meta ?? {});
    } catch (_) {
      serialized = String(meta);
    }
    console.log(`[AGNIHOTRA][BELL] ${message} ${serialized}`);
  }

  async function preloadKind(kind) {
    const cfg = ASSETS[kind];
    if (!cfg) return false;
    if (state.preloaded[kind]) return true;
    if (state.preloadPromises[kind]) return state.preloadPromises[kind];

    const plugin = getPlugin();
    const native = isNativeRuntime();
    const assetPath = native ? cfg.nativePath : cfg.webPath;
    logBell("preload-start", { kind, runtime: native ? "native" : "web", assetPath });

    if (!plugin) {
      logBell("preload-skip-no-plugin", { kind });
      state.preloaded[kind] = false;
      return false;
    }

    state.preloadPromises[kind] = (async () => {
      try {
        await plugin.preload({
          assetId: cfg.id,
          assetPath,
          audioChannelNum: 1,
          isUrl: false,
          volume: cfg.volume,
        });
        state.preloaded[kind] = true;
        logBell("preload-success", { kind, assetPath });
        return true;
      } catch (error) {
        state.lastError = error;
        const message = error?.message || String(error);
        if (/already loaded/i.test(message)) {
          state.preloaded[kind] = true;
          logBell("preload-already-loaded", { kind });
          return true;
        }
        logBell("preload-failed", { kind, message });
        state.preloaded[kind] = false;
        return false;
      } finally {
        state.preloadPromises[kind] = null;
      }
    })();

    return state.preloadPromises[kind];
  }

  async function preloadAll() {
    return Promise.all([preloadKind("single"), preloadKind("triple")]).then(
      ([s, t]) => s || t
    );
  }

  async function playKind(kind, reason) {
    const cfg = ASSETS[kind];
    if (!cfg) return false;
    const plugin = getPlugin();
    const native = isNativeRuntime();
    const isForeground =
      typeof document !== "undefined" &&
      document.visibilityState === "visible";

    // Hard rule: the single-ting bell must NEVER play when the app is
    // backgrounded or closed. Only the triple-bell (pre-alert) is allowed to
    // fall through to its OS-notification fallback elsewhere.
    if (kind === "single" && !isForeground) {
      logBell("play-skip-not-foreground", {
        kind,
        reason,
        visibility: typeof document !== "undefined" ? document.visibilityState : "n/a",
      });
      return false;
    }

    logBell("play-attempt", {
      kind,
      reason,
      runtime: native ? "native" : "web",
      hasPlugin: Boolean(plugin),
      preloaded: state.preloaded[kind],
      visibility: typeof document !== "undefined" ? document.visibilityState : "n/a",
    });

    if (plugin) {
      try {
        if (!state.preloaded[kind]) {
          await preloadKind(kind);
        }
        await plugin.play({ assetId: cfg.id });
        logBell("play-native-ok", { kind, reason });
        return true;
      } catch (error) {
        const message = error?.message || String(error);
        logBell("play-native-failed", { kind, reason, message });
      }
    }

    // HTMLAudio fallback for web or when the plugin fails.
    try {
      const audio = new Audio(cfg.webPath);
      audio.volume = 0.5;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => logBell("play-html-ok", { kind, reason })).catch((err) =>
          logBell("play-html-rejected", {
            kind,
            reason,
            message: err?.message,
          })
        );
      }
      return true;
    } catch (error) {
      logBell("play-html-threw", {
        kind,
        reason,
        message: error?.message,
      });
      return false;
    }
  }

  window.AgnihotraBell = {
    preload: preloadAll,
    preloadSingle: () => preloadKind("single"),
    preloadTriple: () => preloadKind("triple"),
    playInstant: (reason = "single") => playKind("single", reason),
    playTriple: (reason = "triple") => playKind("triple", reason),
    isReady: () => state.preloaded.single,
    isTripleReady: () => state.preloaded.triple,
    getLastError: () => state.lastError,
  };
})();
