# Homatherapie.de — API Research Notes

> Discovered May 24, 2026  
> Eternal Agni — internal developer reference

---

## Summary

Homatherapie.de (Deutsche Gesellschaft für Homa-Therapie e.V.) runs a server-side **PHP application on Apache** that computes Agnihotra timings. They expose:

1. **HTML form interface** (for human use)
2. **JSON API v2** (used by third-party Android apps) — **our preferred integration point**

---

## JSON API v2

### Endpoint

```
POST https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results/api/v2
```

### Request

Content-Type: `application/x-www-form-urlencoded`

| Field       | Type   | Example             | Notes                              |
|-------------|--------|---------------------|------------------------------------|
| `lat_deg`   | float  | `12.9156`           | Latitude (positive = North)        |
| `lon_deg`   | float  | `77.6917`           | Longitude (positive = East)        |
| `timeZoneId`| string | `Asia/Kolkata`      | IANA timezone string               |
| `date`      | string | `05/24/2026`        | Start date MM/DD/YYYY              |
| `end_date`  | string | `05/31/2026`        | End date MM/DD/YYYY                |
| `location`  | string | `Bangalore`         | Human label only, not used for calc|

### Response (JSON)

Dates are grouped by ISO calendar week number:

```json
{
  "21": {
    "24.05.2026": { "rise": "05:56:08", "set": "18:36:06", "weekdayName": "Sun" }
  },
  "22": {
    "25.05.2026": { "rise": "05:56:02", "set": "18:36:24", "weekdayName": "Mon" },
    "26.05.2026": { "rise": "05:55:57", "set": "18:36:41", "weekdayName": "Tue" }
  }
}
```

### Example cURL

```bash
curl -X POST \
  "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results/api/v2" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "lat_deg=12.9156&lon_deg=77.6917&timeZoneId=Asia%2FKolkata&date=05%2F24%2F2026&end_date=05%2F24%2F2026"
```

### Limits / Gotchas

- Returns `null` for invalid dates/coordinates (no HTTP error code)
- No authentication needed (public API)
- Rate-limiting unknown — do not hammer; use sparingly for validation only
- The API is not officially documented; found via reverse-engineering their Android app
  (Themadmans/AgnihotraTiming2 on GitHub: `QuerytoAPI.java`)

---

## HTML Form Interface (legacy)

```
POST https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results.html
```

Same params. Returns HTML — parse with regex.  
**Prefer the v2 JSON API instead.**

---

## Algorithm Used by Homatherapie.de

### What we know

- Server: Apache + PHP (PHPSESSID cookie confirms PHP session)
- Frontend JS (`PLUGIN_timecalc.js`) is only UI (Google Maps, form handling)
- **All calculation is server-side PHP** — source not publicly accessible
- No open-source PHP package found that matches exactly

### Agnihotra timing definition (from their website)

> "The middle of the solar disk stands exactly on the horizon."

This is equivalent to:
- **Zenith = 90.0°** (no atmospheric refraction)
- **cos(H₀) = −tan(φ) · tan(δ)** — pure mathematical horizon
- Same formula as NOAA Solar Calculator at zenith=90°

### Precision comparison vs our NOAA engine (91-day Bangalore dataset)

| Event   | Diff range | Mean diff | Notes                          |
|---------|-----------|-----------|--------------------------------|
| Sunrise | −2 to +2  | ~0 sec    | Mostly exact, ±1 in edge cases |
| Sunset  | −1 to +3  | +0.69 sec | Systematic ~1 sec high         |

The difference is **floating-point arithmetic** between PHP and JavaScript implementations
of the **same NOAA/Meeus algorithm**. It cannot be eliminated without their PHP source.

### What they do NOT use

- Atmospheric refraction correction (−0.833° depression)
- Solar disc radius correction
- Elevation correction for horizon dip
- Any correction beyond pure mathematical horizon

---

## Our Engine vs Theirs

| Aspect               | Homatherapie.de        | Our NOAA Engine          |
|----------------------|------------------------|--------------------------|
| Algorithm            | NOAA/Meeus (PHP)       | NOAA/Meeus (JavaScript)  |
| Julian Day formula   | Integer arithmetic     | Integer arithmetic (same)|
| Obliquity coeff      | `46.8150` (assumed)    | `46.8150` (confirmed)    |
| Rounding             | Unknown (PHP)          | `Math.round`             |
| Solar noon step      | Yes (NOAA structure)   | Yes (same)               |
| Refinement passes    | Unknown (1–2 likely)   | 2 passes                 |
| Mean error sunrise   | ±1 sec                 | —                        |
| Mean error sunset    | ~1 sec high            | —                        |

---

## Third-Party Apps Using Their API

- **AgnihotraTiming** (Themadmans, Android, 2017) — uses v2 JSON API
  GitHub: https://github.com/Themadmans/AgnihotraTiming2
- **Agnihotra Buddy** (German Association, Play Store) — likely same backend

---

## Our Policy

1. **Primary source**: Our own NOAA engine (`timings-engine.js`) — works offline, no network dependency
2. **Validation**: `tools/compare-timings.js` — compare our engine vs homatherapie.de API
3. **Proxy**: `api/agnihotra.js` — available for web clients that need exact homatherapie.de values
4. **Acceptable error**: ±1–2 seconds — well within Agnihotra tradition's practical precision

---

## Related Files

| File                          | Purpose                                      |
|-------------------------------|----------------------------------------------|
| `timings-engine.js`           | Primary NOAA engine (offline, always used)   |
| `api/agnihotra.js`            | Vercel proxy → homatherapie.de v2 JSON API   |
| `tools/compare-timings.js`    | Validation script: our engine vs their API   |
| `tools/homatherapie-api-notes.md` | This file                               |
