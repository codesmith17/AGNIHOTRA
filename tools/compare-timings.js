#!/usr/bin/env node
/**
 * compare-timings.js
 *
 * Compares our NOAA engine vs homatherapie.de's live API for any location/date range.
 * Uses our engine as the authoritative source; homatherapie.de is the reference.
 *
 * Usage:
 *   node tools/compare-timings.js [lat] [lon] [tzOffset] [startDDMMYYYY] [days] [timezone]
 *
 * Examples:
 *   node tools/compare-timings.js                                  # Bangalore, 7 days
 *   node tools/compare-timings.js 19.1012 74.7736 5.5 24.05.2026 14 Asia/Kolkata
 *   node tools/compare-timings.js 48.1374 11.5756 2 24.05.2026 7 Europe/Berlin
 *
 * Outputs a table showing our result, their result, and the diff in seconds.
 */

const https = require("https");

// ── NOAA Engine (same as timings-engine.js) ───────────────────────────────────
const J2000 = 2451545.0, JPC = 36525.0;
function jd(y, m, d) {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function jc(j) { return (j - J2000) / JPC; }
function gml(T) { let l = 280.46646 + T * (36000.76983 + 0.0003032 * T); return ((l % 360) + 360) % 360; }
function gma(T) { return 357.52911 + T * (35999.05029 - 0.0001537 * T); }
function ecc(T) { return 0.016708634 - T * (0.000042037 + 0.0000001267 * T); }
function alng(T) {
  const o = 125.04 - 1934.136 * T, M = gma(T), Mr = M * Math.PI / 180;
  return gml(T) + (Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289)
    - 0.00569 - 0.00478 * Math.sin(o * Math.PI / 180);
}
function obc(T) {
  const o = 125.04 - 1934.136 * T, s = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
  return 23 + (26 + s / 60) / 60 + 0.00256 * Math.cos(o * Math.PI / 180);
}
function dec(T) { const e = obc(T), l = alng(T); return Math.asin(Math.sin(e * Math.PI / 180) * Math.sin(l * Math.PI / 180)) * 180 / Math.PI; }
function eot(T) {
  const e = obc(T), L = gml(T), ec = ecc(T), M = gma(T), y = Math.pow(Math.tan(e * Math.PI / 180 / 2), 2);
  return (y * Math.sin(2 * L * Math.PI / 180) - 2 * ec * Math.sin(M * Math.PI / 180)
    + 4 * ec * y * Math.sin(M * Math.PI / 180) * Math.cos(2 * L * Math.PI / 180)
    - 0.5 * y * y * Math.sin(4 * L * Math.PI / 180) - 1.25 * ec * ec * Math.sin(2 * M * Math.PI / 180)) * 180 / Math.PI * 4;
}
function solarNoon(j, nl) {
  let T = jc(j + nl / 360), e = eot(T), n = nl * 4 - e;
  T = jc(j + n / 1440); e = eot(T); return 720 + nl * 4 - e;
}
function sunRiseSetUTC(y, m, d, lat, lon, isSunrise) {
  const j = jd(y, m, d), nl = -lon, nm = solarNoon(j, nl);
  let T = jc(j + nm / 1440), e = eot(T), dc = dec(T), cosH = -Math.tan(lat * Math.PI / 180) * Math.tan(dc * Math.PI / 180);
  if (cosH < -1 || cosH > 1) return null;
  let H = Math.acos(cosH) * 180 / Math.PI; if (!isSunrise) H = -H;
  let u = 720 + 4 * (nl - H) - e;
  T = jc(j + u / 1440); e = eot(T); dc = dec(T); cosH = -Math.tan(lat * Math.PI / 180) * Math.tan(dc * Math.PI / 180);
  if (cosH < -1 || cosH > 1) return null;
  H = Math.acos(cosH) * 180 / Math.PI; if (!isSunrise) H = -H;
  return 720 + 4 * (nl - H) - e;
}
function minsToHMS(utcMins, tzHours) {
  if (utcMins === null) return "--:--:--";
  let s = Math.round((utcMins + tzHours * 60) * 60);
  s = ((s % 86400) + 86400) % 86400;
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(n => String(n).padStart(2, "0")).join(":");
}
function ourTiming(y, m, d, lat, lon, tzHours) {
  return {
    rise: minsToHMS(sunRiseSetUTC(y, m, d, lat, lon, true), tzHours),
    set:  minsToHMS(sunRiseSetUTC(y, m, d, lat, lon, false), tzHours),
  };
}

// ── Homatherapie API ──────────────────────────────────────────────────────────
function fetchHomatherapie(lat, lon, startMM_DD_YYYY, endMM_DD_YYYY, timezone) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      lat_deg: String(lat), lon_deg: String(lon),
      timeZoneId: timezone, date: startMM_DD_YYYY, end_date: endMM_DD_YYYY, location: "",
    }).toString();

    const req = https.request({
      hostname: "www.homatherapie.de",
      path: "/en/Agnihotra_Zeitenprogramm/results/api/v2",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "EternalAgni-ComparisonTool/1.0",
        "Accept": "application/json",
      },
    }, (res) => {
      let raw = "";
      res.on("data", d => raw += d);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(raw);
          const result = {};
          for (const week of Object.values(parsed)) {
            for (const [dateStr, entry] of Object.entries(week)) {
              if (entry?.rise && entry?.set) {
                // dateStr is "DD.MM.YYYY" — keep as-is
                result[dateStr] = { rise: entry.rise, set: entry.set };
              }
            }
          }
          resolve(result);
        } catch (e) {
          reject(new Error("Failed to parse API response: " + raw.slice(0, 200)));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDDMMYYYY(s) {
  const [d, m, y] = s.split(".").map(Number);
  return { y, m, d };
}
function toMMDDYYYY(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split(".");
  return `${m}/${d}/${y}`;
}
function addDays(ddmmyyyy, n) {
  const [d, m, y] = ddmmyyyy.split(".").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${String(dt.getUTCDate()).padStart(2,"0")}.${String(dt.getUTCMonth()+1).padStart(2,"0")}.${dt.getUTCFullYear()}`;
}
function toSec(hms) { const [h,m,s] = hms.split(":").map(Number); return h*3600+m*60+s; }
function diffSec(a, b) {
  const d = toSec(a) - toSec(b);
  return (d >= 0 ? "+" : "") + d;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const lat      = parseFloat(args[0] ?? "12.9156");
  const lon      = parseFloat(args[1] ?? "77.6917");
  const tzHours  = parseFloat(args[2] ?? "5.5");
  const startStr = args[3] ?? (() => {
    const n = new Date();
    return `${String(n.getDate()).padStart(2,"0")}.${String(n.getMonth()+1).padStart(2,"0")}.${n.getFullYear()}`;
  })();
  const days     = parseInt(args[4] ?? "7");
  const timezone = args[5] ?? "Asia/Kolkata";

  const endStr = addDays(startStr, days - 1);
  const startAPI = toMMDDYYYY(startStr);
  const endAPI   = toMMDDYYYY(endStr);

  console.log(`\n${"═".repeat(82)}`);
  console.log(` Eternal Agni — Timing Comparison Tool`);
  console.log(` Location : ${lat}°N, ${lon}°E  |  TZ: ${timezone} (UTC${tzHours >= 0 ? "+" : ""}${tzHours})`);
  console.log(` Range    : ${startStr} → ${endStr}  (${days} days)`);
  console.log(` Source A : Our NOAA engine (timings-engine.js) — PRIMARY`);
  console.log(` Source B : homatherapie.de v2 JSON API — REFERENCE`);
  console.log(`${"═".repeat(82)}\n`);

  console.log("Fetching homatherapie.de API...");
  let homaData;
  try {
    homaData = await fetchHomatherapie(lat, lon, startAPI, endAPI, timezone);
    console.log(`  ✓ Received ${Object.keys(homaData).length} days from API\n`);
  } catch (e) {
    console.error("  ✗ API failed:", e.message);
    console.log("  (showing only our engine output)\n");
    homaData = {};
  }

  // Header
  const H = "Date       | Ours Rise | Homa Rise | dR(s) | Ours Set  | Homa Set  | dS(s)";
  console.log(H);
  console.log("─".repeat(H.length));

  let totalDays = 0, riseMismatches = 0, setMismatches = 0;
  let riseMaxDiff = 0, setMaxDiff = 0;
  const diffs = { rise: [], set: [] };

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(startStr, i);
    const { y, m, d } = parseDDMMYYYY(dateStr);
    const ours = ourTiming(y, m, d, lat, lon, tzHours);
    const homa = homaData[dateStr] || null;

    const riseHoma = homa?.rise ?? "N/A";
    const setHoma  = homa?.set  ?? "N/A";
    const rDiff = homa ? diffSec(ours.rise, homa.rise) : "N/A";
    const sDiff = homa ? diffSec(ours.set,  homa.set)  : "N/A";

    const rMatch = rDiff === "+0" || rDiff === "0";
    const sMatch = sDiff === "+0" || sDiff === "0";

    console.log(
      `${dateStr} | ${ours.rise}  | ${riseHoma}  | ${String(rDiff).padStart(5)} | ${ours.set}  | ${setHoma}  | ${String(sDiff).padStart(5)}` +
      ((!rMatch || !sMatch) && homa ? " ←" : "")
    );

    totalDays++;
    if (homa) {
      const rd = parseInt(rDiff), sd = parseInt(sDiff);
      diffs.rise.push(rd); diffs.set.push(sd);
      if (!rMatch) { riseMismatches++; riseMaxDiff = Math.max(riseMaxDiff, Math.abs(rd)); }
      if (!sMatch) { setMismatches++;  setMaxDiff  = Math.max(setMaxDiff,  Math.abs(sd)); }
    }
  }

  // Summary
  console.log("─".repeat(H.length));
  if (diffs.rise.length > 0) {
    const avg = arr => (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(2);
    console.log(`\nSummary (${diffs.rise.length} days with API data):`);
    console.log(`  Sunrise — matches: ${diffs.rise.length - riseMismatches}/${diffs.rise.length}  max diff: ${riseMaxDiff}s  avg diff: ${avg(diffs.rise)}s`);
    console.log(`  Sunset  — matches: ${diffs.set.length - setMismatches}/${diffs.set.length}  max diff: ${setMaxDiff}s  avg diff: ${avg(diffs.set)}s`);
  }
  console.log(`\nNote: ±1-2s differences are floating-point arithmetic (PHP vs JS). Not algorithmic.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
