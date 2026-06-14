/**
 * Free place search + reverse geocoding for the "Add a place" flow.
 *
 * - Forward search / autocomplete: Photon (Komoot) — OSM-based, built for
 *   search-as-you-type, supports location bias (lat/lon). Free for fair use.
 * - Final resolve / reverse (map drag): Nominatim — richer structured address
 *   incl. postcode. Hard-throttled to <= 1 req/sec per its usage policy.
 *
 * UX-critical concerns handled here so the UI stays dumb:
 *   • debounce is done in the UI; here we cancel stale requests via AbortController
 *   • Nominatim calls are serialized + spaced >= 1100ms (policy compliance)
 *   • small in-memory LRU cache for queries and reverse lookups
 *   • graceful fallback Photon -> Nominatim when Photon yields nothing
 */
(function () {
  const PHOTON_URL = "https://photon.komoot.io/api/";
  const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
  const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
  // Identify the app to Nominatim (policy requires a real UA / contact).
  const CONTACT = "EternalAgni Agnihotra App (https://eternalagni.com)";
  const NOMINATIM_MIN_INTERVAL_MS = 1100;
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const CACHE_MAX = 60;

  const queryCache = new Map(); // key -> { at, value }
  const reverseCache = new Map();

  function cacheGet(map, key) {
    const hit = map.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
      map.delete(key);
      return null;
    }
    // refresh LRU order
    map.delete(key);
    map.set(key, hit);
    return hit.value;
  }

  function cacheSet(map, key, value) {
    map.set(key, { at: Date.now(), value });
    while (map.size > CACHE_MAX) {
      map.delete(map.keys().next().value);
    }
  }

  // --- Nominatim throttle: serialize calls, space them >= MIN_INTERVAL --------
  let nominatimChain = Promise.resolve();
  let lastNominatimAt = 0;

  function scheduleNominatim(task) {
    const run = nominatimChain.then(async () => {
      const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await task();
      } finally {
        lastNominatimAt = Date.now();
      }
    });
    // Keep the chain alive even if a task throws/aborts.
    nominatimChain = run.catch(() => {});
    return run;
  }

  function isOffline() {
    if (typeof window !== "undefined" && window.__agnihotraForcedOffline) return true;
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }

  async function fetchJson(url, { signal, headers } = {}) {
    const res = await fetch(url, { signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function haversineKm(aLat, aLng, bLat, bLng) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Re-rank by API relevance order but penalize distance from the bias point
  // (the user's own map center — adapts to wherever they are, not a fixed
  // country). Keeps a faraway-but-named place reachable while pushing unrelated
  // same-name hits (e.g. "Jasmine Apartment" on another continent) far down.
  function rerankByProximity(results, lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return results;
    const RANK_WEIGHT_KM = 60; // each relevance rank ≈ 60 km of "credit"
    return results
      .map((r, i) => ({
        r,
        score: i * RANK_WEIGHT_KM + haversineKm(lat, lng, r.lat, r.lng),
      }))
      .sort((a, b) => a.score - b.score)
      .map((x) => x.r);
  }

  function dedupePush(arr, seen, value) {
    const v = String(value || "").trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    arr.push(v);
  }

  // --- Normalizers ------------------------------------------------------------
  function normalizePhotonFeature(f) {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const p = f.properties || {};

    const street =
      [p.housenumber, p.street].filter(Boolean).join(" ") || p.street || "";
    const name =
      p.name ||
      street ||
      p.locality ||
      p.district ||
      p.city ||
      p.county ||
      p.state ||
      "";

    const detailParts = [];
    const seen = new Set();
    if (name) seen.add(String(name).toLowerCase());
    dedupePush(detailParts, seen, street);
    dedupePush(detailParts, seen, p.locality);
    dedupePush(detailParts, seen, p.district);
    dedupePush(detailParts, seen, p.city);
    dedupePush(detailParts, seen, p.county);
    dedupePush(detailParts, seen, p.state);
    dedupePush(detailParts, seen, p.postcode);
    dedupePush(detailParts, seen, p.country);

    return {
      source: "photon",
      name: String(name).trim() || "Selected location",
      detail: detailParts.join(", "),
      lat,
      lng,
      postcode: p.postcode ? String(p.postcode) : null,
      address: p,
    };
  }

  function normalizeNominatim(r) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const a = r.address || {};
    const street =
      [a.house_number, a.road].filter(Boolean).join(" ") || a.road || "";
    const locality =
      a.neighbourhood || a.suburb || a.hamlet || a.village || a.town || "";
    const city = a.city || a.town || a.village || a.municipality || "";
    const name =
      r.name ||
      String(r.display_name || "").split(",")[0] ||
      street ||
      locality ||
      city;

    const detailParts = [];
    const seen = new Set();
    if (name) seen.add(String(name).toLowerCase());
    dedupePush(detailParts, seen, street);
    dedupePush(detailParts, seen, locality);
    dedupePush(detailParts, seen, city);
    dedupePush(detailParts, seen, a.county);
    dedupePush(detailParts, seen, a.state);
    dedupePush(detailParts, seen, a.postcode);
    dedupePush(detailParts, seen, a.country);

    return {
      source: "nominatim",
      name: String(name).trim() || "Selected location",
      detail: detailParts.join(", "),
      lat,
      lng,
      postcode: a.postcode ? String(a.postcode) : null,
      address: a,
    };
  }

  // --- Public: forward search (autocomplete) ---------------------------------
  async function search(query, opts = {}) {
    const q = String(query || "").trim();
    if (q.length < 2 || isOffline()) return [];
    const { lat, lng, lang = "en", limit = 8, signal } = opts;

    const cacheKey = `${q}|${lat ?? ""}|${lng ?? ""}|${lang}|${limit}`;
    const cached = cacheGet(queryCache, cacheKey);
    if (cached) return cached;

    // Photon first (built for type-ahead + bias).
    try {
      // Over-fetch then re-rank locally so proximity wins over same-name noise.
      const fetchLimit = Math.min(40, Math.max(limit * 2, 12));
      const params = new URLSearchParams({
        q,
        limit: String(fetchLimit),
        lang,
      });
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        params.set("lat", String(lat));
        params.set("lon", String(lng));
        params.set("location_bias_scale", "0.8");
      }
      const data = await fetchJson(`${PHOTON_URL}?${params.toString()}`, {
        signal,
      });
      const results = rerankByProximity(
        (data?.features || []).map(normalizePhotonFeature).filter(Boolean),
        lat,
        lng
      ).slice(0, limit);
      if (results.length) {
        cacheSet(queryCache, cacheKey, results);
        return results;
      }
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      // fall through to Nominatim
    }

    // Fallback: Nominatim forward search (throttled).
    try {
      const results = await scheduleNominatim(async () => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          limit: String(Math.min(40, Math.max(limit * 2, 12))),
          q,
          "accept-language": lang,
        });
        const data = await fetchJson(
          `${NOMINATIM_SEARCH_URL}?${params.toString()}`,
          { signal, headers: { Referer: CONTACT } }
        );
        return rerankByProximity(
          (Array.isArray(data) ? data : [])
            .map(normalizeNominatim)
            .filter(Boolean),
          lat,
          lng
        ).slice(0, limit);
      });
      cacheSet(queryCache, cacheKey, results);
      return results;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      return [];
    }
  }

  // --- Public: reverse geocode (used after map drag / marker move) ------------
  async function reverse(lat, lng, opts = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || isOffline()) return null;
    const { lang = "en", signal } = opts;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)},${lang}`;
    const cached = cacheGet(reverseCache, key);
    if (cached) return cached;

    try {
      const value = await scheduleNominatim(async () => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          lat: String(lat),
          lon: String(lng),
          "accept-language": lang,
          zoom: "18",
        });
        const data = await fetchJson(
          `${NOMINATIM_REVERSE_URL}?${params.toString()}`,
          { signal, headers: { Referer: CONTACT } }
        );
        if (!data || data.error) return null;
        return normalizeNominatim({
          lat: data.lat,
          lon: data.lon,
          name: data.name,
          display_name: data.display_name,
          address: data.address,
        });
      });
      if (value) cacheSet(reverseCache, key, value);
      return value;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      return null;
    }
  }

  window.AgnihotraPlaceSearch = { search, reverse, isOffline };
})();
