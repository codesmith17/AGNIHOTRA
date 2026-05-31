(() => {
  const TIME_FORMAT_STORAGE_KEY = "agnihotra_time_format_v1";
  const REMINDER_LEAD_STORAGE_KEY = "agnihotra_reminder_lead_v1";
  const REMINDER_VIBRATE_STORAGE_KEY = "agnihotra_reminder_vibrate_v1";
  const WATCH_ALERT_STORAGE_KEY = "agnihotra_watch_alert_v1";
  const SUPPORT_LOG_STORAGE_KEY = "agnihotra_support_logs_v1";
  const SUPPORT_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const SUPPORT_EMAIL = "kanchanlatakrishna@gmail.com";

  const DEFAULT_REMINDER_LEAD = 15;
  const MIN_REMINDER_LEAD = 2;
  const MAX_REMINDER_LEAD = 60;

  function setStatus(message, isError = false) {
    const node = document.getElementById("supportLogExportStatus");
    if (!node) return;
    node.textContent = message || "";
    node.style.color = isError ? "#9c1d1d" : "#5d3414";
  }

  function getTimeFormat() {
    const saved = String(localStorage.getItem(TIME_FORMAT_STORAGE_KEY) || "")
      .trim()
      .toLowerCase();
    return saved === "24h" ? "24h" : "ampm";
  }

  function setTimeFormat(format) {
    localStorage.setItem(TIME_FORMAT_STORAGE_KEY, format === "24h" ? "24h" : "ampm");
  }

  function getReminderLeadTime() {
    const saved = localStorage.getItem(REMINDER_LEAD_STORAGE_KEY);
    if (saved === null) return DEFAULT_REMINDER_LEAD;
    const val = parseInt(saved, 10);
    if (isNaN(val)) return DEFAULT_REMINDER_LEAD;
    return Math.max(MIN_REMINDER_LEAD, Math.min(MAX_REMINDER_LEAD, val));
  }

  function setReminderLeadTime(mins) {
    const val = Math.max(MIN_REMINDER_LEAD, Math.min(MAX_REMINDER_LEAD, mins));
    localStorage.setItem(REMINDER_LEAD_STORAGE_KEY, val.toString());
  }

  function getBooleanSetting(key, defaultValue) {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    return saved === "true";
  }

  function setBooleanSetting(key, value) {
    localStorage.setItem(key, value ? "true" : "false");
  }

  function readPrunedLogs() {
    try {
      const raw = localStorage.getItem(SUPPORT_LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const minTs = Date.now() - SUPPORT_LOG_RETENTION_MS;
      const logs = parsed.filter((entry) => {
        const ts = Date.parse(entry?.at || "");
        return Number.isFinite(ts) && ts >= minTs;
      });
      localStorage.setItem(SUPPORT_LOG_STORAGE_KEY, JSON.stringify(logs));
      return logs;
    } catch (_) {
      return [];
    }
  }

  async function buildPayload(reason = "export-from-settings-page") {
    const logs = readPrunedLogs();

    // Prefer the unified comprehensive builder — same schema as script.js
    // exports, so customer-support gets a consistent rich report regardless
    // of which page the user pressed "Share Support Report" on.
    if (window.AgnihotraSupportPayload?.build) {
      try {
        return await window.AgnihotraSupportPayload.build({
          logs,
          reason,
          ctx: window.__agnihotraSupportCtx || {},
        });
      } catch (error) {
        console.warn("[AGNIHOTRA][SUPPORT] payload-builder-failed", error);
      }
    }

    return {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      appRelease: window.AGNI_RUNTIME_CONFIG?.appRelease || "unknown",
      appEnvironment: window.AGNI_RUNTIME_CONFIG?.appEnvironment || "unknown",
      timeFormat: getTimeFormat(),
      reminderLeadMinutes: getReminderLeadTime(),
      reminderVibrate: getBooleanSetting(REMINDER_VIBRATE_STORAGE_KEY, true),
      watchAlert: getBooleanSetting(WATCH_ALERT_STORAGE_KEY, false),
      userAgent: navigator.userAgent,
      platform: navigator.platform || "unknown",
      online: navigator.onLine,
      logCount: logs.length,
      logs: logs.slice(-500),
    };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read report blob."));
      reader.onload = () => {
        const out = String(reader.result || "");
        const idx = out.indexOf(",");
        resolve(idx >= 0 ? out.slice(idx + 1) : out);
      };
      reader.readAsDataURL(blob);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function createSupportReportFile(reason = "export-from-settings-page") {
    const payload = await buildPayload(reason);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `agnihotra-support-report-${stamp}.json`;
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });
    return { payload, filename, blob, file };
  }

  async function shareSupportReport() {
    const { filename, blob, file } = await createSupportReportFile("share-support-report");
    window.AgnihotraInstrumentation?.recordUserAction?.("support-share-clicked", { filename });

    const capacitor = window.Capacitor;
    const nativeFs = capacitor?.Plugins?.Filesystem;
    const nativeShare = capacitor?.Plugins?.Share;

    if (capacitor?.isNativePlatform?.() && nativeFs?.writeFile) {
      try {
        const path = `EternalAgniSupport/${filename}`;
        const base64 = await blobToBase64(blob);
        // Use private app storage (DATA) so support reports are wiped when
        // the user uninstalls the app, just like PDF/ICS exports. Other apps
        // can still read the file via the FileProvider content:// URI.
        await nativeFs.writeFile({
          path,
          data: base64,
          directory: "DATA",
          recursive: true,
        });
        const uri = await nativeFs.getUri({ path, directory: "DATA" });
        if (nativeShare?.share && uri?.uri) {
          const sharePayload = {
            title: "Agnihotra support report",
            text: "Sharing Agnihotra support report.",
            files: [uri.uri],
            // Keep url too for older share handlers that prefer a single uri field.
            url: uri.uri,
            dialogTitle: "Share support report",
          };
          await nativeShare.share({
            ...sharePayload,
          });
          setStatus("Support report shared.");
          return;
        }
      } catch (_) {}
    }

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: "Agnihotra support report",
          text: "Support report for issue debugging.",
          files: [file],
        });
        setStatus("Support report shared.");
        return;
      }
    } catch (_) {}

    downloadBlob(blob, filename);
    setStatus("Support report downloaded. Please share this file.");
  }

  function openSupportEmailDraft() {
    const subject = "Agnihotra App Support Report";
    const body = [
      "Hello Support Team,",
      "",
      "I am facing an issue in the Agnihotra app.",
      "",
      "Issue summary:",
      "-",
      "",
      "Steps to reproduce:",
      "1)",
      "2)",
      "",
      "Please attach:",
      "- support report file",
      "- screenshot (optional)",
      "",
      "Thank you.",
    ].join("\n");
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }

  function buildSupportEmailTemplate() {
    return {
      subject: "Agnihotra App Support Report",
      body: [
        "Hello Support Team,",
        "",
        "I am facing an issue in the Agnihotra app.",
        "",
        "Issue summary:",
        "-",
        "",
        "Steps to reproduce:",
        "1)",
        "2)",
        "",
        "Please attach:",
        "- support report file",
        "- screenshot (optional)",
        "",
        "Thank you.",
      ].join("\n"),
    };
  }

  async function emailSupportWithAttachment() {
    const { filename, blob, file } = await createSupportReportFile("email-support-report");
    window.AgnihotraInstrumentation?.recordUserAction?.("support-email-clicked", { filename });
    const capacitor = window.Capacitor;
    const nativeFs = capacitor?.Plugins?.Filesystem;
    const nativeEmailComposer = capacitor?.Plugins?.EmailComposer;
    const nativeShare = capacitor?.Plugins?.Share;
    const template = buildSupportEmailTemplate();
    const shareText = `Please send this report to ${SUPPORT_EMAIL}`;

    if (capacitor?.isNativePlatform?.() && nativeEmailComposer?.open) {
      try {
        const base64 = await blobToBase64(blob);
        await nativeEmailComposer.open({
          to: [SUPPORT_EMAIL],
          subject: template.subject,
          body: template.body,
          isHtml: false,
          attachments: [
            {
              type: "base64",
              path: base64,
              name: filename,
            },
          ],
        });
        setStatus("Email composer opened with report attached.");
        return;
      } catch (_) {}
    }

    if (capacitor?.isNativePlatform?.() && nativeFs?.writeFile && nativeShare?.share) {
      try {
        const path = `EternalAgniSupport/${filename}`;
        const base64 = await blobToBase64(blob);
        // Match the share flow — keep support reports in private app storage
        // so they vanish on uninstall.
        await nativeFs.writeFile({
          path,
          data: base64,
          directory: "DATA",
          recursive: true,
        });
        const uri = await nativeFs.getUri({ path, directory: "DATA" });
        if (uri?.uri) {
          const sharePayload = {
            title: "Email Agnihotra support report",
            text: `${shareText}\nTo: ${SUPPORT_EMAIL}`,
            files: [uri.uri],
            url: uri.uri,
            dialogTitle: "Send support report via email",
          };
          await nativeShare.share({
            ...sharePayload,
          });
          setStatus("Choose Gmail/Email app. Report file is attached.");
          return;
        }
      } catch (_) {}
    }

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: "Email Agnihotra support report",
          text: `${shareText}\nTo: ${SUPPORT_EMAIL}`,
          files: [file],
        });
        setStatus("Choose your email app. Report file is attached.");
        return;
      }
    } catch (_) {}

    downloadBlob(blob, filename);
    openSupportEmailDraft();
    setStatus("Email draft opened. Attach downloaded report and send.");
  }

  function setupTimeFormat() {
    const buttons = Array.from(document.querySelectorAll("[data-time-format]"));
    if (!buttons.length) return;
    let current = getTimeFormat();

    const sync = () => {
      buttons.forEach((btn) => {
        const active = btn.getAttribute("data-time-format") === current;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };
    sync();

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-time-format");
        if (next !== "ampm" && next !== "24h") return;
        current = next;
        setTimeFormat(next);
        sync();
        setStatus("Time format saved.");
        window.AgnihotraInstrumentation?.recordSettingsChange?.("time-format", next);
      });
    });
  }

  function setupReminderLeadTime() {
    const input = document.getElementById("reminderLeadTimeInput");
    if (!input) return;

    input.value = getReminderLeadTime();

    input.addEventListener("change", () => {
      let val = parseInt(input.value, 10);
      if (isNaN(val)) {
        val = DEFAULT_REMINDER_LEAD;
      }
      val = Math.max(MIN_REMINDER_LEAD, Math.min(MAX_REMINDER_LEAD, val));
      input.value = val;
      setReminderLeadTime(val);
      setStatus("Reminder timing saved.");
      window.AgnihotraInstrumentation?.recordSettingsChange?.("reminder-lead-minutes", val);
    });
  }

  function setupToggleSetting({
    inputId,
    storageKey,
    defaultValue,
    settingName,
    savedMessage,
    onAfterChange,
  }) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.checked = getBooleanSetting(storageKey, defaultValue);
    input.addEventListener("change", async () => {
      setBooleanSetting(storageKey, input.checked);
      setStatus(savedMessage);
      window.AgnihotraInstrumentation?.recordSettingsChange?.(settingName, input.checked);
      try {
        await onAfterChange?.(input.checked);
      } catch (error) {
        console.warn(`[AGNIHOTRA][SETTINGS] ${settingName} onAfterChange failed`, error);
      }
    });
  }

  function initSettingsPage() {
    setupTimeFormat();
    setupReminderLeadTime();
    setupToggleSetting({
      inputId: "reminderVibrateToggle",
      storageKey: REMINDER_VIBRATE_STORAGE_KEY,
      defaultValue: true,
      settingName: "reminder-vibrate",
      savedMessage: "Vibration setting saved.",
      onAfterChange: async (enabled) => {
        console.log(
          `[AGNIHOTRA][VIBRATE] settings-changed ${JSON.stringify({ enabled })}`
        );
        if (window.AgnihotraNotificationNative?.ensureCapacitorChannel) {
          await window.AgnihotraNotificationNative.ensureCapacitorChannel();
        }
      },
    });
    setupToggleSetting({
      inputId: "watchAlertToggle",
      storageKey: WATCH_ALERT_STORAGE_KEY,
      defaultValue: false,
      settingName: "watch-alert",
      savedMessage: "Smart watch alert setting saved.",
    });
    const shareBtn = document.getElementById("exportSupportLogsBtn");
    const emailBtn = document.getElementById("emailSupportBtn");
    shareBtn?.addEventListener("click", async () => {
      shareBtn.disabled = true;
      setStatus("Preparing support report...");
      try {
        await shareSupportReport();
      } catch (error) {
        setStatus("Unable to prepare support report. Try again.", true);
        console.error("[AGNIHOTRA][SUPPORT] share-failed", error);
      } finally {
        shareBtn.disabled = false;
      }
    });
    emailBtn?.addEventListener("click", async () => {
      emailBtn.disabled = true;
      setStatus("Preparing email with report...");
      try {
        await emailSupportWithAttachment();
      } catch (error) {
        console.error("[AGNIHOTRA][SUPPORT] email-with-attachment-failed", error);
        openSupportEmailDraft();
        setStatus("Email draft opened. Please attach report manually.", true);
      } finally {
        emailBtn.disabled = false;
      }
    });

    setupForceUpdateButton();
  }

  function setOtaStatus(message, isError = false) {
    const node = document.getElementById("otaForceStatus");
    if (!node) return;
    node.textContent = message || "";
    node.style.color = isError ? "#9c1d1d" : "#5d3414";
  }

  function describeOtaResult(res) {
    const status = res?.status || "unknown";
    switch (status) {
      case "queued":
        return {
          msg: `Update ${res.version} installed. It will take effect on the next app restart${
            res.heldUntil ? " (after the ritual window)" : ""
          }.`,
          error: false,
        };
      case "up-to-date":
        return { msg: `You're already on the latest version (${res.current}). Nothing to install.`, error: false };
      case "already-queued":
        return { msg: `Update ${res.version} is already installed — it will take effect on the next app restart.`, error: false };
      case "blocked-needs-new-apk":
        return {
          msg: `Latest bundle needs a newer app version (needs ${res.minNative}, this APK is ${res.native}). Install a new APK.`,
          error: true,
        };
      case "no-manifest":
        return { msg: "Could not reach the update server. Check your connection.", error: true };
      case "offline":
        return { msg: "You appear to be offline.", error: true };
      case "download-failed":
        return { msg: `Download failed: ${res.message || "unknown error"}.`, error: true };
      case "next-failed":
        return { msg: `Could not queue the update: ${res.message || "unknown error"}.`, error: true };
      case "plugin-incomplete":
        return { msg: "Updater is not available in this build. Install an updater-enabled APK.", error: true };
      case "web":
        return { msg: "Updates only run inside the installed app.", error: true };
      default:
        return { msg: `Update check finished (${status}).`, error: false };
    }
  }

  function setupForceUpdateButton() {
    const btn = document.getElementById("forceOtaUpdateBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const ota = window.AgnihotraOTA;
      if (!ota?.forceCheck) {
        setOtaStatus("Updater not loaded yet. Try again in a moment.", true);
        return;
      }
      btn.disabled = true;
      setOtaStatus("Checking for updates...");
      window.AgnihotraInstrumentation?.recordUserAction?.("ota-force-check-clicked");
      try {
        const res = await ota.forceCheck();
        const { msg, error } = describeOtaResult(res);
        setOtaStatus(msg, error);
      } catch (error) {
        console.error("[AGNIHOTRA][OTA] force-check-failed", error);
        setOtaStatus("Update check failed. Please try again.", true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initSettingsPage);
})();
