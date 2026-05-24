(() => {
  function create() {
    let lastVolumeHintAt = 0;
    let hasShownNativeVolumeHint = false;

    function formatTime(seconds) {
      if (isNaN(seconds)) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function showVolumeHint(message = "If sound is low, increase your media volume.") {
      const now = Date.now();
      if (now - lastVolumeHintAt < 45000) return;
      lastVolumeHintAt = now;

      const existing = document.getElementById("agni-audio-volume-hint");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.id = "agni-audio-volume-hint";
      toast.textContent = message;
      toast.style.position = "fixed";
      toast.style.left = "50%";
      toast.style.bottom = "84px";
      toast.style.transform = "translateX(-50%)";
      toast.style.maxWidth = "92vw";
      toast.style.padding = "10px 14px";
      toast.style.borderRadius = "12px";
      toast.style.color = "#fff";
      toast.style.background = "rgba(35, 23, 15, 0.92)";
      toast.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.34)";
      toast.style.zIndex = "9999";
      toast.style.fontSize = "0.92rem";
      toast.style.fontWeight = "700";
      toast.style.border = "1px solid rgba(255, 255, 255, 0.16)";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2800);
    }

    function initAudioPlayer(audioId) {
      const audio = document.getElementById(audioId);
      const progressBar = document.getElementById(
        audioId.replace("-audio", "-progress-bar")
      );
      const progressFill = document.getElementById(audioId.replace("-audio", "-progress"));
      const currentTimeDisplay = document.getElementById(audioId.replace("-audio", "-current"));
      const durationDisplay = document.getElementById(audioId.replace("-audio", "-duration"));
      if (!audio) return;

      audio.preload = "metadata";
      audio.load();

      const updateDuration = () => {
        if (
          durationDisplay &&
          audio.duration &&
          !isNaN(audio.duration) &&
          isFinite(audio.duration)
        ) {
          durationDisplay.textContent = formatTime(audio.duration);
        }
      };

      audio.addEventListener("timeupdate", () => {
        if (!isNaN(audio.duration) && isFinite(audio.duration)) {
          const progress = (audio.currentTime / audio.duration) * 100;
          if (progressFill) progressFill.style.width = Math.min(100, progress) + "%";
          if (currentTimeDisplay) currentTimeDisplay.textContent = formatTime(audio.currentTime);
          updateDuration();
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        updateDuration();
        if (currentTimeDisplay) currentTimeDisplay.textContent = "0:00";
      });

      audio.addEventListener("canplay", updateDuration);
      audio.addEventListener("loadeddata", updateDuration);
      if (audio.readyState >= 1) updateDuration();

      audio.addEventListener("ended", () => {
        const button = document.querySelector(`button[onclick*="${audioId}"]`);
        if (button) {
          const icon = button.querySelector("i");
          icon?.classList.replace("fa-pause", "fa-play");
          button.classList.remove("playing");
        }
        if (progressFill) progressFill.style.width = "0%";
        if (currentTimeDisplay) currentTimeDisplay.textContent = "0:00";
      });

      if (progressBar) {
        let isDragging = false;
        let animationFrameId = null;
        const handleSeek = (event) => {
          const rect = progressBar.getBoundingClientRect();
          const clickX = event.clientX - rect.left;
          const percentage = Math.max(0, Math.min(1, clickX / rect.width));
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            if (isDragging && progressFill) progressFill.style.width = percentage * 100 + "%";
            audio.currentTime = percentage * audio.duration;
          }
        };

        progressBar.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          handleSeek(event);
        });

        const startDrag = (e) => {
          e.preventDefault();
          isDragging = true;
          progressBar.classList.add("dragging");
          handleSeek(e);
        };
        const moveDrag = (e) => {
          if (!isDragging) return;
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          animationFrameId = requestAnimationFrame(() => handleSeek(e));
        };
        const endDrag = () => {
          if (!isDragging) return;
          isDragging = false;
          progressBar.classList.remove("dragging");
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
          }
        };

        progressBar.addEventListener("mousedown", startDrag);
        document.addEventListener("mousemove", moveDrag);
        document.addEventListener("mouseup", endDrag);
        progressBar.addEventListener("touchstart", (e) => {
          e.preventDefault();
          isDragging = true;
          progressBar.classList.add("dragging");
          handleSeek(e.touches[0]);
        });
        document.addEventListener(
          "touchmove",
          (e) => {
            if (!isDragging) return;
            e.preventDefault();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => handleSeek(e.touches[0]));
          },
          { passive: false }
        );
        document.addEventListener("touchend", endDrag);
      }
    }

    function toggleAudio(audioId, button) {
      const audio = document.getElementById(audioId);
      const icon = button?.querySelector("i");
      if (!audio || !button || !icon) return;

      document.querySelectorAll(".mantra-audio").forEach((a) => {
        if (a.id !== audioId && !a.paused) {
          a.pause();
          const otherBtn = document.querySelector(`button[onclick*="${a.id}"]`);
          if (otherBtn) {
            otherBtn.querySelector("i")?.classList.replace("fa-pause", "fa-play");
            otherBtn.classList.remove("playing");
          }
        }
      });

      if (audio.paused) {
        const isNativeRuntime = Boolean(
          window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()
        );
        if (audio.muted || Number(audio.volume || 0) <= 0.2) {
          showVolumeHint("Audio is low. Please increase media volume.");
        } else if (isNativeRuntime && !hasShownNativeVolumeHint) {
          hasShownNativeVolumeHint = true;
          showVolumeHint("For better mantra sound, use your phone media volume buttons.");
        }

        audio.play().catch((error) => {
          console.warn("[AGNIHOTRA][AUDIO] play-failed", error?.message || error);
          showVolumeHint("Unable to play audio. Please check media volume.");
        });
        icon.classList.replace("fa-play", "fa-pause");
        button.classList.add("playing");
      } else {
        audio.pause();
        icon.classList.replace("fa-pause", "fa-play");
        button.classList.remove("playing");
      }
    }

    function pauseAllAppAudio() {
      document.querySelectorAll(".mantra-audio").forEach((audio) => {
        if (!audio.paused) audio.pause();
      });

      document.querySelectorAll(".play-btn").forEach((button) => {
        const icon = button.querySelector("i");
        if (icon && icon.classList.contains("fa-pause")) {
          icon.classList.replace("fa-pause", "fa-play");
        }
        button.classList.remove("playing");
      });

      try {
        const nativeAudio = window.Capacitor?.Plugins?.NativeAudio;
        if (nativeAudio?.stop) {
          nativeAudio.stop({ assetId: "agnihotra-single-bell" }).catch(() => {});
          nativeAudio.stop({ assetId: "agnihotra-bell-3x" }).catch(() => {});
        }
      } catch (_) {}
    }

    function setupNativeAppAudioLifecycle() {
      const capacitor = window.Capacitor;
      if (!capacitor?.isNativePlatform || !capacitor.isNativePlatform()) return;
      const appPlugin = capacitor?.Plugins?.App;
      if (!appPlugin?.addListener) return;

      appPlugin.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) pauseAllAppAudio();
      });
      appPlugin.addListener("pause", () => pauseAllAppAudio());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") pauseAllAppAudio();
      });
    }

    return {
      initAudioPlayer,
      toggleAudio,
      setupNativeAppAudioLifecycle,
    };
  }

  window.AgnihotraAudioControls = { create };
})();
