/**
 * HIGH-PRECISION AGNIHOTRA CALCULATOR (ITERATIVE ENGINE)
 * Coordinates: 12.9270° N, 77.6694° E (Bengaluru)
 * Timezone: IST (+5.5)
 */

const rad = Math.PI / 180;
const deg = 180 / Math.PI;

// 1. Core Solar Position Algorithm (Meeus/NOAA SPA)
function calculateAgnihotraTiming(dateUTC, lat, lon, tzHours) {
    function getJulianDay(msUTC) { return msUTC / 86400000 + 2440587.5; }
    const JD = getJulianDay(dateUTC.getTime());
    const T = (JD - 2451545.0) / 36525;

    let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
    L0 = ((L0 % 360) + 360) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = Math.sin(rad * M) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
              Math.sin(rad * 2 * M) * (0.019993 - 0.000101 * T) +
              Math.sin(rad * 3 * M) * 0.000289;
    const trueLon = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(rad * omega);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(rad * omega);
    const delta = Math.asin(Math.sin(rad * eps) * Math.sin(rad * lambda));
    const y = Math.pow(Math.tan(rad * (eps / 2)), 2);
    const EoT = 4 * deg * (y * Math.sin(2 * rad * L0) - 2 * e * Math.sin(rad * M) + 
                4 * e * y * Math.sin(rad * M) * Math.cos(2 * rad * L0) - 
                0.5 * y * y * Math.sin(4 * rad * L0) - 1.25 * e * e * Math.sin(2 * rad * M));
    return { delta, EoT };
}

// 2. Iterative Refinement (Corrects for Sun's movement during the day)
function getAgnihotraTimesIterative(dateUTC, lat, lon, tzHours) {
    function getSunDetails(tUTC) {
        const JD = tUTC / 86400000 + 2440587.5;
        const T = (JD - 2451545.0) / 36525;
        let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
        L0 = ((L0 % 360) + 360) % 360;
        const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
        const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
        const C = Math.sin(rad * M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad * 2 * M) * (0.019993 - 0.000101 * T) + Math.sin(rad * 3 * M) * 0.000289;
        const trueLon = L0 + C;
        const omega = 125.04 - 1934.136 * T;
        const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(rad * omega);
        const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
        const eps = eps0 + 0.00256 * Math.cos(rad * omega);
        const delta = Math.asin(Math.sin(rad * eps) * Math.sin(rad * lambda));
        const y = Math.pow(Math.tan(rad * (eps / 2)), 2);
        const EoT = 4 * deg * (y * Math.sin(2 * rad * L0) - 2 * e * Math.sin(rad * M) + 4 * e * y * Math.sin(rad * M) * Math.cos(2 * rad * L0) - 0.5 * y * y * Math.sin(4 * rad * L0) - 1.25 * e * e * Math.sin(2 * rad * M));
        return { delta, EoT };
    }

    let initial = getSunDetails(dateUTC.getTime());
    let H = Math.acos(-Math.tan(lat * rad) * Math.tan(initial.delta)) * deg;
    let solarNoon = 12 + tzHours - lon / 15 - initial.EoT / 60;
    
    // Refine Sunrise
    let riseUTC = dateUTC.getTime() + (solarNoon - H / 15 - tzHours) * 3600000;
    let riseData = getSunDetails(riseUTC);
    let H_rise = Math.acos(-Math.tan(lat * rad) * Math.tan(riseData.delta)) * deg;
    let sunrise = (12 + tzHours - lon / 15 - riseData.EoT / 60) - H_rise / 15;

    // Refine Sunset
    let setUTC = dateUTC.getTime() + (solarNoon + H / 15 - tzHours) * 3600000;
    let setData = getSunDetails(setUTC);
    let H_set = Math.acos(-Math.tan(lat * rad) * Math.tan(setData.delta)) * deg;
    let sunset = (12 + tzHours - lon / 15 - setData.EoT / 60) + H_set / 15;

    return { sunrise, sunset };
}

// 3. Formatting
function toClock(h) {
    let s = Math.round(h * 3600);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// 4. Execution Loop
const lat = 12.9270;
const lon = 77.6694;
const tz = 5.5;
const startDate = new Date(Date.UTC(2026, 0, 4)); // Jan 4, 2026

console.log("3-MONTH AGNIHOTRA SCHEDULE");
console.log("-----------------------------------------");
console.log("Date       | Sunrise  | Sunset");
console.log("-----------------------------------------");

for (let i = 0; i < 90; i++) {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + i);
    const res = getAgnihotraTimesIterative(current, lat, lon, tz);
    
    const dateStr = current.getUTCDate().toString().padStart(2,'0') + "." + 
                    (current.getUTCMonth()+1).toString().padStart(2,'0') + "." + 
                    current.getUTCFullYear();
                    
    console.log(`${dateStr} | ${toClock(res.sunrise)} | ${toClock(res.sunset)}`);
}

