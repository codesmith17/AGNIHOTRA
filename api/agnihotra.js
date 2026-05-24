/**
 * /api/agnihotra — Vercel health-check endpoint
 *
 * The app calculates all timings locally via timings-engine.js (NOAA algorithm).
 * No external API is used at runtime.
 *
 * For developer comparison against homatherapie.de, use:
 *   node tools/compare-timings.js [lat] [lon] [tzOffset] [DD.MM.YYYY] [days] [timezone]
 *   (see tools/homa-proxy-reference.js for the raw proxy implementation)
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  res.status(200).json({
    status: "ok",
    engine: "NOAA/Meeus — timings-engine.js",
    note:   "All timings are calculated locally. No external API calls."
  });
}
