/**
 * Saved places (profiles): manual switch between fixed locations for Agnihotra timings.
 * GPS "auto" mode is separate; reminders follow the active place via script.js.
 */
(function () {
  const STORAGE_KEY = "agnihotra_saved_places_v1";
  const ACTIVE_KEY = "agnihotra_active_place_id_v1";
  const AUTO_ID = "auto";
  const MAX_PLACES = 15;
  const PLACE_SWITCH_HINT_SEEN_KEY = "agnihotra_place_switch_hint_seen_v1";
  // Saving "current place" within this distance of an existing place updates that
  // place instead of creating a duplicate (e.g. small GPS drift while at home).
  const NEARBY_PLACE_MERGE_KM = 0.5;

  function distanceKmBetween(lat1, lng1, lat2, lng2) {
    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lng2)
    ) {
      return Infinity;
    }
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Closest saved place within thresholdKm of the given coords, or null. */
  function findNearbyPlace(lat, lng, thresholdKm = NEARBY_PLACE_MERGE_KM) {
    let best = null;
    for (const place of getPlaces()) {
      const d = distanceKmBetween(lat, lng, place.lat, place.lng);
      if (d <= thresholdKm && (!best || d < best.distanceKm)) {
        best = { place, distanceKm: d };
      }
    }
    return best ? best.place : null;
  }

  function readPlaces() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writePlaces(places) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    } catch (_) {}
  }

  function createPlaceId() {
    return `place_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizePlace(raw) {
    if (!raw || typeof raw !== "object") return null;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const label = String(raw.label || "").trim();
    if (!label) return null;
    return {
      id: String(raw.id || createPlaceId()),
      label,
      lat,
      lng,
      locationName: raw.locationName ? String(raw.locationName) : null,
      locationDetail: raw.locationDetail ? String(raw.locationDetail) : null,
      savedAt: Number(raw.savedAt) || Date.now(),
    };
  }

  function getPlaces() {
    return readPlaces()
      .map(normalizePlace)
      .filter(Boolean);
  }

  function getActivePlaceId() {
    try {
      const id = localStorage.getItem(ACTIVE_KEY);
      if (!id || id === AUTO_ID) return AUTO_ID;
      return id;
    } catch (_) {
      return AUTO_ID;
    }
  }

  function setActivePlaceId(id) {
    try {
      localStorage.setItem(ACTIVE_KEY, id === AUTO_ID ? AUTO_ID : String(id));
    } catch (_) {}
  }

  function getActivePlace() {
    const id = getActivePlaceId();
    if (id === AUTO_ID) return null;
    return getPlaces().find((p) => p.id === id) || null;
  }

  function isManualPlaceActive() {
    return getActivePlaceId() !== AUTO_ID && Boolean(getActivePlace());
  }

  function addPlace({ label, lat, lng, locationName = null, locationDetail = null }) {
    const place = normalizePlace({
      id: createPlaceId(),
      label,
      lat,
      lng,
      locationName,
      locationDetail,
      savedAt: Date.now(),
    });
    if (!place) return { ok: false, reason: "invalid" };

    const places = getPlaces();
    if (places.length >= MAX_PLACES) {
      return { ok: false, reason: "max" };
    }
    places.push(place);
    writePlaces(places);
    return { ok: true, place };
  }

  function updatePlace(id, fields = {}) {
    const places = getPlaces();
    const idx = places.findIndex((p) => p.id === id);
    if (idx === -1) return { ok: false, reason: "not-found" };
    const merged = normalizePlace({
      ...places[idx],
      ...fields,
      id: places[idx].id,
      savedAt: Date.now(),
    });
    if (!merged) return { ok: false, reason: "invalid" };
    places[idx] = merged;
    writePlaces(places);
    return { ok: true, place: merged };
  }

  function removePlace(id) {
    const places = getPlaces().filter((p) => p.id !== id);
    writePlaces(places);
    if (getActivePlaceId() === id) {
      setActivePlaceId(AUTO_ID);
    }
    return places;
  }

  const PLACE_ICON_STYLE = "fa-solid";

  const PLACE_ICON_PRESETS = {
    home: { iconStyle: PLACE_ICON_STYLE, icon: "fa-house", toneClass: "place-icon--home" },
    office: { iconStyle: PLACE_ICON_STYLE, icon: "fa-building", toneClass: "place-icon--office" },
    temple: {
      iconStyle: PLACE_ICON_STYLE,
      icon: "fa-place-of-worship",
      toneClass: "place-icon--temple",
    },
    custom: { iconStyle: PLACE_ICON_STYLE, icon: "fa-location-dot", toneClass: "place-icon--custom" },
  };

  function renderPlaceIconHtml(iconMeta) {
    const style = iconMeta?.iconStyle || PLACE_ICON_STYLE;
    const icon = iconMeta?.icon || "fa-location-dot";
    return `<i class="${style} ${icon}" aria-hidden="true"></i>`;
  }

  function normalizePlaceLabelKey(label) {
    return String(label || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  /** Maps hOme / HOME / mandir etc. to chip preset id: Home | Office | Temple */
  function presetIdFromLabel(label) {
    const key = normalizePlaceLabelKey(label);
    if (key === "home" || key === "ghar" || key === "घर") return "Home";
    if (key === "office" || key === "work" || key === "कार्यालय" || key === "ऑफिस") {
      return "Office";
    }
    if (key === "temple" || key === "mandir" || key === "मंदिर") return "Temple";
    return null;
  }

  /** Canonical display name for known presets; keeps custom names as typed (trimmed). */
  function canonicalizePlaceLabel(label, t) {
    const presetId = presetIdFromLabel(label);
    if (!presetId) return String(label || "").trim();
    const chipLabels = {
      Home: t?.("places.chipHome", "Home") ?? "Home",
      Office: t?.("places.chipOffice", "Office") ?? "Office",
      Temple: t?.("places.chipTemple", "Temple") ?? "Temple",
    };
    return chipLabels[presetId] || presetId;
  }

  function getPlaceIconMeta(label) {
    const key = normalizePlaceLabelKey(label);
    if (key === "home" || key === "ghar" || key === "घर") {
      return PLACE_ICON_PRESETS.home;
    }
    if (key === "office" || key === "work" || key === "कार्यालय" || key === "ऑफिस") {
      return PLACE_ICON_PRESETS.office;
    }
    if (key === "temple" || key === "mandir" || key === "मंदिर") {
      return PLACE_ICON_PRESETS.temple;
    }
    return PLACE_ICON_PRESETS.custom;
  }

  const COORD_ONLY_NAME_RE = /^-?\d+\.\d{4,},\s*-?\d+\.\d{4,}$/;

  /** True when we only have coords / placeholder — should geocode when network returns. */
  function needsAddressEnrichment(record) {
    const name = String(record?.locationName || "").trim();
    if (!name) return true;
    if (/^gps location detected$/i.test(name)) return true;
    if (COORD_ONLY_NAME_RE.test(name)) return true;
    return false;
  }

  function formatPlaceAddressLines(place) {
    if (!place) return [];
    const lines = [];
    const seen = new Set();

    const pushLine = (value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) return;
      const dedupeKey = trimmed.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      lines.push(trimmed);
    };

    pushLine(place.locationName);
    if (place.locationDetail) {
      String(place.locationDetail)
        .split(" • ")
        .forEach((part) => pushLine(part));
    }
    if (!lines.length && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      pushLine(
        `${Number(place.lat).toFixed(5)}, ${Number(place.lng).toFixed(5)}`
      );
    }
    return lines;
  }

  /** Same shape as GPS renderLocationCard: label + primary + bullet details */
  function formatPlaceAddressCard(place) {
    if (!place) return { labelText: "", primary: "", secondary: "" };
    const allParts = formatPlaceAddressLines(place);
    const primary =
      place.locationName?.trim() ||
      allParts[0] ||
      place.label ||
      "";
    const primaryKey = primary.toLowerCase();
    const detailParts = allParts.filter(
      (part) => part.toLowerCase() !== primaryKey
    );
    if (!detailParts.length && allParts.length > 1) {
      detailParts.push(...allParts.slice(1));
    }
    return {
      labelText: place.label,
      primary,
      secondary: detailParts.join(" • "),
    };
  }

  function createAgniDialog() {
    const overlay = document.getElementById("agniDialog");
    const backdrop = overlay?.querySelector(".agni-dialog-backdrop");
    const closeBtn = document.getElementById("agniDialogCloseBtn");
    const iconEl = document.getElementById("agniDialogIcon");
    const titleEl = document.getElementById("agniDialogTitle");
    const messageEl = document.getElementById("agniDialogMessage");
    const previewEl = document.getElementById("agniDialogPreview");
    const formEl = document.getElementById("agniDialogForm");
    const labelEl = document.getElementById("agniDialogLabel");
    const inputEl = document.getElementById("agniDialogInput");
    const chipsEl = document.getElementById("agniDialogChips");
    const cancelBtn = document.getElementById("agniDialogCancelBtn");
    const confirmBtn = document.getElementById("agniDialogConfirmBtn");

    if (!overlay || !titleEl || !confirmBtn) {
      return {
        promptSavePlace: async () => null,
        confirm: async () => false,
        alert: async () => {},
      };
    }

    let resolvePending = null;
    let mode = "alert";
    let dialogLastT = null;

    function setHidden(el, hidden) {
      if (!el) return;
      el.classList.toggle("hidden", hidden);
    }

    function closeDialog(result) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("agni-dialog-open");
      const resolve = resolvePending;
      resolvePending = null;
      resolve?.(result);
    }

    function openDialog() {
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("agni-dialog-open");
    }

    function syncChipSelection(value) {
      if (!chipsEl) return;
      const presetId = presetIdFromLabel(value);
      chipsEl.querySelectorAll(".agni-dialog-chip").forEach((chip) => {
        const chipValue = chip.getAttribute("data-chip-value");
        chip.classList.toggle(
          "is-selected",
          Boolean(presetId && chipValue === presetId)
        );
      });
    }

    function bindChips(t) {
      if (!chipsEl) return;
      const chipLabels = {
        Home: t("places.chipHome", "Home"),
        Office: t("places.chipOffice", "Office"),
        Temple: t("places.chipTemple", "Temple"),
      };
      const chipIconMeta = {
        Home: PLACE_ICON_PRESETS.home,
        Office: PLACE_ICON_PRESETS.office,
        Temple: PLACE_ICON_PRESETS.temple,
      };
      chipsEl.querySelectorAll(".agni-dialog-chip").forEach((chip) => {
        const value = chip.getAttribute("data-chip-value");
        if (value && chipLabels[value]) {
          const icon = chipIconMeta[value]
            ? `${renderPlaceIconHtml(chipIconMeta[value])} `
            : "";
          chip.innerHTML = `${icon}${escapeHtml(chipLabels[value])}`;
        }
        chip.onclick = () => {
          if (!inputEl) return;
          inputEl.value = chipLabels[value] || value;
          syncChipSelection(inputEl.value);
          inputEl.focus();
        };
      });
      if (inputEl) {
        inputEl.oninput = () => syncChipSelection(inputEl.value);
      }
    }

    function onConfirmClick() {
      if (mode === "save") {
        const raw = String(inputEl?.value || "").trim();
        if (!raw) {
          inputEl?.focus();
          inputEl?.classList.add("agni-dialog-input--error");
          setTimeout(() => inputEl?.classList.remove("agni-dialog-input--error"), 600);
          return;
        }
        const value = canonicalizePlaceLabel(raw, dialogLastT);
        closeDialog(value);
        return;
      }
      if (mode === "confirm") {
        closeDialog(true);
        return;
      }
      closeDialog(undefined);
    }

    cancelBtn?.addEventListener("click", () => {
      closeDialog(mode === "confirm" ? false : null);
    });
    confirmBtn.addEventListener("click", onConfirmClick);
    closeBtn?.addEventListener("click", () => {
      closeDialog(mode === "confirm" ? false : null);
    });
    backdrop?.addEventListener("click", () => {
      closeDialog(mode === "confirm" ? false : null);
    });

    document.addEventListener("keydown", (e) => {
      if (overlay.classList.contains("hidden")) return;
      if (e.key === "Escape") {
        closeDialog(mode === "confirm" ? false : null);
      } else if (e.key === "Enter" && mode === "save") {
        onConfirmClick();
      }
    });

    return {
      promptSavePlace({
        t,
        defaultValue = "",
        locationPreview = "",
        title,
        hint,
        confirmText,
        icon,
      }) {
        return new Promise((resolve) => {
          resolvePending = resolve;
          mode = "save";
          dialogLastT = t;
          bindChips(t);

          iconEl.className = "agni-dialog-icon";
          iconEl.innerHTML = `<i class="fas ${icon || "fa-map-marker-alt"}"></i>`;
          titleEl.textContent = title || t("places.saveDialogTitle", "Save this place");
          messageEl.textContent =
            hint ||
            t(
              "places.saveDialogHint",
              "Give it a name you'll recognize when switching."
            );
          setHidden(messageEl, false);
          setHidden(formEl, false);
          setHidden(previewEl, !locationPreview);
          if (previewEl && locationPreview) {
            previewEl.innerHTML = `<i class="fas fa-map-marker-alt"></i><span>${escapeHtml(locationPreview)}</span>`;
          }
          labelEl.textContent = t("places.saveDialogLabel", "Place name");
          inputEl.placeholder = t("places.namePlaceholder", "e.g. Home, Office");
          inputEl.value = defaultValue;
          syncChipSelection(defaultValue);
          cancelBtn.textContent = t("places.dialogCancel", "Cancel");
          confirmBtn.textContent =
            confirmText || t("places.saveDialogConfirm", "Save place");
          setHidden(cancelBtn, false);
          confirmBtn.classList.remove("agni-dialog-btn--solo");

          openDialog();
          requestAnimationFrame(() => {
            inputEl?.focus();
            inputEl?.select();
          });
        });
      },

      confirm({ t, title, message, placeName = "", locationPreview = "" }) {
        return new Promise((resolve) => {
          resolvePending = resolve;
          mode = "confirm";
          iconEl.className = "agni-dialog-icon agni-dialog-icon--confirm";
          iconEl.innerHTML = '<i class="fas fa-trash-alt"></i>';
          titleEl.textContent = title;
          messageEl.textContent = message;
          setHidden(messageEl, false);
          setHidden(formEl, true);
          if (placeName) {
            setHidden(previewEl, false);
            previewEl.innerHTML = `<i class="fas fa-map-marker-alt"></i><span><strong>${escapeHtml(
              placeName
            )}</strong>${locationPreview ? `<br>${escapeHtml(locationPreview)}` : ""}</span>`;
          } else if (locationPreview) {
            setHidden(previewEl, false);
            previewEl.innerHTML = `<i class="fas fa-map-marker-alt"></i><span>${escapeHtml(
              locationPreview
            )}</span>`;
          } else {
            setHidden(previewEl, true);
          }
          cancelBtn.textContent = t("places.dialogCancel", "Cancel");
          confirmBtn.textContent = t("places.dialogDelete", "Remove");
          setHidden(cancelBtn, false);
          confirmBtn.classList.remove("agni-dialog-btn--solo");
          openDialog();
        });
      },

      alert({ t, title, message, tone = "info" }) {
        return new Promise((resolve) => {
          resolvePending = resolve;
          mode = "alert";
          iconEl.className = `agni-dialog-icon agni-dialog-icon--${tone}`;
          iconEl.innerHTML =
            tone === "info"
              ? '<i class="fas fa-info-circle"></i>'
              : '<i class="fas fa-map-marker-alt"></i>';
          titleEl.textContent = title;
          messageEl.textContent = message;
          setHidden(messageEl, false);
          setHidden(formEl, true);
          setHidden(previewEl, true);
          setHidden(cancelBtn, true);
          confirmBtn.textContent = t("places.dialogOk", "OK");
          confirmBtn.classList.add("agni-dialog-btn--solo");
          openDialog();
        });
      },
    };
  }

  function interpolateTemplate(template, values = {}) {
    return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) =>
      values[key] != null ? String(values[key]) : ""
    );
  }

  function hasSeenPlaceSwitchHint() {
    try {
      return localStorage.getItem(PLACE_SWITCH_HINT_SEEN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markPlaceSwitchHintSeen() {
    try {
      localStorage.setItem(PLACE_SWITCH_HINT_SEEN_KEY, "1");
    } catch (_) {}
    const trigger = document.getElementById("locationPlaceTrigger");
    trigger?.classList.remove("location-place-trigger--callout");
  }

  function updateLocationPlaceTriggerUI(t = (k, fb) => fb || k) {
    const trigger = document.getElementById("locationPlaceTrigger");
    const hintEl = document.getElementById("locationPlaceHint");
    const statusEl = document.getElementById("locationStatus");
    if (!trigger) return;

    const place = getActivePlace();
    const isSavedActive = Boolean(place);
    const placesCount = getPlaces().length;

    trigger.classList.toggle("is-saved-place-active", isSavedActive);
    if (!hasSeenPlaceSwitchHint()) {
      trigger.classList.add("location-place-trigger--callout");
    }

    if (hintEl) {
      if (isSavedActive) {
        hintEl.textContent = interpolateTemplate(
          t("places.eyebrowSaved", "Saved place · {{name}}"),
          { name: place.label }
        );
      } else {
        hintEl.textContent = t(
          "places.eyebrowCurrent",
          "Your current location"
        );
      }
    }

    // Only ever HIDE the loading status here (saved places never "detect").
    // Showing/hiding for GPS mode is owned solely by setLocationLoading(), so we
    // never force the "Detecting…" spinner back on while an address is on screen.
    if (statusEl && isSavedActive) {
      statusEl.style.display = "none";
    }

    const ariaLabel = isSavedActive
      ? interpolateTemplate(
          t(
            "places.triggerAriaNamed",
            "{{name}} selected. Tap to switch saved place."
          ),
          { name: place.label }
        )
      : t(
          "places.triggerAria",
          "Location. Tap to switch or save places like Home and Office."
        );
    trigger.setAttribute("aria-label", ariaLabel);
  }

  function debounce(fn, ms) {
    let timer = null;
    const wrapped = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => clearTimeout(timer);
    return wrapped;
  }

  /**
   * Full-screen "add a place" flow: free-text autocomplete (Photon) + a
   * drag-the-map exact picker (Leaflet) for spots missing from the free DB.
   * onSaved(place) is called after the place is created.
   */
  function setupPlaceSearch({ t = (k, fb) => fb || k, dialog, getLastKnownLocation, onSaved }) {
    const sheet = document.getElementById("placeSearchSheet");
    if (!sheet) return { open: () => {} };

    const input = document.getElementById("placeSearchInput");
    const resultsEl = document.getElementById("placeSearchResults");
    const spinner = document.getElementById("placeSearchSpinner");
    const clearBtn = document.getElementById("placeSearchClear");
    const backBtn = document.getElementById("placeSearchBackBtn");
    const mapEl = document.getElementById("placeSearchMap");
    const selNameEl = document.getElementById("placeSearchSelName");
    const selDetailEl = document.getElementById("placeSearchSelDetail");
    const selCoordsEl = document.getElementById("placeSearchSelCoords");
    const useBtn = document.getElementById("placeSearchUseBtn");
    const api = window.AgnihotraPlaceSearch;

    let map = null;
    let selected = null; // { lat, lng, name, detail, postcode }
    let searchAbort = null;
    let reverseAbort = null;
    let skipNextMoveend = false;

    // Pagination / infinite scroll state.
    const PAGE_BASE = 8;
    const PAGE_STEP = 8;
    const PAGE_MAX = 40;
    let lastQuery = "";
    let pageLimit = PAGE_BASE;
    let currentItems = [];
    let hasMore = false;
    let loadingMore = false;

    function setSpinner(on) {
      spinner?.classList.toggle("hidden", !on);
    }

    function setSelected(next) {
      selected = next;
      if (next) {
        selNameEl.textContent = next.name || "";
        selDetailEl.textContent = next.detail || "";
        if (selCoordsEl) {
          selCoordsEl.textContent =
            Number.isFinite(next.lat) && Number.isFinite(next.lng)
              ? `${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`
              : "";
        }
        useBtn.removeAttribute("disabled");
      } else {
        selNameEl.textContent = "";
        selDetailEl.textContent = "";
        if (selCoordsEl) selCoordsEl.textContent = "";
        useBtn.setAttribute("disabled", "true");
      }
    }

    function renderResults(items, { footer } = {}) {
      currentItems = items || [];
      if (!currentItems.length && !footer) {
        resultsEl.innerHTML = "";
        resultsEl.classList.remove("is-open");
        input?.setAttribute("aria-expanded", "false");
        return;
      }
      const rows = currentItems
        .map((r, i) => {
          return `<li role="option" class="place-search-result" data-idx="${i}">
            <span class="place-search-result-icon"><i class="fas fa-location-dot"></i></span>
            <span class="place-search-result-text">
              <span class="place-search-result-name">${escapeHtml(r.name)}</span>
              <span class="place-search-result-detail">${escapeHtml(r.detail)}</span>
            </span>
          </li>`;
        })
        .join("");
      const footerRow = footer
        ? `<li class="place-search-result-footer" aria-disabled="true">${escapeHtml(
            footer
          )}</li>`
        : "";
      resultsEl.innerHTML = rows + footerRow;
      resultsEl.classList.add("is-open");
      input?.setAttribute("aria-expanded", "true");
      resultsEl.querySelectorAll(".place-search-result").forEach((li) => {
        li.addEventListener("click", () => {
          const item = currentItems[Number(li.getAttribute("data-idx"))];
          if (item) chooseResult(item);
        });
      });
    }

    async function fetchPage(q, limit, signal) {
      const center = map?.getCenter();
      return api.search(q, {
        lat: center?.lat ?? getLastKnownLocation?.()?.lat,
        lng: center?.lng ?? getLastKnownLocation?.()?.lng,
        lang:
          (typeof document !== "undefined" && document.documentElement.lang) ||
          "en",
        limit,
        signal,
      });
    }

    async function loadMore() {
      if (loadingMore || !hasMore || !lastQuery) return;
      if (pageLimit >= PAGE_MAX) return;
      loadingMore = true;
      renderResults(currentItems, {
        footer: t("places.searchLoadingMore", "Loading more…"),
      });
      const nextLimit = Math.min(PAGE_MAX, pageLimit + PAGE_STEP);
      if (searchAbort) searchAbort.abort();
      searchAbort = new AbortController();
      try {
        const items = await fetchPage(lastQuery, nextLimit, searchAbort.signal);
        pageLimit = nextLimit;
        hasMore = items.length >= nextLimit && nextLimit < PAGE_MAX;
        renderResults(items);
      } catch (err) {
        if (err?.name !== "AbortError") renderResults(currentItems);
      } finally {
        loadingMore = false;
      }
    }

    function chooseResult(item) {
      renderResults([]);
      input.value = item.name;
      setSelected({
        lat: item.lat,
        lng: item.lng,
        name: item.name,
        detail: item.detail,
        postcode: item.postcode || null,
      });
      if (map) {
        skipNextMoveend = true; // we already have this address from the result
        map.setView([item.lat, item.lng], 16, { animate: true });
      }
    }

    const runSearch = debounce(async (q) => {
      const query = q.trim();
      if (!api || query.length < 2) {
        lastQuery = "";
        hasMore = false;
        renderResults([]);
        setSpinner(false);
        return;
      }
      if (searchAbort) searchAbort.abort();
      searchAbort = new AbortController();
      setSpinner(true);
      lastQuery = query;
      pageLimit = PAGE_BASE;
      hasMore = false;
      try {
        const items = await fetchPage(query, pageLimit, searchAbort.signal);
        hasMore = items.length >= pageLimit && pageLimit < PAGE_MAX;
        renderResults(items);
      } catch (err) {
        if (err?.name !== "AbortError") renderResults([]);
      } finally {
        setSpinner(false);
      }
    }, 320);

    resultsEl?.addEventListener("scroll", () => {
      if (
        resultsEl.scrollTop + resultsEl.clientHeight >=
        resultsEl.scrollHeight - 28
      ) {
        loadMore();
      }
    });

    const reverseCenter = debounce(async () => {
      if (!api || !map) return;
      if (reverseAbort) reverseAbort.abort();
      reverseAbort = new AbortController();
      const c = map.getCenter();
      // Keep the button usable immediately with coords; refine with address.
      setSelected({
        lat: c.lat,
        lng: c.lng,
        name: selected?.name || `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
        detail: selected?.detail || "",
        postcode: selected?.postcode || null,
      });
      try {
        const r = await api.reverse(c.lat, c.lng, {
          lang: document.documentElement.lang || "en",
          signal: reverseAbort.signal,
        });
        if (r) {
          setSelected({
            lat: c.lat,
            lng: c.lng,
            name: r.name,
            detail: r.detail,
            postcode: r.postcode || null,
          });
        }
      } catch (_) {}
    }, 550);

    function ensureMap() {
      if (map || !mapEl || typeof L === "undefined") return;
      const last = getLastKnownLocation?.();
      const startLat = Number.isFinite(last?.lat) ? last.lat : 20.5937;
      const startLng = Number.isFinite(last?.lng) ? last.lng : 78.9629;
      const startZoom = Number.isFinite(last?.lat) ? 14 : 5;
      map = L.map(mapEl, {
        zoomControl: true,
        attributionControl: true,
        tap: true,
      }).setView([startLat, startLng], startZoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      // moveend fires once per move (drag OR zoom OR programmatic setView).
      // We skip only the programmatic setView that follows a result tap; every
      // real user drag/zoom re-resolves the center (so longitude updates too).
      map.on("moveend", () => {
        if (skipNextMoveend) {
          skipNextMoveend = false;
          return;
        }
        reverseCenter();
      });
    }

    function open() {
      sheet.classList.remove("hidden");
      sheet.setAttribute("aria-hidden", "false");
      document.body.classList.add("place-search-open");
      input.value = "";
      renderResults([]);
      setSelected(null);
      ensureMap();
      requestAnimationFrame(() => {
        map?.invalidateSize();
        const last = getLastKnownLocation?.();
        if (map && Number.isFinite(last?.lat)) {
          skipNextMoveend = true;
          map.setView([last.lat, last.lng], 14);
        }
        input.focus();
      });
    }

    function close() {
      sheet.classList.add("hidden");
      sheet.setAttribute("aria-hidden", "true");
      document.body.classList.remove("place-search-open");
      searchAbort?.abort();
      reverseAbort?.abort();
      runSearch.cancel();
      reverseCenter.cancel();
    }

    input?.addEventListener("input", () => {
      const q = input.value;
      clearBtn?.classList.toggle("hidden", !q);
      runSearch(q);
    });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const first = resultsEl.querySelector(".place-search-result");
        first?.click();
      }
    });
    clearBtn?.addEventListener("click", () => {
      input.value = "";
      clearBtn.classList.add("hidden");
      renderResults([]);
      input.focus();
    });
    backBtn?.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheet.classList.contains("hidden")) close();
    });

    useBtn?.addEventListener("click", async () => {
      if (!selected) return;
      const previewParts = [selected.detail].filter(Boolean);
      if (selected.postcode && !String(selected.detail || "").includes(selected.postcode)) {
        previewParts.push(selected.postcode);
      }
      const label = await dialog.promptSavePlace({
        t,
        defaultValue: String(selected.name || "").split(",")[0].trim(),
        locationPreview: [selected.name, ...previewParts].filter(Boolean).join(", "),
        title: t("places.searchSaveTitle", "Name this place"),
        hint: t("places.saveDialogHint", "Give it a name you'll recognize when switching."),
        confirmText: t("places.saveDialogConfirm", "Save place"),
      });
      if (label == null) return;

      const detailParts = [];
      if (selected.detail) detailParts.push(selected.detail);
      if (selected.postcode && !detailParts.join(" ").includes(selected.postcode)) {
        detailParts.push(selected.postcode);
      }
      const result = addPlace({
        label,
        lat: selected.lat,
        lng: selected.lng,
        locationName: selected.name || null,
        locationDetail: detailParts.join(" • ") || null,
      });
      if (!result.ok) {
        if (result.reason === "max") {
          await dialog.alert({
            t,
            tone: "info",
            title: t("places.maxTitle", "Limit reached"),
            message: t("places.maxReached", `You can save up to ${MAX_PLACES} places.`),
          });
        }
        return;
      }
      close();
      await onSaved?.(result.place);
    });

    return { open };
  }

  function setupPlacePickerUI(deps) {
    const {
      t = (k, fb) => fb || k,
      getLastKnownLocation,
      onPlacePickerOpen,
      onSelectPlace,
      onSelectAuto,
      onPlacesChanged,
    } = deps || {};

    const sheet = document.getElementById("placePickerSheet");
    const list = document.getElementById("placePickerList");
    const trigger = document.getElementById("locationPlaceTrigger");
    const autoBtn = document.getElementById("placePickerAutoBtn");
    const addBtn = document.getElementById("placePickerAddBtn");
    const closeBtn = document.getElementById("placePickerCloseBtn");
    const backdrop = sheet?.querySelector(".place-picker-backdrop");
    const listWrap = list?.parentElement;
    const scrollCue = document.getElementById("placePickerScrollCue");

    if (!sheet || !list || !trigger) return;

    function pickerDistanceKm(a, b) {
      if (
        !a ||
        !b ||
        !Number.isFinite(a.lat) ||
        !Number.isFinite(a.lng) ||
        !Number.isFinite(b.lat) ||
        !Number.isFinite(b.lng)
      ) {
        return Number.POSITIVE_INFINITY;
      }
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
    }

    function updateScrollCues() {
      if (!listWrap) return;
      const moreBelow =
        list.scrollHeight - list.clientHeight - list.scrollTop > 6;
      const moreAbove = list.scrollTop > 6;
      listWrap.classList.toggle("can-scroll-down", moreBelow);
      listWrap.classList.toggle("can-scroll-up", moreAbove);
    }

    list.addEventListener("scroll", updateScrollCues, { passive: true });
    scrollCue?.addEventListener("click", () => {
      list.scrollBy({ top: Math.round(list.clientHeight * 0.8), behavior: "smooth" });
    });
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScrollCues);
    }

    const dialog = createAgniDialog();

    function closeSheet() {
      sheet.classList.add("hidden");
      sheet.setAttribute("aria-hidden", "true");
      trigger.setAttribute("aria-expanded", "false");
      document.body.classList.remove("place-picker-open");
    }

    function openSheet() {
      markPlaceSwitchHintSeen();
      renderList();
      placeSearch?.reflectOnlineState?.();
      sheet.classList.remove("hidden");
      sheet.setAttribute("aria-hidden", "false");
      trigger.setAttribute("aria-expanded", "true");
      document.body.classList.add("place-picker-open");
      requestAnimationFrame(() => requestAnimationFrame(updateScrollCues));
      onPlacePickerOpen?.();
    }

    function renderList() {
      const activeId = getActivePlaceId();
      const allPlaces = getPlaces();

      // Order saved places by ascending distance from the current reference
      // point: the active saved place if there is one, otherwise the device's
      // last known location. The active place naturally sorts first (distance 0).
      const activePlace = allPlaces.find((p) => p.id === activeId);
      const ref =
        activePlace && Number.isFinite(activePlace.lat)
          ? { lat: activePlace.lat, lng: activePlace.lng }
          : getLastKnownLocation?.();
      let places = allPlaces;
      if (ref && Number.isFinite(ref.lat) && Number.isFinite(ref.lng)) {
        places = [...allPlaces].sort(
          (p1, p2) => pickerDistanceKm(ref, p1) - pickerDistanceKm(ref, p2)
        );
      }

      const autoLabel = t("places.currentGps", "Current location (GPS)");
      const autoActive = activeId === AUTO_ID;

      let html = `
        <li>
          <button type="button" class="place-picker-item${autoActive ? " is-active" : ""}" data-place-id="${AUTO_ID}">
            <span class="place-picker-item-icon place-icon--custom">${renderPlaceIconHtml({ iconStyle: PLACE_ICON_STYLE, icon: "fa-location-crosshairs" })}</span>
            <span class="place-picker-item-text">
              <span class="place-picker-item-label">${escapeHtml(autoLabel)}</span>
              <span class="place-picker-item-detail">${escapeHtml(t("places.currentGpsHint", "Uses your device GPS"))}</span>
            </span>
            ${autoActive ? '<span class="place-picker-check"><i class="fas fa-check"></i></span>' : ""}
          </button>
        </li>`;

      places.forEach((place) => {
        const isActive = place.id === activeId;
        const iconMeta = getPlaceIconMeta(place.label);
        const addressCard = formatPlaceAddressCard(place);
        const detail =
          [addressCard.primary, addressCard.secondary]
            .filter(Boolean)
            .join(" • ") ||
          `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`;
        html += `
        <li>
          <button type="button" class="place-picker-item${isActive ? " is-active" : ""}" data-place-id="${escapeHtml(place.id)}">
            <span class="place-picker-item-icon ${iconMeta.toneClass}">${renderPlaceIconHtml(iconMeta)}</span>
            <span class="place-picker-item-text">
              <span class="place-picker-item-label">${escapeHtml(place.label)}</span>
              <span class="place-picker-item-detail">${escapeHtml(detail)}</span>
            </span>
            ${isActive ? '<span class="place-picker-check"><i class="fas fa-check"></i></span>' : ""}
          </button>
          <button type="button" class="place-picker-edit" data-edit-id="${escapeHtml(place.id)}" aria-label="${escapeHtml(t("places.editAria", "Rename place"))}">
            <i class="fas fa-pen"></i>
          </button>
          <button type="button" class="place-picker-delete" data-delete-id="${escapeHtml(place.id)}" aria-label="${escapeHtml(t("places.delete", "Delete place"))}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </li>`;
      });

      list.innerHTML = html;
      requestAnimationFrame(updateScrollCues);

      async function applyPlaceSelection(handler) {
        closeSheet();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await handler?.();
        onPlacesChanged?.();
      }

      list.querySelectorAll(".place-picker-item").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-place-id");
          if (id === AUTO_ID) {
            setActivePlaceId(AUTO_ID);
            await applyPlaceSelection(onSelectAuto);
            return;
          }
          const place = getPlaces().find((p) => p.id === id);
          if (!place) return;
          setActivePlaceId(place.id);
          await applyPlaceSelection(() => onSelectPlace?.(place));
        });
      });

      list.querySelectorAll(".place-picker-edit").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-edit-id");
          if (!id) return;
          const place = getPlaces().find((p) => p.id === id);
          if (!place) return;

          const preview =
            place.locationName ||
            place.locationDetail ||
            `${Number(place.lat).toFixed(4)}, ${Number(place.lng).toFixed(4)}`;
          const newLabel = await dialog.promptSavePlace({
            t,
            defaultValue: place.label,
            locationPreview: preview,
            title: t("places.renameTitle", "Rename place"),
            hint: t(
              "places.renameHint",
              "Update the name for this saved place."
            ),
            confirmText: t("places.renameConfirm", "Save name"),
            icon: "fa-pen",
          });
          if (newLabel == null) return;

          const result = updatePlace(id, { label: newLabel });
          if (!result.ok) return;
          renderList();
          // Keep the hero card / timings label in sync if the active place was renamed.
          if (getActivePlaceId() === id) {
            await onSelectPlace?.(result.place);
          }
          onPlacesChanged?.();
        });
      });

      list.querySelectorAll(".place-picker-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-delete-id");
          if (!id) return;
          const placeToRemove = getPlaces().find((p) => p.id === id);
          const placeName = placeToRemove?.label || "";
          const confirmed = await dialog.confirm({
            t,
            title: placeName
              ? interpolateTemplate(
                  t("places.deleteTitleNamed", "Remove {{name}}?"),
                  { name: placeName }
                )
              : t("places.deleteTitle", "Remove place?"),
            message: placeName
              ? interpolateTemplate(
                  t(
                    "places.deleteConfirmNamed",
                    "{{name}} will be removed from your saved list. You can save it again anytime."
                  ),
                  { name: placeName }
                )
              : t(
                  "places.deleteConfirm",
                  "This saved place will be removed. Timings will use your current selection."
                ),
            placeName,
            locationPreview:
              placeToRemove?.locationName ||
              placeToRemove?.locationDetail ||
              "",
          });
          if (!confirmed) return;
          removePlace(id);
          renderList();
          if (getActivePlaceId() === AUTO_ID) {
            await onSelectAuto?.();
          } else {
            const place = getActivePlace();
            if (place) await onSelectPlace?.(place);
          }
          onPlacesChanged?.();
        });
      });
    }

    trigger.addEventListener("click", () => {
      if (sheet.classList.contains("hidden")) openSheet();
      else closeSheet();
    });

    closeBtn?.addEventListener("click", closeSheet);
    backdrop?.addEventListener("click", closeSheet);

    autoBtn?.addEventListener("click", async () => {
      setActivePlaceId(AUTO_ID);
      closeSheet();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await onSelectAuto?.();
      onPlacesChanged?.();
    });

    addBtn?.addEventListener("click", async () => {
      await onPlacePickerOpen?.();
      const last = getLastKnownLocation?.();
      if (!last?.lat || !last?.lng) {
        await dialog.alert({
          t,
          tone: "info",
          title: t("places.needGpsTitle", "Location needed"),
          message: t(
            "places.needGpsFirst",
            "Enable location first, then save this place."
          ),
        });
        return;
      }

      // If we're standing at (or very near) an already-saved place, edit that one
      // instead of creating a duplicate — handles small GPS drift while at home.
      const nearby = findNearbyPlace(last.lat, last.lng);

      const defaultLabel =
        nearby?.label ||
        last.locationName?.split(",")[0]?.trim() ||
        t("places.defaultLabel", "My place");
      const locationPreview =
        last.locationName ||
        last.locationDetail ||
        `${Number(last.lat).toFixed(4)}, ${Number(last.lng).toFixed(4)}`;

      const label = await dialog.promptSavePlace({
        t,
        defaultValue: defaultLabel,
        locationPreview,
      });
      if (label == null) return;

      let result;
      if (nearby) {
        // Update existing place's coords + freshest address; keep its id.
        result = updatePlace(nearby.id, {
          label,
          lat: last.lat,
          lng: last.lng,
          locationName: last.locationName || nearby.locationName || null,
          locationDetail: last.locationDetail || nearby.locationDetail || null,
        });
      } else {
        result = addPlace({
          label,
          lat: last.lat,
          lng: last.lng,
          locationName: last.locationName || null,
          locationDetail: last.locationDetail || null,
        });
      }

      if (!result.ok) {
        if (result.reason === "max") {
          await dialog.alert({
            t,
            tone: "info",
            title: t("places.maxTitle", "Limit reached"),
            message: t(
              "places.maxReached",
              `You can save up to ${MAX_PLACES} places.`
            ),
          });
        }
        return;
      }

      setActivePlaceId(result.place.id);
      closeSheet();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await onSelectPlace?.(result.place);
      onPlacesChanged?.();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheet.classList.contains("hidden")) {
        closeSheet();
      }
    });

    // ---- Search-a-place + drag-map exact picker ----------------------------
    const placeSearch = setupPlaceSearch({
      t,
      dialog,
      getLastKnownLocation,
      onSaved: async (place) => {
        setActivePlaceId(place.id);
        closeSheet();
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        await onSelectPlace?.(place);
        onPlacesChanged?.();
      },
    });

    const searchBtn = document.getElementById("placePickerSearchBtn");

    // Search + map need the network (Photon / Nominatim / OSM tiles). Disable
    // the entry point when offline so users aren't dropped into a dead screen.
    function isOnlineForSearch() {
      if (typeof window !== "undefined" && window.__agnihotraForcedOffline) {
        return false;
      }
      return typeof navigator === "undefined" || navigator.onLine !== false;
    }

    function reflectSearchOnlineState() {
      if (!searchBtn) return;
      const online = isOnlineForSearch();
      searchBtn.disabled = !online;
      searchBtn.classList.toggle("place-picker-action--offline", !online);
      const span = searchBtn.querySelector("span");
      if (span) {
        if (!searchBtn.dataset.onlineLabel) {
          searchBtn.dataset.onlineLabel = span.textContent;
        }
        span.textContent = online
          ? searchBtn.dataset.onlineLabel
          : t("places.searchOffline", "Search needs internet");
      }
    }

    searchBtn?.addEventListener("click", () => {
      if (!isOnlineForSearch()) return;
      placeSearch?.open();
    });

    if (typeof window !== "undefined") {
      window.addEventListener("online", reflectSearchOnlineState);
      window.addEventListener("offline", reflectSearchOnlineState);
    }
    reflectSearchOnlineState();
    placeSearch.reflectOnlineState = reflectSearchOnlineState;

    updateLocationPlaceTriggerUI(t);
    if (!hasSeenPlaceSwitchHint()) {
      trigger.classList.add("location-place-trigger--callout");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.AgnihotraSavedPlaces = {
    AUTO_ID,
    MAX_PLACES,
    getPlaces,
    getActivePlaceId,
    setActivePlaceId,
    getActivePlace,
    isManualPlaceActive,
    addPlace,
    updatePlace,
    removePlace,
    findNearbyPlace,
    needsAddressEnrichment,
    getPlaceIconMeta,
    presetIdFromLabel,
    canonicalizePlaceLabel,
    renderPlaceIconHtml,
    formatPlaceAddressLines,
    formatPlaceAddressCard,
    setupPlacePickerUI,
    updateLocationPlaceTriggerUI,
  };
})();
