(() => {
  function create(ctx) {
    const context = ctx || {};
    let permissionGateBound = false;
    const maxRetries = Number(context.locationPermissionMaxRetries || 3) || 3;

    function getMandatoryPermissionGate() {
      if (typeof document === "undefined" || !document.body) return null;
      let gate = document.getElementById("permission-gate");
      if (!gate) {
        gate = document.createElement("div");
        gate.id = "permission-gate";
        gate.className = "permission-gate hidden";
        gate.innerHTML = `
      <div class="permission-gate-card">
        <h3 class="permission-gate-title">Permissions required</h3>
        <p id="permission-gate-message" class="permission-gate-message">
          Location and notification permissions are required for Agnihotra reminders.
        </p>
        <div class="permission-gate-actions">
          <button id="permission-location-btn" type="button">Grant location</button>
          <button id="permission-notification-btn" type="button">Grant notifications</button>
          <button id="permission-settings-btn" type="button" class="secondary">Open app settings</button>
        </div>
      </div>
    `;
        document.body.appendChild(gate);
      }
      return gate;
    }

    function setPermissionGateVisible(visible, message = "") {
      const gate = getMandatoryPermissionGate();
      if (!gate) return;
      gate.classList.toggle("hidden", !visible);
      const messageElement = document.getElementById("permission-gate-message");
      if (messageElement && message) messageElement.innerText = message;
    }

    function setPermissionGateTone(tone = "default", title = "") {
      const gate = getMandatoryPermissionGate();
      if (!gate) return;
      const card = gate.querySelector(".permission-gate-card");
      const titleNode = gate.querySelector(".permission-gate-title");
      if (!card || !titleNode) return;

      card.classList.remove("tone-default", "tone-location-required", "tone-warning");
      const safeTone =
        tone === "location-required" || tone === "warning" ? tone : "default";
      card.classList.add(`tone-${safeTone}`);
      titleNode.textContent = title || "Permissions required";
    }

    function isPermissionGateVisible() {
      const gate = document.getElementById("permission-gate");
      return Boolean(gate && !gate.classList.contains("hidden"));
    }

    async function getLocationPermissionState() {
      if (!navigator.geolocation) return "unavailable";
      if (!navigator.permissions?.query) return "prompt";
      try {
        const result = await navigator.permissions.query({ name: "geolocation" });
        return result?.state || "prompt";
      } catch (_) {
        return "prompt";
      }
    }

    function getLocationPermissionRetryModal() {
      if (typeof document === "undefined" || !document.body) return null;
      let modal = document.getElementById("location-permission-retry-modal");
      if (modal) return modal;
      modal = document.createElement("div");
      modal.id = "location-permission-retry-modal";
      modal.className = "location-permission-retry-modal hidden";
      modal.innerHTML = `
    <div class="location-permission-retry-card">
      <h3 id="location-permission-retry-title" class="location-permission-retry-title">Location access required</h3>
      <p id="location-permission-retry-message" class="location-permission-retry-message">
        Please allow location. Exact coordinates are needed to show exact Agnihotra timings.
      </p>
      <p id="location-permission-retry-attempt" class="location-permission-retry-attempt"></p>
      <div class="location-permission-retry-actions">
        <button id="location-permission-retry-allow" type="button">Allow location</button>
        <button id="location-permission-retry-settings" type="button" class="secondary">Open app settings</button>
        <button id="location-permission-retry-cancel" type="button" class="secondary">Not now</button>
      </div>
    </div>
  `;
      document.body.appendChild(modal);
      return modal;
    }

    function showLocationPermissionRetryModal({
      attempt = 1,
      maxAttempts = maxRetries,
      errorMessage = "",
      finalGuidance = false,
    } = {}) {
      const modal = getLocationPermissionRetryModal();
      if (!modal) return Promise.resolve("retry");
      const titleNode = document.getElementById("location-permission-retry-title");
      const msgNode = document.getElementById("location-permission-retry-message");
      const attemptNode = document.getElementById("location-permission-retry-attempt");
      const allowBtn = document.getElementById("location-permission-retry-allow");
      const settingsBtn = document.getElementById("location-permission-retry-settings");
      const cancelBtn = document.getElementById("location-permission-retry-cancel");

      if (titleNode) {
        titleNode.textContent = finalGuidance
          ? "Location still not enabled"
          : "Location access required for exact timings";
      }
      if (msgNode) {
        msgNode.textContent = finalGuidance
          ? "We tried multiple times but location is still blocked. Please open App Settings > Permissions > Location > Allow precise location, then return and tap 'Allow location' again."
          : "Please allow location. Exact coordinates are needed to show exact Agnihotra sunrise and sunset timings for your place.";
      }
      if (attemptNode) {
        const base = finalGuidance
          ? `Tried ${maxAttempts}/${maxAttempts} attempts.`
          : `Attempt ${attempt}/${maxAttempts}.`;
        const suffix = errorMessage ? ` Last error: ${errorMessage}` : "";
        attemptNode.textContent = `${base}${suffix}`;
      }
      if (allowBtn) {
        allowBtn.textContent = finalGuidance
          ? "I enabled location, try again"
          : "Allow location";
      }

      modal.classList.remove("hidden");
      return new Promise((resolve) => {
        const cleanup = () => {
          modal.classList.add("hidden");
          allowBtn?.removeEventListener("click", onAllow);
          settingsBtn?.removeEventListener("click", onSettings);
          cancelBtn?.removeEventListener("click", onCancel);
        };
        const onAllow = () => {
          cleanup();
          resolve("retry");
        };
        const onSettings = async () => {
          await context.openNativeAppSettings?.();
          cleanup();
          resolve("retry");
        };
        const onCancel = () => {
          cleanup();
          resolve("cancel");
        };
        allowBtn?.addEventListener("click", onAllow);
        settingsBtn?.addEventListener("click", onSettings);
        cancelBtn?.addEventListener("click", onCancel);
      });
    }

    async function requestMandatoryLocationPermission() {
      context.captureDiagnosticBreadcrumb?.(
        "permission",
        "location-request-start",
        { maxRetries },
        "info"
      );
      if (!navigator.geolocation) return false;
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
          const position = await context.getCurrentPositionAsync?.({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
          if (position?.coords) {
            context.saveLastKnownLocation?.(
              position.coords.latitude,
              position.coords.longitude
            );
          }
          context.captureDiagnosticMessage?.("permission-location-granted", "info");
          window.AgnihotraInstrumentation?.recordPermissionResult?.(
            "location",
            "granted",
            {
              attempt,
              accuracyMeters: position?.coords?.accuracy ?? null,
            }
          );
          return true;
        } catch (error) {
          lastError = error;
          context.locationLog?.("mandatory-location-request-failed", {
            code: error?.code,
            message: error?.message,
            attempt,
            maxRetries,
          });
          window.AgnihotraInstrumentation?.recordPermissionResult?.(
            "location",
            `failed-attempt-${attempt}`,
            {
              code: error?.code || null,
              message: error?.message || null,
            }
          );
          context.captureDiagnosticException?.(
            error,
            "permission-location-request-failed",
            {
              attempt,
              maxRetries,
              code: error?.code || null,
              state: await getLocationPermissionState(),
            }
          );

          if (attempt >= maxRetries) break;
          const action = await showLocationPermissionRetryModal({
            attempt,
            maxAttempts: maxRetries,
            errorMessage: error?.message || "",
          });
          if (action !== "retry") {
            context.captureDiagnosticMessage?.(
              "permission-location-retry-cancelled",
              "warning",
              { attempt, maxRetries }
            );
            return false;
          }
        }
      }

      context.captureDiagnosticMessage?.(
        "permission-location-retries-exhausted",
        "warning",
        { maxRetries, lastError: lastError?.message || null }
      );
      await showLocationPermissionRetryModal({
        attempt: maxRetries,
        maxAttempts: maxRetries,
        errorMessage: lastError?.message || "",
        finalGuidance: true,
      });
      return false;
    }

    async function evaluateMandatoryPermissions({ forcePrompt = false } = {}) {
      context.captureDiagnosticBreadcrumb?.(
        "permission",
        "evaluate-start",
        { forcePrompt },
        "info"
      );
      context.emitSupportSnapshot?.("permission-evaluate-start", { forcePrompt });

      let locationGranted = !context.requireMandatoryLocationPermission;
      let notificationGranted = !context.requireMandatoryNotificationPermission;
      let locationState = "unknown";
      let notificationState = "unknown";

      if (context.requireMandatoryNotificationPermission) {
        notificationState =
          (await context.getNotificationPermissionStatus?.()) || "unknown";
        if (forcePrompt) {
          notificationGranted = Boolean(
            await context.requestNotificationPermission?.({ force: true })
          );
          notificationState =
            (await context.getNotificationPermissionStatus?.()) || notificationState;
        } else if (notificationState === "granted") {
          notificationGranted = true;
        } else {
          notificationGranted = Boolean(
            await context.ensureNotificationPermissionBootstrap?.()
          );
          notificationState =
            (await context.getNotificationPermissionStatus?.()) || notificationState;
        }
      }

      if (context.requireMandatoryLocationPermission) {
        locationState = await getLocationPermissionState();
        context.locationLog?.("mandatory-location-state", { state: locationState, forcePrompt });
        if (locationState === "granted" && !forcePrompt) {
          locationGranted = true;
        } else {
          locationGranted = await requestMandatoryLocationPermission();
          locationState = await getLocationPermissionState();
        }
      }

      const allGranted = locationGranted && notificationGranted;
      context.captureDiagnosticBreadcrumb?.("permission", "evaluate-result", {
        forcePrompt,
        allGranted,
        locationGranted,
        notificationGranted,
        locationState,
        notificationState,
      });

      if (allGranted) {
        setPermissionGateVisible(false);
        context.captureDiagnosticMessage?.("permissions-all-granted", "info");
        context.emitSupportSnapshot?.("permission-all-granted", {
          forcePrompt,
          locationState,
          notificationState,
        });
        return true;
      }

      const blocked = [];
      if (!locationGranted) blocked.push("location");
      if (!notificationGranted) blocked.push("notifications");
      const denied = [];
      if (!locationGranted && locationState === "denied") denied.push("location");
      if (!notificationGranted && notificationState === "denied") denied.push("notifications");

      let gateMessage =
        denied.length > 0
          ? `Permission denied for ${denied.join(" and ")}. Tap Open app settings, allow permission, then return here.`
          : `Please grant ${blocked.join(" and ")} permission${blocked.length > 1 ? "s" : ""} to continue.`;
      let gateTone = "default";
      let gateTitle = "Permissions required";

      if (!locationGranted && locationState === "denied") {
        gateTone = "location-required";
        gateTitle = "Location access required for exact timings";
        gateMessage =
          "Please allow Location access. Exact coordinates are needed to calculate exact Agnihotra sunrise and sunset timings for your place. Tap Open app settings, allow Location, then return to continue.";
      } else if (denied.length > 0) {
        gateTone = "warning";
      }

      context.setLocationLoading?.(false);
      setPermissionGateTone(gateTone, gateTitle);
      setPermissionGateVisible(true, gateMessage);
      context.captureDiagnosticMessage?.("permissions-blocked", "warning", {
        blocked,
        denied,
        gateMessage,
        forcePrompt,
        locationState,
        notificationState,
      });
      context.emitSupportSnapshot?.("permission-blocked", {
        blocked,
        denied,
        forcePrompt,
        gateMessage,
        locationState,
        notificationState,
      });
      return false;
    }

    function bindPermissionGateActions() {
      if (permissionGateBound) return;
      permissionGateBound = true;
      const gate = getMandatoryPermissionGate();
      if (!gate) return;

      const locationBtn = document.getElementById("permission-location-btn");
      const notificationBtn = document.getElementById("permission-notification-btn");
      const settingsBtn = document.getElementById("permission-settings-btn");

      locationBtn?.addEventListener("click", async () => {
        const granted = await evaluateMandatoryPermissions({ forcePrompt: true });
        if (granted) context.continueAppInitialization?.();
      });

      notificationBtn?.addEventListener("click", async () => {
        await context.requestNotificationPermission?.({ force: true });
        const granted = await evaluateMandatoryPermissions({ forcePrompt: true });
        if (granted) context.continueAppInitialization?.();
      });

      settingsBtn?.addEventListener("click", async () => {
        await context.openNativeAppSettings?.();
      });

      document.addEventListener("resume", () => {
        const gateVisible = isPermissionGateVisible();
        if (!gateVisible) return;
        evaluateMandatoryPermissions({ forcePrompt: false }).then((granted) => {
          if (granted) context.continueAppInitialization?.();
        });
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && isPermissionGateVisible()) {
          evaluateMandatoryPermissions({ forcePrompt: false }).then((granted) => {
            if (granted) context.continueAppInitialization?.();
          });
        }
      });
    }

    return {
      bindPermissionGateActions,
      evaluateMandatoryPermissions,
      getLocationPermissionState,
      isPermissionGateVisible,
      setPermissionGateVisible,
    };
  }

  window.AgnihotraPermissionsGate = { create };
})();
