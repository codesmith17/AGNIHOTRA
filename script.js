// --- Astronomical Constants (Meeus/NOAA SPA) ---
const ASTRONOMICAL_CONSTANTS = {
  JULIAN_DAY_AT_UNIX_EPOCH: 2440587.5,
  JULIAN_DAY_AT_J2000: 2451545.0,
  DAYS_PER_JULIAN_CENTURY: 36525,
  MILLISECONDS_PER_DAY: 86400000,
  MILLISECONDS_PER_HOUR: 3600000,

  // Geometric Mean Longitude Constants
  SUN_MEAN_LONGITUDE_J2000: 280.46646,
  SUN_MEAN_LONGITUDE_COEFF_1: 36000.76983,
  SUN_MEAN_LONGITUDE_COEFF_2: 0.0003032,

  // Mean Anomaly Constants
  SUN_MEAN_ANOMALY_J2000: 357.52911,
  SUN_MEAN_ANOMALY_COEFF_1: 35999.05029,
  SUN_MEAN_ANOMALY_COEFF_2: 0.0001537,

  // Orbit Eccentricity Constants
  EARTH_ORBIT_ECCENTRICITY_J2000: 0.016708634,
  EARTH_ORBIT_ECCENTRICITY_COEFF_1: 0.000042037,
  EARTH_ORBIT_ECCENTRICITY_COEFF_2: 0.0000001267,

  // Equation of Center Constants
  SUN_EQ_CENTER_COEFF_1: 1.914602,
  SUN_EQ_CENTER_COEFF_2: 0.004817,
  SUN_EQ_CENTER_COEFF_3: 0.000014,
  SUN_EQ_CENTER_COEFF_4: 0.019993,
  SUN_EQ_CENTER_COEFF_5: 0.000101,
  SUN_EQ_CENTER_COEFF_6: 0.000289,

  // Moon/Nutation Constants
  MOON_ASCENDING_NODE_J2000: 125.04,
  MOON_ASCENDING_NODE_COEFF_1: 1934.136,
  SUN_APPARENT_LONGITUDE_CONST_1: 0.00569,
  SUN_APPARENT_LONGITUDE_CONST_2: 0.00478,

  // Obliquity Constants
  MEAN_OBLIQUITY_J2000_BASE: 23,
  MEAN_OBLIQUITY_J2000_MIN: 26,
  MEAN_OBLIQUITY_COEFF_1: 21.448,
  MEAN_OBLIQUITY_COEFF_2: 46.815,
  MEAN_OBLIQUITY_COEFF_3: 0.00059,
  MEAN_OBLIQUITY_COEFF_4: 0.001813,
  NUTATION_OBLIQUITY_COEFF: 0.00256,
};

// --- Astronomical Calculation (Homatherapy Germany Style) ---
/**
 * IMPORTANT NOTE ON AGNIHOTRA TIMINGS:
 * Agnihotra sunrise/sunset is DIFFERENT from the "actual" (visual) sunrise/sunset seen in news or weather apps.
 *
 * 1. VISUAL SUNRISE: Occurs when the top edge (upper limb) of the sun appears on the horizon.
 *    Calculated at altitude -0.833° to account for atmospheric refraction and the sun's radius.
 *
 * 2. AGNIHOTRA SUNRISE: Occurs when the CENTER of the sun's disk is exactly on the mathematical horizon.
 *    Calculated at altitude 0.0° with NO atmospheric refraction.
 *
 * This is why Agnihotra timings may differ by 2-4 minutes from standard weather reports.
 * High-precision Agnihotra timing calculation based on Meeus/NOAA SPA.
 */
function calculateAgnihotraTiming(dateUTC, lat, lon, tzHours) {
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
    const julianDay =
      timestampUTC / ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_DAY +
      ASTRONOMICAL_CONSTANTS.JULIAN_DAY_AT_UNIX_EPOCH;
    /**
     * julianCentury: Number of 100-year blocks since Jan 1, 2000. Tracks secular orbital drift. (Meeus Eq. 25.1)
     */
    const julianCentury =
      (julianDay - ASTRONOMICAL_CONSTANTS.JULIAN_DAY_AT_J2000) /
      ASTRONOMICAL_CONSTANTS.DAYS_PER_JULIAN_CENTURY;

    /**
     * 2. ORBITAL POSITION
     * sunGeometricMeanLongitude: The Sun's "average" position if Earth's orbit were a circle. (Meeus Eq. 25.2)
     */
    let sunGeometricMeanLongitude =
      ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_J2000 +
      julianCentury *
        (ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_COEFF_1 +
          ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_COEFF_2 * julianCentury);
    sunGeometricMeanLongitude = ((sunGeometricMeanLongitude % 360) + 360) % 360;

    /**
     * sunMeanAnomaly: Earth's "starting point" in its loop relative to Perihelion (closest point to Sun). (Meeus Eq. 25.3)
     */
    const sunMeanAnomaly =
      ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_J2000 +
      julianCentury *
        (ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_COEFF_1 -
          ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_COEFF_2 * julianCentury);

    /**
     * earthOrbitEccentricity: Measures how "oval" Earth's orbit is (changes slightly every century). (Meeus Eq. 25.4)
     */
    const earthOrbitEccentricity =
      ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_J2000 -
      julianCentury *
        (ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_COEFF_1 +
          ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_COEFF_2 *
            julianCentury);

    /**
     * 3. CORRECTIONS & ACCURACY
     * sunEquationOfCenter: Keplerian correction for Earth's non-uniform speed in its oval orbit. (Meeus Ch. 25)
     */
    const sunEquationOfCenter =
      Math.sin(degreesToRadians * sunMeanAnomaly) *
        (ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_1 -
          julianCentury *
            (ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_2 +
              ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_3 * julianCentury)) +
      Math.sin(degreesToRadians * 2 * sunMeanAnomaly) *
        (ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_4 -
          ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_5 * julianCentury) +
      Math.sin(degreesToRadians * 3 * sunMeanAnomaly) *
        ASTRONOMICAL_CONSTANTS.SUN_EQ_CENTER_COEFF_6;

    /**
     * sunTrueLongitude: The exact physical position of the Sun after orbital speed correction.
     */
    const sunTrueLongitude = sunGeometricMeanLongitude + sunEquationOfCenter;

    /**
     * moonAscendingNodeLongitude: Tracks Moon's position to calculate Nutation (Earth's axis wobble).
     */
    const moonAscendingNodeLongitude =
      ASTRONOMICAL_CONSTANTS.MOON_ASCENDING_NODE_J2000 -
      ASTRONOMICAL_CONSTANTS.MOON_ASCENDING_NODE_COEFF_1 * julianCentury;

    /**
     * sunApparentLongitude: Sun's apparent position from Earth, correcting for wobble and light time.
     */
    const sunApparentLongitude =
      sunTrueLongitude -
      ASTRONOMICAL_CONSTANTS.SUN_APPARENT_LONGITUDE_CONST_1 -
      ASTRONOMICAL_CONSTANTS.SUN_APPARENT_LONGITUDE_CONST_2 *
        Math.sin(degreesToRadians * moonAscendingNodeLongitude);

    /**
     * 4. EARTH'S TILT (SEASONS)
     * meanObliquityOfEcliptic: Average tilt of Earth's axis (~23.44°). (Meeus Eq. 22.2)
     */
    const meanObliquityOfEcliptic =
      ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_J2000_BASE +
      (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_J2000_MIN +
        (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_1 -
          julianCentury *
            (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_2 +
              julianCentury *
                (ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_3 -
                  julianCentury * ASTRONOMICAL_CONSTANTS.MEAN_OBLIQUITY_COEFF_4))) /
          60) /
        60;

    /**
     * correctedObliquityOfEcliptic: Precise axis tilt at this exact moment, including Moon's wobble.
     */
    const correctedObliquityOfEcliptic =
      meanObliquityOfEcliptic +
      ASTRONOMICAL_CONSTANTS.NUTATION_OBLIQUITY_COEFF *
        Math.cos(degreesToRadians * moonAscendingNodeLongitude);

    /**
     * sunApparentDeclination: The "height" of the Sun relative to the Equator. Determines day length.
     */
    const sunApparentDeclination = Math.asin(
      Math.sin(degreesToRadians * correctedObliquityOfEcliptic) *
        Math.sin(degreesToRadians * sunApparentLongitude)
    );

    /**
     * 5. TIMING
     * equationOfTime: Fixes the gap between "Sundial Time" and "Clock Time" caused by Earth's variable speed. (Meeus Ch. 28)
     */
    const tangentSquaredObliquity = Math.pow(
      Math.tan(degreesToRadians * (correctedObliquityOfEcliptic / 2)),
      2
    );
    const equationOfTime =
      4 *
      radiansToDegrees *
      (tangentSquaredObliquity *
        Math.sin(2 * degreesToRadians * sunGeometricMeanLongitude) -
        2 * earthOrbitEccentricity * Math.sin(degreesToRadians * sunMeanAnomaly) +
        4 *
          earthOrbitEccentricity *
          tangentSquaredObliquity *
          Math.sin(degreesToRadians * sunMeanAnomaly) *
          Math.cos(2 * degreesToRadians * sunGeometricMeanLongitude) -
        0.5 *
          tangentSquaredObliquity *
          tangentSquaredObliquity *
          Math.sin(4 * degreesToRadians * sunGeometricMeanLongitude) -
        1.25 *
          earthOrbitEccentricity *
          earthOrbitEccentricity *
          Math.sin(2 * degreesToRadians * sunMeanAnomaly));

    return { sunApparentDeclination, equationOfTime };
  }

  /**
   * ITERATIVE REFINEMENT
   * Agnihotra requires exact sunrise/sunset. Since the Sun's position changes
   * between solar noon and the horizon event, we perform a second pass
   * to recalculate the Sun's state at the estimated event time.
   */
  let initialSunDetails = getSunDetails(dateUTC.getTime());

  // Hour Angle for altitude = 0° (Mathematical Horizon):
  // cos(H) = (sin(h) - sin(lat)*sin(delta)) / (cos(lat)*cos(delta))
  // For Agnihotra h=0, so sin(h)=0. Simplifies to: -tan(lat)*tan(delta)
  const cosineOfHourAngle =
    -Math.tan(lat * degreesToRadians) *
    Math.tan(initialSunDetails.sunApparentDeclination);

  // Handle polar day/night
  if (cosineOfHourAngle < -1 || cosineOfHourAngle > 1) return null;

  const hourAngle = Math.acos(cosineOfHourAngle) * radiansToDegrees;
  const solarNoonAtNoonDetails =
    12 + tzHours - lon / 15 - initialSunDetails.equationOfTime / 60;

  // Pass 2: Refine Sunrise
  const approximateSunriseUTC =
    dateUTC.getTime() +
    (solarNoonAtNoonDetails - hourAngle / 15 - tzHours) *
      ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_HOUR;
  const sunriseDetails = getSunDetails(approximateSunriseUTC);
  const refinedHourAngleSunrise =
    Math.acos(
      -Math.tan(lat * degreesToRadians) *
        Math.tan(sunriseDetails.sunApparentDeclination)
    ) * radiansToDegrees;
  const refinedSunrise =
    12 +
    tzHours -
    lon / 15 -
    sunriseDetails.equationOfTime / 60 -
    refinedHourAngleSunrise / 15;

  // Pass 2: Refine Sunset
  const approximateSunsetUTC =
    dateUTC.getTime() +
    (solarNoonAtNoonDetails + hourAngle / 15 - tzHours) *
      ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_HOUR;
  const sunsetDetails = getSunDetails(approximateSunsetUTC);
  const refinedHourAngleSunset =
    Math.acos(
      -Math.tan(lat * degreesToRadians) *
        Math.tan(sunsetDetails.sunApparentDeclination)
    ) * radiansToDegrees;
  const refinedSunset =
    12 +
    tzHours -
    lon / 15 -
    sunsetDetails.equationOfTime / 60 +
    refinedHourAngleSunset / 15;

  return { sunrise: refinedSunrise, sunset: refinedSunset };
}

// Convert decimal hours to HH:MM:SS with exact rounding
function formatHoursToHMS(h) {
  if (h === null) return "--:--:--";
  let sec = Math.round(h * 3600);
  sec = (sec + 86400) % 86400;
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(
    2,
    "0"
  )}:${String(ss).padStart(2, "0")}`;
}

// Function to generate local 6-month timings
function generateLocal6MonthTimings(lat, lng) {
  const timingsMap = {};
  const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
  const startDate = new Date();

  for (let i = 0; i < 183; i++) {
    // Approx 6 months
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);

    // Use UTC date for consistent astronomical calculation
    const dateUTC = new Date(
      Date.UTC(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate()
      )
    );
    const timings = calculateAgnihotraTiming(dateUTC, lat, lng, tzOffsetHours);

    if (timings) {
      const dateStr = formatDateToDDMMYYYY(currentDate);
      timingsMap[dateStr] = {
        date: dateStr,
        sunrise: formatHoursToHMS(timings.sunrise),
        sunset: formatHoursToHMS(timings.sunset),
      };
    }
  }
  return timingsMap;
}

// Function to format date to DD.MM.YYYY format
function formatDateToDDMMYYYY(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

const CACHE_KEY = "agnihotra_timings_cache";
const CACHE_EXPIRY_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months in milliseconds

// Function to check and get valid cached data
function getValidCachedData(lat, lng) {
  const cachedJSON = localStorage.getItem(CACHE_KEY);
  if (!cachedJSON) return null;

  try {
    const cache = JSON.parse(cachedJSON);
    const now = Date.now();

    // 1. Check if older than 6 months
    if (now - cache.lastUpdated > CACHE_EXPIRY_MS) {
      return null;
    }

    // 2. Check if location changed significantly (more than 0.05 degree, roughly 5.5 km / 3.4 miles)
    // If the user moves more than ~5 km, the cache is invalidated and timings are refetched/recalculated
    const latDiff = Math.abs(cache.lat - lat);
    const lngDiff = Math.abs(cache.lng - lng);
    if (latDiff > 0.05 || lngDiff > 0.05) {
      return null;
    }

    // 3. Check if we have data for today
    const todayStr = formatDateToDDMMYYYY(new Date());
    if (!cache.timings || !cache.timings[todayStr]) {
      return null;
    }

    return cache;
  } catch (e) {
    console.error("Error reading cache:", e);
    return null;
  }
}

// Function to save timings to cache
function saveTimingsToCache(timings, lat, lng) {
  const cacheData = {
    lastUpdated: Date.now(),
    lat: lat,
    lng: lng,
    timings: timings,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
}

// Function to get sunrise and sunset - prioritize local precise calculation
async function getSunriseSunset(lat, lng) {
  if (!lat || !lng) {
    console.error("No coordinates provided to getSunriseSunset");
    return;
  }

  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayFormatted = formatDateToDDMMYYYY(today);
    const tomorrowFormatted = formatDateToDDMMYYYY(tomorrow);

    // 1. Check cache first
    const cache = getValidCachedData(lat, lng);
    if (cache && cache.timings[todayFormatted]) {
      const todayData = cache.timings[todayFormatted];
      const tomorrowData = cache.timings[tomorrowFormatted];

      if (todayData) displaySunriseSunset(todayData, "todayTimes");
      if (tomorrowData) displaySunriseSunset(tomorrowData, "tomorrowTimes");

      if (todayData && tomorrowData) {
        displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
        displayFullSchedule(cache.timings);
        return;
      }
    }

    // 2. Primary Method: Local High-Precision Astronomical Calculation
    // This reproduces Homatherapy Germany timings locally
    let allTimings = generateLocal6MonthTimings(lat, lng);

    // 3. Fallback Method: Scrape from homatherapie.de if local calculation isn't enough or as a secondary check
    if (!allTimings || Object.keys(allTimings).length === 0) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 6);
      const endDateFormatted = formatDateToDDMMYYYY(endDate);
      allTimings = await fetchSunriseSunsetData(
        todayFormatted,
        lat,
        lng,
        endDateFormatted
      );
    }

    if (allTimings && Object.keys(allTimings).length > 0) {
      // Save to cache
      saveTimingsToCache(allTimings, lat, lng);

      const todayData = allTimings[todayFormatted];
      const tomorrowData = allTimings[tomorrowFormatted];

      if (todayData) displaySunriseSunset(todayData, "todayTimes");
      if (tomorrowData) displaySunriseSunset(tomorrowData, "tomorrowTimes");

      if (todayData && tomorrowData) {
        displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
      } else {
        // Second Fallback: sunrisesunset.io
        await getSunriseSunsetFromSunAPI(lat, lng, todayData, tomorrowData);
      }

      // Display the full schedule table
      displayFullSchedule(allTimings);
    } else {
      throw new Error("All primary timing methods failed");
    }
  } catch (error) {
    console.error("Timing calculation/fetch failed:", error);
    await getSunriseSunsetFromSunAPI(lat, lng);
  }
}

// Function to fetch data from homatherapie.de for a date range
async function fetchSunriseSunsetData(date, lat, lng, endDate = null) {
  try {
    const year = date.split(".")[2];
    const actualEndDate = endDate || date;
    const url =
      "https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results.html";

    // Get location name first
    let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Fallback to coordinates

    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );

      if (response.ok) {
        const data = await response.json();
        locationName = `${data.city || data.locality || "Unknown"}, ${
          data.principalSubdivision || data.countryName || "Unknown"
        }`;
      }
    } catch (geoError) {
      // Silently fail geo-naming
    }

    // Create form data
    const formData = new URLSearchParams();
    formData.append("yearDate", year);
    formData.append("location", locationName);
    formData.append("lat_deg", lat.toString());
    formData.append("lon_deg", lng.toString());
    formData.append("date", date);
    formData.append("end_date", actualEndDate);

    // Try deployed proxies first, then local proxy
    const proxyEndpoints = [
      "https://agnihotra-eternal-agni.vercel.app/api/agnihotra", // Deployed Vercel endpoint
      "http://localhost:8080/api/agnihotra", // Local development endpoint
    ];

    let response = null;
    let proxyUsed = null;

    for (const endpoint of proxyEndpoints) {
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (response.ok) {
          proxyUsed = endpoint;
          break;
        }
      } catch (proxyError) {
        continue;
      }
    }

    if (response && response.ok) {
      const htmlText = await response.text();

      const timingsMap = {};
      const lines = htmlText.split("\n");

      // Regex to find dates like DD.MM.YYYY
      const dateRegex = /(\d{2}\.\d{2}\.\d{4})/;
      // Regex to find times like HH:MM:SS
      const timeRegex = /\b(\d{1,2}):(\d{2}):(\d{2})\b/g;

      lines.forEach((line) => {
        const dateMatch = line.match(dateRegex);
        if (
          dateMatch &&
          line.includes("<td") &&
          line.includes('align="right"')
        ) {
          const dateFound = dateMatch[1];
          const times = [];
          let match;

          // Reset regex state for each line
          timeRegex.lastIndex = 0;
          while ((match = timeRegex.exec(line)) !== null) {
            const hour = match[1].padStart(2, "0");
            const minute = match[2];
            const second = match[3];
            times.push(`${hour}:${minute}:${second}`);
          }

          if (times.length >= 2) {
            timingsMap[dateFound] = {
              date: dateFound,
              sunrise: times[0],
              sunset: times[1],
            };
          }
        }
      });

      const count = Object.keys(timingsMap).length;
      if (count === 0) {
        return null;
      }

      return timingsMap;
    } else {
      // Since we can't reliably access homatherapie.de from browser,
      // we'll return null to trigger fallback to sunrisesunset.io
      throw new Error(
        "All proxy endpoints failed. Browser CORS policy prevents direct access to homatherapie.de API."
      );
    }
  } catch (error) {
    console.error(`Error fetching data for ${date}:`, error);
    return null;
  }
}

// Alternative function using sunrisesunset.io API (provides seconds precision)
async function getSunriseSunsetFromSunAPI(
  lat,
  lng,
  existingTodayData = null,
  existingTomorrowData = null
) {
  try {
    let todayData = existingTodayData;
    let tomorrowData = existingTomorrowData;

    // Only fetch missing data
    const fetchPromises = [];
    if (!todayData) {
      const apiUrlToday = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=today`;
      fetchPromises.push(fetch(apiUrlToday).then((r) => r.json()));
    } else {
      fetchPromises.push(Promise.resolve(null));
    }

    if (!tomorrowData) {
      const apiUrlTomorrow = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date=tomorrow`;
      fetchPromises.push(fetch(apiUrlTomorrow).then((r) => r.json()));
    } else {
      fetchPromises.push(Promise.resolve(null));
    }

    const [todayResponse, tomorrowResponse] = await Promise.all(fetchPromises);

    // Use existing data or convert from API response
    if (!todayData && todayResponse) {
      const todayResults = todayResponse.results;
      todayData = {
        date: todayResults.date,
        sunrise: todayResults.sunrise,
        sunset: todayResults.sunset,
      };
    }

    if (!tomorrowData && tomorrowResponse) {
      const tomorrowResults = tomorrowResponse.results;
      tomorrowData = {
        date: tomorrowResults.date,
        sunrise: tomorrowResults.sunrise,
        sunset: tomorrowResults.sunset,
      };
    }

    displaySunriseSunset(todayData, "todayTimes");
    displaySunriseSunset(tomorrowData, "tomorrowTimes");
    displayUpcomingTimings(todayData, tomorrowData, "upcomingTimes");
  } catch (error) {
    console.error("Error with sunrisesunset.io API:", error);
    const loadingSpinner = document.querySelector(".loading-spinner");
    if (loadingSpinner) {
      loadingSpinner.style.display = "none";
    }
  }
}

function displaySunriseSunset(results, elementId) {
  const element = document.getElementById(elementId);
  element.innerHTML = ""; // Clear previous

  // Add Date Header once
  const dateHeader = document.createElement("div");
  dateHeader.className = "card-date-header";
  dateHeader.innerText = results.date;
  element.appendChild(dateHeader);

  const sunriseDiv = document.createElement("div");
  sunriseDiv.className = "time-item";
  sunriseDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-sun" style="color: #FFD700;"></i> SUNRISE</span>
        <span class="time-value">${formatTimeToAMPM(results.sunrise)}</span>
    `;

  const sunsetDiv = document.createElement("div");
  sunsetDiv.className = "time-item";
  sunsetDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-moon" style="color: #4B0082;"></i> SUNSET</span>
        <span class="time-value">${formatTimeToAMPM(results.sunset)}</span>
    `;

  element.appendChild(sunriseDiv);
  element.appendChild(sunsetDiv);
}

function formatTimeToAMPM(timeStr) {
  if (!timeStr) return "--:--:--";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;

  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")} ${ampm}`;
}

function displayFullSchedule(timings) {
  const tableBody = document.getElementById("timingsTableBody");
  if (!tableBody) return;

  // Show the schedule section
  const scheduleSection =
    tableBody.closest(".schedule-section") ||
    tableBody.closest(".schedule-container");
  if (scheduleSection) {
    scheduleSection.style.display = "block";
  }

  // Clear existing rows
  tableBody.innerHTML = "";

  // Get today's date at midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter out past dates and sort remaining dates chronologically
  const sortedDates = Object.keys(timings)
    .filter((dateStr) => {
      const [day, month, year] = dateStr.split(".").map(Number);
      const rowDate = new Date(year, month - 1, day);
      return rowDate >= today;
    })
    .sort((a, b) => {
      const [dayA, monthA, yearA] = a.split(".").map(Number);
      const [dayB, monthB, yearB] = b.split(".").map(Number);
      return (
        new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB)
      );
    });

  // Add rows for each date
  sortedDates.forEach((dateStr) => {
    const data = timings[dateStr];
    const row = document.createElement("tr");

    // Highlight today's row
    const todayStr = formatDateToDDMMYYYY(new Date());
    if (dateStr === todayStr) {
      row.style.backgroundColor = "rgba(255, 165, 0, 0.2)";
      row.style.fontWeight = "bold";
    }

    row.innerHTML = `
            <td>${dateStr}</td>
            <td>${data.sunrise}</td>
            <td>${data.sunset}</td>
        `;
    tableBody.appendChild(row);
  });
}

function displayUpcomingTimings(todayResults, tomorrowResults, elementId) {
  const element = document.getElementById(elementId);
  const currentTime = Date.now();

  // Parse the date format DD.MM.YYYY and time format HH:MM:SS
  const todaySunriseTime = parseDateTime(
    todayResults.date,
    todayResults.sunrise
  );
  const todaySunsetTime = parseDateTime(todayResults.date, todayResults.sunset);
  const tomorrowSunriseTime = parseDateTime(
    tomorrowResults.date,
    tomorrowResults.sunrise
  );
  const tomorrowSunsetTime = parseDateTime(
    tomorrowResults.date,
    tomorrowResults.sunset
  );

  // Clear previous content and countdowns
  element.innerHTML = "";
  window.activeCountdowns = {}; // Clear all active countdowns

  // Find the next upcoming event(s) based on current time
  const upcomingEvents = [];

  // Check what's coming next - always show the next 2 upcoming events
  if (currentTime < todaySunriseTime) {
    // Before today's sunrise - show today's sunrise and sunset
    upcomingEvents.push(["Today's Sunrise", todaySunriseTime]);
    upcomingEvents.push(["Today's Sunset", todaySunsetTime]);
  } else if (currentTime < todaySunsetTime) {
    // After today's sunrise but before today's sunset - show today's sunset and tomorrow's sunrise
    upcomingEvents.push(["Today's Sunset", todaySunsetTime]);
    upcomingEvents.push(["Tomorrow's Sunrise", tomorrowSunriseTime]);
  } else {
    // After today's sunset - show tomorrow's sunrise and sunset
    upcomingEvents.push(["Tomorrow's Sunrise", tomorrowSunriseTime]);
    upcomingEvents.push(["Tomorrow's Sunset", tomorrowSunsetTime]);
  }

  // Display the upcoming events
  upcomingEvents.forEach(([eventName, eventTime]) => {
    displayCountdownAndTime(element, eventName, eventTime);
  });
}

// Helper function to parse date and time into timestamp
function parseDateTime(dateStr, timeStr) {
  // Handle both DD.MM.YYYY and YYYY-MM-DD formats
  let day, month, year;

  if (dateStr.includes(".")) {
    // DD.MM.YYYY format from homatherapie.de
    [day, month, year] = dateStr.split(".").map(Number);
  } else if (dateStr.includes("-")) {
    // YYYY-MM-DD format from sunrisesunset.io API
    [year, month, day] = dateStr.split("-").map(Number);
  } else {
    console.error("Unknown date format:", dateStr);
    return Date.now(); // Return current time if parsing fails
  }

  // Parse time string - handle both "HH:MM:SS" and "H:MM:SS AM/PM" formats
  let hours,
    minutes,
    seconds = 0;

  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    // Handle AM/PM format like "6:04:27 AM"
    const isPM = timeStr.includes("PM");
    const timePart = timeStr.replace(/\s*(AM|PM)/i, "");

    const timeParts = timePart.split(":");
    hours = parseInt(timeParts[0]);
    minutes = parseInt(timeParts[1]);
    seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;

    // Convert to 24-hour format
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }
  } else {
    // Handle 24-hour format like "06:04:27"
    const timeParts = timeStr.split(":");
    hours = parseInt(timeParts[0]);
    minutes = parseInt(timeParts[1]);
    seconds = timeParts[2] ? parseInt(timeParts[2]) : 0;
  }

  // Validate parsed values
  if (
    isNaN(day) ||
    isNaN(month) ||
    isNaN(year) ||
    isNaN(hours) ||
    isNaN(minutes) ||
    isNaN(seconds)
  ) {
    console.error("Failed to parse date/time:", {
      dateStr,
      timeStr,
      day,
      month,
      year,
      hours,
      minutes,
      seconds,
    });
    return Date.now(); // Return current time if parsing fails
  }

  // Create date object (month is 0-indexed in JavaScript)
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  return date.getTime();
}

// Global object to store countdown data
window.activeCountdowns = window.activeCountdowns || {};
window.playedAlerts = window.playedAlerts || new Set();

// Persistent AudioContext to be initialized on user gesture
let audioCtx = null;
let bellSound = null;

// Function to initialize or resume AudioContext on user gesture
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window['webkitAudioContext'];
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // Pre-load the bell sound MP3
  if (!bellSound) {
    bellSound = new Audio('bell-tone.mp3');
    bellSound.load();
  }
}

// Unlock audio on common user interactions
["click", "touchstart", "mousedown", "keydown"].forEach((event) => {
  window.addEventListener(event, initAudio, { once: true });
});

/**
 * DEBUG / TESTING FUNCTION
 * Run window.testBell() in the browser console to set a test countdown
 * that will trigger the bell tone in 5 seconds.
 */
window.testBell = function() {
  console.log("Setting up test countdown for 5 seconds from now...");
  initAudio(); // Ensure audio is initialized
  
  const testTime = Date.now() + 5000; // 5 seconds from now
  const upcomingElement = document.getElementById("upcomingTimes");
  
  if (upcomingElement) {
    // Add a test item to the UI
    const itemDiv = document.createElement("div");
    itemDiv.className = "time-item test-item";
    itemDiv.style.border = "2px dashed #FF4500";
    itemDiv.style.padding = "10px";
    itemDiv.style.margin = "10px 0";
    
    itemDiv.innerHTML = `
        <span class="time-label"><i class="fas fa-flask" style="color: #FF4500;"></i> TEST EVENT</span>
        <span id="testCountdown" class="countdown-value">--h --m --s</span>
        <span class="time-secondary">Triggering soon...</span>
    `;
    
    upcomingElement.prepend(itemDiv);
    
    // Track this test event
    window.activeCountdowns["test"] = testTime;
    console.log("Test countdown started. Please keep this tab visible!");
  } else {
    console.error("Could not find #upcomingTimes element. Make sure location is detected first.");
  }
};

// Function to play a bell tone using the MP3 file
function playBellTone() {
  // Only play if the user is active on the page (tab is visible)
  if (document.visibilityState !== "visible") return;

  try {
    if (!bellSound) {
      bellSound = new Audio('bell-tone.mp3');
    }
    
    // Play the sound exactly 4 times
    let playCount = 0;
    const maxPlays = 4;
    
    bellSound.loop = false; // Disable native looping to control count
    
    const playNext = () => {
      if (playCount < maxPlays) {
        bellSound.currentTime = 0;
        const playPromise = bellSound.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            playCount++;
          }).catch(error => {
            console.warn("Audio playback failed:", error);
          });
        }
      } else {
        // Finished playing 4 times, remove the listener
        bellSound.removeEventListener('ended', playNext);
      }
    };

    // Clean up any old listeners before adding a new one
    bellSound.removeEventListener('ended', playNext);
    bellSound.addEventListener('ended', playNext);

    // Start the first play
    playNext();

    // Also resume context just in case other audio features use it
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

function displayCountdownAndTime(element, type, time) {
  const itemDiv = document.createElement("div");
  itemDiv.className = "time-item";

  // Create a unique ID by removing spaces and special characters
  const uniqueId = type.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isSunrise = type.toLowerCase().includes("sunrise");
  const iconClass = isSunrise ? "fas fa-sun" : "fas fa-moon";
  const iconColor = isSunrise ? "#FFD700" : "#4B0082";

  itemDiv.innerHTML = `
        <span class="time-label"><i class="${iconClass}" style="color: ${iconColor};"></i> ${type.toUpperCase()}</span>
        <span id="${uniqueId}Countdown" class="countdown-value">--h --m --s</span>
        <span class="time-secondary">at ${formatDateTimeToTimeOnly(time)}</span>
    `;

  element.appendChild(itemDiv);

  // Store countdown data globally
  window.activeCountdowns[uniqueId] = time;

  // Start the countdown immediately
  updateCountdown(uniqueId, time);
}

function formatDateTimeToTimeOnly(time) {
  const date = new Date(time);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${String(h).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}

// Global countdown updater - runs every second
if (!window.countdownInterval) {
  window.countdownInterval = setInterval(() => {
    for (const [countdownId, targetTime] of Object.entries(
      window.activeCountdowns
    )) {
      updateCountdown(countdownId, targetTime);
    }
  }, 1000);
}

function updateCountdown(type, targetTime) {
  const currentTime = Date.now();
  const timeDiff = targetTime - currentTime;

  const countdownElement = document.getElementById(`${type}Countdown`);

  if (!countdownElement) {
    return; // Element doesn't exist, skip update
  }

  if (timeDiff > 0) {
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    let countdownText = "";
    if (days > 0) {
      countdownText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else {
      countdownText = `${hours}h ${minutes}m ${seconds}s`;
    }

    countdownElement.innerText = countdownText;
  } else {
    // If time just passed and we haven't played the alert yet
    const alertKey = `${type}_${targetTime}`;
    if (!window.playedAlerts.has(alertKey)) {
      // Only play if it passed recently (within last 10 seconds)
      // and not if it's an old event from a previous page load
      if (timeDiff > -10000) {
        playBellTone();
      }
      window.playedAlerts.add(alertKey);
    }

    countdownElement.innerText = "Time passed";
  }
}

function formatDateTime(time) {
  const date = new Date(time);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedDate = `${date.toDateString()} ${
    hours % 12 || 12
  }:${minutes}:${seconds} ${ampm}`;
  return formattedDate;
}

async function getLocation() {
  const loadingSpinner = document.querySelector(".loading-spinner");
  if (loadingSpinner) {
    loadingSpinner.style.display = "block";
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        document.getElementById(
          "userLocation"
        ).innerText = `Your Location: Latitude ${latitude}, Longitude ${longitude}`;
        await reverseGeocode(latitude, longitude);
      },
      async (error) => {
        await showError(error);
      }
    );
  } else {
    document.getElementById("userLocation").innerText =
      "Geolocation not supported. Getting approximate location...";
    // Try to get approximate location using IP-based geolocation
    await getApproximateLocation();
  }
}

async function reverseGeocode(latitude, longitude) {
  try {
    // Use Nominatim (OpenStreetMap) for more precise address details
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();

      // Extract a clean, precise address
      const address = data.display_name;
      const shortAddress = address.split(",").slice(0, 4).join(",").trim(); // Get first few parts for cleaner display

      document.getElementById("userLocation").innerHTML = `
                <span style="font-size: 0.9rem; opacity: 0.8; display: block; margin-bottom: 5px;">Detected Address:</span>
                <span style="font-weight: bold; font-size: 1.1rem; line-height: 1.4; display: block;">${address}</span>
            `;

      // Call the async getSunriseSunset function
      await getSunriseSunset(latitude, longitude);
    } else {
      // Fallback to original BigDataCloud service if Nominatim fails
      const bdcResponse = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      if (bdcResponse.ok) {
        const bdcData = await bdcResponse.json();
        const location = `${
          bdcData.city || bdcData.locality || "Unknown City"
        }, ${bdcData.principalSubdivision || "Unknown State"}, ${
          bdcData.countryName || "Unknown Country"
        }`;
        document.getElementById(
          "userLocation"
        ).innerText = `Your Location: ${location}`;
        await getSunriseSunset(latitude, longitude);
      } else {
        throw new Error("All geocoding services failed");
      }
    }
  } catch (error) {
    // Fall back to coordinates display
    document.getElementById(
      "userLocation"
    ).innerText = `Your Location: ${latitude.toFixed(6)}, ${longitude.toFixed(
      6
    )}`;
    await getSunriseSunset(latitude, longitude);
  }

  // Hide loading spinner
  const loadingSpinner = document.querySelector(".loading-spinner");
  if (loadingSpinner) {
    loadingSpinner.style.display = "none";
  }
}

async function reverseGeocodeApproximate(latitude, longitude) {
  try {
    // Use the same reverse geocoding service but mark as approximate
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );

    if (response.ok) {
      const data = await response.json();
      const location = `${data.city || data.locality || "Unknown City"}, ${
        data.principalSubdivision || "Unknown State"
      }, ${data.countryName || "Unknown Country"}`;

      document.getElementById(
        "userLocation"
      ).innerText = `Your Location: ${location} (approximate)`;

      // Call the async getSunriseSunset function with approximate coordinates
      await getSunriseSunset(latitude, longitude);
    } else {
      // Fall back to coordinates display
      document.getElementById(
        "userLocation"
      ).innerText = `Your Location: ${latitude.toFixed(2)}, ${longitude.toFixed(
        2
      )} (approximate)`;
      await getSunriseSunset(latitude, longitude);
    }
  } catch (error) {
    // Fall back to coordinates display but continue with sunrise/sunset
    document.getElementById(
      "userLocation"
    ).innerText = `Your Location: ${latitude.toFixed(2)}, ${longitude.toFixed(
      2
    )} (approximate)`;
    await getSunriseSunset(latitude, longitude);
  }

  // Hide loading spinner
  const loadingSpinner = document.querySelector(".loading-spinner");
  if (loadingSpinner) {
    loadingSpinner.style.display = "none";
  }
}

async function getApproximateLocation() {
  try {
    // Try multiple IP geolocation services to get coordinates only
    const services = [
      "https://ipapi.co/json/",
      "https://geolocation-db.com/json/",
      "https://freeipapi.com/api/json",
      "https://ipgeolocation.abstractapi.com/v1/?api_key=",
      "https://ipwho.is/",
    ];

    let coordinates = null;

    for (const service of services) {
      try {
        const response = await fetch(service);

        if (response.ok) {
          const data = await response.json();

          // Extract only coordinates from different API response formats
          if (data.latitude && data.longitude) {
            // ipapi.co, geolocation-db.com, ipwho.is format
            coordinates = {
              lat: parseFloat(data.latitude),
              lng: parseFloat(data.longitude),
            };
            break;
          } else if (data.lat && data.lon) {
            // Alternative lat/lon format
            coordinates = {
              lat: parseFloat(data.lat),
              lng: parseFloat(data.lon),
            };
            break;
          }
        }
      } catch (serviceError) {
        continue; // Try next service
      }
    }

    if (coordinates) {
      // Update location text to show we're identifying the place
      document.getElementById(
        "userLocation"
      ).innerText = `Identifying location... (${coordinates.lat.toFixed(
        2
      )}, ${coordinates.lng.toFixed(2)})`;

      // Use the same reverse geocoding function to identify the place
      await reverseGeocodeApproximate(coordinates.lat, coordinates.lng);
    } else {
      throw new Error(
        "All IP geolocation services failed to provide coordinates"
      );
    }
  } catch (error) {
    console.error("IP geolocation failed:", error);
    // No fallback coordinates - require user to enable location
    document.getElementById(
      "userLocation"
    ).innerText = `Unable to detect location. Please refresh and allow location access for Agnihotra times.`;

    // Add a note about enabling location
    const upcomingElement = document.getElementById("upcomingTimes");
    if (upcomingElement) {
      upcomingElement.innerHTML =
        "<li>Location access required for accurate Agnihotra timing</li>";
    }

    // Hide loading spinner
    const loadingSpinner = document.querySelector(".loading-spinner");
    if (loadingSpinner) {
      loadingSpinner.style.display = "none";
    }
  }
}

async function showError(error) {
  document.getElementById(
    "userLocation"
  ).innerText = `Getting approximate location...`;

  // Try to get approximate location using IP-based geolocation
  await getApproximateLocation();
}

      // Offline status monitoring
  function updateOnlineStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      if (navigator.onLine) {
        indicator.style.display = 'none';
        document.body.classList.remove('is-offline');
      } else {
        indicator.style.display = 'block';
        document.body.classList.add('is-offline');
      }
    }
  }

window.onload = () => {
  getLocation();
  updateOnlineStatus();
};

// Register Service Worker immediately for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('Service Worker registered', reg))
    .catch(err => console.error('Service Worker registration failed', err));
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

document.addEventListener("DOMContentLoaded", function () {
  const fadeElements = document.querySelectorAll(".fade-in");

  function checkScroll() {
    fadeElements.forEach((element) => {
      const elementTop = element.getBoundingClientRect().top;

      if (elementTop < window.innerHeight - 50) {
        element.classList.add("active");
      }
    });
  }

  window.addEventListener("scroll", checkScroll);
  checkScroll();
});
