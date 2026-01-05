/**
 * HIGH-PRECISION AGNIHOTRA VERIFIER
 * Compares Calculated vs. timings.json Reference
 */

const fs = require('fs');
const rad = Math.PI / 180;
const deg = 180 / Math.PI;

function getAgnihotraTimesIterative(dateUTC, lat, lon, tzHours) {
    /**
     * IMPORTANT NOTE ON AGNIHOTRA TIMINGS:
     * Agnihotra sunrise/sunset is DIFFERENT from the "actual" (visual) sunrise/sunset.
     * 
     * - VISUAL SUNRISE: Top edge visible, includes atmospheric refraction (~ -0.833° altitude).
     * - AGNIHOTRA SUNRISE: Center of disk on mathematical horizon, no refraction (0.0° altitude).
     * 
     * This follows the precise definition used by Homatherapy Germany.
     */
    const degreesToRadians = Math.PI / 180;
    const radiansToDegrees = 180 / Math.PI;

    /**
     * Internal helper to compute sun details for a specific timestamp.
     * Sources: 
     * - Jean Meeus, "Astronomical Algorithms" (2nd Ed.)
     * - NOAA Solar Calculation Details: https://gml.noaa.gov/grad/solcalc/calcdetails.html
     */
    function getSunDetails(timestampUTC) {
        /** 
         * 1. TIME & EPOCH
         * julianDay: A continuous count of days since 4713 BCE. Standardizes time across eras. (Meeus Ch. 7)
         */
        const julianDay = timestampUTC / 86400000 + 2440587.5;
        /** 
         * julianCentury: Number of 100-year blocks since Jan 1, 2000. Tracks secular orbital drift. (Meeus Eq. 25.1)
         */
        const julianCentury = (julianDay - 2451545.0) / 36525;

        /** 
         * 2. ORBITAL POSITION
         * sunGeometricMeanLongitude: The Sun's "average" position if Earth's orbit were a circle. (Meeus Eq. 25.2)
         */
        let sunGeometricMeanLongitude = 280.46646 + julianCentury * (36000.76983 + 0.0003032 * julianCentury);
        sunGeometricMeanLongitude = ((sunGeometricMeanLongitude % 360) + 360) % 360;

        /** 
         * sunMeanAnomaly: Earth's "starting point" in its loop relative to Perihelion (closest point to Sun). (Meeus Eq. 25.3)
         */
        const sunMeanAnomaly = 357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury);

        /** 
         * earthOrbitEccentricity: Measures how "oval" Earth's orbit is (changes slightly every century). (Meeus Eq. 25.4)
         */
        const earthOrbitEccentricity = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

        /** 
         * 3. CORRECTIONS & ACCURACY
         * sunEquationOfCenter: Keplerian correction for Earth's non-uniform speed in its oval orbit. (Meeus Ch. 25)
         */
        const sunEquationOfCenter = Math.sin(degreesToRadians * sunMeanAnomaly) * (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury)) +
                  Math.sin(degreesToRadians * 2 * sunMeanAnomaly) * (0.019993 - 0.000101 * julianCentury) +
                  Math.sin(degreesToRadians * 3 * sunMeanAnomaly) * 0.000289;

        /** 
         * sunTrueLongitude: The exact physical position of the Sun after orbital speed correction.
         */
        const sunTrueLongitude = sunGeometricMeanLongitude + sunEquationOfCenter;

        /** 
         * moonAscendingNodeLongitude: Tracks Moon's position to calculate Nutation (Earth's axis wobble).
         */
        const moonAscendingNodeLongitude = 125.04 - 1934.136 * julianCentury;
        
        /** 
         * sunApparentLongitude: Sun's apparent position from Earth, correcting for wobble and light time.
         */
        const sunApparentLongitude = sunTrueLongitude - 0.00569 - 0.00478 * Math.sin(degreesToRadians * moonAscendingNodeLongitude);

        /** 
         * 4. EARTH'S TILT (SEASONS)
         * meanObliquityOfEcliptic: Average tilt of Earth's axis (~23.44°). (Meeus Eq. 22.2)
         */
        const meanObliquityOfEcliptic = 23 + (26 + (21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813))) / 60) / 60;
        
        /** 
         * correctedObliquityOfEcliptic: Precise axis tilt at this exact moment, including Moon's wobble.
         */
        const eps = meanObliquityOfEcliptic + 0.00256 * Math.cos(degreesToRadians * moonAscendingNodeLongitude);

        /** 
         * sunApparentDeclination: The "height" of the Sun relative to the Equator. Determines day length.
         */
        const sunApparentDeclination = Math.asin(Math.sin(degreesToRadians * eps) * Math.sin(degreesToRadians * sunApparentLongitude));

        /** 
         * 5. TIMING
         * equationOfTime: Fixes the gap between "Sundial Time" and "Clock Time" caused by Earth's variable speed. (Meeus Ch. 28)
         */
        const tangentSquaredObliquity = Math.pow(Math.tan(degreesToRadians * (eps / 2)), 2);
        const equationOfTime = 4 * radiansToDegrees * (tangentSquaredObliquity * Math.sin(2 * degreesToRadians * sunGeometricMeanLongitude) - 
                    2 * earthOrbitEccentricity * Math.sin(degreesToRadians * sunMeanAnomaly) + 
                    4 * earthOrbitEccentricity * tangentSquaredObliquity * Math.sin(degreesToRadians * sunMeanAnomaly) * Math.cos(2 * degreesToRadians * sunGeometricMeanLongitude) - 
                    0.5 * tangentSquaredObliquity * tangentSquaredObliquity * Math.sin(4 * degreesToRadians * sunGeometricMeanLongitude) - 1.25 * earthOrbitEccentricity * earthOrbitEccentricity * Math.sin(2 * degreesToRadians * sunMeanAnomaly));

        return { sunApparentDeclination, equationOfTime };
    }

    /**
     * ITERATIVE REFINEMENT
     * Agnihotra requires exact sunrise/sunset. Since the Sun's position (delta/EoT) 
     * changes between solar noon and the horizon event, we perform a second pass 
     * to recalculate the Sun's state at the estimated event time.
     */
    let initialSunDetails = getSunDetails(dateUTC.getTime());
    // Hour Angle for altitude = 0° (Mathematical Horizon): 
    // cos(H) = (sin(h) - sin(lat)*sin(delta)) / (cos(lat)*cos(delta))
    // For Agnihotra h=0, so sin(h)=0. Simplifies to: -tan(lat)*tan(delta)
    let cosineOfHourAngle = Math.acos(-Math.tan(lat * degreesToRadians) * Math.tan(initialSunDetails.sunApparentDeclination)) * radiansToDegrees;
    let solarNoon = 12 + tzHours - lon / 15 - initialSunDetails.equationOfTime / 60;
    
    // Pass 2: Refine Sunrise
    let riseUTC = dateUTC.getTime() + (solarNoon - cosineOfHourAngle / 15 - tzHours) * 3600000;
    let sunriseDetails = getSunDetails(riseUTC);
    let H_rise = Math.acos(-Math.tan(lat * degreesToRadians) * Math.tan(sunriseDetails.sunApparentDeclination)) * radiansToDegrees;
    let sunrise = (12 + tzHours - lon / 15 - sunriseDetails.equationOfTime / 60) - H_rise / 15;

    // Pass 2: Refine Sunset
    let setUTC = dateUTC.getTime() + (solarNoon + cosineOfHourAngle / 15 - tzHours) * 3600000;
    let sunsetDetails = getSunDetails(setUTC);
    let H_set = Math.acos(-Math.tan(lat * degreesToRadians) * Math.tan(sunsetDetails.sunApparentDeclination)) * radiansToDegrees;
    let sunset = (12 + tzHours - lon / 15 - sunsetDetails.equationOfTime / 60) + H_set / 15;

    return { sunrise, sunset };
}

function hmsToSec(hms) {
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

function formatHMS(h) {
    let s = Math.round(h * 3600);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Load Reference Data
const cache = JSON.parse(fs.readFileSync('timings.json', 'utf8'));
const lat = cache.lat;
const lon = cache.lng;
const tz = 5.5; // Asia/Kolkata

console.log(`VERIFICATION TABLE (3 MONTHS)`);
console.log(`Location: ${lat.toFixed(4)} N, ${lon.toFixed(4)} E`);
console.log(`---------------------------------------------------------------------------------------------`);
console.log(`Date       | Event   | Target (Ref) | Calculated | Diff (sec)`);
console.log(`---------------------------------------------------------------------------------------------`);

const dates = Object.keys(cache.timings).sort((a,b) => {
    const [d1, m1, y1] = a.split('.').map(Number);
    const [d2, m2, y2] = b.split('.').map(Number);
    return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2);
});

dates.forEach(dateStr => {
    const target = cache.timings[dateStr];
    const [d, m, y] = dateStr.split('.').map(Number);
    const dateUTC = new Date(Date.UTC(y, m-1, d));
    const res = getAgnihotraTimesIterative(dateUTC, lat, lon, tz);
    
    const calcRise = formatHMS(res.sunrise);
    const calcSet = formatHMS(res.sunset);
    
    const diffRise = Math.abs(hmsToSec(target.sunrise) - Math.round(res.sunrise * 3600));
    const diffSet = Math.abs(hmsToSec(target.sunset) - Math.round(res.sunset * 3600));

    console.log(`${dateStr} | Sunrise | ${target.sunrise}     | ${calcRise}   | ${diffRise}`);
    console.log(`${dateStr} | Sunset  | ${target.sunset}     | ${calcSet}   | ${diffSet}`);
});
