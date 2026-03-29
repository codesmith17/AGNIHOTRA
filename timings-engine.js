(() => {
  const ASTRONOMICAL_CONSTANTS = {
    JULIAN_DAY_AT_UNIX_EPOCH: 2440587.5,
    JULIAN_DAY_AT_J2000: 2451545.0,
    DAYS_PER_JULIAN_CENTURY: 36525,
    MILLISECONDS_PER_DAY: 86400000,
    MILLISECONDS_PER_HOUR: 3600000,
    SUN_MEAN_LONGITUDE_J2000: 280.46646,
    SUN_MEAN_LONGITUDE_COEFF_1: 36000.76983,
    SUN_MEAN_LONGITUDE_COEFF_2: 0.0003032,
    SUN_MEAN_ANOMALY_J2000: 357.52911,
    SUN_MEAN_ANOMALY_COEFF_1: 35999.05029,
    SUN_MEAN_ANOMALY_COEFF_2: 0.0001537,
    EARTH_ORBIT_ECCENTRICITY_J2000: 0.016708634,
    EARTH_ORBIT_ECCENTRICITY_COEFF_1: 0.000042037,
    EARTH_ORBIT_ECCENTRICITY_COEFF_2: 0.0000001267,
    SUN_EQ_CENTER_COEFF_1: 1.914602,
    SUN_EQ_CENTER_COEFF_2: 0.004817,
    SUN_EQ_CENTER_COEFF_3: 0.000014,
    SUN_EQ_CENTER_COEFF_4: 0.019993,
    SUN_EQ_CENTER_COEFF_5: 0.000101,
    SUN_EQ_CENTER_COEFF_6: 0.000289,
    MOON_ASCENDING_NODE_J2000: 125.04,
    MOON_ASCENDING_NODE_COEFF_1: 1934.136,
    SUN_APPARENT_LONGITUDE_CONST_1: 0.00569,
    SUN_APPARENT_LONGITUDE_CONST_2: 0.00478,
    MEAN_OBLIQUITY_J2000_BASE: 23,
    MEAN_OBLIQUITY_J2000_MIN: 26,
    MEAN_OBLIQUITY_COEFF_1: 21.448,
    MEAN_OBLIQUITY_COEFF_2: 46.815,
    MEAN_OBLIQUITY_COEFF_3: 0.00059,
    MEAN_OBLIQUITY_COEFF_4: 0.001813,
    NUTATION_OBLIQUITY_COEFF: 0.00256
  };

  function formatDateToDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function formatHoursToHMS(h) {
    if (h === null) return "--:--:--";
    let sec = Math.round(h * 3600);
    sec = (sec + 86400) % 86400;
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function calculateAgnihotraTiming(dateUTC, lat, lon, tzHours) {
    const degreesToRadians = Math.PI / 180;
    const radiansToDegrees = 180 / Math.PI;

    function getSunDetails(timestampUTC) {
      const julianDay =
        timestampUTC / ASTRONOMICAL_CONSTANTS.MILLISECONDS_PER_DAY +
        ASTRONOMICAL_CONSTANTS.JULIAN_DAY_AT_UNIX_EPOCH;
      const julianCentury =
        (julianDay - ASTRONOMICAL_CONSTANTS.JULIAN_DAY_AT_J2000) /
        ASTRONOMICAL_CONSTANTS.DAYS_PER_JULIAN_CENTURY;

      let sunGeometricMeanLongitude =
        ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_J2000 +
        julianCentury *
          (ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_COEFF_1 +
            ASTRONOMICAL_CONSTANTS.SUN_MEAN_LONGITUDE_COEFF_2 * julianCentury);
      sunGeometricMeanLongitude = ((sunGeometricMeanLongitude % 360) + 360) % 360;

      const sunMeanAnomaly =
        ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_J2000 +
        julianCentury *
          (ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_COEFF_1 -
            ASTRONOMICAL_CONSTANTS.SUN_MEAN_ANOMALY_COEFF_2 * julianCentury);

      const earthOrbitEccentricity =
        ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_J2000 -
        julianCentury *
          (ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_COEFF_1 +
            ASTRONOMICAL_CONSTANTS.EARTH_ORBIT_ECCENTRICITY_COEFF_2 * julianCentury);

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

      const sunTrueLongitude = sunGeometricMeanLongitude + sunEquationOfCenter;
      const moonAscendingNodeLongitude =
        ASTRONOMICAL_CONSTANTS.MOON_ASCENDING_NODE_J2000 -
        ASTRONOMICAL_CONSTANTS.MOON_ASCENDING_NODE_COEFF_1 * julianCentury;

      const sunApparentLongitude =
        sunTrueLongitude -
        ASTRONOMICAL_CONSTANTS.SUN_APPARENT_LONGITUDE_CONST_1 -
        ASTRONOMICAL_CONSTANTS.SUN_APPARENT_LONGITUDE_CONST_2 *
          Math.sin(degreesToRadians * moonAscendingNodeLongitude);

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

      const correctedObliquityOfEcliptic =
        meanObliquityOfEcliptic +
        ASTRONOMICAL_CONSTANTS.NUTATION_OBLIQUITY_COEFF *
          Math.cos(degreesToRadians * moonAscendingNodeLongitude);

      const sunApparentDeclination = Math.asin(
        Math.sin(degreesToRadians * correctedObliquityOfEcliptic) *
          Math.sin(degreesToRadians * sunApparentLongitude)
      );

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

    const initialSunDetails = getSunDetails(dateUTC.getTime());
    const cosineOfHourAngle =
      -Math.tan(lat * degreesToRadians) *
      Math.tan(initialSunDetails.sunApparentDeclination);
    if (cosineOfHourAngle < -1 || cosineOfHourAngle > 1) return null;

    const hourAngle = Math.acos(cosineOfHourAngle) * radiansToDegrees;
    const solarNoonAtNoonDetails =
      12 + tzHours - lon / 15 - initialSunDetails.equationOfTime / 60;

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

  function calculateDayTiming(date, lat, lng, tzOffsetHours) {
    const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const timings = calculateAgnihotraTiming(dateUTC, lat, lng, tzOffsetHours);
    if (!timings) return null;
    const dateStr = formatDateToDDMMYYYY(date);
    return {
      date: dateStr,
      sunrise: formatHoursToHMS(timings.sunrise),
      sunset: formatHoursToHMS(timings.sunset)
    };
  }

  async function generateRangeTimings(lat, lng, days = 92, startDate = new Date()) {
    const result = {};
    const tzOffsetHours = -(new Date().getTimezoneOffset() / 60);
    const chunkSize = 10;

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dayTiming = calculateDayTiming(currentDate, lat, lng, tzOffsetHours);
      if (dayTiming) {
        result[dayTiming.date] = dayTiming;
      }

      if (i > 0 && i % chunkSize === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return result;
  }

  window.AgnihotraTimingEngine = {
    calculateDayTiming,
    generateRangeTimings
  };
})();
