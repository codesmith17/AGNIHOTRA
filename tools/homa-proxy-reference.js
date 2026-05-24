/**
 * Vercel serverless proxy — forwards timing requests to homatherapie.de's
 * official JSON API (v2) and returns a flat date→{sunrise,sunset} map.
 *
 * ⚠️  COMPARISON / VALIDATION ONLY
 * The app's primary timing source is timings-engine.js (our offline NOAA engine).
 * This proxy exists for:
 *   - Validating our engine vs homatherapie.de (use tools/compare-timings.js)
 *   - Optional exact-match override for web clients that need it
 *
 * Endpoint: POST /api/agnihotra
 * Body (JSON or form-encoded):
 *   lat        – latitude  (e.g. 12.9156)
 *   lng        – longitude (e.g. 77.6917)
 *   startDate  – "MM/DD/YYYY"
 *   endDate    – "MM/DD/YYYY"
 *   timezone   – IANA tz string (e.g. "Asia/Kolkata")  [optional, default Asia/Kolkata]
 *
 * Returns: { "DD.MM.YYYY": { date, sunrise, sunset }, … }
 *
 * API discovered via reverse-engineering Themadmans/AgnihotraTiming2 (GitHub).
 * Full notes: tools/homatherapie-api-notes.md
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    // ── Parse incoming body ──────────────────────────────────────────────────
    const body = req.body || {};
    const lat      = body.lat      || body.lat_deg;
    const lng      = body.lng      || body.lon_deg;
    const startDate= body.startDate|| body.date;
    const endDate  = body.endDate  || body.end_date || startDate;
    const timezone = body.timezone || body.timeZoneId || "Asia/Kolkata";

    if (!lat || !lng || !startDate) {
      res.status(400).json({ error: "lat, lng, startDate are required" });
      return;
    }

    // ── Call homatherapie.de v2 JSON API ─────────────────────────────────────
    const formBody = new URLSearchParams({
      lat_deg:    String(lat),
      lon_deg:    String(lng),
      timeZoneId: timezone,
      date:       startDate,
      end_date:   endDate,
      location:   "",
    });

    const upstream = await fetch(
      "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results/api/v2",
      {
        method:  "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":   "Mozilla/5.0 (compatible; AgnihotraApp/2.0)",
          "Accept":       "application/json",
          "Referer":      "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm.html",
        },
        body: formBody.toString(),
      }
    );

    if (!upstream.ok) {
      throw new Error(`Upstream HTTP ${upstream.status}`);
    }

    const raw = await upstream.text();

    // ── Parse the week-keyed JSON into a flat date map ────────────────────────
    // Raw shape: { "21": { "24.05.2026": { rise, set, weekdayName } }, "22": { … } }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error("Non-JSON response from upstream: " + raw.slice(0, 200)); }

    const result = {};
    for (const week of Object.values(parsed)) {
      for (const [dateStr, entry] of Object.entries(week)) {
        if (entry && entry.rise && entry.set) {
          result[dateStr] = {
            date:    dateStr,
            sunrise: entry.rise,
            sunset:  entry.set,
          };
        }
      }
    }

    if (Object.keys(result).length === 0) {
      throw new Error("Empty result from upstream API");
    }

    res.status(200).json(result);

  } catch (err) {
    console.error("[agnihotra proxy] error:", err.message);
    res.status(500).json({ error: "Upstream fetch failed", details: err.message });
  }
}
